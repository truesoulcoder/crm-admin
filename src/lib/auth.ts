// Extend Window interface for custom CRM token
declare global {
  interface Window {
    __CRM_TOKEN__?: string;
  }
}

// Utility to parse OAuth hash and handle login state
export function parseOAuthHash(hash: string) {
  if (!hash.startsWith('#')) return null;
  const params = new URLSearchParams(hash.slice(1));
  const access_token = params.get('access_token');
  const expires_in = params.get('expires_in');
  const token_type = params.get('token_type');
  const refresh_token = params.get('refresh_token');
  const id_token = params.get('id_token');
  const email = params.get('email');
  return { access_token, expires_in, token_type, refresh_token, id_token, email };
}

export function setLoginState(token: string) {
  // Store in memory (window)
  window.__CRM_TOKEN__ = token;
  localStorage.setItem('isLoggedIn', 'true');
}

export function logout() {
  window.__CRM_TOKEN__ = undefined;
  localStorage.removeItem('isLoggedIn');
}

export function isLoggedIn() {
  return localStorage.getItem('isLoggedIn') === 'true';
}
