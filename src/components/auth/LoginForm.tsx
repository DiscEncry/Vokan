import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";
import { FormStatusMessage } from "@/components/ui/FormStatusMessage";
import { EyeIcon, EyeOffIcon, Loader2 } from "lucide-react";
import { FcGoogle } from "react-icons/fc";

interface LoginFormProps {
  onSuccess?: () => void;
  onShowPasswordReset?: () => void;
  onGoogleSignIn?: () => Promise<void>;
  googleLoading?: boolean;
  onShowRegister?: () => void;
}

export default function LoginForm({ onSuccess, onShowPasswordReset, onGoogleSignIn, googleLoading, onShowRegister }: LoginFormProps & { onShowRegister?: () => void }) {
  const { signInWithEmail, error: authError, clearError, isLoading } = useAuth();
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    clearError();
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await signInWithEmail(formData.email, formData.password);
    if (result) onSuccess?.();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" value={formData.email} onChange={handleChange} required autoComplete="username" disabled={isLoading} aria-required="true" placeholder="Enter your email" />
      </div>
      <div className="space-y-2 relative">
        <Label htmlFor="password">Password</Label>
        <Input id="password" name="password" type={showPassword ? "text" : "password"} value={formData.password} onChange={handleChange} required autoComplete="current-password" disabled={isLoading} aria-required="true" placeholder="Enter your password" />
        <button type="button" tabIndex={-1} className="absolute right-3 top-9 text-gray-400 hover:text-gray-600 bg-transparent border-none p-0" onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? "Hide password" : "Show password"}>
          {showPassword ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
        </button>
      </div>
      <FormStatusMessage message={authError} type="error" />
      <Button type="submit" className="w-full" disabled={isLoading}>{isLoading ? <Loader2 className="animate-spin mr-2" /> : null}Sign In</Button>
      <div className="flex justify-center">
        <button type="button" className="text-sm text-gray-500 hover:underline" onClick={onShowPasswordReset} tabIndex={0} aria-label="Forgot password?">Forgot password?</button>
      </div>
      <Button type="button" variant="outline" className="w-full mt-2 flex items-center justify-center gap-2" onClick={onGoogleSignIn} disabled={isLoading || googleLoading} aria-label="Continue with Google">
        <FcGoogle size={20} /> Continue with Google
      </Button>
      <div className="flex justify-center mt-2">
        <span className="text-sm text-gray-500">No account? <button type="button" className="text-blue-600 hover:underline" onClick={onShowRegister}>Register</button></span>
      </div>
    </form>
  );
}
