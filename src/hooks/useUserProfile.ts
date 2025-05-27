import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { getUserProfile } from "@/lib/firebase/userProfile";

export function useUserProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
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
      .then((p) => setProfile(p))
      .finally(() => setLoading(false));
  }, [user, refreshKey]);

  return { profile, loading, setProfile, forceRefresh };
}
