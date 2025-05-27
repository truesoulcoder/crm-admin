'use client';

import ClientLayout from '../layout-client';

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ClientLayout>{children}</ClientLayout>;
}