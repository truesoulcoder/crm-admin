// src/components/auth/LoginButton.tsx
'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export function LoginButton() {
  const router = useRouter()
  const supabase = createClient()

// src/components/auth/LoginButton.tsx
const handleGoogleLogin = async () => {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: 'https://truesoulpartners.vercel.app/auth/callback',
      queryParams: {
        access_type: 'offline',
        prompt: 'consent'
      }
    }
  })
  if (error) console.error('Login error:', error.message)
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