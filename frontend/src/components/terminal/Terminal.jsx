import React, { useRef, useImperativeHandle, forwardRef } from 'react';
import { useTerminal } from '../../hooks/useTerminal.js';

const TerminalPane = forwardRef(function TerminalPane({ tabId }, ref) {
  const containerRef = useRef(null);
  const { ws, term } = useTerminal(containerRef, tabId);

  useImperativeHandle(ref, () => ({
    sendText(text) {
      if (ws.current?.readyState === WebSocket.OPEN) {
        ws.current.send(JSON.stringify({ type: 'input', data: text }));
      }
    },
    focus() {
      term.current?.focus();
    },
  }));

  return (
    <div
      ref={containerRef}
      className="flex-1 min-h-0"
      style={{ background: '#0d1117' }}
    />
  );
});

export default TerminalPane;
