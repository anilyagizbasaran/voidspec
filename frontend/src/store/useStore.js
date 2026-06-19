import { create } from 'zustand';

export const useStore = create((set) => ({
  user: null,
  setUser: (user) => set({ user }),
  clearUser: () => set({ user: null }),

  activeTab: 'dashboard',
  setActiveTab: (tab) => set({ activeTab: tab }),

  sidebarCollapsed: false,
  toggleSidebar: () => set(state => ({ sidebarCollapsed: !state.sidebarCollapsed })),

  terminalTabs: [{ id: '1', title: 'Terminal 1' }],
  activeTerminalTab: '1',
  splitMode: false,
  splitTabId: null,

  addTerminalTab: () => set(state => {
    const id = Date.now().toString();
    return {
      terminalTabs: [...state.terminalTabs, { id, title: `Terminal ${state.terminalTabs.length + 1}` }],
      activeTerminalTab: id,
    };
  }),

  removeTerminalTab: (id) => set(state => {
    const tabs = state.terminalTabs.filter(t => t.id !== id);
    const fallbackId = tabs.length ? tabs[tabs.length - 1].id : '1';
    return {
      terminalTabs: tabs.length ? tabs : [{ id: '1', title: 'Terminal 1' }],
      activeTerminalTab: id === state.activeTerminalTab ? fallbackId : state.activeTerminalTab,
      splitTabId: id === state.splitTabId ? null : state.splitTabId,
      splitMode: id === state.splitTabId ? false : state.splitMode,
    };
  }),

  setActiveTerminalTab: (id) => set({ activeTerminalTab: id }),

  enableSplit: () => set(state => {
    const other = state.terminalTabs.find(t => t.id !== state.activeTerminalTab);
    if (other) {
      return { splitMode: true, splitTabId: other.id };
    }
    const id = Date.now().toString();
    return {
      splitMode: true,
      splitTabId: id,
      terminalTabs: [...state.terminalTabs, { id, title: `Terminal ${state.terminalTabs.length + 1}` }],
    };
  }),

  disableSplit: () => set({ splitMode: false, splitTabId: null }),

  setSplitTabId: (id) => set({ splitTabId: id }),
}));
