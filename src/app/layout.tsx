// src/app/layout.tsx
// eslint-disable-next-line import/order
import type { Metadata } from 'next';

import { Inter } from 'next/font/google';

import './globals.css'; // Uses src/app/globals.css
import { UserProvider } from '@/contexts/UserContext';

import ClientLayout from './layout-client'; // Import the client layout

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'CRM Admin',
  description: 'CRM Administration Panel',
};

export function generateViewport() {
  return {
    width: 'device-width',
    initialScale: 1.0,
  };
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <UserProvider>
          <ClientLayout>{children}</ClientLayout> {/* ClientLayout wraps children and includes MainAppShell */}
        </UserProvider>
      </body>
    </html>
  );
}
