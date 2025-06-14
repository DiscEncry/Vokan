import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";
import { usePasswordValidation } from "@/hooks/usePasswordValidation";
import { validateUsername, validatePassword } from "@/lib/validation";
import { FormStatusMessage } from "@/components/ui/FormStatusMessage";
import { EyeIcon, EyeOffIcon, Loader2 } from "lucide-react";
import { FcGoogle } from "react-icons/fc";
import { FaCircleCheck } from "react-icons/fa6";
import { useDebounceEffect } from "@/hooks/useDebounce";
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
  const [submitted, setSubmitted] = useState(false);

  // Request counters for async race condition prevention
  const emailRequestCounter = useRef(0);
  const usernameRequestCounter = useRef(0);
  // AbortControllers for aborting previous requests
  const emailAbortController = useRef<AbortController | null>(null);
  const usernameAbortController = useRef<AbortController | null>(null);

  useEffect(() => {
    if (formData.password) validate(formData.password);
  }, [formData.password, validate]);

  useDebounceEffect(() => setDebounced(d => ({ ...d, email: formData.email })), 500, [formData.email]);
  useDebounceEffect(() => setDebounced(d => ({ ...d, username: formData.username })), 500, [formData.username]);
  useDebounceEffect(() => setDebounced(d => ({ ...d, password: formData.password })), 500, [formData.password]);
  useDebounceEffect(() => setDebounced(d => ({ ...d, confirm: formData.confirm })), 500, [formData.confirm]);

  // More robust email regex (RFC 5322 Official Standard)
  const isEmailFormatValid = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/.test(formData.email);

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
      const reqId = ++emailRequestCounter.current;
      // Abort previous request if any
      if (emailAbortController.current) {
        emailAbortController.current.abort();
      }
      emailAbortController.current = new AbortController();
      fetch(`/api/check-email?email=${encodeURIComponent(formData.email)}`, { signal: emailAbortController.current.signal })
        .then(res => res.json())
        .then(data => {
          if (reqId !== emailRequestCounter.current) return; // Only update if latest
          setEmailUnique(data.available);
          if (!data.available) {
            setEmailError("This email is already registered. Please use another or sign in.");
          } else {
            setEmailError(null);
          }
        })
        .catch((err) => {
          if (reqId !== emailRequestCounter.current) return;
          if (err.name === 'AbortError') return;
          setEmailUnique(null);
          setEmailError("Could not check email. Please try again.");
        })
        .finally(() => {
          if (reqId === emailRequestCounter.current) setEmailChecking(false);
        });
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
      const reqId = ++usernameRequestCounter.current;
      // Abort previous request if any
      if (usernameAbortController.current) {
        usernameAbortController.current.abort();
      }
      usernameAbortController.current = new AbortController();
      fetch(`/api/check-username?username=${encodeURIComponent(formData.username)}`, { signal: usernameAbortController.current.signal })
        .then(res => res.json())
        .then(data => {
          if (reqId !== usernameRequestCounter.current) return;
          setUsernameUnique(data.available);
        })
        .catch((err) => {
          if (reqId !== usernameRequestCounter.current) return;
          if (err.name === 'AbortError') return;
          setUsernameUnique(null);
        })
        .finally(() => {
          if (reqId === usernameRequestCounter.current) setUsernameChecking(false);
        });
    },
    500,
    [formData.username]
  );

  const usernameValid = validateUsername(debounced.username).isValid && usernameUnique !== false;
  const emailValid = debounced.email && emailUnique && !emailError;
  const passwordValid = validatePassword(debounced.password).isValid && strength >= 3;
  const confirmValid = debounced.confirm && debounced.confirm === debounced.password;

  // Only show errors after blur or submit
  const showError = (field: keyof typeof touched) => submitted || touched[field];

  const usernameError = showError('username') && debounced.username && !validateUsername(debounced.username).isValid
    ? 'Username must start with a letter and be at least 3 characters.'
    : (showError('username') && usernameUnique === false ? 'This username is already taken. Please choose another.' : '');
  const emailFormatError = showError('email') && debounced.email && !isEmailFormatValid
    ? 'Please enter a valid email address.'
    : '';
  const emailTakenError = showError('email') && isEmailFormatValid && emailUnique === false ? 'This email is already registered. Please use another or sign in.' : '';
  const passwordError = showError('password') && debounced.password && !validatePassword(debounced.password).isValid
    ? 'Your password must be at least 8 characters long.'
    : (showError('password') && strength < 3 ? 'Please choose a stronger password.' : '');
  const confirmError = showError('confirm') && debounced.confirm && debounced.confirm !== debounced.password
    ? 'The passwords you entered do not match.'
    : '';

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    clearError();
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    // Only set touched on blur, not on every change
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    setTouched(prev => ({ ...prev, [e.target.name]: true }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (!emailValid || !usernameValid || !passwordValid || !confirmValid || isLoading || (usernameUnique !== true)) return;
    const result = await registerWithEmail(formData.email, formData.password, formData.username);
    if (result && 'error' in result) {
      return;
    }
    onSuccess?.();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" aria-live="polite">
      <div className="space-y-2 relative">
        <Label htmlFor="email">Email</Label>
        <div className="relative">
          <Input id="email" name="email" type="email" value={formData.email} onChange={handleChange} onBlur={handleBlur} required autoComplete="email" disabled={isLoading} placeholder="Enter your email" aria-invalid={!emailValid && showError('email')} aria-describedby="email-error" />          {emailChecking && <div className="absolute right-2 top-1/2 -translate-y-1/2"><Loader2 className="w-5 h-5 text-gray-400 custom-spin" aria-label="Checking email..." /></div>}          {emailValid && showError('email') && (
            <FaCircleCheck className="w-4.5 h-4.5 text-emerald-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          )}
        </div>
        {!emailValid && (emailFormatError || emailTakenError) && <div className="text-xs text-red-500 mt-1" id="email-error" aria-live="polite">{emailFormatError || emailTakenError}</div>}
      </div>
      <div className="space-y-2 relative">
        <Label htmlFor="username">Username</Label>
        <div className="relative">
          <Input id="username" name="username" type="text" value={formData.username} onChange={handleChange} onBlur={handleBlur} required autoComplete="username" minLength={3} maxLength={20} pattern="[a-zA-Z][a-zA-Z0-9_]{2,19}" disabled={isLoading} placeholder="Choose a username" aria-invalid={!usernameValid && showError('username')} aria-describedby="username-error" />          {usernameChecking && <div className="absolute right-2 top-1/2 -translate-y-1/2"><Loader2 className="w-5 h-5 text-gray-400 custom-spin" aria-label="Checking username..." /></div>}          {validateUsername(debounced.username).isValid && usernameUnique === true && showError('username') && (
            <FaCircleCheck className="w-4.5 h-4.5 text-emerald-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          )}
        </div>
        {!usernameValid && usernameError && <div className="text-xs text-red-500 mt-1" id="username-error" aria-live="polite">{usernameError}</div>}
      </div>
      <div className="space-y-2 relative">
        <Label htmlFor="password">Password</Label>
        <div className="relative">
          <Input id="password" name="password" type={showPassword ? "text" : "password"} value={formData.password} onChange={handleChange} onBlur={handleBlur} required autoComplete="new-password" disabled={isLoading} placeholder="Create a password" aria-invalid={!passwordValid && showError('password')} aria-describedby="password-error" />
          <button type="button" tabIndex={-1} className="absolute right-8 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 bg-transparent border-none p-0" onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? "Hide password" : "Show password"}>
            {showPassword ? <EyeOffIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
          </button>          {passwordValid && showError('password') && (
            <FaCircleCheck className="w-4.5 h-4.5 text-emerald-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          )}
        </div>
        <PasswordStrengthMeter strength={strength} password={formData.password} />
        {!passwordValid && passwordError && <div className="text-xs text-red-500 mt-1" id="password-error" aria-live="polite">{passwordError}</div>}
      </div>
      <div className="space-y-2 relative">
        <Label htmlFor="confirm">Confirm Password</Label>
        <div className="relative">
          <Input id="confirm" name="confirm" type={showConfirm ? "text" : "password"} value={formData.confirm} onChange={handleChange} onBlur={handleBlur} required autoComplete="new-password" disabled={isLoading} placeholder="Repeat your password" aria-invalid={!confirmValid && showError('confirm')} aria-describedby="confirm-error" />
          <button type="button" tabIndex={-1} className="absolute right-8 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 bg-transparent border-none p-0" onClick={() => setShowConfirm(v => !v)} aria-label={showConfirm ? "Hide password" : "Show password"}>
            {showConfirm ? <EyeOffIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
          </button>          {confirmValid && showError('confirm') && (
            <FaCircleCheck className="w-4.5 h-4.5 text-emerald-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          )}
        </div>
        {!confirmValid && confirmError && <div className="text-xs text-red-500 mt-1" id="confirm-error" aria-live="polite">{confirmError}</div>}
      </div>
      <FormStatusMessage message={authError} type="error" />
      <Button type="submit" className="w-full" disabled={
        isLoading ||
        !emailValid ||
        !usernameValid ||
        !passwordValid ||
        !confirmValid ||
        usernameUnique !== true
      }>
        {isLoading ? <Loader2 className="animate-spin mr-2" /> : null}Create Account
      </Button>
      <Button type="button" variant="outline" className="w-full mt-2 flex items-center justify-center gap-2" onClick={onGoogleSignIn} disabled={isLoading || googleLoading}>
        <FcGoogle size={20} /> Continue with Google
      </Button>
      <div className="flex justify-center mt-2">
        <span className="text-sm text-gray-500">Have an account? <button type="button" className="text-blue-600 hover:underline" onClick={() => onShowLogin && onShowLogin()}>Sign in</button></span>
      </div>
    </form>
  );
}