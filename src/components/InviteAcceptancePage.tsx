import React, { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Loader2, Mail, Shield, Eye, ShieldCheck } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';
import * as api from '../lib/api';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';

interface InviteAcceptancePageProps {
  token: string;
}

export function InviteAcceptancePage({ token }: InviteAcceptancePageProps) {
  const { signIn } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isValidating, setIsValidating] = useState(true);
  const [isAccepting, setIsAccepting] = useState(false);
  const [invitation, setInvitation] = useState<{
    email: string;
    name: string;
    role: 'admin' | 'member' | 'viewer';
    workspaceId: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [needsPassword, setNeedsPassword] = useState(false);

  useEffect(() => {
    validateInvitation();
  }, [token]);

  const validateInvitation = async () => {
    try {
      setIsValidating(true);
      const response = await api.validateInvitation(token);
      
      if (response.valid && response.invitation) {
        setInvitation(response.invitation);
        setError(null);
      } else {
        setError('Invalid or expired invitation');
      }
    } catch (err) {
      console.error('Error validating invitation:', err);
      setError(err instanceof Error ? err.message : 'Failed to validate invitation');
    } finally {
      setIsValidating(false);
      setIsLoading(false);
    }
  };

  const handleAcceptInvitation = async () => {
    // If password form is shown, validate password first
    if (needsPassword) {
      if (!password || password.length < 6) {
        toast.error('Password must be at least 6 characters');
        return;
      }
      if (password !== confirmPassword) {
        toast.error('Passwords do not match');
        return;
      }
    }

    try {
      setIsAccepting(true);
      const response = await api.acceptInvitation(token, needsPassword ? password : undefined);
      
      if (response.success) {
        toast.success('Welcome to the team!', {
          description: response.message,
        });

        // If new account was created, sign them in
        if (needsPassword && password) {
          try {
            await signIn(invitation!.email, password);
          } catch (signInError) {
            console.error('Auto sign-in failed:', signInError);
            // Still redirect to home, user can sign in manually
            window.location.href = '/';
            return;
          }
        }

        // Redirect to dashboard
        window.location.href = '/';
      }
    } catch (err) {
      console.error('Error accepting invitation:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to accept invitation';
      
      // Check if error indicates password is required
      if (errorMessage.includes('Password is required') || errorMessage.includes('password')) {
        setNeedsPassword(true);
        setError(null); // Clear other errors
        toast.info('Please create a password to accept the invitation');
      } else {
        toast.error(errorMessage);
        setError(errorMessage);
      }
    } finally {
      setIsAccepting(false);
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin':
        return <ShieldCheck className="w-5 h-5" />;
      case 'member':
        return <Shield className="w-5 h-5" />;
      case 'viewer':
        return <Eye className="w-5 h-5" />;
      default:
        return null;
    }
  };

  if (isLoading || isValidating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#FAF9FC] via-[#F9F7FD] to-[#F3F0F9] dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center space-y-4">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Validating invitation...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error && !invitation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#FAF9FC] via-[#F9F7FD] to-[#F3F0F9] dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center justify-center mb-4">
              <XCircle className="w-12 h-12 text-destructive" />
            </div>
            <CardTitle className="text-center">Invalid Invitation</CardTitle>
            <CardDescription className="text-center">
              {error}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => window.location.href = '/'}
              className="w-full"
              variant="outline"
            >
              Go to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#FAF9FC] via-[#F9F7FD] to-[#F3F0F9] dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center justify-center mb-4">
            <Mail className="w-12 h-12 text-primary" />
          </div>
          <CardTitle className="text-center">You've Been Invited!</CardTitle>
          <CardDescription className="text-center">
            Join the team and start collaborating
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {invitation && (
            <>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium">Name:</span>
                  <span>{invitation.name}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium">Email:</span>
                  <span>{invitation.email}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium">Role:</span>
                  <div className="flex items-center gap-1">
                    {getRoleIcon(invitation.role)}
                    <span className="capitalize">{invitation.role}</span>
                  </div>
                </div>
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {needsPassword && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="password">Create Password</Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      disabled={isAccepting}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm Password</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm your password"
                      disabled={isAccepting}
                    />
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  onClick={handleAcceptInvitation}
                  className="flex-1"
                  disabled={isAccepting || (needsPassword && (!password || !confirmPassword))}
                >
                  {isAccepting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Accepting...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Accept Invitation
                    </>
                  )}
                </Button>
                <Button
                  onClick={() => window.location.href = '/'}
                  variant="outline"
                  disabled={isAccepting}
                >
                  Decline
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

