"use client";

import { useState } from 'react';
import ProfileForm from '@/components/auth/ProfileForm';
import SetPasswordForm from '@/components/auth/SetPasswordForm';
import AccountDeletionForm from '@/components/auth/AccountDeletionForm';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useAuth } from '@/context/AuthContext';
import { useUserPreferences } from '@/hooks/useUserPreferences';
import { Loader2, ArrowLeft, Mail, Lock, Trash2, User, Shield, Settings } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

export default function SettingsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { profile, loading: profileLoading } = useUserProfile();
  const { preferences, loading: prefsLoading, error: prefsError, updatePreference } = useUserPreferences();
  const { toast } = useToast();
  const [updatingPrefs, setUpdatingPrefs] = useState<{ [key: string]: boolean }>({});
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);

  const loading = profileLoading || prefsLoading;

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
      <div className="min-h-screen bg-background">
        <div className="container max-w-4xl mx-auto p-6">
          <Card className="border-0 shadow-lg">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <Settings className="h-8 w-8 text-muted-foreground" />
              </div>
              <CardTitle className="text-xl mb-2">Authentication Required</CardTitle>
              <CardDescription className="mb-6 max-w-md">
                You must be signed in to access your account settings and preferences.
              </CardDescription>
              <Button onClick={() => router.push('/auth')} className="mb-8">
                Sign In
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container max-w-4xl mx-auto p-6">
          {/* Header skeleton */}
          <div className="mb-8">
            <div className="h-6 w-20 bg-muted rounded animate-pulse mb-6"></div>
            <div className="h-8 w-64 bg-muted rounded animate-pulse mb-2"></div>
            <div className="h-4 w-96 bg-muted rounded animate-pulse"></div>
          </div>
          
          {/* Content skeleton */}
          <div className="space-y-6">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="border-0 shadow-lg">
                <CardHeader>
                  <div className="h-6 w-48 bg-muted rounded animate-pulse mb-2"></div>
                  <div className="h-4 w-72 bg-muted rounded animate-pulse"></div>
                </CardHeader>
                <CardContent>
                  <div className="h-24 bg-muted rounded animate-pulse"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container max-w-4xl mx-auto p-6">
          <Card className="border-0 shadow-lg">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
                <Settings className="h-8 w-8 text-destructive" />
              </div>
              <CardTitle className="text-xl mb-2">Unable to Load Profile</CardTitle>
              <CardDescription className="mb-6">
                There was an issue loading your profile. Please try refreshing the page.
              </CardDescription>
              <Button onClick={() => window.location.reload()} variant="outline">
                Refresh Page
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-4xl mx-auto p-6 space-y-8">
        {/* Header */}
        <div className="space-y-6">
          <Button 
            variant="ghost" 
            onClick={() => router.push('/')}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Home
          </Button>
          
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">Account Settings</h1>
            <p className="text-muted-foreground text-lg">
              Manage your account information, security, and preferences
            </p>
          </div>
        </div>

        {/* Profile Section */}
        <Card className="border-0 shadow-lg">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-xl">Profile Information</CardTitle>
                <CardDescription>
                  Update your personal details and display preferences
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ProfileForm initialProfile={profile} />
          </CardContent>
        </Card>

        {/* Security Section */}
        <Card className="border-0 shadow-lg">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Shield className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-xl">Security & Authentication</CardTitle>
                <CardDescription>
                  Manage your account security and authentication methods
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Email Change Section */}
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center mt-1">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 space-y-2">
                  <div>
                    <h3 className="font-medium">Email Address</h3>
                    <p className="text-sm text-muted-foreground">
                      Change your account email address. You'll need to re-enter your password for security.
                    </p>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setShowEmailForm(!showEmailForm)}
                    className="mt-2"
                  >
                    {showEmailForm ? 'Cancel' : 'Change Email'}
                  </Button>
                  {showEmailForm && (
                    <div className="mt-4 p-4 bg-muted/50 rounded-lg border border-dashed">
                      <p className="text-sm text-muted-foreground italic">
                        Feature coming soon
                      </p>
                    </div>
                  )}
                </div>
              </div>
              
              <Separator />
              
              {/* Password Change Section */}
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center mt-1">
                  <Lock className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 space-y-2">
                  <div>
                    <h3 className="font-medium">Password</h3>
                    <p className="text-sm text-muted-foreground">
                      Update your account password to keep your account secure.
                    </p>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setShowPasswordForm(!showPasswordForm)}
                    className="mt-2"
                  >
                    {showPasswordForm ? 'Cancel' : 'Change Password'}
                  </Button>
                  {showPasswordForm && (
                    <div className="mt-4 p-4 bg-background border rounded-lg">
                      <SetPasswordForm
                        email={profile.email}
                        onSubmitAction={async (password) => {
                          // Import updatePassword dynamically to avoid SSR issues
                          const { updatePassword } = await import("@/lib/firebase/updatePassword");
                          try {
                            await updatePassword(password);
                            setShowPasswordForm(false);
                            toast({
                              title: "Password updated",
                              description: "Your password has been successfully changed.",
                            });
                          } catch (err: any) {
                            toast({
                              title: "Error",
                              description: err.message || "Failed to update password. Please re-authenticate and try again.",
                              variant: "destructive",
                            });
                          }
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card className="border-0 shadow-lg border-l-4 border-l-destructive">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
                <Trash2 className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <CardTitle className="text-xl text-destructive">Danger Zone</CardTitle>
                <CardDescription>
                  Permanently delete your account and all data. This action cannot be undone.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <AccountDeletionForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}