'use client';

import { Menu } from 'lucide-react';

import ThemeToggle from '@/components/ThemeToggle';

interface NavbarProps {
  toggleSidebar: () => void;
  isSidebarOpen: boolean;
}

const Navbar: React.FC<NavbarProps> = ({ toggleSidebar, isSidebarOpen }) => {
  return (
    <div className="navbar bg-base-100 shadow-sm">
      <div className="flex-none lg:hidden">
        <button 
          className="btn btn-square btn-ghost"
          onClick={toggleSidebar}
          aria-label={isSidebarOpen ? 'Close sidebar' : 'Open sidebar'}
        >
          <Menu className="h-6 w-6" />
        </button>
      </div>
      <div className="flex-1">
        {/* Add your navbar content here */}
      </div>
      <div className="flex-none">
        <ThemeToggle />
      </div>
    </div>
  );
};

export default Navbar;
