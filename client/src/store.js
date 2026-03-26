import { create } from 'zustand';

// Load persisted settings from localStorage
function loadPersisted() {
  try {
    const raw = localStorage.getItem('adoptimizer_settings');
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function savePersisted(state) {
  try {
    localStorage.setItem('adoptimizer_settings', JSON.stringify({
      aiKey: state.aiKey,
      aiProv: state.aiProv,
      aiMod: state.aiMod,
      cr: state.cr,
    }));
  } catch { /* ignore */ }
}

const persisted = loadPersisted();

const useStore = create((set, get) => ({
  // AI settings
  aiKey: persisted.aiKey || '',
  aiProv: persisted.aiProv || 'anthropic',
  aiMod: persisted.aiMod || 'claude-sonnet-4-20250514',

  // Google Ads credentials
  cr: persisted.cr || { dt: '', cid: '', cs: '', rt: '', mcc: '', cu: '' },

  // OAuth token cache
  tok: null,
  tokExp: 0,

  // Stats
  stats: { c: 0, k: 0, a: 0, p: 0 },

  // Activity log
  acts: [],

  // Scraper status
  scraperOnline: false,

  // Builder state
  builder: {
    name: '', loc: '', cat: '', website: '', svc: '', aud: '', usp: '',
    campaignName: '', goal: 'LEADS', budget: 50, bidding: 'MAXIMIZE_CONVERSIONS',
    targetLocations: '', radius: 20,
  },

  // Scrape result
  scrapeResult: null,

  // Current campaign ID (for persistence)
  currentCampaignId: null,

  // Toast notifications
  toasts: [],

  // Mobile sidebar
  sidebarOpen: false,

  // Actions
  setAiKey: (key) => { set({ aiKey: key }); savePersisted({ ...get(), aiKey: key }); },
  setAiProv: (prov) => { set({ aiProv: prov }); savePersisted({ ...get(), aiProv: prov }); },
  setAiMod: (mod) => { set({ aiMod: mod }); savePersisted({ ...get(), aiMod: mod }); },

  setCr: (cr) => {
    // Trim all credential values to prevent whitespace issues in API headers
    const trimmed = Object.fromEntries(Object.entries(cr).map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v]));
    const merged = { ...get().cr, ...trimmed };
    set({ cr: merged });
    savePersisted({ ...get(), cr: merged });
  },
  setTok: (tok, exp) => set({ tok, tokExp: exp }),

  setScraperOnline: (online) => set({ scraperOnline: online }),

  setScrapeResult: (result) => set({ scrapeResult: result }),

  setBuilder: (data) => set({ builder: { ...get().builder, ...data } }),

  incStat: (key, amount = 1) => set((s) => ({
    stats: { ...s.stats, [key]: s.stats[key] + amount }
  })),

  log: (msg) => set((s) => ({
    acts: [{ msg, t: new Date().toLocaleTimeString() }, ...s.acts].slice(0, 50)
  })),

  setCurrentCampaignId: (id) => set({ currentCampaignId: id }),

  addToast: (msg, type = 'ai') => {
    const id = Date.now() + Math.random();
    set((s) => ({ toasts: [...s.toasts, { id, msg, type }].slice(-3) }));
    setTimeout(() => get().removeToast(id), 4500);
  },
  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  closeSidebar: () => set({ sidebarOpen: false }),
}));

export default useStore;
