import React, { useState } from "react";
import { Button } from "@/components/ui/button";

// This is a scaffold for Passkey (WebAuthn) registration and sign-in.
// Backend endpoints are required for full functionality.
export default function PasskeyAuthForm() {
  const [step, setStep] = useState<'choose' | 'register' | 'signin' | 'done'>('choose');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Placeholder: Call your backend to get registration options
  const getRegistrationOptions = async () => {
    // TODO: Replace with your backend endpoint
    const res = await fetch("/api/webauthn/register-options", { method: "POST" });
    return res.json();
  };

  // Placeholder: Call your backend to get authentication options
  const getAuthenticationOptions = async () => {
    // TODO: Replace with your backend endpoint
    const res = await fetch("/api/webauthn/authenticate-options", { method: "POST" });
    return res.json();
  };

  // Passkey registration
  const handleRegister = async () => {
    setError(null);
    setSuccess(null);
    setStep('register');
    try {
      const options = await getRegistrationOptions();
      // @ts-ignore
      const cred = await navigator.credentials.create({ publicKey: options });
      // Send credential to backend for verification and storage
      await fetch("/api/webauthn/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential: cred }),
      });
      setSuccess("Passkey registered! You can now sign in with your device.");
      setStep('done');
    } catch (err: any) {
      setError(err.message || "Failed to register passkey.");
    }
  };

  // Passkey sign-in
  const handleSignIn = async () => {
    setError(null);
    setSuccess(null);
    setStep('signin');
    try {
      const options = await getAuthenticationOptions();
      // @ts-ignore
      const assertion = await navigator.credentials.get({ publicKey: options });
      // Send assertion to backend for verification and Firebase custom token minting
      const res = await fetch("/api/webauthn/authenticate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assertion }),
      });
      const { firebaseToken } = await res.json();
      // Use Firebase Auth to sign in with the custom token
      const { getAuth, signInWithCustomToken } = await import("firebase/auth");
      const { auth } = await import("@/lib/firebase/firebaseConfig");
      if (!auth) {
        setError("Firebase is not initialized. Please try again later.");
        return;
      }
      await signInWithCustomToken(auth, firebaseToken);
      setSuccess("Signed in with Passkey!");
      setStep('done');
    } catch (err: any) {
      setError(err.message || "Failed to sign in with passkey.");
    }
  };

  return (
    <div className="flex flex-col gap-4 p-2 max-w-sm">
      <div className="font-semibold text-lg">Passkey (WebAuthn) Authentication</div>
      {step === 'choose' && (
        <>
          <Button onClick={handleRegister} variant="default" size="sm">Register Passkey</Button>
          <Button onClick={handleSignIn} variant="default" size="sm">Sign In with Passkey</Button>
        </>
      )}
      {step === 'register' && <div>Follow your device prompts to register a Passkey...</div>}
      {step === 'signin' && <div>Follow your device prompts to sign in with a Passkey...</div>}
      {step === 'done' && <div className="text-green-600">Done!</div>}
      {error && <div className="text-red-500 text-xs">{error}</div>}
      {success && <div className="text-green-600 text-xs">{success}</div>}
      <div className="text-xs text-gray-500 mt-2">Passkey support requires backend endpoints for full functionality. See Authentication Guide for details.</div>
    </div>
  );
}
