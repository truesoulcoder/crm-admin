"use client";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { parseOAuthHash, setLoginState, getSupabaseUser, logout } from "@/lib/auth";

export default function Home() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const processAuth = async () => {
      if (typeof window === "undefined" || !isMounted) return;
      console.log("[Home Page] useEffect: Starting auth processing.");

      try {
        // 1. Check for OAuth hash first
        if (window.location.hash && window.location.hash.includes("access_token")) {
          console.log("[Home Page] useEffect: Found OAuth hash in URL.");
          const parsed = parseOAuthHash(window.location.hash);
          window.location.hash = ""; // Clear hash immediately

          if (parsed?.access_token && parsed.refresh_token) {
            console.log("[Home Page] useEffect: Parsed tokens from hash, attempting setLoginState.");
            const loginSuccess = await setLoginState(parsed.access_token, parsed.refresh_token);
            if (loginSuccess) {
              console.log("[Home Page] useEffect: setLoginState successful, redirecting to /dashboard.");
              if (isMounted) router.replace("/dashboard");
              return; // Exit after successful auth
            } else {
              console.error("[Home Page] useEffect: setLoginState failed after parsing hash.");
              if (isMounted) setError("Login failed. Please try again.");
              // Proceed to check existing session or show login button
            }
          } else {
            console.warn("[Home Page] useEffect: Could not parse tokens from hash or tokens missing.");
          }
        }

        // 2. If no hash or hash processing failed, check for existing Supabase session
        console.log("[Home Page] useEffect: No hash or hash processing failed/incomplete. Checking existing session.");
        const user = await getSupabaseUser();
        if (user) {
          console.log("[Home Page] useEffect: Existing user session found, redirecting to /dashboard.");
          // Verify local storage consistency, not strictly necessary but good practice
          if (localStorage.getItem('isLoggedIn') !== 'true') {
            localStorage.setItem('isLoggedIn', 'true');
          }
          if (isMounted) router.replace("/dashboard");
          return; // Exit if already logged in
        } else {
          console.log("[Home Page] useEffect: No existing user session found.");
          // Ensure local state is clean if no Supabase user
          if (localStorage.getItem('isLoggedIn') === 'true') {
             await logout(); // Clears local storage and Supabase local session if any mismatch
          }
        }

      } catch (e: any) {
        console.error("[Home Page] useEffect: Error during auth processing:", e);
        if (isMounted) setError(e.message || "An unexpected error occurred during login.");
      }
      
      if (isMounted) setLoading(false);
      console.log("[Home Page] useEffect: Auth processing finished, user not logged in or error occurred.");
    };

    void processAuth();

    return () => {
      isMounted = false;
      console.log("[Home Page] useEffect: Component unmounted.");
    };
  }, [router]);

  const handleGoogleLogin = () => {
    setLoading(true); // Show loading spinner while redirecting
    setError(null);   // Clear previous errors
    window.location.href = "/api/auth/google";
  };

  if (loading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-base-100">
        <span className="loading loading-spinner loading-lg text-primary"></span>
        <p className="mt-4 text-lg">Authenticating...</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-base-100">
      <div className="card w-full max-w-md bg-base-200 shadow-xl items-center p-8">
        <figure className="px-10 pt-10 mb-6">
            <Image
            src="https://oviiqouhtdajfwhpwbyq.supabase.co/storage/v1/object/public/media//logo.png"
            alt="App Logo"
            width={112} // w-28 = 7rem = 112px
            height={112} // h-28 = 7rem = 112px
            className="rounded-full shadow-lg"
            priority
            />
        </figure>
        <div className="card-body items-center text-center">
            {error && (
                <div role="alert" className="alert alert-error mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2 2m2-2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    <span>Error! {error}</span>
                </div>
            )}
            <button
            onClick={handleGoogleLogin}
            className="btn btn-primary btn-lg text-base-100"
            >
            Sign in with Google
            </button>
        </div>
      </div>
    </main>
  );
}
