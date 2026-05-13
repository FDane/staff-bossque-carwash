import { Timestamp } from 'firebase/firestore';

export interface User {
  id: string;
  icNumber: string;
  email?: string;
  name: string;
  phone: string;
  address: string;
  position: string;
  dailySalary: number;
  bankName: string;
  bankAccount: string;
  profileImage?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Attendance {
  id: string;
  staffId: string;
  date: string; // YYYY-MM-DD format
  clockInTime: Timestamp;
  imageUrl: string;
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
  icNumber: string;
  requestedAt: Timestamp;
  status: 'pending' | 'completed';
}

export type Language = 'ms' | 'en';
export type Theme = 'light' | 'dark' | 'system';
