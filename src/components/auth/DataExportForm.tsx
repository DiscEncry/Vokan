import React from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import * as SentryNS from "@sentry/nextjs";

export default function DataExportForm() {
  const { user } = useAuth();
  const [downloading, setDownloading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleExport = async () => {
    setError(null);
    setDownloading(true);
    try {
      // Placeholder: fetch user data from Firestore (profile, settings, etc.)
      // In production, use a backend API or Cloud Function for full export
      const data = {
        uid: user?.uid,
        email: user?.email,
        // Add more fields as needed
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `my-vokan-data.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      SentryNS.captureException(err);
      setError("Failed to export data.");
    } finally {
      setDownloading(false);
    }
  };

  if (!user) return <div>Please sign in to export your data.</div>;

  return (
    <div className="flex flex-col gap-4 p-2 max-w-sm">
      <div className="font-semibold text-lg">Export My Data</div>
      <Button onClick={handleExport} variant="default" size="sm" disabled={downloading}>
        {downloading ? "Exporting..." : "Download My Data"}
      </Button>
      {error && <div className="text-red-500 text-xs">{error}</div>}
    </div>
  );
}
