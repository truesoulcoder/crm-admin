"use client";
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navigation = [
  { name: 'Dashboard', href: '/dashboard' },
  { name: 'Contacts', href: '/contacts' },
  { name: 'Companies', href: '/companies' },
  { name: 'Deals', href: '/deals' },
  { name: 'Activities', href: '/activities' },
  { name: 'Settings', href: '/settings' },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="drawer-side">
      <label htmlFor="my-drawer" className="drawer-overlay"></label>
      <aside className="bg-base-200 w-64 min-h-screen p-4">
        <div className="flex items-center p-4">
          <h1 className="text-xl font-bold">CRMPro</h1>
        </div>
        <ul className="menu p-4">
          {navigation.map((item) => (
            <li key={item.name}>
              <Link 
                href={item.href}
                className={`${pathname === item.href ? 'active' : ''}`}
              >
                {item.name}
              </Link>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
