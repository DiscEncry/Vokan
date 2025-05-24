"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/AuthContext";
import { Loader2 } from "lucide-react";

export default function EmailAuthForm({ onAuthSuccess }: { onAuthSuccess?: () => void }) {
  const { isLoading, signInWithEmail, registerWithEmail } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isRegister, setIsRegister] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email || !password) {
      setError("Email and password are required.");
      return;
    }
    let user = null;
    if (isRegister) {
      const result = await registerWithEmail(email, password);
      if (result && typeof result === 'object' && 'error' in result && typeof result.error === 'string') {
        setError(result.error);
        return;
      }
      user = result;
      if (!user) setError("Registration failed. Email may already be in use.");
    } else {
      user = await signInWithEmail(email, password);
      if (!user) setError("Sign in failed. Check your credentials.");
    }
    if (user && onAuthSuccess) onAuthSuccess();
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
      <Input
        type="password"
        placeholder="Password"
        value={password}
        onChange={e => setPassword(e.target.value)}
        autoComplete={isRegister ? "new-password" : "current-password"}
        required
      />
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
