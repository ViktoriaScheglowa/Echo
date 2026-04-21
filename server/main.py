import json
import uuid
import asyncpg
import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from typing import Dict

app = FastAPI()

# НАСТРОЙКИ ПОДКЛЮЧЕНИЯ (замените на свои данные)
DATABASE_URL = "postgresql://postgres:15111983@localhost/messenger"

# Глобальная переменная для пула соединений
db_pool = None


async def init_db():
    global db_pool
    # Создаем пул соединений
    db_pool = await asyncpg.create_pool(DATABASE_URL)

    async with db_pool.acquire() as conn:
        # Создаем таблицу пользователей
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                user_id TEXT PRIMARY KEY
            );
        """)
        # Создаем таблицу сообщений
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS messages (
                id UUID PRIMARY KEY,
                sender_id TEXT NOT NULL,
                recipient_id TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)


@app.on_event("startup")
async def startup():
    await init_db()


@app.on_event("shutdown")
async def shutdown():
    await db_pool.close()


class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}

    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        self.active_connections[user_id] = websocket

        async with db_pool.acquire() as conn:
            # Регистрируем пользователя
            await conn.execute("INSERT INTO users (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING", user_id)

            # Загружаем историю (используем $1, $2 для защиты от SQL-инъекций)
            rows = await conn.fetch(
                "SELECT id, sender_id, recipient_id, content FROM messages WHERE sender_id = $1 OR recipient_id = $1 ORDER BY created_at ASC",
                user_id
            )
            for row in rows:
                await websocket.send_json({
                    "id": str(row['id']),
                    "senderId": row['sender_id'],
                    "recipientId": row['recipient_id'],
                    "content": row['content']
                })

        await self.update_user_list()

    def disconnect(self, user_id: str):
        if user_id in self.active_connections:
            del self.active_connections[user_id]

    async def update_user_list(self):
        online = list(self.active_connections.keys())

        async with db_pool.acquire() as conn:
            rows = await conn.fetch("SELECT user_id FROM users")
            all_users = [row['user_id'] for row in rows]

        payload = {"type": "USER_LIST", "online": online, "all": all_users}
        for connection in self.active_connections.values():
            await connection.send_json(payload)

    async def send_personal_message(self, message: dict, recipient_id: str):
        if recipient_id in self.active_connections:
            await self.active_connections[recipient_id].send_json(message)


manager = ConnectionManager()


@app.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str):
    user_id = user_id.lower()
    await manager.connect(websocket, user_id)
    try:
        while True:
            data = await websocket.receive_text()
            packet = json.loads(data)

            msg_id = uuid.uuid4()
            packet["id"] = str(msg_id)

            # Сохраняем в PostgreSQL
            async with db_pool.acquire() as conn:
                await conn.execute(
                    "INSERT INTO messages (id, sender_id, recipient_id, content) VALUES ($1, $2, $3, $4)",
                    msg_id, packet['senderId'], packet['recipientId'], packet['content']
                )

            await manager.send_personal_message(packet, packet['recipientId'].lower())
            await manager.send_personal_message(packet, packet['senderId'].lower())

    except WebSocketDisconnect:
        manager.disconnect(user_id)
        await manager.update_user_list()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
