const apiBaseUrl = import.meta.env.VITE_API_URL || '';

export async function api(path, options = {}) {
  let response;
  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options
    });
  } catch {
    throw new Error('The Rangrez API is unavailable. Start the backend and check backend/.env DATABASE_URL.');
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || (response.status >= 500 ? 'The Rangrez API is unavailable. Start the backend and check backend/.env DATABASE_URL.' : 'Something went wrong.'));
  return data;
}

export const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
export const formatMoney = (value) => currency.format(Number(value || 0));
export const todayString = () => new Date().toISOString().slice(0, 10);
export const addDaysString = (days) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};
