"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";
import { ArrowRight, EyeIcon, EyeOffIcon, Loader2 } from "lucide-react";
import { usePasswordValidation } from "@/hooks/usePasswordValidation";
import { validateUsername, validatePassword, validatePasswordMatch, validateForm, registrationSchema } from "@/lib/validation";
import { FormStatusMessage } from "@/components/ui/FormStatusMessage";
import UsernamePasswordRegistrationPanel from "@/components/auth/UsernamePasswordRegistrationPanel";
import { PasswordStrengthMeter } from "@/components/ui/PasswordStrengthMeter";

interface EmailAuthFormProps {
  onSuccess?: () => void;
  isRegistering: boolean;
  onToggleModeAction: () => void;
  onGoogleSignIn?: () => Promise<void>; // Ensure async signature
  googleLoading?: boolean;
}

export default function EmailAuthForm({ onSuccess, isRegistering, onToggleModeAction, onGoogleSignIn, googleLoading }: EmailAuthFormProps) {
  const { signInWithEmail, registerWithEmail, signInWithProvider, error: authError, clearError, isLoading } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  // Restore local googleLoading state for fallback
  const [internalGoogleLoading, setInternalGoogleLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    username: "",
    confirm: ""
  });

  const { strength, checking, validate } = usePasswordValidation();

  // Validate password whenever it changes in registration mode
  useEffect(() => {
    if (isRegistering && formData.password) {
      validate(formData.password);
    }
  }, [formData.password, isRegistering, validate]);

  // Compute validation state
  const validationState = useMemo(() => {
    if (isRegistering) {
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
        return { isValid: false, message: "Analyzing password strength..." };
      }
      if (strength < 3) {
        return {
          isValid: false,
          message: "Please choose a stronger password. Use a mix of uppercase, lowercase, numbers, and symbols until the strength meter is green."
        };
      }
    }
    return { isValid: true, message: null };
  }, [formData, isRegistering, checking, strength]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Do NOT clearError here; let errors show after failed submit
    if (!validationState.isValid) return;
    try {
      if (isRegistering) {
        const result = await registerWithEmail(
          formData.email,
          formData.password,
          formData.username
        );
        if (result && 'error' in result) {
          return; // AuthContext will handle the error display
        }
      } else {
        const result = await signInWithEmail(formData.email, formData.password);
        if (!result) {
          return; // AuthContext will handle the error display
        }
      }
      onSuccess?.();
    } catch (error) {
      // AuthContext handles errors, no need to duplicate error handling here
    }
  };

  // Registration submit handler for shared panel
  const [registrationPanelData, setRegistrationPanelData] = useState({
    username: "",
    password: "",
    confirm: ""
  });
  const [registrationPanelValid, setRegistrationPanelValid] = useState(false);

  // Form field handlers
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    clearError(); // Clear error on field change
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const toggleMode = () => {
    onToggleModeAction();
    clearError(); // Clear error on mode toggle
    setFormData({ email: "", password: "", username: "", confirm: "" });
  };

  // Google sign in handler (fallback if onGoogleSignIn not provided)
  const handleGoogleSignIn = async () => {
    setInternalGoogleLoading(true);
    clearError();
    try {
      await signInWithProvider("google");
      // Do NOT call onSuccess here, let the parent/dialog handle closing only on full registration
    } catch (e) {
      // error handled by context
    } finally {
      setInternalGoogleLoading(false);
    }
  };

  // Debug: Log when Google sign-in handler from parent is called
  const debugGoogleClick = () => {
    if (onGoogleSignIn) {
      console.debug('[EmailAuthForm] Google button clicked, using onGoogleSignIn from parent');
    } else {
      console.debug('[EmailAuthForm] Google button clicked, using internal handler');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          value={formData.email}
          onChange={handleChange}
          placeholder="Enter your email"
          required
          autoComplete={isRegistering ? "email" : "username"}
          disabled={isLoading}
        />
      </div>
      {isRegistering && (
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
            disabled={isLoading}
            minLength={3}
            maxLength={20}
            pattern="[a-zA-Z][a-zA-Z0-9_]{2,19}"
          />
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            value={formData.password}
            onChange={handleChange}
            placeholder={isRegistering ? "Create a password" : "Enter your password"}
            required
            autoComplete={isRegistering ? "new-password" : "current-password"}
            className="pr-10"
            disabled={isLoading}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute right-2 top-1/2 -translate-y-1/2"
            onClick={() => setShowPassword((v) => !v)}
            disabled={isLoading}
          >
            {showPassword ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
          </Button>
        </div>
        {isRegistering && (
          <PasswordStrengthMeter strength={strength} password={formData.password} />
        )}
      </div>
      {isRegistering && (
        <div className="space-y-2">
          <Label htmlFor="confirm">Confirm Password</Label>
          <Input
            id="confirm"
            name="confirm"
            type="password"
            value={formData.confirm}
            onChange={handleChange}
            placeholder="Confirm password"
            required
            autoComplete="new-password"
            disabled={isLoading}
          />
        </div>
      )}
      {/* Validation and error messages */}
      <FormStatusMessage message={validationState.message} type="error" />
      <FormStatusMessage message={authError} type="error" />

      <Button
        type="submit"
        className="w-full"
        disabled={isLoading || !validationState.isValid}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            {isRegistering ? "Create Account" : "Sign In"}
            <ArrowRight className="ml-2 h-4 w-4" />
          </>
        )}
      </Button>
      {/* Google sign in button (always visible) */}
      <Button
        type="button"
        variant="outline"
        className="w-full flex items-center justify-center gap-2"
        onClick={async e => { debugGoogleClick(); await (onGoogleSignIn || handleGoogleSignIn)(); }}
        disabled={isLoading || (typeof googleLoading === 'boolean' ? googleLoading : internalGoogleLoading)}
        aria-busy={typeof googleLoading === 'boolean' ? googleLoading : internalGoogleLoading}
      >
        {(typeof googleLoading === 'boolean' ? googleLoading : internalGoogleLoading) ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            <svg width="20" height="20" viewBox="0 0 48 48" className="inline-block mr-2"><g><path fill="#4285F4" d="M43.6 20.5h-1.9V20H24v8h11.3c-1.6 4.3-5.7 7-11.3 7-6.6 0-12-5.4-12-12s5.4-12 12-12c2.7 0 5.2.9 7.2 2.4l6-6C34.5 5.1 29.6 3 24 3 12.9 3 4 11.9 4 23s8.9 20 20 20c11 0 19.7-8 19.7-20 0-1.3-.1-2.7-.3-4z"/><path fill="#34A853" d="M6.3 14.7l6.6 4.8C14.3 16.1 18.7 13 24 13c2.7 0 5.2.9 7.2 2.4l6-6C34.5 5.1 29.6 3 24 3c-7.7 0-14.3 4.4-17.7 10.7z"/><path fill="#FBBC05" d="M24 43c5.4 0 10-1.8 13.3-4.9l-6.2-5.1c-2 1.4-4.5 2.2-7.1 2.2-5.6 0-10.3-3.8-12-9l-6.6 5.1C9.7 39.6 16.3 43 24 43z"/><path fill="#EA4335" d="M43.6 20.5h-1.9V20H24v8h11.3c-0.7 2-2.1 3.7-4.1 4.9l6.2 5.1C39.9 39.2 44 33.7 44 27c0-1.3-.1-2.7-.3-4z"/></g></svg>
            Continue with Google
          </>
        )}
      </Button>
      {/* Modern, centered, gray, slightly larger toggle text */}
      <div className="w-full flex justify-center mt-4">
        <button
          type="button"
          onClick={toggleMode}
          disabled={isLoading}
          className="text-sm text-gray-400 hover:text-gray-600 hover:underline transition-colors font-medium bg-transparent border-none p-0 m-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: "none" }}
        >
          {isRegistering
            ? "Already have an account? Sign in"
            : "Need an account? Create one"}
        </button>
      </div>
    </form>
  );
}
