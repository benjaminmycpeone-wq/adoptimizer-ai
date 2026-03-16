import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import App from './App';
import Dashboard from './pages/Dashboard';
import ApiKey from './pages/ApiKey';
import Credentials from './pages/Credentials';
import Scraper from './pages/Scraper';
import Builder from './pages/Builder';
import Keywords from './pages/Keywords';
import AdCopy from './pages/AdCopy';
import Campaigns from './pages/Campaigns';
import './styles/variables.css';
import './styles/base.css';
import './styles/components.css';
import './styles/pages.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<App />}>
          <Route index element={<Dashboard />} />
          <Route path="api-key" element={<ApiKey />} />
          <Route path="credentials" element={<Credentials />} />
          <Route path="scraper" element={<Scraper />} />
          <Route path="builder" element={<Builder />} />
          <Route path="keywords" element={<Keywords />} />
          <Route path="ad-copy" element={<AdCopy />} />
          <Route path="campaigns" element={<Campaigns />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
