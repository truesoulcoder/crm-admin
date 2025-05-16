// Extend Window interface for custom CRM token
declare global {
  interface Window {
    __CRM_TOKEN__?: string;
  }
}

import { createBrowserClient } from '@supabase/ssr';

// Environment variables for Supabase client initialization
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Create a Supabase client instance for use in this auth module
// Note: This client is primarily for auth.setSession. Components should manage their own instances if needed for data fetching.
const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);

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

export async function setLoginState(access_token: string, refresh_token: string | null | undefined) {
  // Log received tokens
  console.log('[auth.ts] setLoginState attempting with access_token:', access_token ? 'present' : 'missing', 'refresh_token:', refresh_token ? 'present' : 'missing');
  if (access_token) {
    console.log('[auth.ts] access_token (first 10 chars):', access_token.substring(0, 10));
  }
  if (refresh_token) {
    console.log('[auth.ts] refresh_token (first 10 chars):', refresh_token.substring(0, 10));
  }

  if (!access_token || !refresh_token) {
    console.error('[auth.ts] setLoginState called without access_token or refresh_token');
    logout(); // Clear any partial login state
    return;
  }

  // Attempt to set the session with Supabase
  const { data: sessionData, error } = await supabase.auth.setSession({
    access_token,
    refresh_token,
  });

  if (error) {
    console.error('[auth.ts] Error from supabase.auth.setSession:', error);
    // Clear any partial login state if session setting fails
    window.__CRM_TOKEN__ = undefined;
    localStorage.removeItem('isLoggedIn');
    return;
  }

  // Successfully set session with Supabase
  console.log('[auth.ts] supabase.auth.setSession successful. Session data:', sessionData);
  if (sessionData?.session?.user) {
    console.log('[auth.ts] Session established for user ID:', sessionData.session.user.id);
  } else {
    console.warn('[auth.ts] setSession succeeded but sessionData or sessionData.session.user is null/undefined.');
  }

  // Update local state
  window.__CRM_TOKEN__ = access_token;
  localStorage.setItem('isLoggedIn', 'true');
  console.log('[auth.ts] isLoggedIn flag updated in localStorage.');
}

export async function logout() { // Make async to call supabase.auth.signOut()
  await supabase.auth.signOut(); // This will clear Supabase cookies

  window.__CRM_TOKEN__ = undefined;
  localStorage.removeItem('isLoggedIn');
}

export function isLoggedIn() {
  return localStorage.getItem('isLoggedIn') === 'true';
}
