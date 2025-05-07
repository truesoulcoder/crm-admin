'use client';

import React, { useState, useEffect } from 'react';
import { Menu, Bell, UserCircle, Sun, Moon, Search } from 'lucide-react';

interface NavbarProps {
  onMenuClick: () => void; // For mobile sidebar toggle
}

const Navbar: React.FC<NavbarProps> = ({ onMenuClick }) => {
  const [currentTheme, setCurrentTheme] = useState('light');

  useEffect(() => {
    // Initialize theme from localStorage or default
    const savedTheme = localStorage.getItem('theme') || 'light';
    setCurrentTheme(savedTheme);
    document.documentElement.setAttribute('data-theme', savedTheme);
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
          {/* Corrected: Show Sun for light theme (to switch to dark), Moon for dark theme (to switch to light) */}
          {currentTheme === 'light' ? <Sun size={20} /> : <Moon size={20} />}
        </button>

        <div className="dropdown dropdown-end">
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

        <div className="dropdown dropdown-end ml-2">
          <button tabIndex={0} className="btn btn-ghost btn-circle avatar">
            <div className="w-8 rounded-full ring ring-primary ring-offset-base-100 ring-offset-1">
              <img src={`https://placehold.co/80x80/661AE6/FFFFFF?text=A`} alt="User avatar" />
            </div>
          </button>
          <ul tabIndex={0} className="menu menu-sm dropdown-content mt-3 z-[1] p-2 shadow bg-base-100 rounded-box w-52">
            <li>
              <a className="justify-between">
                Profile
                <span className="badge badge-info">New</span>
              </a>
            </li>
            <li><a>Settings (Link to view)</a></li>
            <li><a>Logout (Implement Supabase logout)</a></li>
          </ul>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
