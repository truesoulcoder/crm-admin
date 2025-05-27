import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Error Boundary',
  description: 'Error boundary page',
};

export default function ErrorBoundaryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-base-100">
      {children}
    </div>
  );
}
