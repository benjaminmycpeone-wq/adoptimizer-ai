import { NavLink, useLocation } from 'react-router-dom';
import useStore from '../store';
import TabSwitcher from './TabSwitcher';

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

const MONITOR_NAV_ITEMS = [
  { section: 'Dashboard' },
  { path: '/monitor', icon: '📊', label: 'Dashboard' },
  { section: 'Content Pipeline' },
  { path: '/monitor/sources', icon: '🏢', label: 'Sources' },
  { path: '/monitor/trends', icon: '📈', label: 'Trends' },
  { path: '/monitor/generator', icon: '✍️', label: 'Generator' },
  { path: '/monitor/review', icon: '📝', label: 'Review' },
  { path: '/monitor/publisher', icon: '🚀', label: 'Publisher' },
  { section: 'Management' },
  { path: '/monitor/clients', icon: '👥', label: 'Clients' },
];

export default function Sidebar() {
  const location = useLocation();
  const isMonitor = location.pathname.startsWith('/monitor');
  const navItems = isMonitor ? MONITOR_NAV_ITEMS : NAV_ITEMS;

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
        <TabSwitcher />

        <div className="logo">
          <h1>{isMonitor ? '📊 CPA Monitor' : '⚡ AdOptimizer AI'}</h1>
          <p>{isMonitor ? 'Content Pipeline Manager' : 'Google Ads Campaign Builder'}</p>
        </div>

        {navItems.map((item, i) =>
          item.section ? (
            <div key={i} className="ns" style={item.style}>{item.section}</div>
          ) : (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `ni${isActive ? ' active' : ''}`}
              end={item.path === '/' || item.path === '/monitor'}
              onClick={closeSidebar}
            >
              <span className="ico">{item.icon}</span> {item.label}
            </NavLink>
          )
        )}

        {!isMonitor && (
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
        )}
      </aside>
    </>
  );
}
