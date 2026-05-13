'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/auth-context';
import { useLanguage } from '@/contexts/language-context';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { format } from 'date-fns';
import { Clock, CalendarDays, Wallet, CheckCircle, XCircle, Camera } from 'lucide-react';
import type { Attendance } from '@/lib/types';

export default function DashboardPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [todayAttendance, setTodayAttendance] = useState<Attendance | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTodayAttendance = async () => {
      if (!user) return;
      
      const today = format(new Date(), 'yyyy-MM-dd');
      const q = query(
        collection(db, 'attendance'),
        where('staffId', '==', user.id),
        where('date', '==', today),
        limit(1)
      );
      
      try {
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          setTodayAttendance({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Attendance);
        }
      } catch (error) {
        console.error('Error fetching attendance:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTodayAttendance();
  }, [user]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Selamat Pagi';
    if (hour < 18) return 'Selamat Petang';
    return 'Selamat Malam';
  };

  const quickActions = [
    { href: '/attendance', icon: Camera, label: t('clockIn'), color: 'bg-primary' },
    { href: '/leave', icon: CalendarDays, label: t('applyLeave'), color: 'bg-accent' },
    { href: '/salary', icon: Wallet, label: t('viewSalary'), color: 'bg-chart-3' },
  ];

  return (
    <div className="p-4 space-y-6">
      {/* Welcome Section */}
      <div className="flex items-center gap-4">
        <Avatar className="h-16 w-16 border-2 border-accent">
          <AvatarImage src={user?.profileImage} alt={user?.name} />
          <AvatarFallback className="bg-primary text-primary-foreground text-lg">
            {user?.name?.slice(0, 2).toUpperCase() || 'ST'}
          </AvatarFallback>
        </Avatar>
        <div>
          <p className="text-muted-foreground text-sm">{getGreeting()}</p>
          <h2 className="text-xl font-bold">{user?.name || 'Staff'}</h2>
          <p className="text-sm text-muted-foreground">{user?.position}</p>
        </div>
      </div>

      {/* Today's Attendance Card */}
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-r from-primary to-primary/80 p-4 text-primary-foreground">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-90">{t('todayAttendance')}</p>
              <p className="text-2xl font-bold">
                {format(new Date(), 'dd MMM yyyy')}
              </p>
            </div>
            <Clock className="h-10 w-10 opacity-80" />
          </div>
        </div>
        <CardContent className="p-4">
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <div className="h-4 w-4 animate-pulse rounded-full bg-muted" />
              <span>{t('loading')}</span>
            </div>
          ) : todayAttendance ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-6 w-6 text-green-500" />
                <div>
                  <p className="font-medium text-green-600 dark:text-green-400">{t('clockedIn')}</p>
                  <p className="text-sm text-muted-foreground">
                    {todayAttendance.clockInTime && format(todayAttendance.clockInTime.toDate(), 'HH:mm')}
                  </p>
                </div>
              </div>
              {todayAttendance.imageUrl && (
                <img 
                  src={todayAttendance.imageUrl} 
                  alt="Attendance" 
                  className="h-12 w-12 rounded-lg object-cover"
                />
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <XCircle className="h-6 w-6 text-orange-500" />
                <p className="font-medium text-orange-600 dark:text-orange-400">{t('notClockedIn')}</p>
              </div>
              <Link href="/attendance">
                <Button size="sm" className="gap-2">
                  <Camera className="h-4 w-4" />
                  {t('clockIn')}
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div>
        <h3 className="mb-3 text-sm font-medium text-muted-foreground">{t('quickActions')}</h3>
        <div className="grid grid-cols-3 gap-3">
          {quickActions.map((action) => (
            <Link key={action.href} href={action.href}>
              <Card className="group cursor-pointer transition-all hover:shadow-md active:scale-95">
                <CardContent className="flex flex-col items-center gap-2 p-4">
                  <div className={`rounded-full ${action.color} p-3 transition-transform group-hover:scale-110`}>
                    <action.icon className="h-5 w-5 text-white" />
                  </div>
                  <span className="text-center text-xs font-medium">{action.label}</span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* Daily Salary Info */}
      <Card>
        <CardContent className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-accent/10 p-2">
              <Wallet className="h-5 w-5 text-accent" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t('dailySalary')}</p>
              <p className="text-lg font-bold">
                RM {user?.dailySalary?.toFixed(2) || '0.00'}
              </p>
            </div>
          </div>
          <Link href="/salary">
            <Button variant="outline" size="sm">{t('salaryDetails')}</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
