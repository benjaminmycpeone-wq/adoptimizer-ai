import { useLocation, useNavigate } from 'react-router-dom';
import { TITLES } from '../constants';
import { checkHealth } from '../api';
import useStore from '../store';

const PATH_MAP = {
  '/': 'dashboard',
  '/api-key': 'apikey',
  '/credentials': 'credentials',
  '/scraper': 'scraper',
  '/builder': 'builder',
  '/keywords': 'keywords',
  '/ad-copy': 'adcopy',
  '/campaigns': 'campaigns',
  '/campaign-review': 'campaignReview',
};

export default function Topbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const setScraperOnline = useStore((s) => s.setScraperOnline);
  const toggleSidebar = useStore((s) => s.toggleSidebar);

  const key = PATH_MAP[location.pathname] || 'dashboard';
  const title = TITLES[key] || 'AdOptimizer AI';

  const handleRefresh = async () => {
    const online = await checkHealth();
    setScraperOnline(online);
    useStore.getState().addToast(online ? 'Server is online' : 'Server is offline', online ? 'as' : 'ae');
  };

  return (
    <div className="topbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button className="hamburger" onClick={toggleSidebar} aria-label="Toggle navigation menu">
          <span /><span /><span />
        </button>
        <h2>{title}</h2>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn bs sm" onClick={handleRefresh} aria-label="Refresh server status">🔄 Refresh</button>
        <button className="btn bp sm" onClick={() => navigate('/scraper')} aria-label="Create new campaign">+ New Campaign</button>
      </div>
    </div>
  );
}
