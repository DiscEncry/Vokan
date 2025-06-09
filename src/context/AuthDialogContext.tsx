"use client";

import React, { createContext, useContext, useState, useCallback } from "react";

// Centralized dialog state for authentication
export type AuthDialogContextType = {
  open: boolean;
  openDialog: (registering?: boolean) => void;
  closeDialog: () => void;
  isRegistering: boolean;
  setRegistering: (v: boolean) => void;
};

const AuthDialogContext = createContext<AuthDialogContextType | undefined>(undefined);

export function AuthDialogProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);

  const openDialog = useCallback((registering = false) => {
    setIsRegistering(registering);
    setOpen(true);
  }, []);
  const closeDialog = useCallback(() => {
    setOpen(false);
  }, []);

  const contextValue = React.useMemo(() => ({
    open,
    openDialog,
    closeDialog,
    isRegistering,
    setRegistering: setIsRegistering,
  }), [open, openDialog, closeDialog, isRegistering]);

  return (
    <AuthDialogContext.Provider value={contextValue}>
      {children}
    </AuthDialogContext.Provider>
  );
}

export function useAuthDialog() {
  const ctx = useContext(AuthDialogContext);
  if (!ctx) throw new Error("useAuthDialog must be used within AuthDialogProvider");
  return ctx;
}
