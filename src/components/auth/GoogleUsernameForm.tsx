"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { usePasswordValidation } from "@/hooks/usePasswordValidation";
import { FormStatusMessage } from "@/components/ui/FormStatusMessage";
import UsernamePasswordRegistrationPanel from "@/components/auth/UsernamePasswordRegistrationPanel";

interface GoogleUsernameFormProps {
  email: string;
  onSubmitAction: (username: string, password: string, confirm: string) => Promise<void>;
  isLoading: boolean;
  error?: string | null;
}

export default function GoogleUsernameForm({
  email,
  onSubmitAction,
  isLoading,
  error,
}: GoogleUsernameFormProps) {
  const [panelData, setPanelData] = useState({ username: "", password: "", confirm: "" });
  const [panelValid, setPanelValid] = useState(false);
  const { validate } = usePasswordValidation();

  // Validate password on change
  useEffect(() => {
    if (panelData.password) {
      validate(panelData.password);
    }
  }, [panelData.password, validate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!panelValid) return;
    await onSubmitAction(panelData.username, panelData.password, panelData.confirm);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <UsernamePasswordRegistrationPanel
        email={email}
        loading={isLoading}
        error={error}
        onSubmit={async () => { /* handled by parent form */ }}
        onChange={setPanelData}
        onValidChange={setPanelValid}
      />
      <Button type="submit" className="w-full" disabled={isLoading || !panelValid}>
        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Complete Registration"}
      </Button>
    </form>
  );
}
