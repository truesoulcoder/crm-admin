"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/contexts/UserContext'; 

export default function HomePage() {
  const { user, isLoading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (user) {
        console.log("[HomePage] User found, redirecting to /dashboard");
        router.replace('/dashboard');
      } else {
        console.log("[HomePage] No user found, redirecting to /login");
        router.replace('/login');
      }
    }
  }, [user, isLoading, router]);

  // Display a loading state while determining auth status
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-base-100">
      <span className="loading loading-spinner loading-lg text-primary"></span>
      <p className="mt-4 text-lg">Loading application...</p>
    </div>
  );
}
