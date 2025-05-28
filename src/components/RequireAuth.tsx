"use client";

import Head from 'next/head';
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useRef, ReactNode } from "react";

import { useUser } from "@/contexts/UserContext";

// Define public paths that don't require authentication
const publicPaths = ['/'];

interface RequireAuthProps {
  children: ReactNode;
}

const RequireAuth: React.FC<RequireAuthProps> = ({ children }) => {
  const { user, loading, error: userContextError } = useUser();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (loading) return; // Wait for user context to load

    if (user) {
      // If logged in and on the root path, redirect to dashboard
      if (pathname === '/') {
        router.push('/dashboard');
      }
    } else if (pathname !== '/') {
      // If not logged in and not on the login page, redirect to login
      router.push('/');
    }
  }, [user, isLoading, pathname, router]);

  if (isLoading) {
    return (
      <>
        <Head>
          <title>Loading User...</title>
        </Head>
        <div className="flex items-center justify-center h-screen text-center">
          <p className="text-lg">Loading application...</p>
          <span className="loading loading-spinner loading-lg ml-2"></span>
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
            There was an issue loading your user information: {userContextError}
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
