import React from "react";

const strengthLabels = [
  "Very weak",
  "Weak",
  "Fair",
  "Strong",
  "Very strong"
];
const strengthColors = [
  "bg-red-400",
  "bg-orange-400",
  "bg-yellow-400",
  "bg-green-400",
  "bg-green-600"
];

export function PasswordStrengthMeter({ strength, password }: { strength: number; password: string }) {
  if (!password) return null;
  return (
    <div className="mt-1">
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 rounded bg-gray-200 overflow-hidden">
          <div
            className={`h-2 rounded transition-all duration-300 ${strengthColors[strength]}`}
            style={{ width: `${((strength + 1) / 5) * 100}%` }}
          />
        </div>
        <span className={`text-xs ml-2 ${strength < 2 ? "text-red-500" : strength < 3 ? "text-yellow-600" : "text-green-600"}`}>{strengthLabels[strength]}</span>
      </div>
    </div>
  );
}

export default PasswordStrengthMeter;
