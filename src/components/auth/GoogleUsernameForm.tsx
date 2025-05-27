import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import zxcvbn from "zxcvbn";
import axios from "axios";

export default function GoogleUsernameForm({
  email,
  onSubmit,
  isLoading,
  error,
}: {
  email: string;
  onSubmit: (username: string, password: string, confirm: string) => void;
  isLoading: boolean;
  error?: string | null;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [passwordStrength, setPasswordStrength] = useState<number>(0);
  const [breached, setBreached] = useState<boolean | null>(null);

  // Password strength and breach check
  const handlePasswordChange = async (val: string) => {
    setPassword(val);
    const result = zxcvbn(val);
    setPasswordStrength(result.score);
    if (val.length >= 8) {
      const sha1 = await window.crypto.subtle.digest('SHA-1', new TextEncoder().encode(val));
      const hash = Array.from(new Uint8Array(sha1)).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
      const prefix = hash.slice(0, 5);
      const suffix = hash.slice(5);
      try {
        const res = await axios.get(`https://api.pwnedpasswords.com/range/${prefix}`);
        setBreached(res.data.includes(suffix));
      } catch {
        setBreached(null);
      }
    } else {
      setBreached(null);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    // Username validation: 3-20 chars, alphanumeric/underscore, no spaces, must start with a letter
    const usernameRegex = /^[a-zA-Z][a-zA-Z0-9_]{2,19}$/;
    if (!usernameRegex.test(username)) {
      setLocalError("Username must be 3-20 characters, start with a letter, and contain only letters, numbers, or underscores.");
      return;
    }
    if (!username) {
      setLocalError("Username is required.");
      return;
    }
    if (!password || password.length < 6) {
      setLocalError("Password must be at least 6 characters.");
      return;
    }
    if (breached) {
      setLocalError("This password has been found in a data breach. Please choose another.");
      return;
    }
    if (password !== confirm) {
      setLocalError("Passwords do not match.");
      return;
    }
    onSubmit(username, password, confirm);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 p-2">
      <Input type="email" value={email} disabled />
      <Input
        type="text"
        placeholder="Username"
        value={username}
        onChange={e => setUsername(e.target.value)}
        required
        autoComplete="username"
      />
      <Input
        type="password"
        placeholder="New password"
        value={password}
        onChange={e => handlePasswordChange(e.target.value)}
        required
        autoComplete="new-password"
      />
      {/* Password strength meter */}
      {password && (
        <div className="text-xs">
          Strength: <span className={`font-semibold ${passwordStrength < 2 ? 'text-red-500' : passwordStrength < 4 ? 'text-yellow-600' : 'text-green-600'}`}>{["Very weak","Weak","Fair","Good","Strong"][passwordStrength]}</span>
          {breached === true && <span className="text-red-500 ml-2">This password has been found in a data breach!</span>}
          {breached === false && password.length >= 8 && <span className="text-green-600 ml-2">Not found in breach database</span>}
        </div>
      )}
      <Input
        type="password"
        placeholder="Confirm password"
        value={confirm}
        onChange={e => setConfirm(e.target.value)}
        required
        autoComplete="new-password"
      />
      <Button type="submit" disabled={isLoading} variant="default">
        {isLoading ? "Submitting..." : "Set Username & Password"}
      </Button>
      {(localError || error) && <div className="text-red-500 text-xs">{localError || error}</div>}
    </form>
  );
}
