// Shared validation utilities for username and password
import { z } from "zod";

export const usernameSchema = z.string()
  .min(3, "Username must be at least 3 characters.")
  .max(20, "Username must be at most 20 characters.")
  .regex(/^[a-zA-Z][a-zA-Z0-9_]{2,19}$/, "Username must start with a letter and contain only letters, numbers, and underscores.");

export const passwordSchema = z.string()
  .min(8, "Password must be at least 8 characters.")
  .max(100, "Password must be at most 100 characters.");

export function validateUsername(username: string) {
  const result = usernameSchema.safeParse(username);
  return {
    isValid: result.success,
    message: result.success ? null : result.error.issues[0].message
  };
}

export function validatePassword(password: string) {
  const result = passwordSchema.safeParse(password);
  return {
    isValid: result.success,
    message: result.success ? null : result.error.issues[0].message
  };
}

export function validatePasswordMatch(password: string, confirm: string) {
  if (password !== confirm) {
    return { isValid: false, message: "Passwords do not match." };
  }
  return { isValid: true, message: null };
}

// Generic form validation utility
export function validateForm<T extends Record<string, any>>(
  schema: z.ZodType<T>,
  data: T
): { isValid: boolean; message: string | null } {
  const result = schema.safeParse(data);
  return {
    isValid: result.success,
    message: result.success ? null : (result.error.issues[0]?.message ?? null)
  };
}

// Registration schema example
export const registrationSchema = z.object({
  username: usernameSchema,
  password: passwordSchema,
  confirm: z.string(),
}).refine((data) => data.password === data.confirm, {
  message: "Passwords do not match.",
  path: ["confirm"],
});

// Set password schema example
export const setPasswordSchema = z.object({
  password: passwordSchema,
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match.",
  path: ["confirmPassword"],
});
