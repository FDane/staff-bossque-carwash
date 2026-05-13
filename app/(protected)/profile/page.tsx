'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/auth-context';
import { useLanguage } from '@/contexts/language-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { User, Phone, MapPin, Briefcase, Building, CreditCard, Camera, Lock, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

export default function ProfilePage() {
  const { user, firebaseUser } = useAuth();
  const { t } = useLanguage();
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Form state
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [address, setAddress] = useState(user?.address || '');
  const [bankName, setBankName] = useState(user?.bankName || '');
  const [bankAccount, setBankAccount] = useState(user?.bankAccount || '');

  const handleSave = async () => {
    if (!user || !firebaseUser) return;

    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', firebaseUser.uid), {
        name,
        phone,
        address,
        bankName,
        bankAccount,
        updatedAt: Timestamp.now(),
      });
      toast.success(t('profileUpdated'));
      setIsEditing(false);
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error(t('error'));
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !firebaseUser) return;

    setUploading(true);
    try {
      const imageRef = ref(storage, `profiles/${firebaseUser.uid}/${Date.now()}.jpg`);
      await uploadBytes(imageRef, file);
      const imageUrl = await getDownloadURL(imageRef);
      
      await updateDoc(doc(db, 'users', firebaseUser.uid), {
        profileImage: imageUrl,
        updatedAt: Timestamp.now(),
      });
      
      toast.success(t('profileUpdated'));
      // Force refresh by reloading
      window.location.reload();
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error(t('error'));
    } finally {
      setUploading(false);
    }
  };

  const handleCancel = () => {
    setName(user?.name || '');
    setPhone(user?.phone || '');
    setAddress(user?.address || '');
    setBankName(user?.bankName || '');
    setBankAccount(user?.bankAccount || '');
    setIsEditing(false);
  };

  const profileFields = [
    { icon: User, label: t('name'), value: name, setValue: setName, editable: true },
    { icon: CreditCard, label: t('icNumber'), value: user?.icNumber || '', editable: false },
    { icon: Phone, label: t('phone'), value: phone, setValue: setPhone, editable: true },
    { icon: MapPin, label: t('address'), value: address, setValue: setAddress, editable: true },
    { icon: Briefcase, label: t('position'), value: user?.position || '', editable: false },
    { icon: Building, label: t('bankName'), value: bankName, setValue: setBankName, editable: true },
    { icon: CreditCard, label: t('bankAccount'), value: bankAccount, setValue: setBankAccount, editable: true },
  ];

  return (
    <div className="p-4 space-y-6">
      {/* Profile Header */}
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <Avatar className="h-24 w-24 border-4 border-accent">
            <AvatarImage src={user?.profileImage} alt={user?.name} />
            <AvatarFallback className="bg-primary text-primary-foreground text-2xl">
              {user?.name?.slice(0, 2).toUpperCase() || 'ST'}
            </AvatarFallback>
          </Avatar>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="absolute -bottom-1 -right-1 rounded-full bg-primary p-2 text-primary-foreground shadow-lg hover:bg-primary/90 disabled:opacity-50"
          >
            {uploading ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <Camera className="h-4 w-4" />
            )}
          </button>
        </div>
        <div className="text-center">
          <h2 className="text-xl font-bold">{user?.name}</h2>
          <p className="text-sm text-muted-foreground">{user?.position}</p>
        </div>
      </div>

      {/* Profile Details */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-4 w-4 text-primary" />
            {t('personalDetails')}
          </CardTitle>
          {!isEditing && (
            <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
              {t('edit')}
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {profileFields.map((field, index) => (
            <div key={index} className="space-y-2">
              <Label className="flex items-center gap-2 text-muted-foreground">
                <field.icon className="h-4 w-4" />
                {field.label}
              </Label>
              {isEditing && field.editable && field.setValue ? (
                <Input
                  value={field.value}
                  onChange={(e) => field.setValue(e.target.value)}
                  className="h-12"
                />
              ) : (
                <p className="py-3 px-4 bg-muted/50 rounded-lg">
                  {field.value || '-'}
                </p>
              )}
            </div>
          ))}
          
          {isEditing && (
            <div className="flex gap-3 pt-4">
              <Button variant="outline" onClick={handleCancel} className="flex-1">
                {t('cancel')}
              </Button>
              <Button onClick={handleSave} disabled={saving} className="flex-1">
                {saving ? (
                  <>
                    <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    {t('loading')}
                  </>
                ) : (
                  t('save')
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Change Password Link */}
      <Link href="/profile/password">
        <Card className="cursor-pointer transition-colors hover:bg-muted/50">
          <CardContent className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-primary/10 p-2">
                <Lock className="h-5 w-5 text-primary" />
              </div>
              <span className="font-medium">{t('changePassword')}</span>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </CardContent>
        </Card>
      </Link>
    </div>
  );
}
