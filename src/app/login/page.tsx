"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();

  useEffect(() => {
    // If already authenticated, redirect to dashboard
    const isLoggedIn = typeof window !== "undefined" && localStorage.getItem("isLoggedIn") === "true";
    if (isLoggedIn) router.replace("/dashboard");
  }, [router]);

  const handleGoogleLogin = () => {
    window.location.href = "/api/auth/google";
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-base-100">
      <div className="bg-white shadow-lg rounded-lg p-8 w-full max-w-md flex flex-col items-center">
        <img src="https://oviiqouhtdajfwhpwbyq.supabase.co/storage/v1/object/public/media//logo.png" alt="App Logo" className="w-28 h-28 mb-8 rounded-full shadow" />
        <button
          onClick={handleGoogleLogin}
          className="flex items-center px-6 py-3 bg-primary text-white rounded-lg shadow hover:bg-primary-focus transition font-semibold text-lg"
        >
          <svg className="w-6 h-6 mr-2" viewBox="0 0 48 48">
            <g>
              <path fill="#4285F4" d="M43.6 20.5h-1.9V20H24v8h11.3c-1.6 4.3-5.7 7.5-10.3 7.5-6.1 0-11-4.9-11-11s4.9-11 11-11c2.6 0 5 .9 6.9 2.4l6-6C35.1 7.1 29.8 5 24 5 12.9 5 4 13.9 4 25s8.9 20 20 20c10 0 19.2-7.2 19.2-20 0-1.3-.1-2.5-.3-3.5z"/>
              <path fill="#34A853" d="M6.3 14.7l6.6 4.8C14.5 16.1 19 13 24 13c2.6 0 5 .9 6.9 2.4l6-6C35.1 7.1 29.8 5 24 5c-7.3 0-13.5 4-17 9.7z"/>
              <path fill="#FBBC05" d="M24 45c5.4 0 10.4-1.8 14.3-4.8l-6.6-5.4C29.8 36.9 27 38 24 38c-4.6 0-8.7-3.2-10.3-7.5l-6.6 5.1C8.8 41.1 15.9 45 24 45z"/>
              <path fill="#EA4335" d="M43.6 20.5h-1.9V20H24v8h11.3c-1.3 3.3-4.3 5.7-7.3 6.5l6.6 5.4C40.9 37.7 44 32.2 44 25c0-1.6-.1-3.1-.4-4.5z"/>
            </g>
          </svg>
          Sign in with Google
        </button>
      </div>
    </main>
  );
}