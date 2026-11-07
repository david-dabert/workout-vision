import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const ProfileContext = createContext(null);

export function ProfileProvider({ children }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [storageError, setStorageError] = useState(null);

  useEffect(() => {
    import('./storage')
      .then(m => m.getProfile())
      .then(p => {
        setProfile(p);
        setLoading(false);
      })
      .catch((err) => {
        console.error('[Profile] Storage load failed:', err);
        setStorageError(err);
        setLoading(false);
      });
  }, []);

  const saveProfile = useCallback(async (updated) => {
    try {
      const { saveProfile: persistProfile } = await import('./storage');
      await persistProfile(updated);
      setProfile(updated);
      setStorageError(null);
    } catch (err) {
      console.error('[Profile] Storage save failed:', err);
      setStorageError(err);
      throw err;
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    try {
      const { getProfile: loadProfile } = await import('./storage');
      const p = await loadProfile();
      setProfile(p);
      setStorageError(null);
      return p;
    } catch (err) {
      console.error('[Profile] Storage refresh failed:', err);
      setStorageError(err);
      return null;
    }
  }, []);

  return (
    <ProfileContext.Provider value={{ profile, saveProfile, refreshProfile, profileLoading: loading, storageError }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error('useProfile must be used within ProfileProvider');
  return ctx;
}
