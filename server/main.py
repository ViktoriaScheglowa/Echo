from urllib.parse import unquote

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import json

app = FastAPI(title="Sentinels API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Хранилища
active_connections: dict[str, WebSocket] = {}
offline_messages: dict[str, list[str]] = {}  # { "user_id": ["msg1", "msg2"] }


@app.get("/")
async def root():
    return {"status": "online", "message": "Sentinels Security System Active"}


@app.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str):
    user_id = unquote(user_id).lower()  # Превращаем ID в строчные буквы
    await websocket.accept()
    active_connections[user_id] = websocket
    print(f"📡 Агент {user_id} в сети (Всего: {list(active_connections.keys())})")

    # Проверяем, есть ли офлайн-сообщения для этого пользователя
    if user_id in offline_messages:
        for msg in offline_messages[user_id]:
            await websocket.send_text(msg)
        del offline_messages[user_id]
        print(f"📦 Офлайн-пакеты доставлены для {user_id}")

    try:
        while True:
            data = await websocket.receive_text()
            message_data = json.loads(data)
            target_id = message_data.get("recipientId", "").lower() # Тоже в нижний регистр

            if target_id:
                # Если получатель в сети — шлем сразу
                if target_id in active_connections:
                    await active_connections[target_id].send_text(data)
                else:
                    # Если нет — кладем в ячейку
                    if target_id not in offline_messages:
                        offline_messages[target_id] = []
                    offline_messages[target_id].append(data)
                    print(f"📌 Сообщение для {target_id} отложено (офлайн)")

    except WebSocketDisconnect:
        if user_id in active_connections:
            del active_connections[user_id]
        print(f"❌ Агент {user_id} покинул сеть")

if __name__ == "__main__":
    import uvicorn
    # host="0.0.0.0" позволяет подключаться к серверу с других устройств в сети
    # port=8000 — стандартный порт для FastAPI
    uvicorn.run(app, host="0.0.0.0", port=8000)
