import React, { useState, useEffect } from 'react';
// Icons migrated to Icon component
import { Icon } from './Icon';
import { ICON_SIZE_SM, ICON_SIZE_MD, ICON_SIZE_LG, ICON_SIZE_2XL, ICON_SIZE_3XL, MAIN_BG_GRADIENT_CLASS } from '../lib/layout-constants';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';
import * as api from '../lib/api';
import { toast } from '../lib/toast-wrapper';
import { useAuth } from '../contexts/AuthContext';
import { logger } from '../lib/logger';

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
            logger.error('Auto sign-in failed:', signInError);
            // Still redirect to home, user can sign in manually
            window.location.href = '/';
            return;
          }
        }

        // Redirect to dashboard
        window.location.href = '/';
      }
    } catch (err) {
      logger.error('Error accepting invitation:', err);
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
        return <Icon name="shield-check" size={ICON_SIZE_LG} />;
      case 'member':
        return <Icon name="shield" size={ICON_SIZE_LG} />;
      case 'viewer':
        return <Icon name="eye" size={ICON_SIZE_LG} />;
      default:
        return null;
    }
  };

  if (isLoading || isValidating) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${MAIN_BG_GRADIENT_CLASS}`}>
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center space-y-4">
              <Icon name="loader-2" size={ICON_SIZE_2XL} className="animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Validating invitation...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error && !invitation) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${MAIN_BG_GRADIENT_CLASS} p-4`}>
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center justify-center mb-4">
              <Icon name="x-circle" size={ICON_SIZE_3XL} className="text-destructive" />
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
    <div className={`min-h-screen flex items-center justify-center ${MAIN_BG_GRADIENT_CLASS} p-4`}>
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center justify-center mb-4">
            <Icon name="mail" size={ICON_SIZE_3XL} className="text-primary" />
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
                      autoComplete="new-password"
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
                      autoComplete="new-password"
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
                      <Icon name="loader-2" size={ICON_SIZE_MD} className="mr-2 animate-spin" />
                      Accepting...
                    </>
                  ) : (
                    <>
                      <Icon name="check-circle" size={ICON_SIZE_MD} className="mr-2" />
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

