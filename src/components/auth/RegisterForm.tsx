import React, { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";
import { usePasswordValidation } from "@/hooks/usePasswordValidation";
import { validateUsername, validatePassword, validatePasswordMatch, validateForm, registrationSchema } from "@/lib/validation";
import { FormStatusMessage } from "@/components/ui/FormStatusMessage";
import { PasswordStrengthMeter } from "@/components/ui/PasswordStrengthMeter";
import { EyeIcon, EyeOffIcon, Loader2 } from "lucide-react";
import { FcGoogle } from "react-icons/fc";

interface RegisterFormProps {
  onSuccess?: () => void;
  onGoogleSignIn?: () => Promise<void>;
  googleLoading?: boolean;
}

export default function RegisterForm({ onSuccess, onGoogleSignIn, googleLoading, onShowLogin }: RegisterFormProps & { onShowLogin?: () => void }) {
  const { registerWithEmail, error: authError, clearError, isLoading } = useAuth();
  const [formData, setFormData] = useState({ email: "", password: "", username: "", confirm: "" });
  const { strength, checking, validate } = usePasswordValidation();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

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
      return { isValid: false, message: "Analyzing password strength..." };
    }
    if (strength < 3) {
      return {
        isValid: false,
        message: "Please choose a stronger password. Use a mix of uppercase, lowercase, numbers, and symbols until the strength meter is green."
      };
    }
    return { isValid: true, message: null };
  }, [formData, checking, strength]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    clearError();
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validationState.isValid) return;
    const result = await registerWithEmail(formData.email, formData.password, formData.username);
    if (result && 'error' in result) {
      // Show error and do NOT call onSuccess
      return;
    }
    onSuccess?.();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" value={formData.email} onChange={handleChange} required autoComplete="email" disabled={isLoading} placeholder="Enter your email" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="username">Username</Label>
        <Input id="username" name="username" type="text" value={formData.username} onChange={handleChange} required autoComplete="username" minLength={3} maxLength={20} pattern="[a-zA-Z][a-zA-Z0-9_]{2,19}" disabled={isLoading} placeholder="Choose a username" />
        {authError === 'This username is already taken. Please choose another.' && (
          <div className="text-xs text-red-500 mt-1">This username is already taken. Please choose another.</div>
        )}
      </div>
      <div className="space-y-2 relative">
        <Label htmlFor="password">Password</Label>
        <Input id="password" name="password" type={showPassword ? "text" : "password"} value={formData.password} onChange={handleChange} required autoComplete="new-password" disabled={isLoading} placeholder="Create a password" />
        <button type="button" tabIndex={-1} className="absolute right-3 top-9 text-gray-400 hover:text-gray-600 bg-transparent border-none p-0" onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? "Hide password" : "Show password"}>
          {showPassword ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
        </button>
        <PasswordStrengthMeter strength={strength} password={formData.password} />
      </div>
      <div className="space-y-2 relative">
        <Label htmlFor="confirm">Confirm Password</Label>
        <Input id="confirm" name="confirm" type={showConfirm ? "text" : "password"} value={formData.confirm} onChange={handleChange} required autoComplete="new-password" disabled={isLoading} placeholder="Repeat your password" />
        <button type="button" tabIndex={-1} className="absolute right-3 top-9 text-gray-400 hover:text-gray-600 bg-transparent border-none p-0" onClick={() => setShowConfirm(v => !v)} aria-label={showConfirm ? "Hide password" : "Show password"}>
          {showConfirm ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
        </button>
      </div>
      <FormStatusMessage message={validationState.message} type="error" />
      <FormStatusMessage message={authError} type="error" />
      <Button type="submit" className="w-full" disabled={isLoading || !validationState.isValid}>{isLoading ? <Loader2 className="animate-spin mr-2" /> : null}Create Account</Button>
      <Button type="button" variant="outline" className="w-full mt-2 flex items-center justify-center gap-2" onClick={onGoogleSignIn} disabled={isLoading || googleLoading}>
        <FcGoogle size={20} /> Continue with Google
      </Button>
      <div className="flex justify-center mt-2">
        <span className="text-sm text-gray-500">Have an account? <button type="button" className="text-blue-600 hover:underline" onClick={() => onShowLogin && onShowLogin()}>Sign in</button></span>
      </div>
    </form>
  );
}
