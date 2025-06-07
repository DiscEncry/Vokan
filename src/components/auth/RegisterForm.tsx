import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";
import { usePasswordValidation } from "@/hooks/usePasswordValidation";
import { validateUsername, validatePassword } from "@/lib/validation";
import { FormStatusMessage } from "@/components/ui/FormStatusMessage";
import { EyeIcon, EyeOffIcon, Loader2 } from "lucide-react";
import { FcGoogle } from "react-icons/fc";
import { useDebounceEffect } from "@/hooks/useDebounce";
import { CheckCircle } from "lucide-react";
import { PasswordStrengthMeter } from "@/components/ui/PasswordStrengthMeter";

interface RegisterFormProps {
  onSuccess?: () => void;
  onGoogleSignIn?: () => Promise<void>;
  googleLoading?: boolean;
}

export default function RegisterForm({ onSuccess, onGoogleSignIn, googleLoading, onShowLogin }: RegisterFormProps & { onShowLogin?: () => void }) {
  const { registerWithEmail, error: authError, clearError, isLoading } = useAuth();
  const [formData, setFormData] = useState({ email: "", password: "", username: "", confirm: "" });
  const { strength, validate } = usePasswordValidation();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [usernameChecking, setUsernameChecking] = useState(false);
  const [usernameUnique, setUsernameUnique] = useState<null | boolean>(null);
  const [emailChecking, setEmailChecking] = useState(false);
  const [emailUnique, setEmailUnique] = useState<null | boolean>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [touched, setTouched] = useState({ email: false, username: false, password: false, confirm: false });
  const [debounced, setDebounced] = useState({ email: '', username: '', password: '', confirm: '' });

  useEffect(() => {
    if (formData.password) validate(formData.password);
  }, [formData.password, validate]);

  useDebounceEffect(() => setDebounced(d => ({ ...d, email: formData.email })), 500, [formData.email]);
  useDebounceEffect(() => setDebounced(d => ({ ...d, username: formData.username })), 500, [formData.username]);
  useDebounceEffect(() => setDebounced(d => ({ ...d, password: formData.password })), 500, [formData.password]);
  useDebounceEffect(() => setDebounced(d => ({ ...d, confirm: formData.confirm })), 500, [formData.confirm]);

  // Email format validation helper
  const isEmailFormatValid = /^\S+@\S+\.\S+$/.test(formData.email);

  useDebounceEffect(
    () => {
      if (!formData.email || !isEmailFormatValid) {
        setEmailUnique(null);
        setEmailError(null);
        setEmailChecking(false);
        return;
      }
      setEmailChecking(true);
      setEmailUnique(null);
      setEmailError(null);
      fetch(`/api/check-email?email=${encodeURIComponent(formData.email)}`)
        .then(res => res.json())
        .then(data => {
          setEmailUnique(data.available);
          if (!data.available) {
            setEmailError("This email is already registered. Please use another or sign in.");
          } else {
            setEmailError(null);
          }
        })
        .catch(() => {
          setEmailUnique(null);
          setEmailError("Could not check email. Please try again.");
        })
        .finally(() => setEmailChecking(false));
    },
    500,
    [formData.email]
  );

  useDebounceEffect(
    () => {
      const usernameValid = validateUsername(formData.username);
      if (!formData.username || !usernameValid.isValid) {
        setUsernameUnique(null);
        setUsernameChecking(false);
        return;
      }
      setUsernameChecking(true);
      setUsernameUnique(null);
      fetch(`/api/check-username?username=${encodeURIComponent(formData.username)}`)
        .then(res => res.json())
        .then(data => {
          setUsernameUnique(data.available);
        })
        .catch(() => {
          setUsernameUnique(null);
        })
        .finally(() => setUsernameChecking(false));
    },
    500,
    [formData.username]
  );

  const usernameValid = validateUsername(debounced.username).isValid && usernameUnique !== false;
  const emailValid = debounced.email && emailUnique && !emailError;
  const passwordValid = validatePassword(debounced.password).isValid && strength >= 3;
  const confirmValid = debounced.confirm && debounced.confirm === debounced.password;

  const usernameError = touched.username && debounced.username && !validateUsername(debounced.username).isValid
    ? 'Username must start with a letter and be at least 3 characters.'
    : (touched.username && usernameUnique === false ? 'This username is already taken. Please choose another.' : '');
  const emailFormatError = touched.email && debounced.email && !/^\S+@\S+\.\S+$/.test(debounced.email)
    ? 'Please enter a valid email address.'
    : '';
  const emailTakenError = touched.email && isEmailFormatValid && emailUnique === false ? 'This email is already registered. Please use another or sign in.' : '';
  const passwordError = touched.password && debounced.password && !validatePassword(debounced.password).isValid
    ? 'Your password must be at least 8 characters long.'
    : (touched.password && strength < 3 ? 'Please choose a stronger password.' : '');
  const confirmError = touched.confirm && debounced.confirm && debounced.confirm !== debounced.password
    ? 'The passwords you entered do not match.'
    : '';

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    clearError();
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setTouched(prev => ({ ...prev, [e.target.name]: true }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailValid || !usernameValid || !passwordValid || !confirmValid || isLoading || (usernameUnique !== true)) return;
    const result = await registerWithEmail(formData.email, formData.password, formData.username);
    if (result && 'error' in result) {
      return;
    }
    onSuccess?.();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2 relative">
        <Label htmlFor="email">Email</Label>
        <div className="relative">
          <Input id="email" name="email" type="email" value={formData.email} onChange={handleChange} required autoComplete="email" disabled={isLoading} placeholder="Enter your email" />
          {emailValid && touched.email && (
            <CheckCircle className="w-5 h-5 text-green-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          )}
        </div>
        {/* Removed emailChecking text */}
        {!emailValid && (emailFormatError || emailTakenError) && <div className="text-xs text-red-500 mt-1">{emailFormatError || emailTakenError}</div>}
      </div>
      <div className="space-y-2 relative">
        <Label htmlFor="username">Username</Label>
        <div className="relative">
          <Input id="username" name="username" type="text" value={formData.username} onChange={handleChange} required autoComplete="username" minLength={3} maxLength={20} pattern="[a-zA-Z][a-zA-Z0-9_]{2,19}" disabled={isLoading} placeholder="Choose a username" />
          {usernameValid && touched.username && (
            <CheckCircle className="w-5 h-5 text-green-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          )}
        </div>
        {/* Removed usernameChecking text */}
        {!usernameValid && usernameError && <div className="text-xs text-red-500 mt-1">{usernameError}</div>}
      </div>
      <div className="space-y-2 relative">
        <Label htmlFor="password">Password</Label>
        <div className="relative">
          <Input id="password" name="password" type={showPassword ? "text" : "password"} value={formData.password} onChange={handleChange} required autoComplete="new-password" disabled={isLoading} placeholder="Create a password" />
          <button type="button" tabIndex={-1} className="absolute right-8 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 bg-transparent border-none p-0" onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? "Hide password" : "Show password"}>
            {showPassword ? <EyeOffIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
          </button>
          {passwordValid && touched.password && (
            <CheckCircle className="w-5 h-5 text-green-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          )}
        </div>
        <PasswordStrengthMeter strength={strength} password={formData.password} />
        {!passwordValid && passwordError && <div className="text-xs text-red-500 mt-1">{passwordError}</div>}
      </div>
      <div className="space-y-2 relative">
        <Label htmlFor="confirm">Confirm Password</Label>
        <div className="relative">
          <Input id="confirm" name="confirm" type={showConfirm ? "text" : "password"} value={formData.confirm} onChange={handleChange} required autoComplete="new-password" disabled={isLoading} placeholder="Repeat your password" />
          <button type="button" tabIndex={-1} className="absolute right-8 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 bg-transparent border-none p-0" onClick={() => setShowConfirm(v => !v)} aria-label={showConfirm ? "Hide password" : "Show password"}>
            {showConfirm ? <EyeOffIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
          </button>
          {confirmValid && touched.confirm && (
            <CheckCircle className="w-5 h-5 text-green-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          )}
        </div>
        {!confirmValid && confirmError && <div className="text-xs text-red-500 mt-1">{confirmError}</div>}
      </div>
      <FormStatusMessage message={authError} type="error" />
      <Button type="submit" className="w-full" disabled={isLoading || !emailValid || !usernameValid || !passwordValid || !confirmValid || usernameUnique === false}>{isLoading ? <Loader2 className="animate-spin mr-2" /> : null}Create Account</Button>
      <Button type="button" variant="outline" className="w-full mt-2 flex items-center justify-center gap-2" onClick={onGoogleSignIn} disabled={isLoading || googleLoading}>
        <FcGoogle size={20} /> Continue with Google
      </Button>
      <div className="flex justify-center mt-2">
        <span className="text-sm text-gray-500">Have an account? <button type="button" className="text-blue-600 hover:underline" onClick={() => onShowLogin && onShowLogin()}>Sign in</button></span>
      </div>
    </form>
  );
}