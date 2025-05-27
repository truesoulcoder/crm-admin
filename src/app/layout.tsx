// src/app/layout.tsx
import { Inter } from 'next/font/google';
import './globals.css';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { Database } from '@/lib/supabase/database.types';

const inter = Inter({ subsets: ['latin'] });

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createServerComponentClient<Database>({ cookies });
  const { data: { session } } = await supabase.auth.getSession();

  return (
    <html lang="en">
      <body className={inter.className}>
        <UserProvider initialSession={session}>
          <EngineProvider>
            {children}
          </EngineProvider>
        </UserProvider>
      </body>
    </html>
  );
}