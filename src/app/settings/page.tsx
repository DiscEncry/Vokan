"use client";

import { useEffect, useState } from 'react';
import ProfileForm from '@/components/auth/ProfileForm';
import SetPasswordForm from '@/components/auth/SetPasswordForm';
import AccountDeletionForm from '@/components/auth/AccountDeletionForm';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useAuth } from '@/context/AuthContext';
import { useUserPreferences } from '@/hooks/useUserPreferences';
import { useTheme } from 'next-themes';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import DevDeleteAllAccountsButton from '@/components/auth/DevDeleteAllAccountsButton';

export default function SettingsPage() {
  const { user } = useAuth();
  const { profile, loading: profileLoading } = useUserProfile();
  const { preferences, loading: prefsLoading, error: prefsError, updatePreference } = useUserPreferences();
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();
  const [updatingPrefs, setUpdatingPrefs] = useState<{ [key: string]: boolean }>({});
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);

  const loading = profileLoading || prefsLoading;

  useEffect(() => {
    if (!loading && preferences.darkMode && theme !== preferences.darkMode) {
      setTheme(preferences.darkMode);
    }
  }, [preferences.darkMode, loading]);

  useEffect(() => {
    if (!loading && theme && preferences.darkMode !== theme) {
      updatePreference('darkMode', theme as 'light' | 'dark' | 'system').catch(console.error);
    }
  }, [theme, loading]);

  const handlePreferenceChange = async (key: keyof typeof preferences, value: any) => {
    setUpdatingPrefs(prev => ({ ...prev, [key]: true }));
    try {
      await updatePreference(key, value);
      toast({
        title: "Preference updated",
        description: "Your settings have been saved.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update preference. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUpdatingPrefs(prev => ({ ...prev, [key]: false }));
    }
  };

  if (!user) {
    return (
      <div className="container max-w-6xl mx-auto p-6">
        <div className="flex flex-col items-center justify-center min-h-[40vh] text-center">
          <div className="text-lg font-semibold mb-2">You must be signed in to view your settings.</div>
          {/* Dev-only: allow deleting all accounts even if not signed in */}
          <div className="mt-8">
            <DevDeleteAllAccountsButton />
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container max-w-6xl mx-auto p-6">
        <div className="flex flex-col space-y-4 mb-8 animate-pulse">
          <div className="h-8 w-48 bg-muted rounded"></div>
          <div className="h-4 w-96 bg-muted rounded"></div>
        </div>
        <div className="flex flex-col items-center justify-center min-h-[40vh]">
          <Loader2 className="animate-spin w-8 h-8 text-muted-foreground mb-2" />
          <div>Loading your settings...</div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="container max-w-6xl mx-auto p-6">
        <div className="flex flex-col items-center justify-center min-h-[40vh] text-center">
          <div className="text-lg font-semibold mb-2">Unable to load profile. Please try again.</div>
        </div>
      </div>
    );
  }
  return (
    <div className="container max-w-6xl mx-auto p-6">
      <div className="flex flex-col space-y-4 mb-8">
        <h1 className="text-3xl font-bold">Account Settings</h1>
        <p className="text-muted-foreground">
          Manage your account information and security
        </p>
      </div>
      <div className="mb-8">
        <ProfileForm initialProfile={profile} />
      </div>
      <div className="space-y-8">
        {/* Email Change */}
        <div className="bg-card rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-2">Change Email</h2>
          <p className="text-sm text-muted-foreground mb-2">To change your email, you must re-enter your password for security.</p>
          {/* TODO: Implement ChangeEmailForm with re-authentication */}
          <button className="btn btn-outline" onClick={() => setShowEmailForm(!showEmailForm)}>
            {showEmailForm ? 'Cancel' : 'Change Email'}
          </button>
          {showEmailForm && (
            <div className="mt-4">
              {/* Placeholder for ChangeEmailForm */}
              <p className="text-xs text-muted-foreground">(Feature coming soon)</p>
            </div>
          )}
        </div>
        {/* Password Change */}
        <div className="bg-card rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-2">Change Password</h2>
          <button className="btn btn-outline" onClick={() => setShowPasswordForm(!showPasswordForm)}>
            {showPasswordForm ? 'Cancel' : 'Change Password'}
          </button>
          {showPasswordForm && (
            <div className="mt-4">
              <SetPasswordForm
                email={profile.email}
                onSubmitAction={async (password) => {
                  // Import updatePassword dynamically to avoid SSR issues
                  const { updatePassword } = await import("@/lib/firebase/updatePassword");
                  try {
                    await updatePassword(password);
                    setShowPasswordForm(false);
                  } catch (err: any) {
                    // Optionally: show error to user (could be improved with state)
                    alert(err.message || "Failed to update password. Please re-authenticate and try again.");
                  }
                }}
              />
            </div>
          )}
        </div>
        {/* Delete Account */}
        <div className="bg-card rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-2 text-red-600">Delete Account</h2>
          <AccountDeletionForm />
        </div>
      </div>
      {/* Dev-only: Danger zone for deleting all accounts */}
      <div className="mt-8">
        <DevDeleteAllAccountsButton />
      </div>
    </div>
  );
}
