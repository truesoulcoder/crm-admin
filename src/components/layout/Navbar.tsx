'use client';

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
        
        // Get the current user session
        const { data: { user }, error } = await supabase.auth.getUser();
        
        if (error) throw error;
        if (!user) throw new Error('No user logged in');
        
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
        setAvatarUrl(null);
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
                ) : avatarUrl ? (
                  <img 
                    src={avatarUrl} 
                    alt={fullName || 'User avatar'} 
                    width={40} 
                    height={40}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      // Fallback to UserCircle if image fails to load
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      // Show the fallback icon
                      const parent = target.parentNode as HTMLElement;
                      const fallback = document.createElement('div');
                      fallback.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-user text-primary"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
                      parent.appendChild(fallback);
                    }}
                  />
                ) : (
                  <UserCircle size={32} className="text-primary" />
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
            <li><a>Profile Settings</a></li>
            <li><a>Account</a></li>
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
