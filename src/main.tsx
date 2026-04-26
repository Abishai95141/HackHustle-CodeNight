import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@/app/App';
import { ensureServiceWorker, getPermission } from '@/lib/browserNotifications';
import '@/styles/globals.css';

// Pre-register the notifications SW if the user has already granted
// permission, so the first push after page load fires without latency.
if (getPermission() === 'granted') void ensureServiceWorker();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
