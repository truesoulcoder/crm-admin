"use client";

import { useRouter, usePathname } from "next/navigation";
import { useEffect, ReactNode } from "react";
import { useUser } from "@/contexts/UserContext";
import Head from 'next/head'; // For setting page title

export default function RequireAuth({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoading, role, error: userContextError } = useUser();

  useEffect(() => {
    console.log("[RequireAuth] Status update - isLoading:", isLoading, "user present:", !!user, "current role:", role, "current path:", pathname);
    if (!isLoading) {
      if (!user) {
        console.log("[RequireAuth] Not loading and no user found. Redirecting to /login from path:", pathname);
        if (pathname !== '/login') { // Prevent redirect loop if somehow RequireAuth is used on /login
          router.replace("/login");
        }
      } else {
        // User is authenticated. Optional: Add further role-based checks if needed for specific pages,
        // though UserContext and individual page logic often handle this.
        console.log("[RequireAuth] Authenticated user found. Role:", role, "Accessing path:", pathname);
      }
    }
  }, [user, isLoading, role, router, pathname]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-base-100">
        <Head>
          <title>Loading Access... | CRM Admin</title>
        </Head>
        <span className="loading loading-spinner loading-lg text-primary"></span>
        <p className="mt-4 text-lg">Verifying access...</p>
      </div>
    );
  }

  if (userContextError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-base-100 p-4">
        <Head>
          <title>Auth Error | CRM Admin</title>
        </Head>
        <div role="alert" className="alert alert-error shadow-lg max-w-md">
          <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2 2m2-2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <div>
            <h3 className="font-bold">Authentication Context Error</h3>
            <div className="text-xs">{userContextError}</div>
          </div>
          <button className="btn btn-sm btn-primary" onClick={() => router.replace('/login')}>Go to Login</button>
        </div>
      </div>
    );
  }

  // If still loading, the above block handles it.
  // If error, that's handled.
  // If not loading, no error, but no user, redirect in useEffect should have fired.
  // This is a final check before rendering children.
  if (!user) {
    // This state should ideally not be reached if useEffect redirect works, 
    // as router.replace should prevent rendering this path further.
    // However, if it is reached (e.g. during fast refresh or edge cases), returning null is safest.
    console.log("[RequireAuth] Render: No user and not loading. Expecting redirect. Path:", pathname);
    return null; 
  }

  // If we reach here, user is authenticated and there's no loading/error from context.
  console.log("[RequireAuth] Render: User authenticated. Rendering children for path:", pathname);
  return <>{children}</>;
}
