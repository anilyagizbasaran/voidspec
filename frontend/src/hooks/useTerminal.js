import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import '@xterm/xterm/css/xterm.css';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';

const SESSION_KEY = (tabId) => `terminal-session-${tabId}`;

export function useTerminal(containerRef, tabId) {
  const termRef = useRef(null);
  const wsRef = useRef(null);
  const fitRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const isMobile = window.innerWidth < 768 || 'ontouchstart' in window;

    const term = new Terminal({
      theme: {
        background: '#0d1117',
        foreground: '#e6edf3',
        cursor: '#58a6ff',
        selectionBackground: '#264f78',
        black: '#484f58',
        red: '#f85149',
        green: '#3fb950',
        yellow: '#d29922',
        blue: '#58a6ff',
        magenta: '#bc8cff',
        cyan: '#39c5cf',
        white: '#b1bac4',
        brightBlack: '#6e7681',
        brightRed: '#ff7b72',
        brightGreen: '#56d364',
        brightYellow: '#e3b341',
        brightBlue: '#79c0ff',
        brightMagenta: '#d2a8ff',
        brightCyan: '#56d4dd',
        brightWhite: '#f0f6fc',
      },
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      fontSize: isMobile ? 14 : 13,
      lineHeight: 1.4,
      cursorBlink: true,
      allowProposedApi: true,
      scrollOnUserInput: true,
      scrollback: 5000,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);
    term.open(containerRef.current);
    requestAnimationFrame(() => fitAddon.fit());

    termRef.current = term;
    fitRef.current = fitAddon;

    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const existingSessionId = sessionStorage.getItem(SESSION_KEY(tabId));
    const wsUrl = existingSessionId
      ? `${proto}://${location.host}/ws/terminal?sessionId=${existingSessionId}`
      : `${proto}://${location.host}/ws/terminal`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = e => {
      const msg = JSON.parse(e.data);
      if (msg.type === 'session') {
        sessionStorage.setItem(SESSION_KEY(tabId), msg.sessionId);
      } else if (msg.type === 'data') {
        term.write(msg.data, () => term.scrollToBottom());
      } else if (msg.type === 'exit') {
        term.write('\r\n[session ended]\r\n');
        sessionStorage.removeItem(SESSION_KEY(tabId));
      }
    };

    ws.onopen = () => {
      fitAddon.fit();
      ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
    };

    term.onData(data => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'input', data }));
      }
    });

    containerRef.current.addEventListener('paste', e => {
      const text = e.clipboardData?.getData('text');
      if (text && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'input', data: text }));
      }
      e.preventDefault();
    });

    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
      }
    });
    resizeObserver.observe(containerRef.current);

    // Mobil: dokunuşta klavyeyi aç
    const onTouch = () => term.focus();
    containerRef.current.addEventListener('touchstart', onTouch, { passive: true });

    // Mobil: klavye açılınca/kapanınca viewport küçülür, terminali yeniden fit et
    const onViewportResize = () => {
      requestAnimationFrame(() => {
        fitAddon.fit();
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
        }
      });
    };
    window.visualViewport?.addEventListener('resize', onViewportResize);

    return () => {
      resizeObserver.disconnect();
      window.visualViewport?.removeEventListener('resize', onViewportResize);
      ws.close();
      term.dispose();
    };
  }, [tabId]);

  return { term: termRef, ws: wsRef };
}

// Tab kapatılırken session'ı temizlemek için dışarıdan çağrılır
export function clearTerminalSession(tabId) {
  sessionStorage.removeItem(SESSION_KEY(tabId));
}
