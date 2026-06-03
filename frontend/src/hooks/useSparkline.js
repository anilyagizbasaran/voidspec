import { useState, useEffect } from 'react';

export function useSparkline(value, maxPoints = 30) {
  const [history, setHistory] = useState([]);
  useEffect(() => {
    if (value == null || isNaN(value)) return;
    setHistory(prev => {
      const next = [...prev, value];
      return next.length > maxPoints ? next.slice(-maxPoints) : next;
    });
  }, [value]); // maxPoints intentionally excluded
  return history;
}

export function useTrend(history) {
  if (history.length < 6) return null;
  const recent = history.slice(-3).reduce((a, b) => a + b, 0) / 3;
  const older  = history.slice(-6, -3).reduce((a, b) => a + b, 0) / 3;
  const delta  = recent - older;
  return Math.abs(delta) < 1 ? 0 : parseFloat(delta.toFixed(1));
}
