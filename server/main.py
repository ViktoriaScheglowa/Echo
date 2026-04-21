import json
import uuid
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from typing import List, Dict, Set

app = FastAPI()

# Глобальная история и список пользователей
message_history: List[Dict[str, str]] = []
registered_users: Set[str] = set()


class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}

    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        self.active_connections[user_id] = websocket
        registered_users.add(user_id)
        await self.update_user_list()

        # Отправляем историю (где пользователь был отправителем или получателем)
        user_history = [
            msg for msg in message_history
            if msg['recipientId'] == user_id or msg['senderId'] == user_id
        ]
        for msg in user_history:
            await websocket.send_json(msg)

    def disconnect(self, user_id: str):
        if user_id in self.active_connections:
            del self.active_connections[user_id]

    async def update_user_list(self):
        online = list(self.active_connections.keys())
        all_users = list(registered_users)
        payload = {
            "type": "USER_LIST",
            "online": online,
            "all": all_users
        }
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

            # Присваиваем сообщению уникальный ID
            packet["id"] = str(uuid.uuid4())
            message_history.append(packet)

            # Лимит истории
            if len(message_history) > 500:
                message_history.pop(0)

            # Отправляем обоим участникам диалога
            await manager.send_personal_message(packet, packet['recipientId'].lower())
            await manager.send_personal_message(packet, packet['senderId'].lower())

    except WebSocketDisconnect:
        manager.disconnect(user_id)
        await manager.update_user_list()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
