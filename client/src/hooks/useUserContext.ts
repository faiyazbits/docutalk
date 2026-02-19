'use client';

import { useState, useCallback } from 'react';
import type { UserInfo, ClientContext } from '@/types';

export function useUserContext() {
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);

  const setUser = useCallback((info: UserInfo) => {
    setUserInfo(info);
  }, []);

  const clearUser = useCallback(() => {
    setUserInfo(null);
  }, []);

  const buildContext = useCallback((): ClientContext => {
    return {
      user: userInfo ?? undefined,
      deviceType: 'web',
      bookId: 'plusTwo123',
      currentUrl: typeof window !== 'undefined' ? window.location.href : '',
      timestamp: new Date().toISOString(),
    };
  }, [userInfo]);

  return { userInfo, setUser, clearUser, buildContext };
}
