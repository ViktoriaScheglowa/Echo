from fastapi import WebSocket
from typing import Dict, List
import json

class ConnectionManager:
    """Управляет активными WebSocket-соединениями."""
    def __init__(self):
        # active_connections[user_id] = WebSocket
        self.active_connections: Dict[str, WebSocket] = {}

    async def connect(self, user_id: str, websocket: WebSocket):
        await websocket.accept()
        self.active_connections[user_id] = websocket

    def disconnect(self, user_id: str):
        if user_id in self.active_connections:
            del self.active_connections[user_id]

    async def send_secure_message(self, message: dict, recipient_id: str):
        """Отправка зашифрованного пакета конкретному пользователю."""
        if recipient_id in self.active_connections:
            ws = self.active_connections[recipient_id]
            # Сообщение уже зашифровано отправителем (E2EE)
            await ws.send_text(json.dumps(message))

manager = ConnectionManager()
