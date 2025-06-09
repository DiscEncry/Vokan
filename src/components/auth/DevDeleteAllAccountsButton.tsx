import { useState } from "react";
import { Button } from "@/components/ui/button";

/**
 * Danger: Deletes ALL user accounts and usernames from Firestore and Firebase Auth.
 * For development/testing only. Not for production!
 */
export default function DevDeleteAllAccountsButton() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const handleDeleteAll = async () => {
    if (!window.confirm("Are you sure? This will delete ALL user accounts, usernames, and authentication records. This cannot be undone!")) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/dev-delete-all", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setResult("Deleted all users, usernames, and authentication records.");
      } else {
        setResult(data.error || "Failed to delete all accounts.");
      }
    } catch (e: any) {
      setResult(e.message || "Failed to delete all accounts.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 p-2 border border-red-400 bg-red-50 rounded">
      <div className="font-semibold text-red-700">Danger Zone (Development Only)</div>
      <Button onClick={handleDeleteAll} variant="destructive" disabled={loading}>
        {loading ? "Deleting..." : "Delete ALL Accounts & Auth Records"}
      </Button>
      {result && <div className="text-xs text-red-700">{result}</div>}
    </div>
  );
}
