'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useLanguage } from '@/contexts/language-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { collection, addDoc, query, where, getDocs, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { format } from 'date-fns';
import { CalendarDays, Plus, Clock, CheckCircle, XCircle, AlertCircle, X } from 'lucide-react';
import { toast } from 'sonner';
import type { Leave } from '@/lib/types';

export default function LeavePage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  
  // Form state
  const [leaveType, setLeaveType] = useState<'sick' | 'emergency' | ''>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');

  const fetchLeaves = useCallback(async () => {
    if (!user) return;
    
    try {
      const q = query(
        collection(db, 'leaves'),
        where('staffId', '==', user.id),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      const leaveData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Leave));
      setLeaves(leaveData);
    } catch (error) {
      console.error('Error fetching leaves:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchLeaves();
  }, [fetchLeaves]);

  const resetForm = () => {
    setLeaveType('');
    setStartDate('');
    setEndDate('');
    setReason('');
    setShowForm(false);
  };

  const notifyAdminWhatsAppLeave = async () => {
    // Fallback to staffId if the user object doesn't have a displayName property
    const staffIdentifier = (user as any)?.displayName || user?.id || 'Pekerja';
    const typeLabel = leaveType === 'sick' ? 'Cuti Sakit' : 'Cuti Kecemasan';

    const messageText = `🚗 *Carwash Bossque*\n\nNotifikasi Permohonan Cuti:\n👤 Staff: *${staffIdentifier}*\n📝 Jenis: *${typeLabel}*\n📅 Tarikh: *${startDate}* hingga *${endDate}*\n💡 Sebab: _${reason}_`;

    try {
      // Reuses the exact same API route you built for the Attendance page
      await fetch('/api/send-whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: messageText })
      });
    } catch (error) {
      console.error('Failed to trigger WhatsApp notification:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !leaveType || !startDate || !endDate || !reason) return;

    setSubmitting(true);
    try {
      await addDoc(collection(db, 'leaves'), {
        staffId: user.id,
        type: leaveType,
        startDate,
        endDate,
        reason,
        status: 'pending', // Auto-approve since no admin panel
        createdAt: Timestamp.now(),
      });

      notifyAdminWhatsAppLeave(); // Trigger WhatsApp notification to admin
      
      toast.success(t('leaveSubmitted'));
      resetForm();
      fetchLeaves();
    } catch (error) {
      console.error('Error submitting leave:', error);
      toast.error(t('error'));
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'rejected':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Clock className="h-5 w-5 text-yellow-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300';
      case 'rejected':
        return 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300';
      default:
        return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300';
    }
  };

  const getLeaveTypeLabel = (type: string) => {
    return type === 'sick' ? t('sickLeave') : t('emergencyLeave');
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'approved':
        return t('approved');
      case 'rejected':
        return t('rejected');
      default:
        return t('pending');
    }
  };

  return (
    <div className="p-4 space-y-6">
      {/* Apply Leave Button */}
      {!showForm && (
        <Button onClick={() => setShowForm(true)} className="w-full gap-2">
          <Plus className="h-4 w-4" />
          {t('applyLeave')}
        </Button>
      )}

      {/* Leave Application Form */}
      {showForm && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <CalendarDays className="h-5 w-5 text-primary" />
              {t('leaveApplication')}
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={resetForm}>
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>{t('leaveType')}</Label>
                <Select value={leaveType} onValueChange={(value: 'sick' | 'emergency') => setLeaveType(value)}>
                  <SelectTrigger className="h-12">
                    <SelectValue placeholder={t('selectLeaveType')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sick">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-orange-500" />
                        {t('sickLeave')}
                      </div>
                    </SelectItem>
                    <SelectItem value="emergency">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-red-500" />
                        {t('emergencyLeave')}
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('startDate')}</Label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                    className="h-12"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('endDate')}</Label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    min={startDate}
                    required
                    className="h-12"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t('reason')}</Label>
                <Textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={t('reason')}
                  required
                  rows={4}
                />
              </div>

              <div className="flex gap-3">
                <Button type="button" variant="outline" onClick={resetForm} className="flex-1">
                  {t('cancel')}
                </Button>
                <Button type="submit" disabled={submitting} className="flex-1">
                  {submitting ? (
                    <>
                      <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      {t('loading')}
                    </>
                  ) : (
                    t('submit')
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Leave History */}
      <div>
        <h3 className="mb-3 text-sm font-medium text-muted-foreground">{t('leaveHistory')}</h3>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="h-5 w-24 animate-pulse rounded bg-muted" />
                      <div className="h-6 w-20 animate-pulse rounded-full bg-muted" />
                    </div>
                    <div className="h-4 w-32 animate-pulse rounded bg-muted" />
                    <div className="h-3 w-full animate-pulse rounded bg-muted" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : leaves.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center p-8 text-center">
              <div className="rounded-full bg-muted p-4">
                <CalendarDays className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="mt-4 text-muted-foreground">{t('noLeave')}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {leaves.map((leave) => (
              <Card key={leave.id}>
                <CardContent className="p-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(leave.status)}
                        <span className="font-medium">{getLeaveTypeLabel(leave.type)}</span>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-medium ${getStatusColor(leave.status)}`}>
                        {getStatusLabel(leave.status)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CalendarDays className="h-4 w-4" />
                      <span>{leave.startDate} - {leave.endDate}</span>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">{leave.reason}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
