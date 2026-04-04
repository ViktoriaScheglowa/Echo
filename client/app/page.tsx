"use client";
import CryptoJS from 'crypto-js';
import { useEffect, useState, useRef } from 'react';

type ChatStorage = { [key: string]: { sender: string, text: string }[] };

export default function SentinelsMessenger() {
    const [chats, setChats] = useState<ChatStorage>({});
    const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
    const [activeChat, setActiveChat] = useState<string | null>(null);
    const [input, setInput] = useState('');
    const [status, setStatus] = useState('Connecting...');
    const [myId, setMyId] = useState("");
    const [isMounted, setIsMounted] = useState(false);

    const socketRef = useRef<WebSocket | null>(null);
    const SECRET_KEY = "sentinels-alpha-key";

    useEffect(() => {
        setIsMounted(true);
        const savedId = localStorage.getItem('sentinel_id') || "Agent_" + Math.floor(Math.random() * 1000);
        localStorage.setItem('sentinel_id', savedId);
        setMyId(savedId);

        const savedChats = localStorage.getItem('sentinel_chats');
        if (savedChats) {
            try { setChats(JSON.parse(savedChats)); } catch(e) { console.error(e); }
        }
    }, []);

    useEffect(() => {
        if (isMounted) localStorage.setItem('sentinel_chats', JSON.stringify(chats));
    }, [chats, isMounted]);

    useEffect(() => {
        if (!isMounted || !myId) return;

        const socket = new WebSocket(`ws://localhost:8000/ws/${encodeURIComponent(myId)}`);
        socketRef.current = socket;

        socket.onmessage = (event) => {
            try {
                const packet = JSON.parse(event.data);

                // Служебный пакет: список пользователей
                if (packet.type === "USER_LIST") {
                    setOnlineUsers(packet.users.filter((id: string) => id !== myId.toLowerCase()));
                    return;
                }

                // Пакет с сообщением
                const bytes = CryptoJS.AES.decrypt(packet.content, SECRET_KEY);
                const text = bytes.toString(CryptoJS.enc.Utf8);
                const sender = packet.senderId.toLowerCase();

                if (text) {
                    setChats(prev => ({
                        ...prev,
                        [sender]: [...(prev[sender] || []), { sender, text }]
                    }));
                }
            } catch (e) { console.error("❌ Error:", e); }
        };

        socket.onopen = () => setStatus('ONLINE');
        socket.onclose = () => setStatus('OFFLINE');
        return () => { if (socket.readyState === 1) socket.close(); };
    }, [isMounted, myId]);

    const sendMessage = (e: React.FormEvent) => {
        e.preventDefault();
        if (input && activeChat && socketRef.current?.readyState === WebSocket.OPEN) {
            const encrypted = CryptoJS.AES.encrypt(input, SECRET_KEY).toString();
            const packet = {
                senderId: myId.toLowerCase(),
                recipientId: activeChat.toLowerCase(),
                content: encrypted
            };
            socketRef.current.send(JSON.stringify(packet));
            setChats(prev => ({
                ...prev,
                [activeChat]: [...(prev[activeChat] || []), { sender: 'You', text: input }]
            }));
            setInput('');
        }
    };

    if (!isMounted) return <div className="bg-black h-screen" />;

    return (
        <div className="flex h-screen bg-black text-white font-mono uppercase tracking-tight">
            {/* SIDEBAR */}
            <div className="w-72 border-r border-zinc-800 flex flex-col bg-zinc-950">
                <div className="p-6 border-b border-zinc-800">
                    <h1 className="text-blue-500 font-black text-xl italic">SENTINELS</h1>
                    <div className="text-[9px] opacity-40 mt-1">MY_NODE: {myId}</div>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {/* СЕКЦИЯ ОНЛАЙН АГЕНТОВ */}
                    <div className="p-4 bg-blue-900/5">
                        <p className="text-[10px] text-blue-500 mb-3 tracking-[0.2em]">● ONLINE_AGENTS</p>
                        {onlineUsers.length === 0 && <p className="text-[9px] text-zinc-600">ALONE IN THE DARK...</p>}
                        {onlineUsers.map(id => (
                            <div key={id} onClick={() => {
                                if (!chats[id]) setChats(prev => ({ ...prev, [id]: [] }));
                                setActiveChat(id);
                            }} className="flex items-center gap-2 mb-2 cursor-pointer hover:bg-zinc-800 p-2 transition-all">
                                <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                                <span className="text-xs text-zinc-300">{id}</span>
                            </div>
                        ))}
                    </div>

                    {/* ИСТОРИЯ ДИАЛОГОВ */}
                    <div className="mt-4 border-t border-zinc-900 pt-4">
                        <p className="text-[10px] text-zinc-500 mb-3 px-6 tracking-[0.2em]">RECENT_SESSIONS</p>
                        {Object.keys(chats).map(chatId => (
                            <div key={chatId} onClick={() => setActiveChat(chatId)}
                                className={`p-4 cursor-pointer border-b border-zinc-900 ${activeChat === chatId ? 'bg-blue-950/30 border-l-2 border-l-blue-500' : 'hover:bg-zinc-900'}`}>
                                <p className="text-xs font-bold">{chatId}</p>
                                <p className="text-[9px] opacity-30 truncate lowercase italic">
                                    {chats[chatId].length > 0 ? chats[chatId][chats[chatId].length - 1].text : "linked"}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* CHAT WINDOW */}
            <div className="flex-1 flex flex-col bg-black">
                {activeChat ? (
                    <>
                        <header className="px-6 py-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-950">
                            <span className="text-sm text-blue-400 font-bold">SESSION: {activeChat}</span>
                            <span className="text-[10px] text-green-500">{status}</span>
                        </header>
                        <div className="flex-1 overflow-y-auto p-6 space-y-4">
                            {chats[activeChat].map((msg, i) => (
                                <div key={i} className={`flex ${msg.sender === 'You' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[80%] p-3 border ${msg.sender === 'You' ? 'border-blue-600/50 bg-blue-900/5' : 'border-zinc-800 bg-zinc-900/50'}`}>
                                        <p className="text-sm normal-case">{msg.text}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <form onSubmit={sendMessage} className="p-6 border-t border-zinc-800 bg-zinc-950 flex gap-4">
                            <input value={input} onChange={e => setInput(e.target.value)} autoFocus
                                className="flex-1 bg-zinc-900 border border-zinc-800 p-4 text-sm outline-none focus:border-blue-500 text-blue-100"
                                placeholder={`>> WRITE TO ${activeChat}...`} />
                            <button className="bg-blue-600 px-10 py-4 font-black hover:bg-blue-500 transition-all">TRANSMIT</button>
                        </form>
                    </>
                ) : (
                    <div className="flex-1 flex items-center justify-center opacity-20 text-[10px]">
                        SELECT AGENT TO START SECURE SESSION
                    </div>
                )}
            </div>
        </div>
    );
}
