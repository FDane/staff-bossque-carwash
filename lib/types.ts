import { Timestamp } from 'firebase/firestore';

export interface User {
  id: string;
  nric: string;
  email?: string;
  name: string;
  phone: string;
  address: string;
  position: string;
  dailySalary: number;
  salaryTiers?: number[] | Record<string, number>;
  bankName: string;
  bankAccount: string;
  profileImage?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  isStaff: boolean;
}

export interface Attendance {
  id: string;
  staffId: string;
  date: string; // YYYY-MM-DD format
  clockInTime: Timestamp;
  clockOutTime?: Timestamp;
  imageUrl: string;
  createdAt: Timestamp;
}

export interface Advance {
  id: string;
  staffId: string;
  date: string; // YYYY-MM-DD format, the day the advance is deducted
  amount: number;
  createdAt: Timestamp;
}

export interface Leave {
  id: string;
  staffId: string;
  type: 'sick' | 'emergency';
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Timestamp;
}

export interface PasswordReset {
  id: string;
  staffId: string;
  nric: string;
  requestedAt: Timestamp;
  status: 'pending' | 'completed';
}

export interface DailySalary {
  id: string; // Format: staffId_YYYY-MM-DD
  staffId: string;
  date: string; // YYYY-MM-DD format
  baseSalary: number; // Calculated based on tiers and carCount
  carCount: number; // From daily_stats for that day
  penalty: number;
  bonus: number;
  advancesDeducted: number; // Total advances for that day
  totalEarnings: number;
  clockInTime: Timestamp;
  clockOutTime?: Timestamp; // Optional, for when they haven't clocked out yet
  lastUpdatedAt: Timestamp; // To track when this record was last updated
}
export type Language = 'ms' | 'en';
export type Theme = 'light' | 'dark' | 'system';
