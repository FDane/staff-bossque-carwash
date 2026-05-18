'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useLanguage } from '@/contexts/language-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { collection, addDoc, query, where, getDocs, orderBy, Timestamp, doc, updateDoc, setDoc, deleteDoc as deleteFirestoreDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject, StorageReference } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { format, startOfDay, setHours, setMinutes, differenceInMinutes } from 'date-fns';
import { Camera, Upload, CheckCircle, Clock, Image as ImageIcon, X } from 'lucide-react';
import { toast } from 'sonner';
import type { Attendance, DailySalary, Advance } from '@/lib/types';

export default function AttendancePage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [attendanceHistory, setAttendanceHistory] = useState<Attendance[]>([]);
  const [todayAttendance, setTodayAttendance] = useState<Attendance | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isClockingOut, setIsClockingOut] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);

  const fetchAttendance = useCallback(async () => {
    if (!user) return;
    
    const today = format(new Date(), 'yyyy-MM-dd');
    
    try {
      // Check today's attendance
      const todayQuery = query(
        collection(db, 'attendance'),
        where('staffId', '==', user.id),
        where('date', '==', today)
      );
      const todaySnapshot = await getDocs(todayQuery);
      if (!todaySnapshot.empty) {
        setTodayAttendance({ id: todaySnapshot.docs[0].id, ...todaySnapshot.docs[0].data() } as Attendance);
      }

      // Get attendance history
      const historyQuery = query(
        collection(db, 'attendance'),
        where('staffId', '==', user.id),
        orderBy('clockInTime', 'desc')
      );
      const historySnapshot = await getDocs(historyQuery);
      const history = historySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Attendance));
      setAttendanceHistory(history);
    } catch (error) {
      console.error('Error fetching attendance:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchAttendance();
  }, [fetchAttendance]);

  // Effect to attach stream to video element when it becomes available
  useEffect(() => {
    if (showCamera && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [showCamera]);

  // Cleanup camera tracks when component unmounts
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onload = (e) => setImagePreview(e.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const startCamera = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      toast.error(t('cameraNotSupported'));
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } } 
      });
      streamRef.current = stream;
      setShowCamera(true);
    } catch (error: any) {
      console.error('Error accessing camera:', error);
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        toast.error(t('cameraPermissionDenied'));
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        toast.error(t('cameraNotFound'));
      } else {
        toast.error(t('error'));
      }
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setShowCamera(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        canvas.toBlob((blob) => {
          if (blob) {
            const file = new File([blob], 'attendance.jpg', { type: 'image/jpeg' });
            setSelectedImage(file);
            setImagePreview(canvas.toDataURL('image/jpeg'));
          }
        }, 'image/jpeg', 0.8);
      }
      stopCamera();
    }
  };

  const clearImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const calculateDailyEarnings = useCallback(async (
    staffId: string,
    dateStr: string,
    clockInTime: Date,
    clockOutTime?: Date | null,
    initialCarCount: number = 0,
    initialAdvancesDeducted: number = 0
  ) => {
    let baseSalary = Number(user?.dailySalary) || 0;
    let carCount = initialCarCount;
    let penalty = 0;
    let bonus = 0;
    let advancesDeducted = initialAdvancesDeducted;

    // Fetch current car count from daily_stats if not provided
    if (initialCarCount === 0) {
      const statsQuery = query(collection(db, 'daily_stats'), where('date', '==', dateStr));
      const statsSnapshot = await getDocs(statsQuery);
      if (!statsSnapshot.empty) {
        carCount = statsSnapshot.docs[0].data().totalCars || 0;
      }
    }

    // Apply salary tiers
    if (user?.salaryTiers && typeof user.salaryTiers === 'object') {
      console.log("Attendance: Checking tiers for car count:", carCount);
      let tieredSalary: number | undefined;

      if (Array.isArray(user.salaryTiers)) {
        const index = Math.floor(carCount / 10);
        const tierIndex = Math.max(0, Math.min(index, user.salaryTiers.length - 1));
        tieredSalary = user.salaryTiers[tierIndex];
      } else {
        // Handle Map/Object structure: { t1: 40, t2: 50, ... }
        const tierNumber = Math.min(Math.floor(carCount / 10) + 1, 5);
        const tierKey = `t${tierNumber}`;
        tieredSalary = (user.salaryTiers as any)[tierKey];
        console.log(`Attendance: Map detected. Accessing key [${tierKey}] -> Result: RM${tieredSalary}`);
      }

      if (tieredSalary !== undefined && tieredSalary !== null) {
        baseSalary = Number(tieredSalary);
      }
    }

    // Fetch advances if not provided
    if (initialAdvancesDeducted === 0) {
      const advancesQuery = query(
        collection(db, 'advances'),
        where('staffId', '==', staffId),
        where('date', '==', dateStr)
      );
      const advancesSnapshot = await getDocs(advancesQuery);
      advancesDeducted = advancesSnapshot.docs.reduce((sum, doc) => sum + (doc.data() as Advance).amount, 0);
    }

    // Lateness check (9:00 AM start, 10 min grace)
    const workStart = setHours(setMinutes(startOfDay(clockInTime), 0), 9);
    const minutesLate = differenceInMinutes(clockInTime, workStart);
    if (minutesLate >= 10) { // RM0.10 deduction starts at 10 minutes late
      penalty = Math.floor(minutesLate / 10) * 0.50;
    }

    // Early Leave and Overtime check
    if (clockOutTime) {
      const workEnd = setHours(setMinutes(startOfDay(clockOutTime), 0), 18); // 6:00 PM
      const otStart = setHours(setMinutes(startOfDay(clockOutTime), 30), 18); // 6:30 PM

      if (clockOutTime < workEnd) {
        // Early leave penalty: RM0.50 for every 10 mins early
        const minutesEarly = differenceInMinutes(workEnd, clockOutTime);
        penalty += Math.floor(minutesEarly / 10) * 0.50;
      } else if (clockOutTime >= otStart) {
        // Overtime bonus: RM0.50 for every 10 mins after 6:30 PM
        const minutesOT = differenceInMinutes(clockOutTime, otStart);
        bonus = Math.floor(minutesOT / 10) * 0.50;
      }
    }

    const totalEarnings = baseSalary - penalty + bonus - advancesDeducted;

    const result: any = {
      staffId,
      date: dateStr,
      baseSalary,
      carCount,
      penalty,
      bonus,
      advancesDeducted,
      totalEarnings,
      clockInTime: Timestamp.fromDate(clockInTime),
      lastUpdatedAt: Timestamp.now(),
    };

    if (clockOutTime) {
      result.clockOutTime = Timestamp.fromDate(clockOutTime);
    }

    return result;
  }, [user]);

  const handleClockIn = async () => {
    if (!user || !selectedImage) return;
    if (todayAttendance) {
      toast.error(t('alreadyClockedIn'));
      return;
    }

    setUploading(true);
    let uploadedImageRef: StorageReference | null = null; // To keep track of the uploaded image for cleanup
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      const clockInTimestamp = Timestamp.now();
      const dailySalaryId = `${user.id}_${today}`;

      // 1. Upload image to Firebase Storage first
      const imageRef = ref(storage, `attendance/${today}_${user.id}.jpg`);
      await uploadBytes(imageRef, selectedImage);
      uploadedImageRef = imageRef; // Store reference for potential cleanup
      const imageUrl = await getDownloadURL(imageRef);

      // Calculate initial daily salary (T1, 0 cars, current advances)
      const initialDailySalaryData = await calculateDailyEarnings(
        user.id,
        today,
        clockInTimestamp.toDate(),
        null, // No clock out time yet
        0, // Initial car count is 0
        0 // Advances will be fetched by calculateDailyEarnings
      );

      console.log("Attendance: Initial Salary Record for Clock-in:", initialDailySalaryData);

      // 2. Create daily_salaries record
      await setDoc(doc(db, 'daily_salaries', dailySalaryId), { 
        ...initialDailySalaryData, 
        id: dailySalaryId 
      });

      // 3. Save attendance record
      await addDoc(collection(db, 'attendance'), {
        staffId: user.id,
        date: today,
        clockInTime: clockInTimestamp,
        imageUrl,
        createdAt: Timestamp.now(),
      });

      toast.success(t('clockInSuccess'));
      clearImage();
      fetchAttendance();
    } catch (error) {
      console.error('Error clocking in:', error);
      toast.error(t('error'));

      // If an image was uploaded but Firestore operations failed, delete the image
      if (uploadedImageRef) {
        try {
          await deleteObject(uploadedImageRef);
          console.log('Successfully deleted orphaned image from storage.');
        } catch (deleteError) {
          console.error('Failed to delete orphaned image from storage:', deleteError);
        }
      }
    } finally {
      setUploading(false);
    }
  };

  const handleClockOut = async () => {
    if (!user || !todayAttendance || todayAttendance.clockOutTime) return;

    setIsClockingOut(true);
    try {
      const clockOutTimestamp = Timestamp.now();
      const today = format(new Date(), 'yyyy-MM-dd');

      // Update attendance record with clock out time
      const attendanceDocRef = doc(db, 'attendance', todayAttendance.id);
      await updateDoc(attendanceDocRef, {
        clockOutTime: clockOutTimestamp,
        updatedAt: Timestamp.now(),
      });

      // Recalculate and update daily salary record
      const dailySalaryDocRef = doc(db, 'daily_salaries', `${user.id}_${today}`);
      const dailySalaryData = await calculateDailyEarnings(
        user.id,
        today,
        todayAttendance.clockInTime.toDate(),
        clockOutTimestamp.toDate()
      );
      await updateDoc(dailySalaryDocRef, dailySalaryData);

      toast.success(t('clockOutSuccess')); 
      fetchAttendance(); 
    } catch (error) {
      console.error('Error clocking out:', error);
      toast.error(t('error'));
    } finally {
      setIsClockingOut(false);
    }
  };

  const showClockOutButton = useMemo(() => {
    return todayAttendance && !todayAttendance.clockOutTime;
  }, [todayAttendance]);

  return (
    <div className="p-4 space-y-6">
      {/* Clock In Section */}
      {!todayAttendance && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5 text-primary" />
              {t('clockIn')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {showCamera ? (
              <div className="space-y-4">
                <div className="relative aspect-video overflow-hidden rounded-lg bg-muted">
                  <video 
                    ref={videoRef} 
                    autoPlay 
                    playsInline 
                    muted 
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={capturePhoto} className="flex-1 gap-2">
                    <Camera className="h-4 w-4" />
                    {t('takePhoto')}
                  </Button>
                  <Button onClick={stopCamera} variant="outline">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : imagePreview ? (
              <div className="space-y-4">
                <div className="relative aspect-video overflow-hidden rounded-lg">
                  <img src={imagePreview} alt="Preview" className="h-full w-full object-cover" />
                  <button
                    onClick={clearImage}
                    className="absolute right-2 top-2 rounded-full bg-black/50 p-1 text-white hover:bg-black/70"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <Button 
                  onClick={handleClockIn} 
                  className="w-full gap-2" 
                  disabled={uploading}
                >
                  {uploading ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      {t('loading')}
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4" />
                      {t('clockIn')}
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="user"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <Button 
                  onClick={startCamera}
                  className="w-full gap-2"
                  variant="default"
                >
                  <Camera className="h-4 w-4" />
                  {t('takePhoto')}
                </Button>
                <Button 
                  onClick={() => fileInputRef.current?.click()}
                  variant="outline"
                  className="w-full gap-2"
                >
                  <Upload className="h-4 w-4" />
                  {t('uploadPhoto')}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Clock Out Section */}
      {showClockOutButton && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              {t('clockOut')} {/* Assuming you add this translation key */}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button
              onClick={handleClockOut}
              className="w-full gap-2"
              disabled={isClockingOut}
            >
              {isClockingOut ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <Clock className="h-4 w-4" />}
              {isClockingOut ? t('loading') : t('clockOut')}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Today's Status */}
      {todayAttendance && (
        <Card className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="rounded-full bg-green-100 p-3 dark:bg-green-900">
              <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-green-700 dark:text-green-300">{t('clockedIn')}</p>
              <p className="text-sm text-green-600 dark:text-green-400">
                {todayAttendance.clockInTime && format(todayAttendance.clockInTime.toDate(), 'HH:mm, dd MMM yyyy')}
              </p>
            </div>
            {todayAttendance.imageUrl && (
              <img 
                src={todayAttendance.imageUrl} 
                alt="Today" 
                className="h-14 w-14 rounded-lg object-cover"
              />
            )}
          </CardContent>
        </Card>
      )}

      {/* Attendance History */}
      <div>
        <h3 className="mb-3 text-sm font-medium text-muted-foreground">{t('attendanceHistory')}</h3>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 animate-pulse rounded-lg bg-muted" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                      <div className="h-3 w-16 animate-pulse rounded bg-muted" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : attendanceHistory.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center p-8 text-center">
              <div className="rounded-full bg-muted p-4">
                <Clock className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="mt-4 text-muted-foreground">{t('noAttendance')}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {attendanceHistory.map((record) => (
              <Card key={record.id}>
                <CardContent className="flex items-center gap-4 p-4">
                  {record.imageUrl ? (
                    <img 
                      src={record.imageUrl} 
                      alt="Attendance" 
                      className="h-12 w-12 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
                      <ImageIcon className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="font-medium">{record.date}</p>
                    <p className="text-sm text-muted-foreground">
                      {record.clockInTime && format(record.clockInTime.toDate(), 'HH:mm')}
                    </p>
                  </div>
                  <CheckCircle className="h-5 w-5 text-green-500" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Hidden canvas for camera capture */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
