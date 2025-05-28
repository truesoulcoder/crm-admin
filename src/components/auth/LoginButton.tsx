// src/components/auth/LoginButton.tsx
'use client'

import { createClient } from '@/lib/supabase/client'

export function LoginButton() {
  const supabase = createClient()

  const handleGoogleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent'
        }
      }
    })

    if (error) {
      console.error('Login error:', error)
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