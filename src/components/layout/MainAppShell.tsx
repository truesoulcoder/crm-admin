'use client';

import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import Navbar from './Navbar';




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
    <div className="drawer lg:drawer-open">
      <input id="sidebar-drawer-toggle" type="checkbox" className="drawer-toggle" />
      <div className="drawer-content flex flex-col">
        {/* Navbar */}
        <Navbar onMenuClick={toggleMobileSidebar} />
        {/* Main content area */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 bg-base-100">
          {children}
        </main>
      </div>
      {/* Sidebar */}
      <div className="drawer-side z-30">
        <label htmlFor="sidebar-drawer-toggle" aria-label="close sidebar" className="drawer-overlay"></label>
        <Sidebar />
      </div>
    </div>
  );
};

export default MainAppShell;
