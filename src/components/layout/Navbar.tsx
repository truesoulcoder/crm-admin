'use client';

// Helper function to generate initials from a name
function getInitials(name?: string): string {
  if (!name || name.trim() === '') return '??';
  const parts = name.trim().split(' ').filter(p => p !== '');
  if (parts.length === 1 && parts[0].length > 0) return parts[0].substring(0, 2).toUpperCase();
  if (parts.length > 1) {
    const firstInitial = parts[0].substring(0, 1);
    const lastInitial = parts[parts.length - 1].substring(0, 1);
    return `${firstInitial}${lastInitial}`.toUpperCase();
  }
  return '??';
}

import { Menu, UserCircle, Search } from 'lucide-react';
import Image from 'next/image';
import { useEffect, useState } from 'react';

import ThemeSelector from '@/components/ThemeSelector';
import { createClient } from '@/lib/supabase/client';
import { updateUserProfile } from '@/actions/update-user-profile';

interface NavbarProps {
  onMenuClick: () => void; // For mobile sidebar toggle
}

const Navbar: React.FC<NavbarProps> = ({ onMenuClick }) => {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [fullName, setFullName] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        setIsLoading(true);
        const supabase = createClient();
        // Check for session before fetching user
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setFullName(null);
          setEmail(null);
          setIsLoading(false);
          return;
        }
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error || !user) {
          setFullName(null);
          setEmail(null);
          setIsLoading(false);
          return;
        }
        
        // Try multiple possible locations for the avatar URL
        let avatarUrl = user.user_metadata?.avatar_url || 
                       user.user_metadata?.picture ||
                       user.identities?.[0]?.identity_data?.avatar_url ||
                       user.identities?.[0]?.identity_data?.picture ||
                       null;
        
        const fullName = user.user_metadata?.full_name ||
                        user.user_metadata?.name ||
                        user.identities?.[0]?.identity_data?.full_name ||
                        user.identities?.[0]?.identity_data?.name ||
                        user.email?.split('@')[0] ||
                        'User';
        
        // Only try to update profile if we don't have an avatar URL yet
        if (!avatarUrl) {
          const { error: updateError } = await updateUserProfile();
          if (!updateError) {
            // If update was successful, refetch user data
            const { data: { user: updatedUser } } = await supabase.auth.getUser();
            if (updatedUser) {
              avatarUrl = updatedUser.user_metadata?.avatar_url || 
                         updatedUser.identities?.[0]?.identity_data?.avatar_url ||
                         null;
            }
          }
        }
        
        // Force HTTPS if the URL is from Google and using HTTP
        const processedAvatarUrl = avatarUrl?.startsWith('http://') && avatarUrl.includes('googleusercontent.com')
          ? avatarUrl.replace('http://', 'https://')
          : avatarUrl;
          
        setAvatarUrl(processedAvatarUrl || null);
        setFullName(fullName);
        setEmail(user.email || null);
      } catch (error: unknown) {
        console.error('Error loading user profile:', error instanceof Error ? error.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    };

    void loadProfile();
    
    // Set up auth state change listener
    const supabase = createClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        try {
          const user = session.user;
          let avatarUrl = user.user_metadata?.avatar_url || 
                         user.identities?.[0]?.identity_data?.avatar_url ||
                         null;
          
          // Only try to update profile if we don't have an avatar URL yet
          if (!avatarUrl) {
            const { error: updateError } = await updateUserProfile();
            if (!updateError) {
              // If update was successful, refetch user data
              const { data: { user: updatedUser } } = await supabase.auth.getUser();
              if (updatedUser) {
                avatarUrl = updatedUser.user_metadata?.avatar_url || 
                           updatedUser.identities?.[0]?.identity_data?.avatar_url ||
                           null;
              }
            }
          }
          
          const fullName = user.user_metadata?.full_name ||
                          user.identities?.[0]?.identity_data?.full_name ||
                          user.user_metadata?.name ||
                          user.email?.split('@')[0] ||
                          'User';
          
          // Force HTTPS if the URL is from Google and using HTTP
          const processedAvatarUrl = avatarUrl?.startsWith('http://') && avatarUrl.includes('googleusercontent.com')
            ? avatarUrl.replace('http://', 'https://')
            : avatarUrl;
          
          setAvatarUrl(processedAvatarUrl || null);
          setFullName(fullName);
          setEmail(user.email || null);
        } catch (error) {
          console.error('Error in auth state change:', error);
        }
      } else if (event === 'SIGNED_OUT') {
        setFullName(null);
        setEmail(null);
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
          <div className="flex items-center gap-2">
            <div className="text-right hidden sm:block">
              <div className="font-medium text-sm">{fullName}</div>
            </div>
            <button 
              tabIndex={0} 
              className="btn btn-ghost btn-circle avatar"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              <div className="w-10 h-10 rounded-full ring ring-primary ring-offset-base-100 ring-offset-1 flex items-center justify-center bg-base-200 overflow-hidden">
                {isLoading ? (
                  <div className="w-10 h-10 rounded-full bg-base-300 animate-pulse" />
                ) : (
                  <div className="w-10 h-10 flex items-center justify-center rounded-full bg-primary text-primary-content text-lg font-bold border-2 border-base-100 shadow" title={fullName || ''}>
                    {getInitials(fullName ?? undefined)}
                  </div>
                )}
              </div>
            </button>
          </div>
          <ul 
            tabIndex={0} 
            className={`menu menu-sm dropdown-content mt-3 z-[1] p-2 shadow bg-base-100 rounded-box w-60 ${isMenuOpen ? 'block' : 'hidden'}`}
          >
            <li className="menu-title">
              <div className="flex flex-col p-2">
                <span className="font-bold">{fullName}</span>
                {email && <span className="text-xs opacity-70">{email}</span>}
              </div>
            </li>
            <div className="divider my-0"></div>
            <li>
              <a
                onClick={async (e) => {
                  e.preventDefault();
                  try {
                    const { logout } = await import('@/lib/auth');
                    await logout();
                    window.location.href = '/';
                  } catch (error) {
                    console.error('Logout failed:', error);
                    alert('Logout failed. Please try again.');
                  }
                }}
                className="text-error hover:bg-error hover:text-error-content"
              >
                Sign out
              </a>
            </li>
          </ul>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
