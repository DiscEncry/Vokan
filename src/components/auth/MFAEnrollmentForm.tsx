import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/AuthContext";

// This is a scaffold for MFA enrollment. Actual implementation requires Firebase Identity Platform upgrade.
export default function MFAEnrollmentForm() {
  const { user } = useAuth();
  const [step, setStep] = useState<'choose' | 'sms' | 'totp' | 'done'>('choose');
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Placeholder handlers for SMS and TOTP enrollment
  const handleEnrollSMS = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    // TODO: Integrate with Firebase MFA SMS enrollment
    setSuccess("SMS enrollment flow would start here (requires backend support).");
    setStep('done');
  };

  const handleEnrollTOTP = async () => {
    setError(null);
    setSuccess(null);
    // TODO: Integrate with Firebase MFA TOTP enrollment
    setSuccess("TOTP enrollment flow would start here (requires backend support).");
    setStep('done');
  };

  if (!user) return <div>Please sign in to manage MFA.</div>;

  return (
    <div className="flex flex-col gap-4 p-2 max-w-sm">
      <div className="font-semibold text-lg">Multi-Factor Authentication (MFA) Enrollment</div>
      {step === 'choose' && (
        <>
          <div>Choose a second factor to add:</div>
          <Button onClick={() => setStep('sms')} variant="default" size="sm">SMS (Phone)</Button>
          <Button onClick={() => setStep('totp')} variant="default" size="sm">Authenticator App (TOTP)</Button>
        </>
      )}
      {step === 'sms' && (
        <form onSubmit={handleEnrollSMS} className="flex flex-col gap-2">
          <Input
            type="tel"
            placeholder="Your phone number"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            required
          />
          <Button type="submit" variant="default" size="sm">Enroll SMS</Button>
        </form>
      )}
      {step === 'totp' && (
        <div className="flex flex-col gap-2">
          <div>Scan the QR code with your authenticator app (e.g., Google Authenticator, Authy).</div>
          {/* TODO: Show QR code and secret here after backend integration */}
          <Button onClick={handleEnrollTOTP} variant="default" size="sm">I have scanned the QR code</Button>
        </div>
      )}
      {step === 'done' && (
        <div className="text-green-600">Enrollment step complete. (This is a placeholder. Actual MFA setup requires backend support.)</div>
      )}
      {error && <div className="text-red-500 text-xs">{error}</div>}
      {success && <div className="text-green-600 text-xs">{success}</div>}
      <div className="text-xs text-gray-500 mt-2">Backup codes and recovery options will be available after full integration.</div>
    </div>
  );
}
