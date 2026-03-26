"use client";
import { useEffect, useState, useRef } from 'react';

export default function SentinelsChat() {
  const [messages, setMessages] = useState<{sender: string, text: string}[]>([]);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState('Connecting...');
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    // Подключаемся к твоему Python серверу
    const socket = new WebSocket('ws://127.0.0.1:8000/ws/user_1');
    socketRef.current = socket;

    socket.onopen = () => setStatus('🛡️ SECURE CONNECTION ESTABLISHED');
    socket.onclose = () => setStatus('❌ DISCONNECTED');

    socket.onmessage = (event) => {
      setMessages(prev => [...prev, { sender: 'System/Echo', text: event.data }]);
    };

    return () => socket.close();
  }, []);

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (input && socketRef.current) {
      socketRef.current.send(JSON.stringify({ content: input }));
      setMessages(prev => [...prev, { sender: 'You', text: input }]);
      setInput('');
    }
  };

  return (
    <div className="flex flex-col h-screen bg-black text-white font-mono uppercase tracking-widest">
      <header className="p-6 border-b border-zinc-800 flex justify-between items-center bg-zinc-950">
        <h1 className="text-2xl font-black italic text-blue-500">SENTINELS v0.1.0</h1>
        <span className="text-[10px] border border-blue-500 px-3 py-1 text-blue-400 animate-pulse">{status}</span>
      </header>

      <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-zinc-900 to-black">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.sender === 'You' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[75%] p-4 border ${msg.sender === 'You' ? 'border-blue-600 bg-blue-900/20' : 'border-zinc-700 bg-zinc-800/40'}`}>
              <p className="text-xs mb-1 opacity-50">[{msg.sender}]</p>
              <p className="text-sm leading-relaxed">{msg.text}</p>
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={sendMessage} className="p-6 bg-black border-t border-zinc-800 flex gap-4">
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
