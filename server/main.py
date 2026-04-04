from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from urllib.parse import unquote
import json

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Хранилища
active_connections: dict[str, WebSocket] = {}
offline_messages: dict[str, list[str]] = {}


# Функция уведомления всех о списке онлайн-пользователей
async def broadcast_active_users():
    # Собираем список всех имен, кто сейчас в словаре
    users = list(active_connections.keys())
    payload = json.dumps({"type": "USER_LIST", "users": users})

    # Создаем копию словаря, чтобы не было ошибки "dictionary changed size during iteration"
    current_sockets = list(active_connections.values())

    for websocket in current_sockets:
        try:
            await websocket.send_text(payload)
        except Exception as e:
            print(f"Ошибка рассылки: {e}")


@app.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str):
    # ДЕКОДИРОВАНИЕ КИРИЛЛИЦЫ - КРИТИЧНО!
    user_id = unquote(user_id).lower()

    await websocket.accept()
    active_connections[user_id] = websocket

    # Принудительная пауза в полсекунды помогает сокету "проснуться"
    import asyncio
    await asyncio.sleep(0.5)

    await broadcast_active_users()
    print(f"📡 Агент {user_id} зашел. В сети: {list(active_connections.keys())}")

    # Отдача офлайн сообщений
    if user_id in offline_messages:
        for msg in offline_messages[user_id]:
            await websocket.send_text(msg)
        del offline_messages[user_id]

    try:
        while True:
            data = await websocket.receive_text()
            message_data = json.loads(data)

            # Игнорируем технические пакеты, обрабатываем только сообщения
            if "recipientId" in message_data:
                target_id = message_data["recipientId"].lower()
                if target_id in active_connections:
                    await active_connections[target_id].send_text(data)
                else:
                    if target_id not in offline_messages:
                        offline_messages[target_id] = []
                    offline_messages[target_id].append(data)
    except WebSocketDisconnect:
        if user_id in active_connections:
            del active_connections[user_id]
        await broadcast_active_users()
        print(f"❌ Агент {user_id} покинул сеть")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
