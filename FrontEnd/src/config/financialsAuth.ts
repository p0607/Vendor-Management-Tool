/**
 * Financials-only session storage (separate from VMS keys: user, authToken, token).
 */

export const FINANCIALS_STORAGE_KEYS = {
  TOKEN: 'financials_auth_token',
  USER: 'financials_user',
} as const;

export interface FinancialsUser {
  id: number;
  name: string;
  designation?: string;
  business_unit?: string;
  email?: string;
}

export const getFinancialsToken = (): string | null =>
  localStorage.getItem(FINANCIALS_STORAGE_KEYS.TOKEN);

export const getFinancialsUser = (): FinancialsUser | null => {
  try {
    const raw = localStorage.getItem(FINANCIALS_STORAGE_KEYS.USER);
    if (!raw) return null;
    return JSON.parse(raw) as FinancialsUser;
  } catch {
    return null;
  }
};

export const isFinancialsAuthenticated = (): boolean =>
  Boolean(getFinancialsToken() && getFinancialsUser());

export const setFinancialsSession = (user: FinancialsUser, token: string): void => {
  localStorage.setItem(FINANCIALS_STORAGE_KEYS.USER, JSON.stringify(user));
  localStorage.setItem(FINANCIALS_STORAGE_KEYS.TOKEN, token);
};

export const clearFinancialsSession = (): void => {
  localStorage.removeItem(FINANCIALS_STORAGE_KEYS.USER);
  localStorage.removeItem(FINANCIALS_STORAGE_KEYS.TOKEN);
};
