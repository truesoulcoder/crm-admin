"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, ReactNode } from "react";
import { getSupabaseSession, logout } from "@/lib/auth"; 
import { createBrowserClient } from "@supabase/ssr"; 

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export default function RequireAuth({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    console.log("[RequireAuth] useEffect: Initializing auth check.");

    const checkCurrentSession = async () => {
      if (!isMounted) return;
      console.log("[RequireAuth] checkCurrentSession: Checking...");
      try {
        const session = await getSupabaseSession();
        if (session) {
          console.log("[RequireAuth] checkCurrentSession: Session found. User authenticated.");
          if (isMounted) {
            setIsAuthenticated(true);
            setAuthError(null);
          }
        } else {
          console.log("[RequireAuth] checkCurrentSession: No active session. Redirecting to login.");
          if (isMounted) {
            setIsAuthenticated(false);
            if (window.location.pathname !== "/") {
              router.replace("/");
            }
          }
        }
      } catch (e: any) {
        console.error("[RequireAuth] checkCurrentSession: Error checking session:", e);
        if (isMounted) setAuthError("Error verifying authentication. Please try logging in again.");
        await logout(); 
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    checkCurrentSession();

    const supabaseForListener = createBrowserClient(supabaseUrl, supabaseAnonKey);
    const { data: authListener } = supabaseForListener.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;
      console.log("[RequireAuth] onAuthStateChange: Event:", event, "Session:", session ? 'exists' : 'null');
      if (event === "SIGNED_IN" && session) {
        console.log("[RequireAuth] onAuthStateChange: SIGNED_IN. User authenticated.");
        setIsAuthenticated(true);
        setAuthError(null);
        setLoading(false); 
      } else if (event === "SIGNED_OUT") {
        console.log("[RequireAuth] onAuthStateChange: SIGNED_OUT. User not authenticated. Redirecting.");
        setIsAuthenticated(false);
        setLoading(false); 
        if (window.location.pathname !== "/") {
          router.replace("/");
        }
      } else if (event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
         if (session) {
            console.log("[RequireAuth] onAuthStateChange: Token refreshed or user updated. User remains authenticated.");
            setIsAuthenticated(true);
         } else {
            console.log("[RequireAuth] onAuthStateChange: Token refresh resulted in no session. User not authenticated. Redirecting.");
            setIsAuthenticated(false);
            setLoading(false);
            if (window.location.pathname !== "/") {
              router.replace("/");
            }
         }
      }
    });

    return () => {
      isMounted = false;
      if (authListener?.subscription) {
        console.log("[RequireAuth] useEffect: Cleaning up auth listener.");
        authListener.subscription.unsubscribe();
      }
    };
  }, [router]);

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-base-100">
        <span className="loading loading-spinner loading-lg text-primary"></span>
        <p className="mt-4 text-lg">Checking authentication...</p>
      </div>
    );
  }

  if (authError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-base-100 p-4">
        <div role="alert" className="alert alert-error shadow-lg max-w-md">
          <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2 2m2-2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <div>
            <h3 className="font-bold">Authentication Error</h3>
            <div className="text-xs">{authError}</div>
          </div>
          <button className="btn btn-sm btn-primary" onClick={() => router.replace('/')}>Go to Login</button>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    console.log("[RequireAuth] Render: Not authenticated, returning null (should have redirected).");
    return null; 
  }

  console.log("[RequireAuth] Render: Authenticated, rendering children.");
  return <>{children}</>;
}
