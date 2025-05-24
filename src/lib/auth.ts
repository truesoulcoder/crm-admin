// Extend Window interface for// src/lib/auth.ts
"use client";

// import { createBrowserClient } from '@supabase/ssr'; // Replaced by shared client
import { supabase } from '@/lib/supabase/client'; // Use the official singleton Supabase client

// window.__CRM_TOKEN__ declaration removed as it's no longer used.

// Environment variables (checks remain for early failure, but client is imported)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error("Missing env.NEXT_PUBLIC_SUPABASE_URL");
}
if (!supabaseAnonKey) {
  throw new Error("Missing env.NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

// const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey); // Removed: Using imported shared client

// Auth functions follow
// parseOAuthHash function removed as it's no longer used.
// setLoginState function removed as it's no longer used.

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
    // window.__CRM_TOKEN__ = undefined; // Removed as token is no longer used
    // console.log("[auth.ts] logout: Cleared window.__CRM_TOKEN__."); // Removed as token is no longer used
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
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) {
      console.error("[auth.ts] getSupabaseSession: supabase.auth.getSession() returned an error:", error.message, error);
      return null;
    }
    if (session) {
      console.log("[auth.ts] getSupabaseSession: Session found, User ID:", session.user.id);
    } else {
      console.log("[auth.ts] getSupabaseSession: No session found (getSession returned null data).");
    }
    return session;
  } catch (e: any) {
    console.error("[auth.ts] getSupabaseSession: Caught an exception during getSession():", e.message, e);
    return null;
  }
};

// The old isLoggedIn() function that only checked localStorage has been removed.
// Always use getSupabaseUser() or getSupabaseSession() to check actual auth state.
