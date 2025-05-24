import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function SetPasswordForm({ email, onSetPassword, isLoading, error }: {
  email: string;
  onSetPassword: (password: string) => void;
  isLoading: boolean;
  error?: string | null;
}) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

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
      <Input type="email" value={email} disabled />
      <Input
        type="password"
        placeholder="New password"
        value={password}
        onChange={e => setPassword(e.target.value)}
        required
      />
      <Input
        type="password"
        placeholder="Confirm password"
        value={confirm}
        onChange={e => setConfirm(e.target.value)}
        required
      />
      {(localError || error) && <div className="text-red-500 text-xs">{localError || error}</div>}
      <Button type="submit" variant="default" size="sm" disabled={isLoading}>
        {isLoading ? "Setting..." : "Set Password"}
      </Button>
    </form>
  );
}
