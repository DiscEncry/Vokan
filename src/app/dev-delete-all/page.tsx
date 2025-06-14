"use client";

import DevDeleteAllAccountsButton from "@/components/auth/DevDeleteAllAccountsButton";

export default function DevDeleteAllPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-red-50">
      <div className="max-w-md w-full p-6 bg-white border border-red-200 rounded shadow">
        <h1 className="text-2xl font-bold text-red-700 mb-4 text-center">
          Delete All Accounts (Development Only)
        </h1>
        <p className="mb-4 text-red-600 text-center">
          <strong>Warning:</strong> This will permanently delete <u>all</u> user
          accounts, usernames, and authentication records. This action cannot be
          undone.
        </p>
        <DevDeleteAllAccountsButton />
      </div>
    </div>
  );
}
