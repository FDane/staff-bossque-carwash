'use client';

import { useState, useEffect } from 'react';
import { X, Share, PlusSquare, Download } from 'lucide-react';

export function InstallPrompt() {
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check if already installed
    const isStandaloneMode = window.matchMedia('(display-mode: standalone)').matches 
      || (window.navigator as any).standalone 
      || document.referrer.includes('android-app://');
    
    setIsStandalone(isStandaloneMode);

    // Detect iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(isIOSDevice);

    // Handle Android/Chrome prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      if (!isStandaloneMode) setIsVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Show iOS prompt manually if not standalone
    if (isIOSDevice && !isStandaloneMode) {
      setIsVisible(true);
    }

    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setIsVisible(false);
    }
  };

  if (!isVisible || isStandalone) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[100] md:hidden">
      <div className="bg-card border shadow-lg rounded-xl p-4 animate-in slide-in-from-bottom-8 duration-300">
        <button 
          onClick={() => setIsVisible(false)}
          className="absolute top-2 right-2 p-1 text-muted-foreground hover:text-foreground"
        >
          <X size={18} />
        </button>

        <div className="flex items-start gap-3">
          <div className="bg-primary/10 p-2 rounded-lg text-primary">
            <Download size={24} />
          </div>
          <div className="flex-1 pr-6">
            <h3 className="font-semibold text-sm">Pasang Aplikasi Bossque</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Akses sistem pengurusan dengan lebih pantas terus dari skrin utama anda.
            </p>
          </div>
        </div>

        <div className="mt-4">
          {isIOS ? (
            <div className="text-xs space-y-2 bg-muted/50 p-2 rounded-lg">
              <p className="flex items-center gap-2">
                1. Klik butang <Share size={14} className="text-blue-500" /> Kongsi (Share).
              </p>
              <p className="flex items-center gap-2">
                2. Pilih <PlusSquare size={14} /> <strong>Tambah ke Skrin Utama</strong>.
              </p>
            </div>
          ) : (
            <button
              onClick={handleInstallClick}
              className="w-full bg-primary text-primary-foreground py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Pasang Sekarang
            </button>
          )}
        </div>
      </div>
    </div>
  );
}