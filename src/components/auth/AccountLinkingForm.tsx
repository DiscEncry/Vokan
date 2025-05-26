import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/AuthContext";
import { EmailAuthProvider, GoogleAuthProvider, linkWithCredential, getAuth } from "firebase/auth";

export default function AccountLinkingForm() {
  const { user } = useAuth();
  const [email, setEmail] = useState(user?.email || "");
  const [password, setPassword] = useState("");
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Link email/password to Google account
  const handleLinkPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!user) return;
    setLinking(true);
    try {
      const cred = EmailAuthProvider.credential(email, password);
      await linkWithCredential(user, cred);
      setSuccess("Email/password linked successfully!");
    } catch (err: any) {
      setError(err.message || "Failed to link email/password.");
    } finally {
      setLinking(false);
    }
  };

  // Link Google to email/password account
  const handleLinkGoogle = async () => {
    setError(null);
    setSuccess(null);
    if (!user) return;
    setLinking(true);
    try {
      const provider = new GoogleAuthProvider();
      await user.linkWithPopup(provider);
      setSuccess("Google account linked successfully!");
    } catch (err: any) {
      setError(err.message || "Failed to link Google account.");
    } finally {
      setLinking(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 p-2 max-w-sm">
      <form onSubmit={handleLinkPassword} className="flex flex-col gap-2">
        <div className="font-semibold">Link Email/Password</div>
        <Input type="email" value={email} disabled />
        <Input
          type="password"
          placeholder="Password to link"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
        />
        <Button type="submit" variant="default" size="sm" disabled={linking}>
          {linking ? "Linking..." : "Link Email/Password"}
        </Button>
      </form>
      <div className="flex flex-col gap-2">
        <div className="font-semibold">Link Google Account</div>
        <Button onClick={handleLinkGoogle} variant="default" size="sm" disabled={linking}>
          {linking ? "Linking..." : "Link Google"}
        </Button>
      </div>
      {error && <div className="text-red-500 text-xs">{error}</div>}
      {success && <div className="text-green-600 text-xs">{success}</div>}
    </div>
  );
}
