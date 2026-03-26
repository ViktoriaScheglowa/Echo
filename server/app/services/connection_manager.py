from fastapi import WebSocket
from typing import Dict

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}

    async def connect(self, user_id: str, websocket: WebSocket):
        await websocket.accept()
        self.active_connections[user_id] = websocket

    def disconnect(self, user_id: str):
        if user_id in self.active_connections:
            del self.active_connections[user_id]

    async def forward_message(self, payload: dict):
        recipient_id = payload.get("recipient_id")
        if recipient_id in self.active_connections:
            await self.active_connections[recipient_id].send_json(payload)

manager = ConnectionManager()
