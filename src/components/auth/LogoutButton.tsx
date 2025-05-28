// src/components/auth/LogoutButton.tsx
'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export function LogoutButton() {
  const router = useRouter()
  const supabase = createClient()

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) {
      console.error('Logout error:', error.message)
    } else {
      router.push('/login')
      router.refresh()
    }
  }

  return (
    <button 
      onClick={handleLogout} 
      className="btn btn-ghost"
    >
      Sign Out
    </button>
  )
}