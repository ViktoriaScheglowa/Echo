from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from app.services.connection_manager import manager
import json

app = FastAPI(title="Sentinels API", version="0.1.0")

# ВАЖНО: Разрешаем фронтенду (порт 3000) стучаться к бэкенду (порт 8000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Простой эндпоинт для проверки в браузере
@app.get("/")
async def root():
    return {"status": "online", "message": "Sentinels Security System Active"}


# WebSocket для чата
@app.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            # message_data = json.loads(data)
            # encrypted_content = message_data.get('content')

            # Раньше было: await websocket.send_text(...)
            # Теперь: отправляем ВСЕМ подключенным
            await manager.broadcast(data)

    except WebSocketDisconnect:
        manager.disconnect(websocket)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
