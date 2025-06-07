"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EyeIcon, EyeOffIcon, Loader2 } from "lucide-react";
import { CheckCircle } from "lucide-react";

import { usePasswordValidation } from "@/hooks/usePasswordValidation";
import { validatePassword, validatePasswordMatch, validateForm, setPasswordSchema } from "@/lib/validation";
import { FormStatusMessage } from "@/components/ui/FormStatusMessage";
import { PasswordStrengthMeter } from "@/components/ui/PasswordStrengthMeter";
import { useDebounceEffect } from "@/hooks/useDebounce";

interface SetPasswordFormProps {
  email: string;
  onSubmitAction: (password: string) => Promise<void>;
  error?: string | null;
  loading?: boolean;
}

export default function SetPasswordForm({
  email,
  onSubmitAction,
  error,
  loading = false
}: SetPasswordFormProps) {
  const [formState, setFormState] = useState({
    password: "",
    confirmPassword: "",
    showPassword: false,
    showConfirmPassword: false,
    confirmError: null as string | null
  });

  const { strength, checking, validate } = usePasswordValidation();

  // Validate password whenever it changes
  useEffect(() => {
    if (formState.password) {
      validate(formState.password);
    }
  }, [formState.password, validate]);

  // Clear confirm error when either password changes
  useEffect(() => {
    if (formState.confirmError) {
      setFormState(prev => ({ ...prev, confirmError: null }));
    }
  }, [formState.password, formState.confirmPassword]);

  // Helper to update form state
  const updateFormState = (updates: Partial<typeof formState>) => {
    setFormState(prev => ({ ...prev, ...updates }));
  };

  // Track if user has finished typing (debounced) for each field
  const [touched, setTouched] = useState({ password: false, confirmPassword: false });
  const [debounced, setDebounced] = useState({ password: '', confirmPassword: '' });

  // Debounce each field's value
  useDebounceEffect(() => setDebounced(d => ({ ...d, password: formState.password })), 500, [formState.password]);
  useDebounceEffect(() => setDebounced(d => ({ ...d, confirmPassword: formState.confirmPassword })), 500, [formState.confirmPassword]);

  // Compute validation state
  const validationState = useMemo(() => {
    const result = validateForm(setPasswordSchema, {
      password: formState.password,
      confirmPassword: formState.confirmPassword,
    });
    if (!result.isValid) {
      if (result.message === "Passwords do not match.") {
        return { isValid: false, message: "The passwords you entered do not match. Please re-enter your password to confirm." };
      }
      if (result.message && result.message.includes("at least 8 characters")) {
        return { isValid: false, message: "Your password must be at least 8 characters long." };
      }
      return { isValid: false, message: result.message };
    }
    if (checking) {
      return {
        isValid: false,
        message: (
          <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Analyzing password strength...</span>
        )
      };
    }
    if (strength < 3) {
      return {
        isValid: false,
        message: (
          <span>
            Please choose a stronger password. Use a mix of uppercase, lowercase, numbers, and symbols until the strength meter is green.
          </span>
        )
      };
    }
    return { isValid: true, message: null };
  }, [formState, checking, strength]);

  // Validation helpers for each field
  const passwordValid = validatePassword(debounced.password).isValid && strength >= 3;
  const confirmValid = debounced.confirmPassword && debounced.confirmPassword === debounced.password;

  // Error helpers for each field
  const passwordError = touched.password && debounced.password && !validatePassword(debounced.password).isValid
    ? 'Your password must be at least 8 characters long.'
    : (touched.password && strength < 3 ? 'Please choose a stronger password.' : '');
  const confirmError = touched.confirmPassword && debounced.confirmPassword && debounced.confirmPassword !== debounced.password
    ? 'The passwords you entered do not match.'
    : '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validationState.isValid) return;

    try {
      await onSubmitAction(formState.password);
      // Reset form on success
      setFormState({
        password: "",
        confirmPassword: "",
        showPassword: false,
        showConfirmPassword: false,
        confirmError: null
      });
    } catch (err) {
      // Error handling is managed by parent component
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          value={email}
          disabled
          className="bg-muted"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <div className="relative">
          <Input
            id="password"
            type={formState.showPassword ? "text" : "password"}
            value={formState.password}
            onChange={e => { updateFormState({ password: e.target.value }); setTouched(t => ({ ...t, password: true })); }}
            placeholder="Create a password"
            required
            disabled={loading}
            className="pr-10"
            autoComplete="new-password"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute right-8 top-1/2 -translate-y-1/2"
            onClick={() => updateFormState({ showPassword: !formState.showPassword })}
            disabled={loading}
          >
            {formState.showPassword ? (
              <EyeOffIcon className="h-4 w-4" />
            ) : (
              <EyeIcon className="h-4 w-4" />
            )}
          </Button>
          {passwordValid && touched.password && (
            <CheckCircle className="w-5 h-5 text-green-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          )}
        </div>
        <PasswordStrengthMeter strength={strength} password={formState.password} />
        {!passwordValid && passwordError && <div className="text-xs text-red-500 mt-1">{passwordError}</div>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Confirm Password</Label>
        <div className="relative">
          <Input
            id="confirmPassword"
            type={formState.showConfirmPassword ? "text" : "password"}
            value={formState.confirmPassword}
            onChange={e => { updateFormState({ confirmPassword: e.target.value }); setTouched(t => ({ ...t, confirmPassword: true })); }}
            placeholder="Confirm password"
            required
            disabled={loading}
            className="pr-10"
            autoComplete="new-password"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute right-8 top-1/2 -translate-y-1/2"
            onClick={() => updateFormState({ showConfirmPassword: !formState.showConfirmPassword })}
            disabled={loading}
          >
            {formState.showConfirmPassword ? (
              <EyeOffIcon className="h-4 w-4" />
            ) : (
              <EyeIcon className="h-4 w-4" />
            )}
          </Button>
          {confirmValid && touched.confirmPassword && (
            <CheckCircle className="w-5 h-5 text-green-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          )}
        </div>
        {!confirmValid && confirmError && <div className="text-xs text-red-500 mt-1">{confirmError}</div>}
      </div>
      <FormStatusMessage message={validationState.message} type="error" />
      <FormStatusMessage message={error} type="error" />
      <div className="space-y-2">
        <Button
          type="submit"
          className="w-full"
          disabled={loading || !validationState.isValid}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            "Set Password"
          )}
        </Button>
      </div>
    </form>
  );
}

// No major changes needed: SetPasswordForm already uses validation, password strength, and feedback matching registration UX.
// If you want to add more real-time feedback or polish, you can add debounced validation or more granular error messages here.
