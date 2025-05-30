import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { getUserProfile } from "@/lib/firebase/userProfile";
import type { UserProfile } from "@/types/userProfile";

export function useUserProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);

  // Add a forceRefresh state to allow manual refresh
  const [refreshKey, setRefreshKey] = useState(0);
  const forceRefresh = () => setRefreshKey((k) => k + 1);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      return;
    }
    setLoading(true);
    getUserProfile(user.uid)
      .then((p) => {
        // Defensive: only set profile if username is a non-empty string
        if (p && typeof p.username === 'string' && p.username.trim().length > 0) {
          setProfile(p);
        } else {
          setProfile(null);
        }
      })
      .finally(() => setLoading(false));
  }, [user, refreshKey]);

  return { profile, loading, setProfile, forceRefresh };
}
