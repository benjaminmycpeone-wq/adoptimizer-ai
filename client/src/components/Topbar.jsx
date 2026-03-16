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
};

export default function Topbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const setScraperOnline = useStore((s) => s.setScraperOnline);

  const key = PATH_MAP[location.pathname] || 'dashboard';
  const title = TITLES[key] || 'AdOptimizer AI';

  const handleRefresh = async () => {
    const online = await checkHealth();
    setScraperOnline(online);
  };

  return (
    <div className="topbar">
      <h2>{title}</h2>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn bs sm" onClick={handleRefresh}>🔄 Refresh</button>
        <button className="btn bp sm" onClick={() => navigate('/scraper')}>+ New Campaign</button>
      </div>
    </div>
  );
}
