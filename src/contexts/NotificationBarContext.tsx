import { createContext, useContext, useState, ReactNode } from 'react';

interface NotificationBarContextType {
  isVisible: boolean;
  setIsVisible: (visible: boolean) => void;
  notificationHeight: number;
  setNotificationHeight: (height: number) => void;
}

const NotificationBarContext = createContext<NotificationBarContextType | undefined>(undefined);

export function NotificationBarProvider({ children }: { children: ReactNode }) {
  const [isVisible, setIsVisible] = useState(false);
  const [notificationHeight, setNotificationHeight] = useState(0);

  return (
    <NotificationBarContext.Provider
      value={{
        isVisible,
        setIsVisible,
        notificationHeight,
        setNotificationHeight
      }}
    >
      {children}
    </NotificationBarContext.Provider>
  );
}

export function useNotificationBarContext() {
  const context = useContext(NotificationBarContext);
  if (context === undefined) {
    throw new Error('useNotificationBarContext must be used within a NotificationBarProvider');
  }
  return context;
}
