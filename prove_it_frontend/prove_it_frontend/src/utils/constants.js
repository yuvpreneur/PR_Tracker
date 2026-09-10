export const APP_NAME = 'Prove IT Catalysts';
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export const CURRENCIES = [
  { code: 'INR', symbol: '₹' },
  { code: 'USD', symbol: '$' },
  { code: 'EUR', symbol: '€' },
  { code: 'GBP', symbol: '£' },
  { code: 'AED', symbol: 'AED ' },
];

export const PAYMENT_TERMS = [
  { value: 'due_on_receipt', label: 'Due on receipt', days: 0 },
  { value: 'net15', label: 'Net 15', days: 15 },
  { value: 'net30', label: 'Net 30', days: 30 },
  { value: 'net45', label: 'Net 45', days: 45 },
  { value: 'net60', label: 'Net 60', days: 60 },
  { value: 'net90', label: 'Net 90', days: 90 },
  { value: 'custom', label: 'Custom', days: null },
];
