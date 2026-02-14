'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Activity, History, Shield, Settings, Zap } from 'lucide-react';

const navItems = [
  { href: '/', label: 'Dashboard', icon: Activity },
  { href: '/history', label: 'History', icon: History },
  { href: '/intercept', label: 'Intercept', icon: Zap },
  { href: '/rules', label: 'Rules', icon: Shield },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 border-r border-border bg-card/50 flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-border">
        <h1 className="text-xl font-bold">WebAPI Moderator</h1>
        <p className="text-xs text-muted-foreground mt-1">HTTP/HTTPS Intercepting Proxy</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-border text-xs text-muted-foreground">
        <p>Proxy: localhost:8080</p>
        <p className="mt-1">Configure your browser/system to use this proxy</p>
      </div>
    </aside>
  );
}
