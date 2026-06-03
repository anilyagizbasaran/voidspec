import { createContext, useContext } from 'react';

// Default to a reasonable size so widgets don't flash "tiny" before ResizeObserver fires
export const WidgetSizeCtx = createContext({ w: 400, h: 200 });

export function useWidgetSize() {
  return useContext(WidgetSizeCtx);
}

// Convenience breakpoint helpers
export function widgetBreakpoints({ w, h }) {
  return {
    tiny:    w < 180 || h < 110,
    compact: w < 290 || h < 150,
    wide:    w >= 500,
    tall:    h >= 300,
    w, h,
  };
}
