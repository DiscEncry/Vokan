"use client";

import { useState, useEffect, useMemo } from "react";
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

  // Only show main form error if it's not a password length/strength or password mismatch error
  const isFieldLevelError =
    validationState.message === "Your password must be at least 8 characters long." ||
    validationState.message === "Please choose a stronger password. Use a mix of uppercase, lowercase, numbers, and symbols until the strength meter is green." ||
    validationState.message === "The passwords you entered do not match. Please re-enter your password to confirm.";
  const showMainError = touched.password && touched.confirmPassword && validationState.message && !isFieldLevelError;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
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
          <button
            type="button"
            tabIndex={-1}
            className="absolute right-8 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 bg-transparent border-none p-0"
            onClick={() => updateFormState({ showPassword: !formState.showPassword })}
            aria-label={formState.showPassword ? "Hide password" : "Show password"}
            disabled={loading}
          >
            {formState.showPassword ? <EyeOffIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
          </button>
          {passwordValid && touched.password && (
            <CheckCircle className="w-5 h-5 text-green-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          )}
        </div>
        <PasswordStrengthMeter strength={strength} password={formState.password} />
        {/* Only show password error after user has typed */}
        {!passwordValid && passwordError && touched.password && <div className="text-xs text-red-500 mt-1">{passwordError}</div>}
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
          <button
            type="button"
            tabIndex={-1}
            className="absolute right-8 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 bg-transparent border-none p-0"
            onClick={() => updateFormState({ showConfirmPassword: !formState.showConfirmPassword })}
            aria-label={formState.showConfirmPassword ? "Hide password" : "Show password"}
            disabled={loading}
          >
            {formState.showConfirmPassword ? <EyeOffIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
          </button>
          {confirmValid && touched.confirmPassword && (
            <CheckCircle className="w-5 h-5 text-green-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          )}
        </div>
        {/* Only show confirm error after user has typed */}
        {!confirmValid && confirmError && touched.confirmPassword && <div className="text-xs text-red-500 mt-1">{confirmError}</div>}
      </div>
      {/* Only show main form error after both fields have been touched */}
      {showMainError && <FormStatusMessage message={validationState.message} type="error" />}
      <FormStatusMessage message={error} type="error" />
      <div className="space-y-2">
        <Button
          type="submit"
          className="w-full"
          disabled={loading || !validationState.isValid}
        >
          {loading ? <Loader2 className="animate-spin mr-2" /> : null}Set Password
        </Button>
      </div>
    </form>
  );
}

// No major changes needed: SetPasswordForm already uses validation, password strength, and feedback matching registration UX.
// If you want to add more real-time feedback or polish, you can add debounced validation or more granular error messages here.
