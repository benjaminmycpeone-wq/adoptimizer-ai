import React, { Suspense, lazy } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import PageSkeleton from './components/PageSkeleton';
import './styles/variables.css';
import './styles/base.css';
import './styles/components.css';
import './styles/pages.css';
import './styles/monitor.css';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const ApiKey = lazy(() => import('./pages/ApiKey'));
const Credentials = lazy(() => import('./pages/Credentials'));
const Scraper = lazy(() => import('./pages/Scraper'));
const Builder = lazy(() => import('./pages/Builder'));
const Keywords = lazy(() => import('./pages/Keywords'));
const AdCopy = lazy(() => import('./pages/AdCopy'));
const Campaigns = lazy(() => import('./pages/Campaigns'));
const CampaignReview = lazy(() => import('./pages/CampaignReview'));

const MonitorDashboard = lazy(() => import('./pages/monitor/MonitorDashboard'));
const Sources = lazy(() => import('./pages/monitor/Sources'));
const Trends = lazy(() => import('./pages/monitor/Trends'));
const Generator = lazy(() => import('./pages/monitor/Generator'));
const MonitorReview = lazy(() => import('./pages/monitor/MonitorReview'));
const Publisher = lazy(() => import('./pages/monitor/Publisher'));
const MonitorClients = lazy(() => import('./pages/monitor/MonitorClients'));

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route element={<App />}>
            <Route index element={<Suspense fallback={<PageSkeleton />}><Dashboard /></Suspense>} />
            <Route path="api-key" element={<Suspense fallback={<PageSkeleton />}><ApiKey /></Suspense>} />
            <Route path="credentials" element={<Suspense fallback={<PageSkeleton />}><Credentials /></Suspense>} />
            <Route path="scraper" element={<Suspense fallback={<PageSkeleton />}><Scraper /></Suspense>} />
            <Route path="builder" element={<Suspense fallback={<PageSkeleton />}><Builder /></Suspense>} />
            <Route path="keywords" element={<Suspense fallback={<PageSkeleton />}><Keywords /></Suspense>} />
            <Route path="ad-copy" element={<Suspense fallback={<PageSkeleton />}><AdCopy /></Suspense>} />
            <Route path="campaigns" element={<Suspense fallback={<PageSkeleton />}><Campaigns /></Suspense>} />
            <Route path="campaign-review" element={<Suspense fallback={<PageSkeleton />}><CampaignReview /></Suspense>} />
            <Route path="monitor" element={<Suspense fallback={<PageSkeleton />}><MonitorDashboard /></Suspense>} />
            <Route path="monitor/sources" element={<Suspense fallback={<PageSkeleton />}><Sources /></Suspense>} />
            <Route path="monitor/trends" element={<Suspense fallback={<PageSkeleton />}><Trends /></Suspense>} />
            <Route path="monitor/generator" element={<Suspense fallback={<PageSkeleton />}><Generator /></Suspense>} />
            <Route path="monitor/review" element={<Suspense fallback={<PageSkeleton />}><MonitorReview /></Suspense>} />
            <Route path="monitor/publisher" element={<Suspense fallback={<PageSkeleton />}><Publisher /></Suspense>} />
            <Route path="monitor/clients" element={<Suspense fallback={<PageSkeleton />}><MonitorClients /></Suspense>} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
);
