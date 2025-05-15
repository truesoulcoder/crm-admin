'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { Menu, Bell, UserCircle, Sun, Moon, Search } from 'lucide-react';

interface NavbarProps {
  onMenuClick: () => void; // For mobile sidebar toggle
}

const Navbar: React.FC<NavbarProps> = ({ onMenuClick }) => {
  const [currentTheme, setCurrentTheme] = useState('light');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [fullName, setFullName] = useState<string | null>(null);

  useEffect(() => {
    // Initialize theme from localStorage or default
    const savedTheme = localStorage.getItem('theme') || 'light';
    setCurrentTheme(savedTheme);
    document.documentElement.setAttribute('data-theme', savedTheme);
  }, []);

  useEffect(() => {
    fetch('/api/gmail/profile')
      .then(res => res.json())
      .then(profile => {
        setAvatarUrl(profile.picture || null);
        setFullName(profile.name || null);
      })
      .catch(err => console.error('Gmail profile error:', err));
  }, []);

  const toggleTheme = () => {
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    setCurrentTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
  };

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
      <div className="navbar-end">
        <button onClick={toggleTheme} className="btn btn-ghost btn-circle">
          {currentTheme === 'light' ? <Sun size={20} /> : <Moon size={20} />}
        </button>
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
              {avatarUrl ? (
                <Image src={avatarUrl} alt="User avatar" width={32} height={32} />
              ) : (
                <UserCircle size={32} className="text-primary" />
              )}
            </div>
          </button>
          <ul tabIndex={0} className="menu menu-sm dropdown-content mt-3 z-[1] p-2 shadow bg-base-100 rounded-box w-52">
            <li>
              <a
                onClick={() => {
                  import('@/lib/auth').then(({ logout }) => {
                    logout();
                    window.location.href = '/';
                  });
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
