"use client";
import CryptoJS from 'crypto-js';
import { useEffect, useState, useRef } from 'react';

export default function SentinelsChat() {
    // --- СОСТОЯНИЯ (STATES) ---
    const [messages, setMessages] = useState<{sender: string, text: string}[]>([]);
    const [input, setInput] = useState('');
    const [status, setStatus] = useState('Connecting...');

    const [isMounted, setIsMounted] = useState(false);
    const [myId, setMyId] = useState("");
    const [isEditingId, setIsEditingId] = useState(false);
    const [tempId, setTempId] = useState("");

    const socketRef = useRef<WebSocket | null>(null);
    const SECRET_KEY = "sentinels-alpha-key";

    // --- ЭФФЕКТ №1: Загрузка данных при старте ---
    useEffect(() => {
        setIsMounted(true);

        // 1. Загружаем или создаем ID
        const savedId = localStorage.getItem('sentinel_id');
        if (savedId) {
            setMyId(savedId);
            setTempId(savedId);
        } else {
            const newId = "Agent_" + Math.floor(Math.random() * 1000);
            localStorage.setItem('sentinel_id', newId);
            setMyId(newId);
            setTempId(newId);
        }

        // 2. Загружаем историю сообщений из памяти
        const savedHistory = localStorage.getItem('sentinel_messages');
        if (savedHistory) {
            try {
                setMessages(JSON.parse(savedHistory));
            } catch (e) {
                console.error("Failed to load history", e);
            }
        }
    }, []);

    // --- ЭФФЕКТ №2: Авто-сохранение сообщений при каждом изменении ---
    useEffect(() => {
        if (isMounted && messages.length > 0) {
            localStorage.setItem('sentinel_messages', JSON.stringify(messages));
        }
    }, [messages, isMounted]);

    // --- ЭФФЕКТ №3: WebSocket соединение ---
    useEffect(() => {
        if (!isMounted || !myId) return;

        const socket = new WebSocket(`ws://localhost:8000/ws/${myId}`);
        socketRef.current = socket;

        socket.onopen = () => setStatus('🛡️ SECURE CONNECTION ESTABLISHED');

        socket.onmessage = (event) => {
            try {
                const packet = JSON.parse(event.data);
                const bytes = CryptoJS.AES.decrypt(packet.content, SECRET_KEY);
                const decryptedText = bytes.toString(CryptoJS.enc.Utf8);

                if (decryptedText) {
                    setMessages(prev => [...prev, {
                        sender: packet.senderId === myId ? 'You' : packet.senderId,
                        text: decryptedText
                    }]);
                }
            } catch (e) {
                console.error("❌ Decryption error:", e);
            }
        };

        socket.onclose = () => setStatus('❌ DISCONNECTED');
        socket.onerror = () => setStatus('❌ CONNECTION ERROR');

        return () => {
            if (socket.readyState === 1) socket.close();
        };
    }, [isMounted, myId]);

    // --- ФУНКЦИИ ---
    const saveNewId = () => {
        if (tempId.trim()) {
            localStorage.setItem('sentinel_id', tempId);
            setMyId(tempId);
            setIsEditingId(false);
            window.location.reload();
        }
    };

    const clearHistory = () => {
        if (confirm("Вы уверены, что хотите уничтожить все логи переписки?")) {
            localStorage.removeItem('sentinel_messages');
            setMessages([]);
        }
    };

    const sendMessage = (e: React.FormEvent) => {
        e.preventDefault();
        if (input && socketRef.current?.readyState === WebSocket.OPEN) {
            const encrypted = CryptoJS.AES.encrypt(input, SECRET_KEY).toString();
            const messagePacket = { senderId: myId, content: encrypted };
            socketRef.current.send(JSON.stringify(messagePacket));
            setInput('');
        }
    };

    if (!isMounted) return <div className="bg-black h-screen" />;

    return (
        <div className="flex flex-col h-screen bg-black text-white font-mono uppercase tracking-widest">
            <header className="p-6 border-b border-zinc-800 flex justify-between items-center bg-zinc-950">
                <div className="flex flex-col">
                    <h1 className="text-2xl font-black italic text-blue-500">SENTINELS v0.1.0</h1>
                    <button
                        onClick={clearHistory}
                        className="text-[9px] mt-1 text-red-500 hover:text-red-400 text-left w-fit transition-all"
                    >
                        [ PURGE LOGS ]
                    </button>
                </div>

                <div className="flex flex-col items-end gap-2">
                    <span className="text-[10px] border border-blue-500 px-3 py-1 text-blue-400 animate-pulse">
                        {status}
                    </span>

                    {isEditingId ? (
                        <div className="flex gap-2">
                            <input
                                className="bg-zinc-800 text-xs p-1 border border-blue-500 outline-none text-white w-32"
                                value={tempId}
                                onChange={(e) => setTempId(e.target.value)}
                                autoFocus
                            />
                            <button onClick={saveNewId} className="text-[10px] text-green-500 font-bold">[SAVE]</button>
                        </div>
                    ) : (
                        <span
                            onClick={() => setIsEditingId(true)}
                            className="text-[10px] text-zinc-500 cursor-pointer hover:text-white transition-colors"
                        >
                            ID: {myId || "Initializing..."} (click to edit)
                        </span>
                    )}
                </div>
            </header>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-zinc-900 to-black">
                {messages.length === 0 && (
                    <p className="text-center text-zinc-700 text-xs mt-10">--- NO LOGS FOUND IN LOCAL STORAGE ---</p>
                )}
                {messages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.sender === 'You' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[75%] p-4 border ${msg.sender === 'You' ? 'border-blue-600 bg-blue-900/20 shadow-[0_0_15px_rgba(37,99,235,0.1)]' : 'border-zinc-700 bg-zinc-800/40'}`}>
                            <p className="text-xs mb-1 opacity-50">[{msg.sender}]</p>
                            <p className="text-sm leading-relaxed lowercase first-letter:uppercase">{msg.text}</p>
                        </div>
                    </div>
                ))}
            </div>

            <form onSubmit={sendMessage} className="p-6 bg-black border-t border-zinc-800 flex gap-4 shadow-[0_-10px_30px_rgba(0,0,0,0.5)]">
                <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    className="flex-1 bg-zinc-900 border border-zinc-700 p-4 outline-none focus:border-blue-500 transition-all text-blue-400"
                    placeholder=">> ENTER ENCRYPTED MESSAGE..."
                />
                <button type="submit" className="bg-blue-600 px-8 py-4 font-black hover:bg-blue-500 hover:shadow-[0_0_20px_rgba(37,99,235,0.5)] transition-all active:scale-95">
                    TRANSMIT
                </button>
            </form>
        </div>
    );
}
