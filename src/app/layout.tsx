export const metadata = {
  icons: {
    icon: 'https://oviiqouhtdajfwhpwbyq.supabase.co/storage/v1/object/public/media//favicon.ico',
  },
};

import './globals.css';

import ClientLayout from './layout-client';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-base-100">
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}

