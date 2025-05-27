import React, { useState } from "react";
import { Button } from "@/components/ui/button";

export default function BackupCodesForm({ uid }: { uid: string }) {
  const [codes, setCodes] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/mfa/generate-backup-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid }),
      });
      const data = await res.json();
      if (data.codes) setCodes(data.codes);
      else setError("Failed to generate backup codes.");
    } catch (err: any) {
      setError(err.message || "Failed to generate backup codes.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 p-2 max-w-sm">
      <div className="font-semibold text-lg">Backup Codes</div>
      <div className="text-sm text-gray-600">Generate one-time backup codes for account recovery. Store them securely. Each code can be used once.</div>
      <Button onClick={handleGenerate} variant="default" size="sm" disabled={loading}>
        {loading ? "Generating..." : "Generate Backup Codes"}
      </Button>
      {codes && (
        <div className="bg-gray-100 p-2 rounded text-xs">
          {codes.map(code => <div key={code}>{code}</div>)}
          <div className="text-red-500 mt-2">These codes will not be shown again. Save them now!</div>
        </div>
      )}
      {error && <div className="text-red-500 text-xs">{error}</div>}
    </div>
  );
}
