import React, { useEffect, useRef, useState } from 'react';

export default function ContainerLogs({ id }) {
  const [lines, setLines] = useState([]);
  const bottomRef = useRef(null);
  const wsRef = useRef(null);

  useEffect(() => {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${proto}://${location.host}/ws/docker/logs/${id}`);
    wsRef.current = ws;

    ws.onmessage = e => {
      const msg = JSON.parse(e.data);
      if (msg.type === 'history') {
        setLines(msg.data.split('\n').filter(Boolean));
      } else if (msg.type === 'log') {
        setLines(prev => [...prev, ...msg.data.split('\n').filter(Boolean)].slice(-500));
      }
    };

    return () => ws.close();
  }, [id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines]);

  return (
    <div className="border-t border-panel-border bg-panel-bg p-3 max-h-64 overflow-y-auto">
      <pre className="text-xs text-panel-text font-mono whitespace-pre-wrap break-all leading-5">
        {lines.map((line, i) => <div key={i}>{line}</div>)}
      </pre>
      <div ref={bottomRef} />
    </div>
  );
}
