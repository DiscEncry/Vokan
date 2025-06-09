import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormStatusMessage } from "@/components/ui/FormStatusMessage";

export default function PasswordResetForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<null | { type: "success" | "error"; message: string }>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setStatus(null);
    setLoading(true);
    try {
      const res = await fetch("/api/password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        let msg = data.error || "Failed to send reset email.";
        if (msg.toLowerCase().includes("not found")) {
          msg = "No account found with that email address.";
        }
        throw new Error(msg);
      }
      setStatus({ type: "success", message: "Password reset email sent. Please check your inbox." });
    } catch (e: any) {
      setStatus({ type: "error", message: e.message || "Failed to send reset email." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="reset-email">Email address</Label>
        <Input
          id="reset-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
        />
      </div>
      <Button type="submit" disabled={loading || !email} className="w-full">
        {loading ? "Sending..." : "Send Password Reset Email"}
      </Button>
      {status && <FormStatusMessage status={status.type} message={status.message} />}
    </form>
  );
}
