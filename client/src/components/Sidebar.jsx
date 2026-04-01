import { NavLink } from 'react-router-dom';
import useStore from '../store';

const NAV_ITEMS = [
  { section: 'Setup' },
  { path: '/', icon: '📊', label: 'Dashboard' },
  { path: '/api-key', icon: '🤖', label: 'AI API Key' },
  { path: '/credentials', icon: '🔑', label: 'Google Ads Creds' },
  { section: 'Workflow', style: { marginTop: 6 } },
  { path: '/scraper', icon: '🔍', label: '1. Scrape Client Site' },
  { path: '/builder', icon: '🏗️', label: '2. Build Campaign' },
  { path: '/campaigns', icon: '📡', label: '3. Live Campaigns' },
  { section: 'Tools', style: { marginTop: 6 } },
  { path: '/keywords', icon: '🔤', label: 'Keyword Research' },
  { path: '/ad-copy', icon: '✍️', label: 'Ad Copy Generator' },
  { path: '/campaign-review', icon: '🔎', label: 'Campaign Review' },
];

export default function Sidebar() {
  const aiProv = useStore((s) => s.aiProv);
  const aiKey = useStore((s) => s.aiKey);
  const cr = useStore((s) => s.cr);
  const scraperOnline = useStore((s) => s.scraperOnline);
  const sidebarOpen = useStore((s) => s.sidebarOpen);
  const closeSidebar = useStore((s) => s.closeSidebar);

  return (
    <>
      {sidebarOpen && <div className="sidebar-overlay" onClick={closeSidebar} />}
      <aside className={`sidebar${sidebarOpen ? ' open' : ''}`} role="navigation" aria-label="Main navigation">
        <a href="/" style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
          <div className="logo">
            <h1>⚡ AdOptimizer AI</h1>
            <p>Google Ads Campaign Builder</p>
          </div>
        </a>

        {NAV_ITEMS.map((item, i) =>
          item.section ? (
            <div key={i} className="ns" style={item.style}>{item.section}</div>
          ) : (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `ni${isActive ? ' active' : ''}`}
              end={item.path === '/'}
              onClick={closeSidebar}
            >
              <span className="ico">{item.icon}</span> {item.label}
            </NavLink>
          )
        )}

        <div className="sf">
          <div className="status-row">
            <span className={`dot ${aiKey ? 'on' : 'off'}`} aria-label={aiKey ? 'AI configured' : 'AI not configured'} />
            <span>{aiKey ? `AI: ${aiProv}` : 'AI: not set'}</span>
          </div>
          <div className="status-row">
            <span className={`dot ${cr.dt ? 'on' : 'off'}`} aria-label={cr.dt ? 'Google Ads configured' : 'Google Ads not configured'} />
            <span>{cr.dt ? 'Google Ads: set' : 'Google Ads: not set'}</span>
          </div>
          <div className="status-row">
            <span className={`dot ${scraperOnline ? 'on' : 'off'}`} aria-label={scraperOnline ? 'Scraper online' : 'Scraper offline'} />
            <span>{scraperOnline ? 'Scraper online' : 'Scraper offline'}</span>
          </div>
        </div>
      </aside>
    </>
  );
}
