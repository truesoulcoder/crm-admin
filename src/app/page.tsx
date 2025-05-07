import Link from 'next/link';

export default function Home() {
  return (
    <div className="hero min-h-screen bg-base-200">
      <div className="hero-content text-center">
        <div className="max-w-md">
          <h1 className="text-5xl font-bold">Welcome to CRMPro</h1>
          <p className="py-6">
            A modern CRM solution built with Next.js, DaisyUI, and Supabase
          </p>
          <div className="flex gap-4 justify-center">
            <Link href="/auth/signin" className="btn btn-primary">
              Sign In
            </Link>
            <Link href="/dashboard" className="btn btn-outline">
              Dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
