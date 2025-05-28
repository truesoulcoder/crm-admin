'use client';

import { useRouter } from 'next/navigation';

import { signOut } from '@/actions/auth';

import { Button } from '@/components/ui/button';

export function LogoutButton({ className }: { className?: string }) {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await signOut();
      // Force a full page reload to clear all client-side state
      window.location.href = '/login';
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <Button 
      variant="ghost" 
      className={className}
      onClick={handleLogout}
    >
      Sign Out
    </Button>
  );
}
