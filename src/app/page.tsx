"use client";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { parseOAuthHash, setLoginState } from "@/lib/auth";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const processAuth = async () => {
      if (typeof window !== "undefined") {
        if (window.location.hash && window.location.hash.includes("access_token")) {
          const parsed = parseOAuthHash(window.location.hash);
          if (parsed?.access_token) {
            await setLoginState(parsed.access_token, parsed.refresh_token);
            window.location.hash = "";
            router.replace("/dashboard");
            return; // Exit after handling auth
          }
        }
        // If not handled by hash, check if already logged in
        const isLoggedIn = localStorage.getItem("isLoggedIn") === "true";
        if (isLoggedIn) {
          router.replace("/dashboard");
        }
      }
    };

    void processAuth();
  }, [router]);

  const handleGoogleLogin = () => {
    window.location.href = "/api/auth/google";
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-base-100">
      <div className="bg-black shadow-lg rounded-lg p-8 w-full max-w-md flex flex-col items-center">
        <Image
          src="https://oviiqouhtdajfwhpwbyq.supabase.co/storage/v1/object/public/media//logo.png"
          alt="App Logo"
          width={112} // w-28 = 7rem = 112px
          height={112} // h-28 = 7rem = 112px
          className="mb-8 rounded-full shadow"
          priority
        />
        <button
          onClick={handleGoogleLogin}
          className="flex items-center px-6 py-3 bg-primary text-white rounded-lg shadow hover:bg-primary-focus transition font-semibold text-lg"
        >
          Sign in with Google
        </button>
      </div>
    </main>
  );
}
