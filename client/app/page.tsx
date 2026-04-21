"use client";
import CryptoJS from 'crypto-js';
import { useEffect, useState, useRef } from 'react';

type Message = { id: string; sender: string; text: string };
type ChatStorage = { [chatId: string]: Message[] };
type KeyStorage = { [chatId: string]: string };

export default function SentinelsMessenger() {
    const [myId, setMyId] = useState("");
    const [isLocked, setIsLocked] = useState(true);
    const [isMounted, setIsMounted] = useState(false);

    const [chats, setChats] = useState<ChatStorage>({});
    const [chatKeys, setChatKeys] = useState<KeyStorage>({});
    const [unreadCounts, setUnreadCounts] = useState<{ [chatId: string]: number }>({});

    const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
    const [knownUsers, setKnownUsers] = useState<string[]>([]);
    const [encryptedBuffer, setEncryptedBuffer] = useState<{ [chatId: string]: any[] }>({});

    const [activeChat, setActiveChat] = useState<string | null>(null);
    const [input, setInput] = useState('');
    const [newChatKey, setNewChatKey] = useState('');
    const socketRef = useRef<WebSocket | null>(null);

    const normalize = (id: string) => id.trim().toLowerCase();
    const getHash = (key: string) => CryptoJS.SHA256(key).toString();

    // Загрузка
    useEffect(() => {
        setIsMounted(true);
        const savedId = localStorage.getItem('sentinel_id');
        if (savedId) {
            const id = normalize(savedId);
            setMyId(id);
            const savedChats = localStorage.getItem(`chats_${id}`);
            const savedKeys = localStorage.getItem(`keys_${id}`);
            const savedContacts = localStorage.getItem(`contacts_${id}`);
            if (savedChats) setChats(JSON.parse(savedChats));
            if (savedKeys) setChatKeys(JSON.parse(savedKeys));
            if (savedContacts) setKnownUsers(JSON.parse(savedContacts));
        }
    }, []);

    // Сохранение
    useEffect(() => {
        if (isMounted && myId && !isLocked) {
            const id = normalize(myId);
            localStorage.setItem(`chats_${id}`, JSON.stringify(chats));
            localStorage.setItem(`keys_${id}`, JSON.stringify(chatKeys));
            localStorage.setItem(`contacts_${id}`, JSON.stringify(knownUsers));
        }
    }, [chats, chatKeys, knownUsers, isMounted, myId, isLocked]);

    // WebSocket
    useEffect(() => {
        if (!isMounted || !myId || isLocked) return;
        const socket = new WebSocket(`ws://localhost:8000/ws/${normalize(myId)}`);
        socketRef.current = socket;

        socket.onmessage = (event) => {
            const packet = JSON.parse(event.data);

            if (packet.type === "USER_LIST") {
                const myName = normalize(myId);
                setOnlineUsers((packet.online || []).map((u: string) => normalize(u)).filter((u: string) => u !== myName));
                setKnownUsers(prev => Array.from(new Set([...prev, ...(packet.all || []).map((u: string) => normalize(u))])).filter(u => u !== myName));
                return;
            }

            const sender = normalize(packet.senderId);
            const recipient = normalize(packet.recipientId);
            const myName = normalize(myId);
            const chatPartner = sender === myName ? recipient : sender;

            const isFromMe = sender === myName;

            // Проверяем, есть ли уже такое сообщение в истории (чтобы не считать историю за новые)
            const isDuplicate = (chats[chatPartner] || []).some(m => m.id === packet.id);
            if (isDuplicate) return;

            const key = chatKeys[chatPartner];
            if (key) {
                decryptAndAppend(chatPartner, packet, key);
                // Увеличиваем счетчик только если:
                // 1. Сообщение не от меня
                // 2. Чат сейчас не открыт
                if (!isFromMe && chatPartner !== normalize(activeChat || "")) {
                    setUnreadCounts(prev => ({ ...prev, [chatPartner]: (prev[chatPartner] || 0) + 1 }));
                }
            } else {
                // В буфер зашифрованных кладем только чужие сообщения
                if (!isFromMe) {
                    setEncryptedBuffer(prev => {
                        const currentBuf = prev[chatPartner] || [];
                        if (currentBuf.some(p => p.id === packet.id)) return prev;
                        return { ...prev, [chatPartner]: [...currentBuf, packet] };
                    });
                }
            }
        };
        return () => { if (socket.readyState === 1) socket.close(); };
    }, [isMounted, myId, isLocked, chatKeys, activeChat, chats]);

    const decryptAndAppend = (chatPartner: string, packet: any, key: string) => {
        try {
            const bytes = CryptoJS.AES.decrypt(packet.content, getHash(key));
            const text = bytes.toString(CryptoJS.enc.Utf8);
            if (text) {
                setChats(prev => {
                    const history = prev[chatPartner] || [];
                    if (history.find(m => m.id === packet.id)) return prev;
                    const displaySender = normalize(packet.senderId) === normalize(myId) ? 'you' : chatPartner;
                    return { ...prev, [chatPartner]: [...history, { id: packet.id, sender: displaySender, text }] };
                });
            }
        } catch (e) { console.error("Key mismatch"); }
    };

    const handleChatSelection = (user: string) => {
        const target = normalize(user);
        setActiveChat(target);
        // Сбрасываем все уведомления при входе в чат
        setUnreadCounts(prev => ({ ...prev, [target]: 0 }));
        setEncryptedBuffer(prev => ({ ...prev, [target]: [] }));
    };

    const activateChannel = () => {
        if (!newChatKey || !activeChat) return;
        const target = normalize(activeChat);
        setChatKeys(prev => ({ ...prev, [target]: newChatKey }));
        const buffer = encryptedBuffer[target] || [];
        buffer.forEach(packet => decryptAndAppend(target, packet, newChatKey));
        setEncryptedBuffer(prev => ({ ...prev, [target]: [] }));
        setNewChatKey('');
    };

    const sendMessage = (e: React.FormEvent) => {
        e.preventDefault();
        const target = activeChat ? normalize(activeChat) : null;
        if (!input || !target || !chatKeys[target]) return;
        const encrypted = CryptoJS.AES.encrypt(input, getHash(chatKeys[target])).toString();
        socketRef.current?.send(JSON.stringify({ senderId: normalize(myId), recipientId: target, content: encrypted }));
        setInput('');
    };

    if (!isMounted) return null;
    if (isLocked) {
        return (
            <div className="h-screen bg-black flex items-center justify-center p-6 text-white font-mono uppercase">
                <div className="max-w-sm w-full border border-zinc-800 p-8 bg-zinc-950">
                    <h2 className="text-blue-500 font-black text-2xl mb-6 text-center italic">SENTINEL_ID</h2>
                    <input className="w-full bg-zinc-900 border border-zinc-800 p-4 mb-4 outline-none text-center text-blue-400 font-bold" placeholder="NAME..." value={myId} onChange={(e) => setMyId(e.target.value)} />
                    <button onClick={() => { if(myId) setIsLocked(false); }} className="w-full bg-blue-600 py-4 font-black">CONNECT</button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-screen bg-black text-white font-mono uppercase text-[11px]">
            <div className="w-64 border-r border-zinc-800 flex flex-col bg-zinc-950">
                <div className="p-6 border-b border-zinc-800 flex justify-between items-center">
                    <div className="truncate pr-2">
                        <div className="text-blue-500 font-black">SENTINEL_OS</div>
                        <div className="opacity-40 lowercase">{myId}</div>
                    </div>
                    <button onClick={() => { localStorage.clear(); window.location.reload(); }} className="text-red-900 text-[8px] border border-red-900 px-1">[RESET]</button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-1">
                    <div className="text-zinc-700 mb-4 font-bold text-[9px] tracking-widest">CONTACTS</div>
                    {knownUsers.map(user => {
                        const bCount = encryptedBuffer[user]?.length || 0;
                        const uCount = unreadCounts[user] || 0;
                        const total = bCount + uCount;

                        return (
                            <div key={user} onClick={() => handleChatSelection(user)} className={`p-3 cursor-pointer border transition-all ${activeChat === user ? 'bg-blue-600/10 border-blue-500/50 text-blue-400' : 'border-transparent hover:bg-zinc-900 text-zinc-500'}`}>
                                <div className="flex justify-between items-center">
                                    <span className="lowercase">{user}</span>
                                    <div className="flex items-center gap-2">
                                        {total > 0 && <span className="bg-blue-600 text-white px-1.5 animate-pulse rounded-sm">{total}</span>}
                                        <span className={onlineUsers.includes(user) ? "text-green-500" : "text-zinc-900"}>●</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="flex-1 flex flex-col bg-black">
                {activeChat ? (
                    <>
                        <header className="p-5 border-b border-zinc-800 flex justify-between bg-zinc-950/30">
                            <span className="text-blue-400 font-black lowercase">{activeChat}</span>
                            <span className={onlineUsers.includes(normalize(activeChat)) ? "text-green-500" : "text-zinc-900"}>
                                {onlineUsers.includes(normalize(activeChat)) ? "ONLINE" : "OFFLINE"}
                            </span>
                        </header>

                        {!chatKeys[normalize(activeChat)] ? (
                            <div className="flex-1 flex items-center justify-center p-10">
                                <div className="max-w-xs w-full text-center border border-zinc-800 p-8 bg-zinc-950 shadow-2xl">
                                    <p className="mb-6 text-zinc-500 text-[10px]">КАНАЛ ЗАШИФРОВАН.</p>
                                    <input type="password" placeholder="KEY..." className="w-full bg-zinc-900 border border-zinc-800 p-4 mb-4 text-center outline-none focus:border-blue-500 text-blue-500" value={newChatKey} onChange={(e) => setNewChatKey(e.target.value)} />
                                    <button onClick={activateChannel} className="w-full bg-blue-600 py-4 font-black">ACTIVATE</button>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                                    {chats[normalize(activeChat)]?.map((msg, i) => (
                                        <div key={i} className={`flex ${msg.sender === 'you' ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`max-w-[80%] p-3 border ${msg.sender === 'you' ? 'border-blue-500/30 bg-blue-600/5' : 'border-zinc-800 bg-zinc-900/40'}`}>
                                                <div className="text-[8px] opacity-20 mb-1 lowercase">{msg.sender}</div>
                                                <p className="text-sm normal-case">{msg.text}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <form onSubmit={sendMessage} className="p-6 border-t border-zinc-800 bg-zinc-950/50 flex gap-4">
                                    <input className="flex-1 bg-zinc-900 border border-zinc-800 p-4 outline-none text-sm lowercase" placeholder="MESSAGE..." value={input} onChange={e => setInput(e.target.value)} />
                                    <button className="bg-blue-600 px-8 font-black">SEND</button>
                                </form>
                            </>
                        )}
                    </>
                ) : (
                    <div className="flex-1 flex items-center justify-center opacity-10 text-4xl font-black">SENTINEL</div>
                )}
            </div>
        </div>
    );
}
