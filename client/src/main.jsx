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

const Dashboard = lazy(() => import('./pages/Dashboard'));
const ApiKey = lazy(() => import('./pages/ApiKey'));
const Credentials = lazy(() => import('./pages/Credentials'));
const Scraper = lazy(() => import('./pages/Scraper'));
const Builder = lazy(() => import('./pages/Builder'));
const Keywords = lazy(() => import('./pages/Keywords'));
const AdCopy = lazy(() => import('./pages/AdCopy'));
const Campaigns = lazy(() => import('./pages/Campaigns'));
const CampaignReview = lazy(() => import('./pages/CampaignReview'));

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
          </Route>
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
);
