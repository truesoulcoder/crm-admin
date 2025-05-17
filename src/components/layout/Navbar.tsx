'use client';

'use client';

import { Menu, Bell, UserCircle, Search } from 'lucide-react';
import Image from 'next/image';
import React, { useState, useEffect } from 'react';

import ThemeSelector from '@/components/ThemeSelector';

interface NavbarProps {
  onMenuClick: () => void; // For mobile sidebar toggle
}

const Navbar: React.FC<NavbarProps> = ({ onMenuClick }) => {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [fullName, setFullName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    interface GmailProfileResponse {
      picture?: string;
      name?: string;
      email?: string;
      [key: string]: unknown;
    }

    const fetchProfile = async (): Promise<GmailProfileResponse> => {
      const res = await fetch('/api/gmail/profile');
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      const data = await res.json() as GmailProfileResponse;
      return data;
    };

    const loadProfile = async () => {
      try {
        setIsLoading(true);
        const data = await fetchProfile();
        setAvatarUrl(data.picture || null);
        setFullName(data.name || null);
      } catch (error: unknown) {
        // In a production app, log to an error reporting service
        // eslint-disable-next-line no-console
        console.error('Gmail profile error:', error instanceof Error ? error.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    };

    void loadProfile();
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
        {/* Notification bell */}
        <div className="dropdown dropdown-end ml-2">
          <button tabIndex={0} className="btn btn-ghost btn-circle">
            <div className="indicator">
              <Bell size={20} />
              <span className="badge badge-xs badge-primary indicator-item">3</span>
            </div>
          </button>
          <div tabIndex={0} className="mt-3 z-[1] card card-compact dropdown-content w-52 bg-base-100 shadow">
            <div className="card-body">
              <span className="font-bold text-lg">3 Notifications</span>
              <div className="text-info">You have new leads!</div>
              <div className="card-actions">
                <button className="btn btn-primary btn-block btn-sm">View all</button>
              </div>
            </div>
          </div>
        </div>
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
