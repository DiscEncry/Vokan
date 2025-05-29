"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EyeIcon, EyeOffIcon, Loader2 } from "lucide-react";
import { usePasswordValidation } from "@/hooks/usePasswordValidation";
import { validatePassword, validatePasswordMatch, validateForm, setPasswordSchema } from "@/lib/validation";
import { FormStatusMessage } from "@/components/ui/FormStatusMessage";
import { PasswordStrengthMeter } from "@/components/ui/PasswordStrengthMeter";

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
            onChange={(e) => updateFormState({ password: e.target.value })}
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
            className="absolute right-2 top-1/2 -translate-y-1/2"
            onClick={() => updateFormState({ showPassword: !formState.showPassword })}
            disabled={loading}
          >
            {formState.showPassword ? (
              <EyeOffIcon className="h-4 w-4" />
            ) : (
              <EyeIcon className="h-4 w-4" />
            )}
          </Button>
        </div>
        <PasswordStrengthMeter strength={strength} password={formState.password} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Confirm Password</Label>
        <div className="relative">
          <Input
            id="confirmPassword"
            type={formState.showConfirmPassword ? "text" : "password"}
            value={formState.confirmPassword}
            onChange={(e) => updateFormState({ confirmPassword: e.target.value })}
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
            className="absolute right-2 top-1/2 -translate-y-1/2"
            onClick={() => updateFormState({ showConfirmPassword: !formState.showConfirmPassword })}
            disabled={loading}
          >
            {formState.showConfirmPassword ? (
              <EyeOffIcon className="h-4 w-4" />
            ) : (
              <EyeIcon className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Password strength and validation feedback */}
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
