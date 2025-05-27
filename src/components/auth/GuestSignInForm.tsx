import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";

export default function GuestSignInForm({ onGuestSignIn }: { onGuestSignIn?: () => void }) {
  const { isLoading } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleGuestSignIn = async () => {
    setError(null);
    setLoading(true);
    try {
      // Firebase anonymous sign-in (requires enabling in Firebase Console)
      const { getAuth, signInAnonymously } = await import("firebase/auth");
      const { auth } = await import("@/lib/firebase/firebaseConfig");
      if (!auth) throw new Error("Firebase not initialized");
      await signInAnonymously(auth);
      if (onGuestSignIn) onGuestSignIn();
    } catch (err: any) {
      setError(err.message || "Failed to sign in as guest.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 p-2 max-w-sm">
      <div className="font-semibold text-lg">Try as Guest</div>
      <div className="text-sm text-gray-600">You can try the app without creating an account. Your progress will be saved locally. Sign up later to save your data to the cloud.</div>
      <Button onClick={handleGuestSignIn} variant="default" size="sm" disabled={loading || isLoading}>
        {loading ? "Signing in..." : "Continue as Guest"}
      </Button>
      {error && <div className="text-red-500 text-xs">{error}</div>}
    </div>
  );
}
