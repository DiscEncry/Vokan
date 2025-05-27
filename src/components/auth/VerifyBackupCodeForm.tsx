import React, { useState } from "react";
import { Button } from "@/components/ui/button";

export default function VerifyBackupCodeForm({ uid, onSuccess }: { uid: string, onSuccess?: () => void }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/mfa/verify-backup-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid, code }),
      });
      const data = await res.json();
      if (data.success) {
        if (onSuccess) onSuccess();
      } else {
        setError(data.error || "Invalid backup code.");
      }
    } catch (err: any) {
      setError(err.message || "Failed to verify backup code.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleVerify} className="flex flex-col gap-2 p-2 max-w-sm">
      <div className="font-semibold text-lg">Use a Backup Code</div>
      <input
        type="text"
        value={code}
        onChange={e => setCode(e.target.value)}
        placeholder="Enter backup code"
        required
        className="border p-2 rounded"
      />
      <Button type="submit" variant="default" size="sm" disabled={loading}>
        {loading ? "Verifying..." : "Verify Code"}
      </Button>
      {error && <div className="text-red-500 text-xs">{error}</div>}
    </form>
  );
}
