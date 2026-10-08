/**
 * Test harness for the public /news page and its Sales filters.
 *
 * The page is mounted as shipped, against stubbed REST responses, so the tests
 * exercise the real filter, page-link and paging code.
 *
 * Not part of the app build — reachable only from the dev server.
 */
import '../../src/index.css';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { NotificationBarProvider } from '../../src/contexts/NotificationBarContext';
import NewsPage from '../../src/pages/NewsPage';

createRoot(document.getElementById('root')!).render(
  <HelmetProvider>
    <BrowserRouter>
      <NotificationBarProvider>
        <NewsPage />
      </NotificationBarProvider>
    </BrowserRouter>
  </HelmetProvider>,
);
