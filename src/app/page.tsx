import { redirect } from 'next/navigation';

// This page needs to be dynamic to handle auth state
// https://nextjs.org/docs/app/building-your-application/rendering/server-components#server-rendering-strategies
export const dynamic = 'force-dynamic';

export default function Home() {
  redirect('/dashboard');
}