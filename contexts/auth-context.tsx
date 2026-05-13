'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, updatePassword, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, collection, addDoc, Timestamp } from 'firebase/firestore';
import { auth, db, icToEmail, setAuthPersistence } from '@/lib/firebase';
import type { User } from '@/lib/types';

interface AuthContextType {
  user: User | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  login: (icNumber: string, password: string, rememberMe: boolean) => Promise<void>;
  logout: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  requestPasswordReset: (icNumber: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log("Auth: Initializing listener...");
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      console.log("Auth: State changed, user found:", !!fbUser);
      setFirebaseUser(fbUser);
      if (fbUser) {
        try {
          // Fetch user data from Firestore
          const userDoc = await getDoc(doc(db, 'staff', fbUser.uid));
          if (userDoc.exists()) {
            setUser({ id: userDoc.id, ...userDoc.data() } as User);
          } else {
            setUser(null);
          }
        } catch (error) {
          console.error("Firestore permission error:", error);
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (icNumber: string, password: string, rememberMe: boolean) => {
    await setAuthPersistence(rememberMe);
    const email = icToEmail(icNumber);
    await signInWithEmailAndPassword(auth, email, password);
  };

  const logout = async () => {
    await signOut(auth);
    setUser(null);
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    if (!firebaseUser || !user) throw new Error('Not authenticated');
    
    // Re-authenticate user first
    const email = icToEmail(user.icNumber);
    await signInWithEmailAndPassword(auth, email, currentPassword);
    
    // Update password
    await updatePassword(firebaseUser, newPassword);
  };

  const requestPasswordReset = async (icNumber: string) => {
    // Create a password reset request in Firestore for the owner to handle
    await addDoc(collection(db, 'password_resets'), {
      icNumber,
      requestedAt: Timestamp.now(),
      status: 'pending',
    });
  };

  return (
    <AuthContext.Provider value={{ user, firebaseUser, loading, login, logout, changePassword, requestPasswordReset }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
