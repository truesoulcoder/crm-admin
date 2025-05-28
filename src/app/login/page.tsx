'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';

// Components
import { GoogleLoginButton } from '@/components/auth/GoogleLoginButton';
import { Background } from '@/components/ui/Background';

// UI Components
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { useToast } from '@/components/ui/use-toast';

// Services
import { supabase } from '@/lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [mousePosition, setMousePosition] = useState({ x: 50, y: 0 });

  const openModal = () => setIsModalOpen(true);
  const closeModal = () => setIsModalOpen(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      setMousePosition({ x, y });
    }
  };

  useEffect(() => {
    // Handle auth errors
    const errorMsg = searchParams?.get('error');
    if (errorMsg) {
      toast({
        title: 'Authentication Error',
        description: 'There was an error signing in. Please try again.',
        variant: 'destructive',
      });
      // Clear the error from the URL
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('error');
      window.history.replaceState({}, '', newUrl.toString());
    }

    // If user is already logged in, redirect to dashboard
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        router.replace('/dashboard');
      }
    };
    
    void checkUser();
  }, [router, searchParams, toast]);

  const handleLogin = async () => {
    try {
      setIsLoading(true);
      const { data, error: authError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/api/auth/google`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
            next: '/dashboard',
          },
        },
      });
      
      if (authError) {
        console.error('Authentication error:', authError);
        throw new Error(authError.message || 'Authentication failed');
      }
    } catch (err) {
      console.error('Error signing in with Google:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative flex h-screen w-full items-center justify-center overflow-hidden bg-gradient-to-br from-slate-900 to-slate-800 text-white"
      onMouseMove={handleMouseMove}
    >
      {/* Example Modal */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={closeModal}
        title="Example Modal"
      >
        <p className="mb-4">This is an example modal. Click outside or press ESC to close.</p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={closeModal}>
            Cancel
          </Button>
          <Button variant="primary" onClick={closeModal}>
            Confirm
          </Button>
        </div>
      </Modal>

      {/* Button to open the modal */}
      <Button 
        variant="primary" 
        onClick={openModal}
        className="absolute top-4 right-4 z-10"
      >
        Open Modal
      </Button>

      <Background
        fill
        height={16}
        gradient={{ 
          display: true, 
          opacity: 1,
          x: mousePosition.x,
          y: mousePosition.y,
          colorStart: 'hsl(var(--a))', // Using accent color
          colorEnd: 'transparent'
        }}
        lines={{
          display: true,
          opacity: 0.1,
          size: 16,
          thickness: 1,
          angle: 90,
          color: 'hsl(var(--a))' // Using accent color
        }}
        mask={{
          x: mousePosition.x,
          y: mousePosition.y,
          radius: 100 // Adding required radius property
        }}
      />
      
      <div className="relative z-10 w-full max-w-md p-8 space-y-6 bg-background/80 backdrop-blur-sm rounded-lg shadow-lg">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-bold">Welcome back</h1>
          <p className="text-muted-foreground">Sign in to your account to continue</p>
        </div>
        
        <div className="space-y-4">
          <Button
            onClick={handleLogin}
            variant="outline" 
            type="button" 
            className="w-full"
            disabled={isLoading}
          >
            {isLoading ? (
              <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Icons.google className="mr-2 h-4 w-4" />
            )}
            Continue with Google
          </Button>
        </div>
      </div>
    </div>
  );
}
