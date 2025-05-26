"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/AuthContext";
import { Loader2 } from "lucide-react";

export default function EmailAuthForm({ onAuthSuccess }: { onAuthSuccess?: () => void }) {
  const { isLoading, signInWithEmail, registerWithEmail } = useAuth();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [isRegister, setIsRegister] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email || !password) {
      setError("Email and password are required.");
      return;
    }
    if (isRegister) {
      if (!username) {
        setError("Username is required.");
        return;
      }
      if (password !== confirm) {
        setError("Passwords do not match.");
        return;
      }
      const result = await registerWithEmail(email, password, username);
      if (result && typeof result === 'object' && 'error' in result && typeof result.error === 'string') {
        setError(result.error);
        return;
      }
      const user = result;
      if (!user) setError("Registration failed. Email may already be in use.");
      if (user && onAuthSuccess) onAuthSuccess();
    } else {
      const user = await signInWithEmail(email, password);
      if (!user) setError("Sign in failed. Check your credentials.");
      if (user && onAuthSuccess) onAuthSuccess();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 p-2">
      <Input
        type="email"
        placeholder="Email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        autoComplete="email"
        required
      />
      {isRegister && (
        <Input
          type="text"
          placeholder="Username"
          value={username}
          onChange={e => setUsername(e.target.value)}
          autoComplete="username"
          required
        />
      )}
      <Input
        type="password"
        placeholder="Password"
        value={password}
        onChange={e => setPassword(e.target.value)}
        autoComplete={isRegister ? "new-password" : "current-password"}
        required
      />
      {isRegister && (
        <Input
          type="password"
          placeholder="Retype Password"
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
          autoComplete="new-password"
          required
        />
      )}
      {error && <div className="text-red-500 text-xs">{error}</div>}
      <Button type="submit" variant="default" size="sm" disabled={isLoading}>
        {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
        {isRegister ? "Register" : "Sign In"}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setIsRegister(r => !r)}
        disabled={isLoading}
      >
        {isRegister ? "Already have an account? Sign In" : "Need an account? Register"}
      </Button>
    </form>
  );
}
