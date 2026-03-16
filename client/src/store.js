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

  // Actions
  setAiKey: (key) => { set({ aiKey: key }); savePersisted({ ...get(), aiKey: key }); },
  setAiProv: (prov) => { set({ aiProv: prov }); savePersisted({ ...get(), aiProv: prov }); },
  setAiMod: (mod) => { set({ aiMod: mod }); savePersisted({ ...get(), aiMod: mod }); },

  setCr: (cr) => {
    const merged = { ...get().cr, ...cr };
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
}));

export default useStore;
