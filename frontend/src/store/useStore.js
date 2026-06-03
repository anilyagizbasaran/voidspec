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
  addTerminalTab: () => set(state => {
    const id = Date.now().toString();
    return {
      terminalTabs: [...state.terminalTabs, { id, title: `Terminal ${state.terminalTabs.length + 1}` }],
      activeTerminalTab: id,
    };
  }),
  removeTerminalTab: (id) => set(state => {
    const tabs = state.terminalTabs.filter(t => t.id !== id);
    return {
      terminalTabs: tabs.length ? tabs : [{ id: '1', title: 'Terminal 1' }],
      activeTerminalTab: tabs.length ? tabs[tabs.length - 1].id : '1',
    };
  }),
  setActiveTerminalTab: (id) => set({ activeTerminalTab: id }),
}));
