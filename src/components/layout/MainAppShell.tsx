'use client';

// External dependencies
import { useState, useEffect, useRef, useCallback, useMemo, ChangeEvent, FormEvent } from 'react'; 
import { Button, Card, Table, Modal, Alert, Badge } from 'react-daisyui';
import { toast } from 'react-hot-toast';

import GoogleMapsLoader from '@/components/maps/GoogleMapsLoader'; // Import GoogleMapsLoader
import RequireAuth from '@/components/RequireAuth'; // Assuming RequireAuth is in src/components

import Navbar from './Navbar';
import Sidebar from './Sidebar';




type MainAppShellProps = {
  children?: React.ReactNode;
};

const MainAppShell: React.FC<MainAppShellProps> = ({ children }) => {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const toggleMobileSidebar = () => {
    const drawerCheckbox = document.getElementById('sidebar-drawer-toggle') as HTMLInputElement | null;
    if (drawerCheckbox) {
        drawerCheckbox.checked = !drawerCheckbox.checked;
        setIsMobileSidebarOpen(drawerCheckbox.checked);
    }
  };

  return (
    <GoogleMapsLoader>
      <div className="drawer lg:drawer-open">
      <input id="sidebar-drawer-toggle" type="checkbox" className="drawer-toggle" />
      <div className="drawer-content flex flex-col">
        {/* Navbar */}
        <Navbar onMenuClick={toggleMobileSidebar} />
        {/* Main content area */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 bg-base-100">
          <RequireAuth>
            {children}
          </RequireAuth>
        </main>
      </div>
      {/* Sidebar */}
      <div className="drawer-side z-30">
        <label htmlFor="sidebar-drawer-toggle" aria-label="close sidebar" className="drawer-overlay"></label>
        <Sidebar />
      </div>
    </div>
    </GoogleMapsLoader>
  );
};

export default MainAppShell;
