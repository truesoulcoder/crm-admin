import './globals.css';

import MainAppShell from '@/components/layout/MainAppShell';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-base-100 min-h-screen">
        <MainAppShell>{children}</MainAppShell>
      </body>
    </html>
  );
}
