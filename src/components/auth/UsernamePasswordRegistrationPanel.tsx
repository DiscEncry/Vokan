import React, { useState, useEffect, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { EyeIcon, EyeOffIcon, Loader2 } from "lucide-react";
import { validateUsername, validatePassword, validatePasswordMatch, validateForm, registrationSchema } from "@/lib/validation";
import { usePasswordValidation } from "@/hooks/usePasswordValidation";
import { FormStatusMessage } from "@/components/ui/FormStatusMessage";
import { PasswordStrengthMeter } from "@/components/ui/PasswordStrengthMeter";

interface UsernamePasswordRegistrationPanelProps {
  email: string;
  initialUsername?: string;
  loading?: boolean;
  error?: string | null;
  onSubmit: (username: string, password: string, confirm: string) => Promise<void>;
  onChange?: (formData: { username: string; password: string; confirm: string }) => void;
  onValidChange?: (isValid: boolean) => void;
}

export default function UsernamePasswordRegistrationPanel({
  email,
  initialUsername = "",
  loading = false,
  error,
  onSubmit,
  onChange,
  onValidChange,
}: UsernamePasswordRegistrationPanelProps) {
  const [formData, setFormData] = useState({
    username: initialUsername,
    password: "",
    confirm: "",
    showPassword: false,
    showConfirmPassword: false,
  });
  const { strength, checking, validate } = usePasswordValidation();

  useEffect(() => {
    if (formData.password) validate(formData.password);
  }, [formData.password, validate]);

  const validationState = useMemo(() => {
    const result = validateForm(registrationSchema, {
      username: formData.username,
      password: formData.password,
      confirm: formData.confirm,
    });
    if (!result.isValid) {
      // Professionalize common validation messages
      if (result.message === "Passwords do not match.") {
        return { isValid: false, message: "The passwords you entered do not match. Please re-enter your password to confirm." };
      }
      if (result.message && result.message.includes("at least 8 characters")) {
        return { isValid: false, message: "Your password must be at least 8 characters long." };
      }
      if (result.message && result.message.includes("must start with a letter")) {
        return { isValid: false, message: "Username must start with a letter and can only contain letters, numbers, and underscores." };
      }
      return { isValid: false, message: result.message };
    }
    if (checking) {
      return { isValid: false, message: (
        <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Analyzing password strength...</span>
      ) };
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
  }, [formData, checking, strength]);

  // Notify parent of changes
  useEffect(() => {
    onChange?.({ username: formData.username, password: formData.password, confirm: formData.confirm });
    onValidChange?.(!!validationState.isValid);
  }, [formData.username, formData.password, formData.confirm, validationState.isValid]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Expose submit and validation state to parent
  React.useImperativeHandle(
    (onSubmit as any).ref,
    () => ({
      formData,
      isValid: validationState.isValid,
      submit: () => onSubmit(formData.username, formData.password, formData.confirm)
    }),
    [formData, validationState, onSubmit]
  );

  return (
    <div className="space-y-4">
      {/* Removed email input to avoid duplicate email fields. Email is handled by parent. */}
      <div className="space-y-2">
        <Label htmlFor="username">Username</Label>
        <Input
          id="username"
          name="username"
          type="text"
          value={formData.username}
          onChange={handleChange}
          placeholder="Choose a username"
          required
          autoComplete="username"
          disabled={loading}
          minLength={3}
          maxLength={20}
          pattern="[a-zA-Z][a-zA-Z0-9_]{2,19}"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={formData.showPassword ? "text" : "password"}
            value={formData.password}
            onChange={handleChange}
            placeholder="Create a password"
            required
            autoComplete="new-password"
            disabled={loading}
            className="pr-10"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute right-2 top-1/2 -translate-y-1/2"
            onClick={() => setFormData(prev => ({ ...prev, showPassword: !prev.showPassword }))}
            disabled={loading}
          >
            {formData.showPassword ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
          </Button>
        </div>
        <PasswordStrengthMeter strength={strength} password={formData.password} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm">Confirm Password</Label>
        <div className="relative">
          <Input
            id="confirm"
            name="confirm"
            type={formData.showConfirmPassword ? "text" : "password"}
            value={formData.confirm}
            onChange={handleChange}
            placeholder="Confirm password"
            required
            autoComplete="new-password"
            disabled={loading}
            className="pr-10"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute right-2 top-1/2 -translate-y-1/2"
            onClick={() => setFormData(prev => ({ ...prev, showConfirmPassword: !prev.showConfirmPassword }))}
            disabled={loading}
          >
            {formData.showConfirmPassword ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
          </Button>
        </div>
      </div>
      <FormStatusMessage message={validationState.message} type="error" />
      <FormStatusMessage message={error} type="error" />
    </div>
  );
}
