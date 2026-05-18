'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useLanguage } from '@/contexts/language-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from '@/components/ui/select';
import { collection, query, where, getDocs, doc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, differenceInMinutes, startOfDay, setHours, setMinutes } from 'date-fns';
import { Wallet, Calendar, Download, TrendingUp, CheckCircle } from 'lucide-react';
import { jsPDF } from 'jspdf';
import type { Attendance, Advance, DailySalary } from '@/lib/types';

const MONTHS = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december'
] as const;

export default function SalaryPage() {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [advances, setAdvances] = useState<Advance[]>([]);
  const [dailySalaryRecords, setDailySalaryRecords] = useState<DailySalary[]>([]);
  const [dailyStats, setDailyStats] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  const currentDate = new Date(selectedYear, selectedMonth, 1);

  const daysWorked = dailySalaryRecords.length;

  const fetchSalaryData = useCallback(async () => {
    if (!user) return;

    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);

    try {
      console.log("Salary reconciliation: Current user tiers:", user?.salaryTiers);
      // 1. Fetch existing Daily Salary Records
      const salaryQuery = query(
        collection(db, 'daily_salaries'),
        where('staffId', '==', user.id),
        where('date', '>=', format(monthStart, 'yyyy-MM-dd')),
        where('date', '<=', format(monthEnd, 'yyyy-MM-dd'))
      );
      const salarySnapshot = await getDocs(salaryQuery);
      const fetchedRecords = salarySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DailySalary));

      // 2. Fetch Daily Stats to get the final car counts for those days
      const statsQuery = query(
        collection(db, 'daily_stats'),
        where('date', '>=', format(monthStart, 'yyyy-MM-dd')),
        where('date', '<=', format(monthEnd, 'yyyy-MM-dd'))
      );
      const statsSnapshot = await getDocs(statsQuery);
      const statsMap: Record<string, number> = {};
      statsSnapshot.docs.forEach(doc => {
        statsMap[doc.data().date] = doc.data().totalCars || 0;
      });
      setDailyStats(statsMap);

      // 3. Fetch Advances to ensure deductions are up to date
      const advancesQuery = query(
        collection(db, 'advances'),
        where('staffId', '==', user.id),
        where('date', '>=', format(monthStart, 'yyyy-MM-dd')),
        where('date', '<=', format(monthEnd, 'yyyy-MM-dd'))
      );
      const advancesSnapshot = await getDocs(advancesQuery);
      const advancesRecords = advancesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Advance));
      setAdvances(advancesRecords);

      // 4. Reconciliation: Update records if the car count or advances have changed
      const updatedRecords = await Promise.all(fetchedRecords.map(async (record) => {
        const currentTotalCars = statsMap[record.date] || 0;
        const dailyAdvances = advancesRecords
          .filter(adv => adv.date === record.date)
          .reduce((sum, adv) => sum + adv.amount, 0);

        // If data is out of sync, recalculate
        if (record.carCount !== currentTotalCars || record.advancesDeducted !== dailyAdvances) {
          let baseSalary = Number(user.dailySalary) || 0;

          if (user.salaryTiers && typeof user.salaryTiers === 'object') {
            if (Array.isArray(user.salaryTiers)) {
              const tierIndex = Math.max(0, Math.min(Math.floor(currentTotalCars / 10), user.salaryTiers.length - 1));
              baseSalary = Number(user.salaryTiers[tierIndex]) || baseSalary;
            } else {
              const tierNumber = Math.min(Math.floor(currentTotalCars / 10) + 1, 5);
              const tierKey = `t${tierNumber}`;
              baseSalary = Number((user.salaryTiers as any)[tierKey]) || baseSalary;
              console.log(`Salary Sync [${record.date}]: Map detected. Key [${tierKey}] -> RM${baseSalary}`);
            }
          }

          // Recalculate Penalty and Bonus based on new RM0.50 rules
          let penalty = 0;
          let bonus = 0;
          const clockInTime = record.clockInTime.toDate();
          const workStart = setHours(setMinutes(startOfDay(clockInTime), 0), 9);
          const minutesLate = differenceInMinutes(clockInTime, workStart);
          if (minutesLate >= 10) penalty = Math.floor(minutesLate / 10) * 0.50;

          if (record.clockOutTime) {
            const clockOutTime = record.clockOutTime.toDate();
            const workEnd = setHours(setMinutes(startOfDay(clockOutTime), 0), 18);
            const otStart = setHours(setMinutes(startOfDay(clockOutTime), 30), 18);
            
            if (clockOutTime < workEnd) {
              const minutesEarly = differenceInMinutes(workEnd, clockOutTime);
              penalty += Math.floor(minutesEarly / 10) * 0.50;
            } else if (clockOutTime >= otStart) {
              const minutesOT = differenceInMinutes(clockOutTime, otStart);
              bonus = Math.floor(minutesOT / 10) * 0.50;
            }
          }

          const totalEarnings = Number(baseSalary) - penalty + bonus - dailyAdvances;
          
          const docRef = doc(db, 'daily_salaries', record.id);
          const updateData = {
            carCount: currentTotalCars,
            baseSalary: Number(baseSalary),
            penalty,
            bonus,
            advancesDeducted: dailyAdvances,
            totalEarnings: totalEarnings,
            lastUpdatedAt: Timestamp.now()
          };
          
          await updateDoc(docRef, updateData);
          return { ...record, ...updateData };
        }
        return record;
      }));

      setDailySalaryRecords(updatedRecords.sort((a, b) => a.date.localeCompare(b.date)));
    } catch (error) {
      console.error('Error fetching salary data:', error);
    } finally {
      setLoading(false);
    }
  }, [user, currentDate]);

  const totalSalary = dailySalaryRecords.reduce((sum, record) => {
    // If using daily_salaries collection, we can use the stored totalEarnings
    return sum + (record.totalEarnings || 0);
  }, 0);

  // Calculate average daily salary based on actual earnings (including tiers, penalties, etc.)
  const avgDailySalary = daysWorked > 0 ? totalSalary / daysWorked : 0;

  useEffect(() => {
    setLoading(true);
    fetchSalaryData();
  }, [fetchSalaryData]);

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
      [`${t('nric')}:`, user.nric],
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
    doc.setFontSize(9);
    doc.text(`* ${language === 'ms' ? 'Penalti lewat: RM0.10/10min | OT: RM0.10/10min' : 'Late penalty: RM0.10/10min | OT: RM0.10/10min'}`, 20, yPos + 5);
    
    // Table header
    yPos += 15;
    doc.setFillColor(240, 240, 240);
    doc.rect(20, yPos - 5, pageWidth - 40, 10, 'F');
    doc.setFontSize(10);
    doc.text(language === 'ms' ? 'Tarikh (Kereta)' : 'Date (Cars)', 25, yPos);
    doc.text(language === 'ms' ? 'Jumlah' : 'Amount', pageWidth - 60, yPos);
    
    let totalAdvancesDeducted = 0;
    yPos += 10;
    dailySalaryRecords.forEach(record => {
      const clockInTime = record.clockInTime ? format(record.clockInTime.toDate(), 'HH:mm') : 'N/A';
      const clockOutTime = record.clockOutTime ? format(record.clockOutTime.toDate(), 'HH:mm') : '-';
      doc.text(`${record.date} (${record.carCount}) | ${clockInTime}-${clockOutTime}`, 25, yPos);
      doc.text(`RM ${record.totalEarnings.toFixed(2)}`, pageWidth - 60, yPos);
      yPos += 8;
      totalAdvancesDeducted += record.advancesDeducted;
    });
    
    // Advances deduction for the entire month
    const totalMonthlyAdvances = advances.reduce((sum, adv) => sum + adv.amount, 0);

    // Total
    yPos += 10;
    doc.setFillColor(30, 58, 95);
    doc.rect(20, yPos - 5, pageWidth - 40, 12, 'F');

    if (totalMonthlyAdvances > 0) {
      doc.setTextColor(255, 255, 255); // White color for total advances
      doc.setFont(undefined!, 'bold');
      doc.text(t('totalAdvances'), 25, yPos - 10); // Display before total salary
      doc.text(`- RM ${totalMonthlyAdvances.toFixed(2)}`, pageWidth - 60, yPos - 10);
    }
    doc.setTextColor(255, 255, 255);
    doc.setFont(undefined!, 'bold');
    doc.setFontSize(12);
    doc.text(t('totalSalary'), 25, yPos + 2);
    doc.text(`RM ${totalSalary.toFixed(2)}`, pageWidth - 60, yPos + 2);
    
    // Reset
    doc.setTextColor(0, 0, 0);
    doc.setFont(undefined!, 'normal');
    
    // Attendance List
    yPos += 15;
    doc.setFontSize(12);
    doc.setFont(undefined!, 'bold');
    doc.text(language === 'ms' ? 'REKOD KEHADIRAN' : 'ATTENDANCE RECORD', 20, yPos);
    doc.setFont(undefined!, 'normal');
    doc.setFontSize(9);
    
    yPos += 10;
    const attendanceDates = dailySalaryRecords.map(r => r.date).sort();
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

  const attendanceDates = new Set(dailySalaryRecords.map(r => r.date));

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
            <SelectGroup>
              <SelectLabel>{t('month')}</SelectLabel>
              {MONTHS.map((month, index) => (
                <SelectItem key={month} value={index.toString()}>
                  {t(month)}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
          <SelectTrigger className="w-24">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>{t('year')}</SelectLabel>
              {years.map((year) => (
                <SelectItem key={year} value={year.toString()}>
                  {year}
                </SelectItem>
              ))}
            </SelectGroup>
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
                RM {totalSalary.toFixed(2)}
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
                <p className="font-semibold">RM {avgDailySalary.toFixed(2)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-green-100 p-2 dark:bg-green-900">
                <Calendar className="h-4 w-4 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t('daysWorked')}</p>
                <p className="font-semibold">{daysWorked} {language === 'ms' ? 'hari' : 'days'}</p>
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
          </CardTitle> {/* Changed to Attendance Calendar */}
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
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, i) => (
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
                const isToday = format(new Date(), 'yyyy-MM-dd') === dateStr;
                
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
              <span className="text-muted-foreground">{t('avgDailySalary')}</span> {/* Assuming you add this translation key */}
              <span className="font-medium">RM {avgDailySalary.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-muted-foreground">{t('daysWorked')}</span>
              <span className="font-medium">{daysWorked}</span>
            </div>
            {advances.length > 0 && (
              <div className="flex items-center justify-between py-2 border-b">
                <span className="text-muted-foreground">{t('advancesDeducted')}</span>
                <span className="font-medium">- RM {advances.reduce((sum, adv) => sum + adv.amount, 0).toFixed(2)}</span> {/* Display total advances for the month */}
              </div>
            )}
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

      {/* Daily Breakdown List */}
      <div className="space-y-3 pb-8">
        <h3 className="text-sm font-medium text-muted-foreground">{t('dailyBreakdown')}</h3>
        {dailySalaryRecords.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              {t('noSalaryData')}
            </CardContent>
          </Card>
        ) : (
          dailySalaryRecords.slice().reverse().map((record) => (
            <Card key={record.id}>
              <CardContent className="p-4 space-y-3">
                <div className="flex justify-between items-start border-b pb-2">
                  <div>
                    <p className="font-bold">{record.date}</p>
                    <p className="text-xs text-muted-foreground">
                      {record.carCount} {t('cars')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-primary">RM {record.totalEarnings.toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground">{t('netTotal')}</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-y-2 text-sm">
                  <div className="flex justify-between pr-4 border-r">
                    <span className="text-muted-foreground text-xs">{t('dailySalary')}</span>
                    <span className="font-medium">RM {record.baseSalary.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between pl-4">
                    <span className="text-muted-foreground text-xs">{t('bonus')}</span>
                    <span className="text-green-600 font-medium">+ RM {record.bonus.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between pr-4 border-r">
                    <span className="text-muted-foreground text-xs">{t('latePenalty')}</span>
                    <span className="text-destructive font-medium">- RM {record.penalty.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between pl-4">
                    <span className="text-muted-foreground text-xs">{t('advancesDeducted')}</span>
                    <span className="text-destructive font-medium">- RM {record.advancesDeducted.toFixed(2)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
