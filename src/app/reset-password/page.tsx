"use client";
import React, { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormStatusMessage } from "@/components/ui/FormStatusMessage";
import { validatePassword, validatePasswordMatch } from "@/lib/validation";
import Link from "next/link";
import { EyeIcon, EyeOffIcon } from "lucide-react";
import { CheckCircle } from "lucide-react";
import { PasswordStrengthMeter } from "@/components/ui/PasswordStrengthMeter";
import { usePasswordValidation } from "@/hooks/usePasswordValidation";
import { useDebounceEffect } from "@/hooks/useDebounce";

export default function ResetPasswordPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const oobCode = searchParams.get("oobCode") || "";
  const [form, setForm] = useState({ password: "", confirm: "" });
  const [status, setStatus] = useState<null | { type: "success" | "error"; message: string }>(null);
  const [loading, setLoading] = useState(false);
  const [showLoginLink, setShowLoginLink] = useState(false);
  const { strength, validate } = usePasswordValidation();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [touched, setTouched] = useState({ password: false, confirm: false });
  const [debounced, setDebounced] = useState({ password: '', confirm: '' });

  useEffect(() => {
    if (form.password) validate(form.password);
  }, [form.password, validate]);

  useDebounceEffect(() => setDebounced(d => ({ ...d, password: form.password })), 500, [form.password]);
  useDebounceEffect(() => setDebounced(d => ({ ...d, confirm: form.confirm })), 500, [form.confirm]);

  const passwordValid = validatePassword(debounced.password).isValid && strength >= 3;
  const confirmValid = debounced.confirm && debounced.confirm === debounced.password;
  const passwordError = touched.password && debounced.password && !validatePassword(debounced.password).isValid
    ? 'Your password must be at least 8 characters long.'
    : (touched.password && strength < 3 ? 'Please choose a stronger password.' : '');
  const confirmError = touched.confirm && debounced.confirm && debounced.confirm !== debounced.password
    ? 'The passwords you entered do not match.'
    : '';

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
    setTouched(t => ({ ...t, [e.target.name]: true }));
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
      <div className="space-y-2 relative">
        <Label htmlFor="password">New Password</Label>
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            value={form.password}
            onChange={handleChange}
            required
            placeholder="Enter new password"
          />
          <button type="button" tabIndex={-1} className="absolute right-8 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 bg-transparent border-none p-0" onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? "Hide password" : "Show password"}>
            {showPassword ? <EyeOffIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
          </button>
          {passwordValid && touched.password && (
            <CheckCircle className="w-5 h-5 text-green-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          )}
        </div>
        <PasswordStrengthMeter strength={strength} password={form.password} />
        {!passwordValid && passwordError && <div className="text-xs text-red-500 mt-1">{passwordError}</div>}
      </div>
      <div className="space-y-2 relative">
        <Label htmlFor="confirm">Confirm New Password</Label>
        <div className="relative">
          <Input
            id="confirm"
            name="confirm"
            type={showConfirm ? "text" : "password"}
            autoComplete="new-password"
            value={form.confirm}
            onChange={handleChange}
            required
            placeholder="Repeat new password"
          />
          <button type="button" tabIndex={-1} className="absolute right-8 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 bg-transparent border-none p-0" onClick={() => setShowConfirm(v => !v)} aria-label={showConfirm ? "Hide password" : "Show password"}>
            {showConfirm ? <EyeOffIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
          </button>
          {confirmValid && touched.confirm && (
            <CheckCircle className="w-5 h-5 text-green-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          )}
        </div>
        {!confirmValid && confirmError && <div className="text-xs text-red-500 mt-1">{confirmError}</div>}
      </div>
      <Button type="submit" className="w-full" disabled={loading || !passwordValid || !confirmValid}>
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
