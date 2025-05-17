'use client';

import { Menu, UserCircle, Search } from 'lucide-react';
import Image from 'next/image';
import { useEffect, useState } from 'react';

import ThemeSelector from '@/components/ThemeSelector';
import { createClient } from '@/lib/supabase/client';

interface NavbarProps {
  onMenuClick: () => void; // For mobile sidebar toggle
}

const Navbar: React.FC<NavbarProps> = ({ onMenuClick }) => {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [fullName, setFullName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        setIsLoading(true);
        const supabase = createClient();
        
        // Get the current user session
        const { data: { user }, error } = await supabase.auth.getUser();
        
        if (error) throw error;
        if (!user) throw new Error('No user logged in');
        
        // Set user data from the auth session with proper type safety
        setAvatarUrl(user.user_metadata?.avatar_url || null);
        setFullName(user.user_metadata?.full_name || user.email?.split('@')[0] || 'User');
      } catch (error: unknown) {
        console.error('Error loading user profile:', error instanceof Error ? error.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    };

    void loadProfile();
    
    // Set up auth state change listener
    const supabase = createClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        const user = session.user;
        setAvatarUrl(user.user_metadata?.avatar_url || null);
        setFullName(user.user_metadata?.full_name || user.email?.split('@')[0] || 'User');
      } else if (event === 'SIGNED_OUT') {
        setAvatarUrl(null);
        setFullName(null);
      }
    });
    
    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  return (
    <nav className="navbar bg-base-100 shadow-sm sticky top-0 z-20">
      <div className="navbar-start">
        <button onClick={onMenuClick} className="btn btn-ghost btn-circle lg:hidden">
          <Menu size={24} />
        </button>
        <div className="form-control hidden md:flex">
          <div className="input-group">
            <input type="text" placeholder="Search…" className="input input-bordered input-sm" />
            <button className="btn btn-square btn-sm">
              <Search size={18} />
            </button>
          </div>
        </div>
      </div>
      <div className="navbar-end gap-1">
        <ThemeSelector />
        {/* Avatar dropdown */}
        <div className="dropdown dropdown-end ml-2">
          <button tabIndex={0} className="btn btn-ghost btn-circle avatar">
            <div className="w-8 rounded-full ring ring-primary ring-offset-base-100 ring-offset-1">
              {isLoading ? (
                <div className="w-8 h-8 rounded-full bg-base-300 animate-pulse" />
              ) : avatarUrl ? (
                <Image 
                  src={avatarUrl} 
                  alt={fullName || 'User avatar'} 
                  width={32} 
                  height={32}
                  className="rounded-full"
                  onError={(e) => {
                    // Fallback to UserCircle if image fails to load
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                  }}
                />
              ) : (
                <UserCircle size={32} className="text-primary" />
              )}
            </div>
          </button>
          <ul tabIndex={0} className="menu menu-sm dropdown-content mt-3 z-[1] p-2 shadow bg-base-100 rounded-box w-52">
            <li>
              <a
                onClick={() => {
                  const handleLogout = async () => {
                    try {
                      const { logout } = await import('@/lib/auth');
                      await logout();
                      window.location.href = '/';
                    } catch (error) {
                      // In a production app, log to an error reporting service
                      // eslint-disable-next-line no-console
                      console.error('Logout failed:', error);
                      // Optionally show an error message to the user
                      alert('Logout failed. Please try again.');
                    }
                  };
                  void handleLogout();
                }}
              >
                Logout
              </a>
            </li>
          </ul>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
