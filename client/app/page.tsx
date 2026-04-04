"use client";
import CryptoJS from 'crypto-js';
import { useEffect, useState, useRef } from 'react';

export default function SentinelsChat() {
    const [recipientId, setRecipientId] = useState('');
    const [messages, setMessages] = useState<{sender: string, text: string}[]>([]);
    const [input, setInput] = useState('');
    const [status, setStatus] = useState('Connecting...');

    const [isMounted, setIsMounted] = useState(false);
    const [myId, setMyId] = useState("");
    const [isEditingId, setIsEditingId] = useState(false);
    const [tempId, setTempId] = useState("");

    const socketRef = useRef<WebSocket | null>(null);
    const SECRET_KEY = "sentinels-alpha-key";

    // --- УВЕДОМЛЕНИЯ ---
    const requestNotificationPermission = async () => {
        if ("Notification" in window) {
            const permission = await Notification.requestPermission();
            if (permission === "granted") alert("SYSTEM: Notifications Enabled");
        }
    };

    useEffect(() => {
        setIsMounted(true);
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

        const savedHistory = localStorage.getItem('sentinel_messages');
        if (savedHistory) {
            try { setMessages(JSON.parse(savedHistory)); } catch (e) { console.error(e); }
        }
    }, []);

    useEffect(() => {
        if (isMounted && messages.length > 0) {
            localStorage.setItem('sentinel_messages', JSON.stringify(messages));
        }
    }, [messages, isMounted]);

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
                    const isMe = packet.senderId === myId;

                    // Уведомление, если вкладка скрыта
                    if (!isMe && document.visibilityState !== 'visible') {
                        new Notification(`SENTINEL: ${packet.senderId}`, {
                            body: decryptedText,
                        });
                    }

                    setMessages(prev => [...prev, {
                        sender: isMe ? 'You' : packet.senderId,
                        text: decryptedText
                    }]);
                }
            } catch (e) { console.error("❌ Decryption error", e); }
        };

        socket.onclose = () => setStatus('❌ DISCONNECTED');
        return () => { if (socket.readyState === 1) socket.close(); };
    }, [isMounted, myId]);

    const saveNewId = () => {
        localStorage.setItem('sentinel_id', tempId);
        window.location.reload();
    };

    const clearHistory = () => {
        if (confirm("Уничтожить логи?")) {
            localStorage.removeItem('sentinel_messages');
            setMessages([]);
        }
    };

    const sendMessage = (e: React.FormEvent) => {
        e.preventDefault();
        // Проверяем, что recipientId существует перед вызовом методов
        const target = recipientId ? recipientId.trim().toLowerCase() : "";
        if (input && recipientId && socketRef.current?.readyState === WebSocket.OPEN) {
            const encrypted = CryptoJS.AES.encrypt(input, SECRET_KEY).toString();
            const messagePacket = {
                senderId: myId.toLowerCase(), // Свой ID тоже в нижний регистр
                recipientId: target,
                content: encrypted
            };
            socketRef.current.send(JSON.stringify(messagePacket));
            setMessages(prev => [...prev, { sender: 'You', text: input }]);
            setInput('');
        }else if (!target) {
            alert("КТО ПОЛУЧАТЕЛЬ? Введите Target ID.");
        }
    };

    if (!isMounted) return <div className="bg-black h-screen" />;

    return (
        <div className="flex flex-col h-screen bg-black text-white font-mono uppercase tracking-widest">
            <header className="p-6 border-b border-zinc-800 flex justify-between items-center bg-zinc-950">
                <div className="flex flex-col">
                    <h1 className="text-2xl font-black italic text-blue-500">SENTINELS v0.1.0</h1>
                    <div className="flex gap-4 mt-1">
                        <button onClick={clearHistory} className="text-[9px] text-red-500 hover:text-red-400">[ PURGE LOGS ]</button>
                        <button onClick={requestNotificationPermission} className="text-[9px] text-blue-400 hover:text-blue-300">[ ENABLE ALERTS ]</button>
                    </div>
                </div>

                <div className="flex flex-col items-end gap-2">
                    <span className="text-[10px] border border-blue-500 px-3 py-1 text-blue-400 animate-pulse">{status}</span>
                    {isEditingId ? (
                        <div className="flex gap-2">
                            <input className="bg-zinc-800 text-xs p-1 border border-blue-500 outline-none w-32" value={tempId} onChange={(e) => setTempId(e.target.value)} autoFocus />
                            <button onClick={saveNewId} className="text-[10px] text-green-500 font-bold">[SAVE]</button>
                        </div>
                    ) : (
                        <span onClick={() => setIsEditingId(true)} className="text-[10px] text-zinc-500 cursor-pointer hover:text-white">ID: {myId} (EDIT)</span>
                    )}
                </div>
            </header>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-black">
                {messages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.sender === 'You' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[75%] p-4 border ${msg.sender === 'You' ? 'border-blue-600 bg-blue-900/10' : 'border-zinc-700 bg-zinc-800/40'}`}>
                            <p className="text-[10px] mb-1 opacity-50">[{msg.sender}]</p>
                            <p className="text-sm normal-case">{msg.text}</p>
                        </div>
                    </div>
                ))}
            </div>

            <form onSubmit={sendMessage} className="p-6 bg-zinc-950 border-t border-zinc-800 flex flex-col gap-4">
                <div className="flex items-center gap-2">
                    <span className="text-[10px] text-blue-500">TARGET_ID:</span>
                    <input value={recipientId} onChange={(e) => setRecipientId(e.target.value)} className="bg-zinc-900 border border-zinc-800 px-3 py-1 text-xs outline-none focus:border-blue-500 w-48" placeholder="Agent Name..." />
                </div>
                <div className="flex gap-4">
                    <input value={input} onChange={(e) => setInput(e.target.value)} className="flex-1 bg-zinc-900 border border-zinc-700 p-4 outline-none focus:border-blue-500 text-blue-400" placeholder=">> ENTER ENCRYPTED MESSAGE..." />
                    <button type="submit" className="bg-blue-600 px-8 py-4 font-black hover:bg-blue-500 transition-all">TRANSMIT</button>
                </div>
            </form>
        </div>
    );
}
