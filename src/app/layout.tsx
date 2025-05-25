import { Inter } from 'next/font/google';

// eslint-disable-next-line import/no-named-as-default
import Background from '@/components/ui/Background';
import { UserProvider } from '@/contexts/UserContext';

import ClientLayout from './layout-client'; // Import the client layout

import type { Metadata } from 'next';


import './globals.css'; // Uses src/app/globals.css




const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'CRM Admin',
  description: 'CRM Administration Panel',
  icons: {
    icon: 'https://oviiqouhtdajfwhpwbyq.supabase.co/storage/v1/object/public/media//favicon.ico',
    shortcut: 'https://oviiqouhtdajfwhpwbyq.supabase.co/storage/v1/object/public/media//favicon.ico',
    apple: 'https://oviiqouhtdajfwhpwbyq.supabase.co/storage/v1/object/public/media//favicon.ico',
  },
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
        <Background
  fill={true}
  gradient={{ display: true, opacity: 0.8, x: 50, y: 30, colorStart: '#2e026d', colorEnd: '#15162c' }}
  lines={{ display: true, opacity: 0.07, size: 70, thickness: 2, angle: 45, color: '#fff' }}
  mask={{ x: 50, y: 50, radius: 0 }}
>
          <UserProvider>
            <ClientLayout>{children}</ClientLayout> {/* ClientLayout wraps children and includes MainAppShell */}
          </UserProvider>
        </Background>
      </body>
    </html>
  );
}
