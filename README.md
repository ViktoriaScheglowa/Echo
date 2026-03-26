# 🛡️ Sentinels: Secure E2EE Messenger

**Sentinels** — это защищенный мессенджер с открытым исходным кодом, ориентированный на приватность, обход блокировок и устойчивость к внешним атакам.

## 🚀 Основные фичи

* **End-to-End Encryption (E2EE):** Шифрование на базе Web Crypto API (AES-GCM 256). Сервер никогда не видит текст сообщений.
* **Zero-Knowledge Auth:** Мы не храним пароли. Авторизация происходит через криптографические подписи.
* **PWA Support:** Приложение можно установить на телефон в обход AppStore/Google Play.
* **Anti-DPI / Anti-Blocking:** Использование WebRTC для P2P соединений и динамическое проксирование запросов.
* **Sandbox Isolation:** Все вложения открываются в изолированных `iframe` для защиты от JS-инъекций и вирусов.

## 🛠 Технологический стек

- **Frontend:** Next.js 14, TypeScript, TailwindCSS, Zustand.
- **Backend:** Python 3.10+, FastAPI, WebSockets (Pydantic v2).
- **Data:** Redis (Real-time), PostgreSQL (Metadata), IndexedDB (Local Storage).

## 📦 Быстрый старт

### 1. Предварительные требования
* Node.js v18+
* Python 3.10+
* Docker (опционально)

### 2. Настройка Backend
```bash
cd server
python -m venv venv
source venv/bin/activate  # На Windows: venv\Scripts\activate
pip install -r requirements.txt
python main.py