import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";
import { createUserProfile } from "@/lib/firebase/userProfile";
import { validateUsername } from "@/lib/validation";
import { useDebounceEffect } from "@/hooks/useDebounce";
import type { UserProfile } from "@/types/userProfile";
import { CheckCircle } from "lucide-react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "https://your-api.vercel.app";

export default function ProfileForm({ initialProfile, onSuccess }: {
  initialProfile: UserProfile;
  onSuccess?: (profile: UserProfile) => void;
}) {
  const { user } = useAuth();
  const [username, setUsername] = useState(initialProfile.username);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [usernameChecking, setUsernameChecking] = useState(false);
  const [usernameUnique, setUsernameUnique] = useState<null | boolean>(null);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [touched, setTouched] = useState({ username: false });
  const [debounced, setDebounced] = useState({ username: initialProfile.username });

  useDebounceEffect(
    () => {
      setDebounced(d => ({ ...d, username }));
    },
    500,
    [username]
  );

  useDebounceEffect(
    () => {
      const usernameValid = validateUsername(username);
      if (!username || !usernameValid.isValid) {
        setUsernameUnique(null);
        setUsernameChecking(false);
        setUsernameError(usernameValid.message || null);
        return;
      }
      setUsernameChecking(true);
      setUsernameUnique(null);
      setUsernameError(null);
      fetch(`${API_BASE_URL}/api/check-username?username=${encodeURIComponent(username)}`)
        .then(res => res.json())
        .then(data => {
          setUsernameUnique(data.available);
          if (!data.available) {
            setUsernameError("This username is already taken. Please choose another.");
          } else {
            setUsernameError(null);
          }
        })
        .catch(() => {
          setUsernameUnique(null);
          setUsernameError("Could not check username. Please try again.");
        })
        .finally(() => setUsernameChecking(false));
    },
    500,
    [username]
  );

  // Validation helpers for username
  const usernameValid = validateUsername(debounced.username).isValid && usernameUnique !== false;
  // Error helpers for username
  const usernameFormatError = touched.username && debounced.username && !validateUsername(debounced.username).isValid
    ? 'Username must be 3-20 characters, start with a letter, and contain only letters, numbers, or underscores.'
    : '';
  const usernameTakenError = touched.username && usernameUnique === false ? 'This username is already taken. Please choose another.' : '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    const usernameValid = validateUsername(username);
    if (!usernameValid.isValid) {
      setError(usernameValid.message);
      return;
    }
    if (usernameUnique === false) {
      setError("Username is already taken.");
      return;
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
      <Label htmlFor="email">Email</Label>
      <Input id="email" type="email" value={initialProfile.email} disabled />
      <Label htmlFor="username">Username</Label>
      <div className="relative">
        <Input
          id="username"
          type="text"
          placeholder="Username"
          value={username}
          onChange={e => { setUsername(e.target.value); setTouched(t => ({ ...t, username: true })); }}
          required
          autoComplete="username"
        />
        {usernameValid && touched.username && (
          <CheckCircle className="w-5 h-5 text-green-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
        )}
      </div>
      {!usernameValid && (usernameFormatError || usernameTakenError) && <div className="text-xs text-red-500 mt-1">{usernameFormatError || usernameTakenError}</div>}
      {error && <div className="text-red-500 text-xs">{error}</div>}
      {success && <div className="text-green-600 text-xs">Profile updated!</div>}
      <Button type="submit" variant="default" size="sm" disabled={loading}>
        {loading ? "Saving..." : "Save Profile"}
      </Button>
    </form>
  );
}
