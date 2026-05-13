'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { useLanguage } from '@/contexts/language-context';
import { useTheme } from 'next-themes';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Globe, Moon, Sun, Monitor, LogOut, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

export default function SettingsPage() {
  const { logout } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  const { theme, setTheme } = useTheme();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    toast.success(t('logoutSuccess'));
    router.replace('/login');
  };

  const handleLanguageChange = (value: 'ms' | 'en') => {
    setLanguage(value);
    toast.success(t('languageChanged'));
  };

  const handleThemeChange = (value: string) => {
    setTheme(value);
    toast.success(t('themeChanged'));
  };

  const themeOptions = [
    { value: 'light', label: t('lightMode'), icon: Sun },
    { value: 'dark', label: t('darkMode'), icon: Moon },
    { value: 'system', label: t('systemMode'), icon: Monitor },
  ];

  const languageOptions = [
    { value: 'ms', label: t('malay'), flag: '🇲🇾' },
    { value: 'en', label: t('english'), flag: '🇬🇧' },
  ];

  return (
    <div className="p-4 space-y-6">
      {/* Language Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Globe className="h-4 w-4 text-primary" />
            {t('language')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <RadioGroup value={language} onValueChange={(value: 'ms' | 'en') => setLanguage(value)}>
            {languageOptions.map((option) => (
              <div key={option.value} className="flex items-center space-x-3 py-3 border-b last:border-0">
                <RadioGroupItem value={option.value} id={`lang-${option.value}`} />
                <Label 
                  htmlFor={`lang-${option.value}`} 
                  className="flex flex-1 items-center gap-3 cursor-pointer"
                >
                  <span className="text-xl">{option.flag}</span>
                  <span className="font-medium">{option.label}</span>
                </Label>
                {language === option.value && (
                  <ChevronRight className="h-4 w-4 text-primary" />
                )}
              </div>
            ))}
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Theme Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sun className="h-4 w-4 text-primary" />
            {t('theme')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <RadioGroup value={theme} onValueChange={setTheme}>
            {themeOptions.map((option) => (
              <div key={option.value} className="flex items-center space-x-3 py-3 border-b last:border-0">
                <RadioGroupItem value={option.value} id={`theme-${option.value}`} />
                <Label 
                  htmlFor={`theme-${option.value}`} 
                  className="flex flex-1 items-center gap-3 cursor-pointer"
                >
                  <div className="rounded-full bg-muted p-2">
                    <option.icon className="h-4 w-4" />
                  </div>
                  <span className="font-medium">{option.label}</span>
                </Label>
                {theme === option.value && (
                  <ChevronRight className="h-4 w-4 text-primary" />
                )}
              </div>
            ))}
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Logout Button */}
      <Button 
        onClick={handleLogout} 
        variant="destructive" 
        className="w-full gap-2"
      >
        <LogOut className="h-4 w-4" />
        {t('logout')}
      </Button>

      {/* App Version */}
      <p className="text-center text-xs text-muted-foreground">
        {t('appName')} v1.0.0
      </p>
    </div>
  );
}
