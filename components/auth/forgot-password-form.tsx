'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { useLanguage } from '@/contexts/language-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, ArrowLeft, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

export function ForgotPasswordForm() {
  const [icNumber, setIcNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const { requestPasswordReset } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!icNumber) return;

    setIsLoading(true);
    try {
      await requestPasswordReset(icNumber);
      setIsSubmitted(true);
      toast.success(t('resetRequested'));
    } catch {
      toast.error(t('error'));
    } finally {
      setIsLoading(false);
    }
  };

  if (isSubmitted) {
    return (
      <Card className="w-full max-w-md border-0 shadow-xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
            <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
          </div>
          <CardTitle className="text-xl font-bold">{t('success')}</CardTitle>
          <CardDescription className="text-base">{t('resetDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={() => router.push('/login')} 
            className="w-full h-12"
          >
            {t('login')}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md border-0 shadow-xl">
      <CardHeader className="text-center">
        <Button 
          variant="ghost" 
          size="sm"
          onClick={() => router.push('/login')} 
          className="absolute left-4 top-4"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <CardTitle className="text-xl font-bold">{t('forgotPassword')}</CardTitle>
        <CardDescription>{t('resetDescription')}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="icNumber">{t('icNumber')}</Label>
            <Input
              id="icNumber"
              type="text"
              placeholder="000000-00-0000"
              value={icNumber}
              onChange={(e) => setIcNumber(e.target.value)}
              required
              className="h-12"
            />
          </div>
          <Button type="submit" className="w-full h-12 text-base" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('loading')}
              </>
            ) : (
              t('submit')
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
