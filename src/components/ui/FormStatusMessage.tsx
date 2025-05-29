import React from "react";

interface FormStatusMessageProps {
  message?: React.ReactNode | null;
  type?: "error" | "success" | "info";
}

export const FormStatusMessage: React.FC<FormStatusMessageProps> = ({ message, type = "error" }) => {
  if (!message) return null;
  let color = "text-red-600";
  if (type === "success") color = "text-green-600";
  if (type === "info") color = "text-blue-600";
  return (
    <p className={`text-sm ${color}`} role={type === "error" ? "alert" : undefined}>
      {message}
    </p>
  );
};
