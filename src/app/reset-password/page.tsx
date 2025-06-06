"use client";
import React, { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormStatusMessage } from "@/components/ui/FormStatusMessage";
import { validatePassword, validatePasswordMatch } from "@/lib/validation";
import Link from "next/link";

export default function ResetPasswordPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const oobCode = searchParams.get("oobCode") || "";
  const [form, setForm] = useState({ password: "", confirm: "" });
  const [status, setStatus] = useState<null | { type: "success" | "error"; message: string }>(null);
  const [loading, setLoading] = useState(false);
  const [showLoginLink, setShowLoginLink] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);
    // Client-side validation
    const pw = validatePassword(form.password);
    if (!pw.isValid) {
      setStatus({ type: "error", message: pw.message || "Password is invalid." });
      return;
    }
    const match = validatePasswordMatch(form.password, form.confirm);
    if (!match.isValid) {
      setStatus({ type: "error", message: match.message || "Passwords do not match." });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/password-reset/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oobCode, newPassword: form.password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to reset password.");
      setStatus({ type: "success", message: "Password reset successful! You can now log in with your new password." });
      setShowLoginLink(true);
      // Optionally, do not auto-redirect, just show login link
      // setTimeout(() => router.push("/"), 2000);
    } catch (e: any) {
      setStatus({ type: "error", message: e.message || "Failed to reset password." });
    } finally {
      setLoading(false);
    }
  };

  if (!oobCode) {
    return <FormStatusMessage status="error" message="Invalid or missing password reset code." />;
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-md mx-auto mt-10 space-y-4">
      <h1 className="text-2xl font-bold mb-2">Set New Password</h1>
      <div>
        <Label htmlFor="password">New Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          value={form.password}
          onChange={handleChange}
          required
        />
      </div>
      <div>
        <Label htmlFor="confirm">Confirm New Password</Label>
        <Input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          value={form.confirm}
          onChange={handleChange}
          required
        />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Resetting..." : "Set New Password"}
      </Button>
      {status && <FormStatusMessage status={status.type} message={status.message} />}
      {showLoginLink && (
        <div className="text-center mt-4">
          <Link href="/">
            <span className="text-blue-600 hover:underline">Go to Login</span>
          </Link>
        </div>
      )}
    </form>
  );
}
