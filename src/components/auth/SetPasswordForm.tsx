import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import zxcvbn from "zxcvbn";
import axios from "axios";

export default function SetPasswordForm({ email, onSetPassword, isLoading, error }: {
  email: string;
  onSetPassword: (password: string) => void;
  isLoading: boolean;
  error?: string | null;
}) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [passwordStrength, setPasswordStrength] = useState<number>(0);
  const [breached, setBreached] = useState<boolean | null>(null);

  // Check password strength and breach status
  const handlePasswordChange = async (val: string) => {
    setPassword(val);
    const result = zxcvbn(val);
    setPasswordStrength(result.score);
    // Breached password check (k-anonymity, partial hash)
    if (val.length >= 8) {
      const sha1 = await window.crypto.subtle.digest('SHA-1', new TextEncoder().encode(val));
      const hash = Array.from(new Uint8Array(sha1)).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
      const prefix = hash.slice(0, 5);
      const suffix = hash.slice(5);
      try {
        const res = await axios.get(`https://api.pwnedpasswords.com/range/${prefix}`);
        setBreached(res.data.includes(suffix));
      } catch {
        setBreached(null); // API error
      }
    } else {
      setBreached(null);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    if (!password || password.length < 6) {
      setLocalError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setLocalError("Passwords do not match.");
      return;
    }
    onSetPassword(password);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 p-2">
      <Label htmlFor="email">Email</Label>
      <Input id="email" type="email" value={email} disabled />
      <Label htmlFor="password">New Password</Label>
      <Input
        id="password"
        type="password"
        placeholder="New password"
        value={password}
        onChange={e => handlePasswordChange(e.target.value)}
        required
        autoComplete="new-password"
      />
      {/* Password strength meter */}
      <div className="text-xs">
        Strength: {["Too weak", "Weak", "Fair", "Good", "Strong"][passwordStrength]}
        {breached === true && <span className="text-red-500 ml-2">Breached password!</span>}
        {breached === false && <span className="text-green-600 ml-2">Not found in breaches</span>}
      </div>
      <Label htmlFor="confirm">Confirm Password</Label>
      <Input
        id="confirm"
        type="password"
        placeholder="Confirm password"
        value={confirm}
        onChange={e => setConfirm(e.target.value)}
        required
        autoComplete="new-password"
      />
      {(localError || error) && <div className="text-red-500 text-xs">{localError || error}</div>}
      <Button type="submit" variant="default" size="sm" disabled={isLoading}>
        {isLoading ? "Setting..." : "Set Password"}
      </Button>
    </form>
  );
}
