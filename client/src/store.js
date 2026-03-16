import { create } from 'zustand';

const useStore = create((set, get) => ({
  // AI settings
  aiKey: '',
  aiProv: 'anthropic',
  aiMod: 'claude-sonnet-4-20250514',

  // Google Ads credentials
  cr: { dt: '', cid: '', cs: '', rt: '', mcc: '', cu: '' },

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
  setAiKey: (key) => set({ aiKey: key }),
  setAiProv: (prov) => set({ aiProv: prov }),
  setAiMod: (mod) => set({ aiMod: mod }),

  setCr: (cr) => set({ cr: { ...get().cr, ...cr } }),
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
