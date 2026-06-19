import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { I18nProvider } from './i18n/I18nContext.tsx';
import { migrateLegacyStorage } from './lib/storage';

// One-time migration from un-namespaced legacy keys to the `mealdrive:*` namespace.
migrateLegacyStorage();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <App />
    </I18nProvider>
  </StrictMode>,
);
