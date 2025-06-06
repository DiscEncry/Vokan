import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { getUserProfile } from "@/lib/firebase/userProfile";
import type { UserProfile } from "@/types/userProfile";

// Helper: sleep for ms milliseconds
function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function useUserProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Add a forceRefresh state to allow manual refresh
  const [refreshKey, setRefreshKey] = useState(0);
  const forceRefresh = () => setRefreshKey((k) => k + 1);

  useEffect(() => {
    let cancelled = false;
    async function fetchProfileWithRetry() {
      if (!user) {
        setProfile(null);
        setError(null);
        return;
      }
      setLoading(true);
      setError(null);
      let attempts = 0;
      let lastProfile: UserProfile | null = null;
      while (attempts < 5) {
        try {
          const p = await getUserProfile(user.uid);
          if (p && typeof p.username === 'string' && p.username.trim().length > 0) {
            lastProfile = p;
            break;
          }
        } catch (e) {
          // ignore, will retry
        }
        attempts++;
        await sleep(300);
      }
      if (!cancelled) {
        if (lastProfile) {
          setProfile(lastProfile);
          setError(null);
        } else {
          setProfile(null);
          setError('Profile is incomplete or missing.');
        }
        setLoading(false);
      }
    }
    fetchProfileWithRetry();
    return () => {
      cancelled = true;
    };
  }, [user, refreshKey]);

  return { profile, loading, error, setProfile, forceRefresh };
}
