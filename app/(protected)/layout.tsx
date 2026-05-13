import { AuthGuard } from '@/components/auth/auth-guard';
import { MobileNav, TopBar } from '@/components/navigation/mobile-nav';

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <div className="flex min-h-screen flex-col bg-background">
        <TopBar />
        <main className="flex-1 pb-20">
          {children}
        </main>
        <MobileNav />
      </div>
    </AuthGuard>
  );
}
