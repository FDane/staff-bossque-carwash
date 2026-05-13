'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useLanguage } from '@/contexts/language-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth } from 'date-fns';
import { Wallet, Calendar, Download, TrendingUp, CheckCircle } from 'lucide-react';
import { jsPDF } from 'jspdf';
import type { Attendance } from '@/lib/types';

const MONTHS = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december'
] as const;

export default function SalaryPage() {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [attendanceRecords, setAttendanceRecords] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);

  const currentDate = new Date(selectedYear, selectedMonth, 1);
  const dailySalary = user?.dailySalary || 0;
  const daysWorked = attendanceRecords.length;
  const totalSalary = daysWorked * dailySalary;

  const fetchAttendance = useCallback(async () => {
    if (!user) return;
    
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    
    try {
      const q = query(
        collection(db, 'attendance'),
        where('staffId', '==', user.id),
        where('date', '>=', format(monthStart, 'yyyy-MM-dd')),
        where('date', '<=', format(monthEnd, 'yyyy-MM-dd'))
      );
      const snapshot = await getDocs(q);
      const records = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Attendance));
      setAttendanceRecords(records);
    } catch (error) {
      console.error('Error fetching attendance:', error);
    } finally {
      setLoading(false);
    }
  }, [user, currentDate]);

  useEffect(() => {
    setLoading(true);
    fetchAttendance();
  }, [fetchAttendance]);

  const generatePayslip = () => {
    if (!user) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const monthName = t(MONTHS[selectedMonth]);
    
    // Header
    doc.setFillColor(30, 58, 95); // Dark blue
    doc.rect(0, 0, pageWidth, 40, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.text('SLIP GAJI / PAYSLIP', pageWidth / 2, 20, { align: 'center' });
    doc.setFontSize(12);
    doc.text(`${monthName} ${selectedYear}`, pageWidth / 2, 32, { align: 'center' });
    
    // Reset text color
    doc.setTextColor(0, 0, 0);
    
    // Company Info
    doc.setFontSize(10);
    doc.text('Carwash Management System', 20, 55);
    doc.text(`${t('generatedOn')}: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 20, 62);
    
    // Staff Details
    doc.setFontSize(12);
    doc.setFont(undefined!, 'bold');
    doc.text(language === 'ms' ? 'MAKLUMAT KAKITANGAN' : 'STAFF INFORMATION', 20, 80);
    doc.setFont(undefined!, 'normal');
    doc.setFontSize(10);
    
    const staffInfo = [
      [`${t('name')}:`, user.name],
      [`${t('icNumber')}:`, user.icNumber],
      [`${t('position')}:`, user.position || '-'],
      [`${t('bankName')}:`, user.bankName || '-'],
      [`${t('bankAccount')}:`, user.bankAccount || '-'],
    ];
    
    let yPos = 90;
    staffInfo.forEach(([label, value]) => {
      doc.text(label, 20, yPos);
      doc.text(value, 70, yPos);
      yPos += 8;
    });
    
    // Salary Details
    yPos += 10;
    doc.setFontSize(12);
    doc.setFont(undefined!, 'bold');
    doc.text(language === 'ms' ? 'BUTIRAN GAJI' : 'SALARY DETAILS', 20, yPos);
    doc.setFont(undefined!, 'normal');
    
    // Table header
    yPos += 10;
    doc.setFillColor(240, 240, 240);
    doc.rect(20, yPos - 5, pageWidth - 40, 10, 'F');
    doc.setFontSize(10);
    doc.text(language === 'ms' ? 'Perkara' : 'Item', 25, yPos);
    doc.text(language === 'ms' ? 'Jumlah' : 'Amount', pageWidth - 60, yPos);
    
    // Table content
    const salaryItems = [
      [t('dailySalary'), `RM ${dailySalary.toFixed(2)}`],
      [t('daysWorked'), `${daysWorked} ${language === 'ms' ? 'hari' : 'days'}`],
    ];
    
    yPos += 15;
    salaryItems.forEach(([label, value]) => {
      doc.text(label, 25, yPos);
      doc.text(value, pageWidth - 60, yPos);
      yPos += 10;
    });
    
    // Total
    yPos += 5;
    doc.setFillColor(30, 58, 95);
    doc.rect(20, yPos - 5, pageWidth - 40, 12, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont(undefined!, 'bold');
    doc.setFontSize(12);
    doc.text(t('totalSalary'), 25, yPos + 2);
    doc.text(`RM ${totalSalary.toFixed(2)}`, pageWidth - 60, yPos + 2);
    
    // Reset
    doc.setTextColor(0, 0, 0);
    doc.setFont(undefined!, 'normal');
    
    // Attendance List
    yPos += 25;
    doc.setFontSize(12);
    doc.setFont(undefined!, 'bold');
    doc.text(language === 'ms' ? 'REKOD KEHADIRAN' : 'ATTENDANCE RECORD', 20, yPos);
    doc.setFont(undefined!, 'normal');
    doc.setFontSize(9);
    
    yPos += 10;
    const attendanceDates = attendanceRecords.map(r => r.date).sort();
    const dateList = attendanceDates.join(', ');
    const splitDates = doc.splitTextToSize(dateList, pageWidth - 40);
    doc.text(splitDates, 20, yPos);
    
    // Footer
    doc.setFontSize(8);
    doc.setTextColor(128, 128, 128);
    doc.text(
      language === 'ms' 
        ? 'Dokumen ini dijana secara automatik oleh sistem.' 
        : 'This document is automatically generated by the system.',
      pageWidth / 2,
      280,
      { align: 'center' }
    );
    
    // Save
    doc.save(`Payslip_${user.name}_${monthName}_${selectedYear}.pdf`);
  };

  // Generate calendar view data
  const daysInMonth = eachDayOfInterval({
    start: startOfMonth(currentDate),
    end: endOfMonth(currentDate),
  });
  
  const attendanceDates = new Set(attendanceRecords.map(r => r.date));

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  return (
    <div className="p-4 space-y-6">
      {/* Month/Year Selector */}
      <div className="flex gap-3">
        <Select value={selectedMonth.toString()} onValueChange={(v) => setSelectedMonth(parseInt(v))}>
          <SelectTrigger className="flex-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MONTHS.map((month, index) => (
              <SelectItem key={month} value={index.toString()}>
                {t(month)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
          <SelectTrigger className="w-24">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map((year) => (
              <SelectItem key={year} value={year.toString()}>
                {year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Salary Overview Card */}
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-r from-accent to-accent/80 p-4 text-accent-foreground">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-90">{t('monthlySalary')}</p>
              <p className="text-3xl font-bold">
                RM {loading ? '...' : totalSalary.toFixed(2)}
              </p>
            </div>
            <Wallet className="h-12 w-12 opacity-80" />
          </div>
        </div>
        <CardContent className="p-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-primary/10 p-2">
                <TrendingUp className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t('dailySalary')}</p>
                <p className="font-semibold">RM {dailySalary.toFixed(2)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-green-100 p-2 dark:bg-green-900">
                <Calendar className="h-4 w-4 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t('daysWorked')}</p>
                <p className="font-semibold">{loading ? '...' : daysWorked} {language === 'ms' ? 'hari' : 'days'}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Download Payslip Button */}
      <Button onClick={generatePayslip} className="w-full gap-2" disabled={loading || daysWorked === 0}>
        <Download className="h-4 w-4" />
        {t('downloadPayslip')}
      </Button>

      {/* Calendar View */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {t('attendanceHistory')} - {t(MONTHS[selectedMonth])} {selectedYear}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: 35 }).map((_, i) => (
                <div key={i} className="aspect-square animate-pulse rounded bg-muted" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-1 text-center text-xs">
              {/* Day headers */}
              {['A', 'I', 'S', 'R', 'K', 'J', 'S'].map((day, i) => (
                <div key={i} className="py-1 font-medium text-muted-foreground">
                  {day}
                </div>
              ))}
              
              {/* Empty cells for start of month */}
              {Array.from({ length: daysInMonth[0].getDay() }).map((_, i) => (
                <div key={`empty-${i}`} />
              ))}
              
              {/* Days */}
              {daysInMonth.map((day) => {
                const dateStr = format(day, 'yyyy-MM-dd');
                const hasAttendance = attendanceDates.has(dateStr);
                const isToday = format(new Date(), 'yyyy-MM-dd') === dateStr && isSameMonth(day, new Date());
                
                return (
                  <div
                    key={dateStr}
                    className={`relative flex aspect-square items-center justify-center rounded ${
                      hasAttendance 
                        ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' 
                        : 'bg-muted/50'
                    } ${isToday ? 'ring-2 ring-primary' : ''}`}
                  >
                    {format(day, 'd')}
                    {hasAttendance && (
                      <CheckCircle className="absolute -bottom-0.5 -right-0.5 h-3 w-3 text-green-500" />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detailed Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Wallet className="h-4 w-4 text-primary" />
            {t('salaryDetails')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-muted-foreground">{t('dailySalary')}</span>
              <span className="font-medium">RM {dailySalary.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-muted-foreground">{t('daysWorked')}</span>
              <span className="font-medium">{daysWorked}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-muted-foreground">{t('month')}</span>
              <span className="font-medium">{t(MONTHS[selectedMonth])} {selectedYear}</span>
            </div>
            <div className="flex items-center justify-between py-2 bg-primary/5 rounded-lg px-3 -mx-3">
              <span className="font-semibold">{t('totalSalary')}</span>
              <span className="text-xl font-bold text-primary">RM {totalSalary.toFixed(2)}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
