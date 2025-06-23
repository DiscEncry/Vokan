import { useState } from "react";
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
    if (isLoading) return;
    const result = await signInWithEmail(formData.email, formData.password);
    if (result) onSuccess?.();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5 w-full">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" inputMode="email" value={formData.email} onChange={handleChange} required autoComplete="username" disabled={isLoading} aria-required="true" placeholder="Enter your email" className="h-12 text-base rounded-lg" />
      </div>
      <div className="space-y-2 relative">
        <Label htmlFor="password">Password</Label>
        <Input id="password" name="password" type={showPassword ? "text" : "password"} value={formData.password} onChange={handleChange} required autoComplete="current-password" disabled={isLoading} aria-required="true" placeholder="Enter your password" className="h-12 text-base rounded-lg pr-10" />
        <button type="button" tabIndex={-1} className="absolute right-3 top-9 text-gray-400 hover:text-gray-600 bg-transparent border-none p-0" onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? "Hide password" : "Show password"}>
          {showPassword ? <EyeOffIcon size={20} /> : <EyeIcon size={20} />}
        </button>
      </div>
      <FormStatusMessage message={authError} type="error" />
      <Button type="submit" className="w-full h-12 text-base rounded-lg" disabled={isLoading}>{isLoading ? <Loader2 className="animate-spin mr-2" /> : null}Sign In</Button>
      <div className="flex justify-between items-center mt-2">
        <button type="button" className="text-sm text-gray-500 hover:underline" onClick={onShowPasswordReset} tabIndex={0} aria-label="Forgot password?">Forgot password?</button>
        <span className="text-sm text-gray-500">No account? <button type="button" className="text-blue-600 hover:underline" onClick={() => { clearError(); onShowRegister && onShowRegister(); }}>Register</button></span>
      </div>
      <div className="flex items-center gap-2 my-4">
        <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-700" />
        <span className="text-xs text-zinc-400">or</span>
        <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-700" />
      </div>
      <Button type="button" variant="outline" className="w-full h-12 flex items-center justify-center gap-2 rounded-lg" onClick={onGoogleSignIn} disabled={isLoading || googleLoading} aria-label="Continue with Google">
        <FcGoogle size={22} /> Continue with Google
      </Button>
    </form>
  );
}
