import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { App } from './app/App.tsx';
import { AuthProvider } from './core/auth/AuthProvider.tsx';
import { AppErrorBoundary } from './features/system/SystemPages.tsx';
import { initializeTheme } from './shared/theme.ts';
import './shared/styles/global.css';
import './shared/styles/dashboard.css';

initializeTheme();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <AppErrorBoundary>
          <App />
        </AppErrorBoundary>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
