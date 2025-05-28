// app/layout.tsx
import { Inter } from 'next/font/google';
import { ReactNode } from 'react';
import Providers from './providers';
import ClientLayoutWrapper from './client-layout-wrapper';

const inter = Inter({ subsets: ['latin'] });

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en" data-theme="custom_crm_theme" suppressHydrationWarning>
      <body className={inter.className}>
        <Providers>
          <ClientLayoutWrapper>
            {children}
          </ClientLayoutWrapper>
        </Providers>
      </body>
    </html>
  );
}