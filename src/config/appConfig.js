export const APP_CONFIG = {
  appName: import.meta.env.VITE_APP_NAME || 'Invovo ERP',
  companyName: import.meta.env.VITE_COMPANY_NAME || 'Smart SaaS',
  defaultCurrency: import.meta.env.VITE_DEFAULT_CURRENCY || 'PKR',
  supportedCurrencies: {
    PKR: { symbol: 'Rs.', label: 'Pakistani Rupee' },
    USD: { symbol: '$', label: 'US Dollar' },
    EUR: { symbol: '€', label: 'Euro' },
    GBP: { symbol: '£', label: 'British Pound' },
    SAR: { symbol: 'SAR', label: 'Saudi Riyal' },
    AED: { symbol: 'AED', label: 'UAE Dirham' },
    INR: { symbol: '₹', label: 'Indian Rupee' },
  }
};

export const formatCurrency = (amount, currencyCode = APP_CONFIG.defaultCurrency) => {
  const currency = APP_CONFIG.supportedCurrencies[currencyCode] || APP_CONFIG.supportedCurrencies['PKR'];
  const formattedAmount = Number(amount || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  return `${currency.symbol} ${formattedAmount}`;
};
