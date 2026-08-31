import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { OfflineSyncProvider } from './contexts/OfflineSyncContext';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <OfflineSyncProvider>
      <App />
    </OfflineSyncProvider>
  </StrictMode>,
)

// =========================================================================
// GLOBAL SAAS PRODUCTION FORMATTING INJECTION (100% PRESERVED)
// =========================================================================
import { APP_CONFIG } from './config/appConfig';

Number.prototype.toPKR = function () {
  return `${APP_CONFIG.supportedCurrencies[APP_CONFIG.defaultCurrency].symbol} ` + this.toLocaleString(undefined, { maximumFractionDigits: 2 });
};

String.prototype.toPKR = function () {
  const num = Number(this);
  if (isNaN(num)) return `${APP_CONFIG.supportedCurrencies[APP_CONFIG.defaultCurrency].symbol} 0`;
  return `${APP_CONFIG.supportedCurrencies[APP_CONFIG.defaultCurrency].symbol} ` + num.toLocaleString(undefined, { maximumFractionDigits: 2 });
};