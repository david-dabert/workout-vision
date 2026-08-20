import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getProfile as loadProfile, saveProfile as persistProfile } from './storage';

const ProfileContext = createContext(null);

export function ProfileProvider({ children }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProfile().then(p => {
      setProfile(p);
      setLoading(false);
    });
  }, []);

  const saveProfile = useCallback(async (updated) => {
    await persistProfile(updated);
    setProfile(updated);
  }, []);

  const refreshProfile = useCallback(async () => {
    const p = await loadProfile();
    setProfile(p);
    return p;
  }, []);

  return (
    <ProfileContext.Provider value={{ profile, saveProfile, refreshProfile, profileLoading: loading }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error('useProfile must be used within ProfileProvider');
  return ctx;
}
