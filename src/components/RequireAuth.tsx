"use client";

import Head from 'next/head';
import { useRouter, usePathname } from "next/navigation";
import { useEffect, ReactNode } from "react";

import { useUser } from "@/contexts/UserContext";

export default function RequireAuth({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoading, error: userContextError } = useUser();

  useEffect(() => {
    if (!isLoading && !user) {
      if (pathname !== '/') {
        router.replace("/");
      }
    }
  }, [user, isLoading, router, pathname]);

  if (isLoading) {
    return (
      <>
        <Head>
          <title>Loading User...</title>
        </Head>
        <div className="flex items-center justify-center h-screen text-center">
          <p className="text-lg">Loading application...</p>
          {/* You can add a spinner component here if available in your project */}
          {/* e.g., <span className="loading loading-spinner loading-lg"></span> */}
        </div>
      </>
    );
  }

  if (userContextError) {
    return (
      <>
        <Head>
          <title>Authentication Error</title>
        </Head>
        <div className="flex flex-col items-center justify-center h-screen text-center p-4">
          <p className="text-lg text-red-600">Authentication Error</p>
          <p className="text-sm text-gray-700 mt-2">
            There was an issue loading your user information: {userContextError.message}.
          </p>
          <p className="text-sm text-gray-500 mt-1">
            Please try refreshing the page or contact support if the problem persists.
          </p>
        </div>
      </>
    );
  }

  if (!user && pathname !== '/') {
    // The useEffect hook handles redirection. This state should be brief.
    // Display a placeholder while redirecting.
    return (
      <>
        <Head>
          <title>Redirecting...</title>
        </Head>
        <div className="flex items-center justify-center h-screen text-center">
          <p className="text-lg">Redirecting to login page...</p>
        </div>
      </>
    );
  }

  // If user is authenticated, or if it's the login page itself (even if !user), render children.
  return <>{children}</>;
}
