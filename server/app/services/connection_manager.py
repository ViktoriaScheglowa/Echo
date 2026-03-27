from fastapi import WebSocket
from typing import Dict


class ConnectionManager:
    def __init__(self):
        # Храним активные соединения в списке
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    # ЭТОТ МЕТОД РАССЫЛАЕТ ВСЕМ!
    async def broadcast(self, message: str):
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except Exception:
                # Если кто-то отвалился, просто пропускаем
                pass


manager = ConnectionManager()
