// Extend Window interface for// src/lib/auth.ts
"use client";

import { createBrowserClient } from '@supabase/ssr';

// This declares a global type augmentation for the Window interface
declare global {
  interface Window {
    __CRM_TOKEN__?: string;
  }
}

// Environment variables and Supabase client initialization (outside declare global)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error("Missing env.NEXT_PUBLIC_SUPABASE_URL");
}
if (!supabaseAnonKey) {
  throw new Error("Missing env.NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);

// Auth functions follow
export function parseOAuthHash(hash: string): { access_token: string; refresh_token: string; } | null {
  if (!hash.startsWith('#')) {
    console.warn('[auth.ts] parseOAuthHash: Hash does not start with #');
    return null;
  }
  const params = new URLSearchParams(hash.substring(1)); // Remove '#' and parse
  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');

  if (access_token && refresh_token) {
    console.log('[auth.ts] parseOAuthHash: Successfully parsed tokens.');
    return { access_token, refresh_token };
  } else {
    console.warn('[auth.ts] parseOAuthHash: Could not extract access_token or refresh_token from hash:', hash);
    return null;
  }
}

export async function setLoginState(access_token: string, refresh_token: string | null | undefined): Promise<boolean> {
  console.log('[auth.ts] setLoginState: Attempting to set session.');
  if (!access_token || !refresh_token) {
    console.error('[auth.ts] setLoginState: Missing access_token or refresh_token. Aborting and logging out.');
    await logout(); // Ensure clean state if tokens are missing
    return false; // Indicate failure
  }

  const { data, error } = await supabase.auth.setSession({
    access_token,
    refresh_token,
  });

  if (error) {
    console.error('[auth.ts] setLoginState: Error from supabase.auth.setSession:', error.message);
    await logout(); // Ensure clean state on error
    return false; // Indicate failure
  }

  if (data?.session) {
    console.log('[auth.ts] setLoginState: Session successfully set. User ID:', data.session.user.id);
    localStorage.setItem('isLoggedIn', 'true'); // Legacy flag, prefer Supabase session check
    if (typeof window !== 'undefined') window.__CRM_TOKEN__ = access_token;
    return true; // Indicate success
  } else {
    console.warn('[auth.ts] setLoginState: setSession call succeeded but no session data returned. Treating as failure.');
    await logout(); // Ensure clean state if no session data
    return false; // Indicate failure
  }
}

export async function logout() {
  console.log('[auth.ts] logout: Initiating sign out and clearing local state.');
  // signOut clears the session from Supabase and local storage (cookies for ssr, localstorage for browser client)
  const { error } = await supabase.auth.signOut(); 
  if (error) {
    console.error('[auth.ts] logout: Error during supabase.auth.signOut:', error.message);
  }
  
  // Explicitly clear local storage items we manage
  localStorage.removeItem('isLoggedIn');
  console.log("[auth.ts] logout: Removed 'isLoggedIn' from localStorage.");

  if (typeof window !== 'undefined') {
    window.__CRM_TOKEN__ = undefined;
    console.log("[auth.ts] logout: Cleared window.__CRM_TOKEN__.");
    window.location.hash = ""; // Clear any auth fragments from URL
    console.log("[auth.ts] logout: Cleared window.location.hash.");

    // Attempt to remove any other Supabase-specific keys from localStorage
    try {
      const allKeys = Object.keys(localStorage);
      const supabaseAuthKeys = allKeys.filter(key => key.startsWith('sb-') || key.startsWith('supabase.auth.token')); // Broader check
      supabaseAuthKeys.forEach(key => {
        localStorage.removeItem(key);
        console.log(`[auth.ts] logout: Removed ${key} from localStorage.`);
      });
    } catch (e) {
      console.warn("[auth.ts] logout: Error while trying to clear all Supabase localStorage keys:", e);
    }
  }
  console.log('[auth.ts] logout: Logout process complete.');
}

export const getSupabaseUser = async () => {
  console.log("[auth.ts] getSupabaseUser: Fetching user...");
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) {
    console.warn("[auth.ts] getSupabaseUser: Error getting user (this can be normal if not logged in):", error.message);
    return null;
  }
  if (user) {
    console.log("[auth.ts] getSupabaseUser: User found, ID:", user.id);
  } else {
    console.log("[auth.ts] getSupabaseUser: No user found.");
  }
  return user;
};

export const getSupabaseSession = async () => {
  console.log("[auth.ts] getSupabaseSession: Fetching session...");
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) {
    console.warn("[auth.ts] getSupabaseSession: Error getting session (this can be normal if not logged in):", error.message);
    return null;
  }
  if (session) {
    console.log("[auth.ts] getSupabaseSession: Session found, User ID:", session.user.id);
  } else {
    console.log("[auth.ts] getSupabaseSession: No session found.");
  }
  return session;
};

// The old isLoggedIn() function that only checked localStorage has been removed.
// Always use getSupabaseUser() or getSupabaseSession() to check actual auth state.
