'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useLanguage } from '@/contexts/language-context';
import { cn } from '@/lib/utils';
import { LayoutDashboard, Clock, CalendarDays, Wallet, User, Settings } from 'lucide-react';

const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, labelKey: 'dashboard' as const },
  { href: '/attendance', icon: Clock, labelKey: 'attendance' as const },
  { href: '/leave', icon: CalendarDays, labelKey: 'leave' as const },
  { href: '/salary', icon: Wallet, labelKey: 'salary' as const },
  { href: '/profile', icon: User, labelKey: 'profile' as const },
];

export function MobileNav() {
  const pathname = usePathname();
  const { t } = useLanguage();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 safe-bottom">
      <div className="flex items-center justify-around px-2 py-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center gap-1 rounded-lg px-3 py-2 text-xs transition-colors',
                isActive 
                  ? 'text-primary' 
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <item.icon className={cn('h-5 w-5', isActive && 'text-accent')} />
              <span className="font-medium">{t(item.labelKey)}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function TopBar() {
  const { t } = useLanguage();
  const pathname = usePathname();

  // Determine the page title based on pathname
  const getPageTitle = () => {
    if (pathname.startsWith('/dashboard')) return t('dashboard');
    if (pathname.startsWith('/attendance')) return t('attendance');
    if (pathname.startsWith('/leave')) return t('leave');
    if (pathname.startsWith('/salary')) return t('salary');
    if (pathname.startsWith('/profile')) return t('profile');
    if (pathname.startsWith('/settings')) return t('settings');
    return t('appName');
  };

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="flex h-14 items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center">
            <Image
              src="/logo.png"
              alt="Logo"
              width={32}
              height={32}
              className="object-contain"
            />
          </div>
          <h1 className="text-lg font-semibold">{getPageTitle()}</h1>
        </div>
        <Link 
          href="/settings"
          className={cn(
            'rounded-lg p-2 transition-colors',
            pathname === '/settings' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Settings className="h-5 w-5" />
        </Link>
      </div>
    </header>
  );
}
