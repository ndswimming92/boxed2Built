import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

interface PrivacyModeContextValue {
  privacyModeEnabled: boolean;
  togglePrivacyMode: () => void;
  maskFinancialValue: (value: string | number) => string;
}

const PrivacyModeContext = createContext<PrivacyModeContextValue | undefined>(undefined);

const PRIVACY_MODE_STORAGE_KEY = 'admin-privacy-mode-enabled';

export function PrivacyModeProvider({ children }: { children: React.ReactNode }) {
  const [privacyModeEnabled, setPrivacyModeEnabled] = useState<boolean>(() => {
    return localStorage.getItem(PRIVACY_MODE_STORAGE_KEY) === 'true';
  });

  useEffect(() => {
    localStorage.setItem(PRIVACY_MODE_STORAGE_KEY, String(privacyModeEnabled));
  }, [privacyModeEnabled]);

  const togglePrivacyMode = () => {
    setPrivacyModeEnabled(prev => !prev);
  };

  const maskFinancialValue = (value: string | number) => {
    if (!privacyModeEnabled) {
      return String(value);
    }

    if (typeof value === 'number') {
      return '$••••';
    }

    const hasCurrencySignal = /[$€£]|usd|dollars?/i.test(value);
    return hasCurrencySignal ? '$••••' : '••••';
  };

  const contextValue = useMemo(
    () => ({
      privacyModeEnabled,
      togglePrivacyMode,
      maskFinancialValue,
    }),
    [privacyModeEnabled]
  );

  return <PrivacyModeContext.Provider value={contextValue}>{children}</PrivacyModeContext.Provider>;
}

export function usePrivacyMode() {
  const context = useContext(PrivacyModeContext);
  if (!context) {
    throw new Error('usePrivacyMode must be used within a PrivacyModeProvider');
  }
  return context;
}
