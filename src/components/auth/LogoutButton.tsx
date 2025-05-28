// src/components/auth/LoginButton.tsx
'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export function LoginButton() {
  const router = useRouter()
  const supabase = createClient()

  const handleGoogleLogin = async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    })

    if (error) {
      console.error('Error logging in:', error.message)
    }
  }

  return (
    <button 
      onClick={handleGoogleLogin} 
      className="btn btn-primary"
    >
      Sign in with Google
    </button>
  )
}