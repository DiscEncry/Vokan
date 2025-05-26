import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/AuthContext";
import { getUserProfile, createUserProfile } from "@/lib/firebase/userProfile";
import { checkUsernameExists } from "@/lib/firebase/checkUsernameExists";
import type { UserProfile } from "@/types/userProfile";

export default function ProfileForm({ initialProfile, onSuccess }: {
  initialProfile: UserProfile;
  onSuccess?: (profile: UserProfile) => void;
}) {
  const { user } = useAuth();
  const [username, setUsername] = useState(initialProfile.username);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    if (!username) {
      setError("Username is required.");
      return;
    }
    if (username !== initialProfile.username) {
      const exists = await checkUsernameExists(username);
      if (exists) {
        setError("Username is already taken.");
        return;
      }
    }
    setLoading(true);
    try {
      const updated: UserProfile = {
        ...initialProfile,
        username,
      };
      await createUserProfile(updated);
      setSuccess(true);
      if (onSuccess) onSuccess(updated);
    } catch (err: any) {
      setError(err.message || "Failed to update profile.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 p-2 max-w-sm">
      <Input type="email" value={initialProfile.email} disabled />
      <Input
        type="text"
        placeholder="Username"
        value={username}
        onChange={e => setUsername(e.target.value)}
        required
      />
      {error && <div className="text-red-500 text-xs">{error}</div>}
      {success && <div className="text-green-600 text-xs">Profile updated!</div>}
      <Button type="submit" variant="default" size="sm" disabled={loading}>
        {loading ? "Saving..." : "Save Profile"}
      </Button>
    </form>
  );
}
