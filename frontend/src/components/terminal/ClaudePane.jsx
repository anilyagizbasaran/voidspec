import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Bot, User, Loader2 } from 'lucide-react';

function MessageBubble({ msg }) {
  const isUser = msg.role === 'user';
  return (
    <div className={`flex gap-2 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      <div className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center mt-0.5 ${isUser ? 'bg-panel-accent/30' : 'bg-panel-cyan/20'}`}>
        {isUser ? <User size={12} className="text-panel-accent" /> : <Bot size={12} className="text-panel-cyan" />}
      </div>
      <div className={`max-w-[85%] px-3 py-2 rounded-lg text-xs leading-5 font-mono whitespace-pre-wrap break-words ${
        isUser
          ? 'bg-panel-accent/15 text-panel-text rounded-tr-none'
          : 'bg-panel-surface border border-panel-border text-panel-text rounded-tl-none'
      }`}>
        {msg.content}
      </div>
    </div>
  );
}

export default function ClaudePane() {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Merhaba! Ben Claude. Sunucu yönetimi, Docker, bash komutları veya herhangi bir konuda yardımcı olabilirim.' }
  ]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const wsRef = useRef(null);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const streamingMsgRef = useRef('');

  useEffect(() => {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${proto}://${location.host}/ws/claude`);
    wsRef.current = ws;

    ws.onmessage = e => {
      const msg = JSON.parse(e.data);

      if (msg.type === 'start') {
        streamingMsgRef.current = '';
        setStreaming(true);
        setMessages(prev => [...prev, { role: 'assistant', content: '' }]);
      } else if (msg.type === 'chunk') {
        streamingMsgRef.current += msg.text;
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: 'assistant', content: streamingMsgRef.current };
          return updated;
        });
      } else if (msg.type === 'done') {
        setStreaming(false);
        inputRef.current?.focus();
      } else if (msg.type === 'error') {
        setStreaming(false);
        setMessages(prev => [...prev, { role: 'assistant', content: `Hata: ${msg.text}` }]);
      }
    };

    ws.onclose = () => { wsRef.current = null; };

    return () => { ws.close(); };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = useCallback(() => {
    const text = input.trim();
    if (!text || streaming || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    setMessages(prev => [...prev, { role: 'user', content: text }]);
    wsRef.current.send(JSON.stringify({ text }));
    setInput('');
  }, [input, streaming]);

  function onKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <div className="flex flex-col h-full" style={{ background: '#0d1117' }}>
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-panel-border bg-panel-surface shrink-0">
        <Bot size={14} className="text-panel-cyan" />
        <span className="text-xs text-panel-text font-medium">Claude AI</span>
        <span className="text-xs text-panel-muted">— sunucu asistanı</span>
        {streaming && <Loader2 size={12} className="ml-auto text-panel-cyan animate-spin" />}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
        {messages.map((msg, i) => (
          <MessageBubble key={i} msg={msg} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-panel-border bg-panel-surface p-2 flex gap-2 items-end">
        <textarea
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={streaming}
          placeholder="Mesajınızı yazın… (Enter göndermek için)"
          rows={1}
          className="flex-1 bg-panel-bg border border-panel-border rounded px-3 py-2 text-xs text-panel-text placeholder-panel-muted focus:outline-none focus:border-panel-accent resize-none font-mono leading-5 disabled:opacity-50"
          style={{ maxHeight: '120px', overflowY: 'auto' }}
          onInput={e => {
            e.target.style.height = 'auto';
            e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
          }}
        />
        <button
          onClick={send}
          disabled={streaming || !input.trim()}
          className="p-2 rounded bg-panel-accent/20 text-panel-accent hover:bg-panel-accent/30 disabled:opacity-40 transition-colors shrink-0"
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  );
}
