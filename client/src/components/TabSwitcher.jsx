import { useLocation, useNavigate } from 'react-router-dom';

export default function TabSwitcher() {
  const location = useLocation();
  const navigate = useNavigate();
  const isMonitor = location.pathname.startsWith('/monitor');

  return (
    <div className="tab-switcher">
      <button
        className={`tab-switcher-btn${!isMonitor ? ' active' : ''}`}
        onClick={() => navigate('/')}
      >
        <span className="tab-switcher-icon">&#9889;</span> Ad Optimizer
      </button>
      <button
        className={`tab-switcher-btn${isMonitor ? ' active' : ''}`}
        onClick={() => navigate('/monitor')}
      >
        <span className="tab-switcher-icon">&#128202;</span> CPA Monitor
      </button>
    </div>
  );
}
