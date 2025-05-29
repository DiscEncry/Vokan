import { useState, useCallback } from "react";
import zxcvbn from "zxcvbn";

export function usePasswordValidation() {
  const [strength, setStrength] = useState(0);
  const [checking, setChecking] = useState(false);

  const validate = useCallback(async (password: string) => {
    setChecking(true);
    setStrength(zxcvbn(password).score);
    setChecking(false);
  }, []);

  return { strength, checking, validate };
}
