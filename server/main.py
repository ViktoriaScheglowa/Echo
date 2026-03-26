from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
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
    await websocket.accept()
    print(f"User {user_id} connected")
    try:
        while True:
            # Ожидаем данные от клиента
            data = await websocket.receive_text()
            message_data = json.loads(data)

            # Логика: просто отправляем сообщение обратно (Echo)
            # В реальном приложении здесь будет маршрутизация получателю
            await websocket.send_text(f"Message received: {message_data.get('content')}")
    except WebSocketDisconnect:
        print(f"User {user_id} disconnected")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
