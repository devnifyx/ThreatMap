export const AUTH_REQUIRED_EVENT = 'lekirrax:auth-required';

export type AuthRequiredDetail = {
  title: string;
  message: string;
};

let lastEventSignature = '';
let lastEventAt = 0;

export function notifyAuthRequired(detail?: Partial<AuthRequiredDetail>) {
  if (typeof window === 'undefined') return;

  const payload: AuthRequiredDetail = {
    title: detail?.title || 'Session expired',
    message: detail?.message || 'Your session has expired. Please log in again to continue.'
  };

  const signature = `${payload.title}|${payload.message}`;
  const now = Date.now();
  if (signature === lastEventSignature && now - lastEventAt < 1200) {
    return;
  }

  lastEventSignature = signature;
  lastEventAt = now;
  window.dispatchEvent(new CustomEvent<AuthRequiredDetail>(AUTH_REQUIRED_EVENT, { detail: payload }));
}

export function notifyAuthStatus(status: number) {
  if (status === 401) {
    notifyAuthRequired({
      title: 'Session expired',
      message: 'Your session has expired or timed out. Please log in again to continue.'
    });
  } else if (status === 403) {
    notifyAuthRequired({
      title: 'Re-authentication required',
      message: 'Your current session is no longer authorized. Please log in again to continue.'
    });
  }
}

