import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import * as Sentry from "@sentry/nextjs";

export default function AccountDeletionForm() {
  const { user, signOut } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleDelete = async () => {
    setError(null);
    setSuccess(null);
    if (!user) return;
    setLoading(true);
    try {
      await user.delete();
      setSuccess("Account deleted. We're sorry to see you go.");
      await signOut();
    } catch (err: any) {
      Sentry.captureException(err);
      setError(err.message || "Failed to delete account. Please re-authenticate and try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!user) return <div>Please sign in to delete your account.</div>;

  return (
    <div className="flex flex-col gap-4 p-2 max-w-sm">
      <div className="font-semibold text-lg">Delete Account</div>
      <div className="text-sm text-gray-600">This will permanently delete your account and all associated data. This action cannot be undone.</div>
      <Button onClick={handleDelete} variant="destructive" size="sm" disabled={loading}>
        {loading ? "Deleting..." : "Delete My Account"}
      </Button>
      {error && <div className="text-red-500 text-xs">{error}</div>}
      {success && <div className="text-green-600 text-xs">{success}</div>}
    </div>
  );
}
