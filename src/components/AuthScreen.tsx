import React, { useState, useRef } from "react";
// Icons migrated to Icon component
import { Icon } from "./Icon";
import { ICON_SIZE_SM, ICON_SIZE_MD, ICON_SIZE_LG, ICON_SIZE_XS, ICON_SIZE_3XL } from "../lib/layout-constants";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Checkbox } from "./ui/checkbox";
import { CheckboxSwitch as Switch } from "./ui/checkbox-switch";
import { Badge } from "./ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "./ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { logger } from "../lib/logger";
import { toast } from '../lib/toast-wrapper';
import { motion } from "motion/react";
import { PrivacyPolicyDialog } from "./PrivacyPolicyDialog";
import { TermsOfServiceDialog } from "./TermsOfServiceDialog";
import taskzmLogoBlack from "../assets/Taskzm_Logo_BLK-removebg.png";  // Black logo for light mode
import taskzmLogoGray from "../assets/taskzm-logo-gray.png";  // Gray logo for dark mode
import { supabase } from '../lib/supabase-client';
import { 
  AUTH_UI_TEXT, 
  AUTH_CONFIG,
  AUTH_COLORS,
  AUTH_REMEMBER_EMAIL_KEY,
} from '../lib/auth-constants';
import { getUserFriendlyErrorMessage } from '../lib/error-utils';
import { AUTH_SCREEN, VIEWPORT_BREAKPOINTS, PANEL_GAP_MEDIUM, PANEL_GAP_SMALL, PANEL_FIELD_SPACING, AUTH_SCREEN_SAFE_AREA } from '../lib/layout-constants';
import { COLOR_BACKGROUND_LIGHT } from '../lib/color-theme';
import { useIsMobile } from './ui/use-mobile';
import { AvatarSelection } from './AvatarSelection';
import { AVATAR_UI_TEXT } from '../lib/avatar-constants';
import { pickAvatarFromPool } from '../lib/avatar-utils';
import { getPlatform } from '../lib/platform';
import { getNativePasswordResetRedirectUrl } from '../lib/native-app';

// Password strength calculation
function getPasswordStrength(password: string): { strength: 'weak' | 'medium' | 'strong'; score: number; feedback: string[] } {
  let score = 0;
  const feedback: string[] = [];

  if (password.length >= AUTH_CONFIG.passwordStrongLength) score += 1;
  else feedback.push(AUTH_UI_TEXT.passwordStrength.feedback.minLength);

  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  else feedback.push(AUTH_UI_TEXT.passwordStrength.feedback.caseMix);

  if (/\d/.test(password)) score += 1;
  else feedback.push(AUTH_UI_TEXT.passwordStrength.feedback.numbers);

  if (/[^a-zA-Z0-9]/.test(password)) score += 1;
  else feedback.push(AUTH_UI_TEXT.passwordStrength.feedback.specialChars);

  if (password.length >= AUTH_CONFIG.passwordVeryStrongLength) score += 1;

  let strength: 'weak' | 'medium' | 'strong' = 'weak';
  if (score >= 4) strength = 'strong';
  else if (score >= 2) strength = 'medium';

  return { strength, score, feedback };
}

/** Both auth tabs share one size so the active pill never grows past the bar on switch. */
const AUTH_TAB_TRIGGER_CLASS =
  "flex-1 h-9 min-h-9 rounded-full border-0 px-3 md:px-4 text-xs md:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm";

export function AuthScreen() {
  const { signIn, signUp } = useAuth();
  const { actualTheme } = useTheme();
  const isDark = actualTheme === 'dark';
  const isMobile = useIsMobile();
  
  // Determine screen size category with state for reactivity
  const [screenSize, setScreenSize] = React.useState<'mobile' | 'tablet' | 'desktop'>(() => {
    if (typeof window === 'undefined') return 'desktop';
    const width = window.innerWidth;
    if (width < VIEWPORT_BREAKPOINTS.mobile) return 'mobile';
    if (width < VIEWPORT_BREAKPOINTS.tablet) return 'tablet';
    return 'desktop';
  });
  
  React.useEffect(() => {
    const updateScreenSize = () => {
      const width = window.innerWidth;
      if (width < VIEWPORT_BREAKPOINTS.mobile) {
        setScreenSize('mobile');
      } else if (width < VIEWPORT_BREAKPOINTS.tablet) {
        setScreenSize('tablet');
      } else {
        setScreenSize('desktop');
      }
    };
    
    updateScreenSize();
    window.addEventListener('resize', updateScreenSize);
    return () => window.removeEventListener('resize', updateScreenSize);
  }, []);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("signin");
  const [rememberMe, setRememberMe] = useState(false);

  // Sign In State
  const [signInEmail, setSignInEmail] = useState("");
  const [signInPassword, setSignInPassword] = useState("");
  const [showSignInPassword, setShowSignInPassword] = useState(false);
  const [showForgotPasswordDialog, setShowForgotPasswordDialog] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState("");
  const [isSendingReset, setIsSendingReset] = useState(false);

  // Sign Up State
  const [signUpName, setSignUpName] = useState("");
  const [signUpEmail, setSignUpEmail] = useState("");
  const [signUpPassword, setSignUpPassword] = useState("");
  const [signUpConfirmPassword, setSignUpConfirmPassword] = useState("");
  const [showSignUpPassword, setShowSignUpPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [showPrivacyDialog, setShowPrivacyDialog] = useState(false);
  const [showTermsDialog, setShowTermsDialog] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [signUpAvatar, setSignUpAvatar] = useState<string | undefined>(undefined);

  // Prevent concurrent sign-in (double submit / multiple clicks)
  const signInInProgressRef = useRef(false);

  // Password strength
  const passwordStrength = getPasswordStrength(signUpPassword);
  const passwordsMatch = signUpPassword && signUpConfirmPassword && signUpPassword === signUpConfirmPassword;

  // Email validation
  const validateEmail = (email: string, isSignUp: boolean = false): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      if (isSignUp) {
        setEmailError(AUTH_UI_TEXT.validation.emailRequired);
      }
      return false;
    }
    if (isSignUp) {
      setEmailError("");
    }
    return true;
  };

  // Handle forgot password
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotPasswordEmail) {
      toast.error(AUTH_UI_TEXT.validation.emailRequired);
      return;
    }

    if (!validateEmail(forgotPasswordEmail, false)) {
      toast.error(AUTH_UI_TEXT.validation.emailRequired);
      return;
    }

    setIsSendingReset(true);
    try {
      const resetRedirect = getPlatform().isNative
        ? getNativePasswordResetRedirectUrl()
        : `${window.location.origin}/reset-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(forgotPasswordEmail, {
        redirectTo: resetRedirect,
      });

      if (error) {
        throw error;
      }

      toast.success(AUTH_UI_TEXT.forgotPassword.successMessage, {
        duration: AUTH_CONFIG.toastDuration,
      });
      setShowForgotPasswordDialog(false);
      setForgotPasswordEmail("");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : AUTH_UI_TEXT.forgotPassword.errorMessage;
      toast.error(errorMessage);
    } finally {
      setIsSendingReset(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();

    if (signInInProgressRef.current) return;
    if (!validateEmail(signInEmail, false)) {
      toast.error(AUTH_UI_TEXT.validation.emailRequired);
      return;
    }
    const password = signInPassword.trim();
    if (!password) {
      toast.error(AUTH_UI_TEXT.validation.passwordRequired);
      return;
    }

    signInInProgressRef.current = true;
    setIsLoading(true);

    try {
      await signIn(signInEmail, password);

      if (rememberMe) {
        localStorage.setItem(AUTH_REMEMBER_EMAIL_KEY, signInEmail);
      } else {
        localStorage.removeItem(AUTH_REMEMBER_EMAIL_KEY);
      }

      toast.success(AUTH_UI_TEXT.signIn.successMessage);
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : AUTH_UI_TEXT.error.signInFailed;

      if (
        errorMessage.toLowerCase().includes("invalid") ||
        errorMessage.toLowerCase().includes("credentials")
      ) {
        toast.error(AUTH_UI_TEXT.signIn.invalidCredentialsWithForgot, {
          duration: AUTH_CONFIG.invalidCredentialsToastDurationMs,
          action: {
            label: AUTH_UI_TEXT.forgotPassword.title,
            onClick: () => {
              setForgotPasswordEmail(signInEmail);
              setShowForgotPasswordDialog(true);
            },
          },
        });
      } else {
        toast.error(errorMessage);
      }
    } finally {
      signInInProgressRef.current = false;
      setIsLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateEmail(signUpEmail, true)) {
      return;
    }

    if (!acceptedTerms) {
      toast.error(AUTH_UI_TEXT.validation.termsRequired);
      return;
    }

    if (signUpPassword !== signUpConfirmPassword) {
      toast.error(AUTH_UI_TEXT.validation.passwordsNoMatch);
      return;
    }

    if (signUpPassword.length < AUTH_CONFIG.passwordMinLength) {
      toast.error(AUTH_UI_TEXT.validation.passwordTooShort);
      return;
    }

    if (passwordStrength.strength === 'weak' && signUpPassword.length < AUTH_CONFIG.passwordStrongLength) {
      toast.error(AUTH_UI_TEXT.validation.passwordTooWeak);
      return;
    }

    setIsLoading(true);

    try {
      const avatar =
        signUpAvatar || pickAvatarFromPool(signUpName.trim() || signUpEmail.trim());
      await signUp(signUpEmail, signUpPassword, signUpName, false, avatar);
      toast.success(
        AUTH_UI_TEXT.signUp.successMessage,
        {
          duration: AUTH_CONFIG.toastDuration,
        },
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : AUTH_UI_TEXT.error.accountCreationFailed;

      // Check if user already exists
      if (
        errorMessage.toLowerCase().includes("already") ||
        errorMessage.toLowerCase().includes("exists")
      ) {
        toast.error(AUTH_UI_TEXT.accountExistsTrySignIn, {
          duration: AUTH_CONFIG.accountExistsToastDurationMs,
          action: {
            label: AUTH_UI_TEXT.signIn.title,
            onClick: () => setActiveTab("signin"),
          },
        });
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Load remembered email on mount
  React.useEffect(() => {
    const rememberedEmail = localStorage.getItem(AUTH_REMEMBER_EMAIL_KEY);
    if (rememberedEmail) {
      setSignInEmail(rememberedEmail);
      setRememberMe(true);
    }
  }, []);


  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.2,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6, ease: "easeOut" },
    },
  };

  const cardVariants = {
    hidden: { opacity: 0, scale: 0.9, y: 20 },
    visible: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: { duration: 0.5, ease: "easeOut" },
    },
  };

  const logoVariants = {
    hidden: { opacity: 0, scale: 0.8 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: { duration: 0.6, ease: "easeOut" },
    },
  };

  // Get responsive values based on screen size
  const getPadding = () => {
    if (screenSize === 'mobile') return AUTH_SCREEN.mobile.padding;
    if (screenSize === 'tablet') return AUTH_SCREEN.tablet.padding;
    return AUTH_SCREEN.desktop.padding;
  };
  
  const getLogo = () => {
    if (screenSize === 'mobile') return AUTH_SCREEN.mobile.logo;
    if (screenSize === 'tablet') return AUTH_SCREEN.tablet.logo;
    return AUTH_SCREEN.desktop.logo;
  };
  
  const getCard = () => {
    if (screenSize === 'mobile') return AUTH_SCREEN.mobile.card;
    if (screenSize === 'tablet') return AUTH_SCREEN.tablet.card;
    return AUTH_SCREEN.desktop.card;
  };
  
  const getSpacing = () => {
    if (screenSize === 'mobile') return AUTH_SCREEN.mobile.spacing;
    if (screenSize === 'tablet') return AUTH_SCREEN.tablet.spacing;
    return AUTH_SCREEN.desktop.spacing;
  };
  
  const padding = getPadding();
  const logo = getLogo();
  const card = getCard();
  const spacing = getSpacing();

  return (
    <div 
      className="min-h-viewport-safe w-full overflow-x-hidden overflow-y-auto relative flex items-center justify-center"
      style={{
        paddingTop: AUTH_SCREEN_SAFE_AREA.top(padding.vertical),
        paddingBottom: AUTH_SCREEN_SAFE_AREA.bottom(padding.bottom),
        paddingLeft: AUTH_SCREEN_SAFE_AREA.left(padding.horizontal),
        paddingRight: AUTH_SCREEN_SAFE_AREA.right(padding.horizontal),
      } as React.CSSProperties}
    >
      <div
        className="fixed inset-0 z-0 w-screen h-screen dark:bg-gray-950"
        style={{ background: isDark ? undefined : COLOR_BACKGROUND_LIGHT }}
      />

      {/* Main Content */}
      <motion.div
        className="relative z-10 w-full mx-auto my-auto"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        style={{
          maxWidth: card.maxWidth || '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
        } as React.CSSProperties}
      >
        <div 
          className="flex flex-col items-center justify-center w-full"
        >
          {/* Branding Section - Above form */}
          <motion.div
            className="text-center w-full flex flex-col items-center flex-shrink-0"
            variants={itemVariants}
            style={{
              marginBottom: spacing.brandingMarginBottom,
              marginTop: '0', // Use spacing constants instead of negative margins
            } as React.CSSProperties}
          >
            <motion.div className="flex flex-col items-center w-full" variants={logoVariants}>
              <motion.div
                className="inline-flex items-center gap-1 bg-card/70 dark:bg-background/70 backdrop-blur-sm px-2 py-1 rounded-full shadow-sm border border-border"
                style={{
                  marginBottom: spacing.badgeMarginBottom,
                } as React.CSSProperties}
                whileHover={{ scale: 1.05 }}
              >
                <Icon name="sparkles" size={ICON_SIZE_SM} weight="duotone" className="text-primary" />
                <span className="text-[9px] sm:text-[10px] font-medium text-gray-700 dark:text-foreground">
                  {AUTH_UI_TEXT.neurodivergentBadge}
                </span>
              </motion.div>
              <motion.img
                src={isDark ? taskzmLogoGray : taskzmLogoBlack}
                alt="TaskZM Logo"
                className="object-contain"
                style={{
                  width: logo.width,
                  maxWidth: ('maxWidth' in logo ? logo.maxWidth : undefined) || '100%',
                  height: 'auto',
                  marginTop: '0', // No negative margin - use spacing constants instead
                  marginBottom: spacing.logoMarginBottom,
                  paddingTop: '0',
                  paddingBottom: '0',
                  display: 'block',
                  lineHeight: 0,
                } as React.CSSProperties}
                whileHover={{ scale: 1.02 }}
              />
              <p 
                className="text-xs sm:text-sm text-muted-foreground text-center max-w-sm px-2 sm:px-4"
                style={{
                  marginTop: ('taglineMarginTop' in spacing ? spacing.taglineMarginTop : undefined) || ('logoMarginBottom' in spacing ? spacing.logoMarginBottom : '0.75rem'),
                } as React.CSSProperties}
              >
                {AUTH_UI_TEXT.subtitle}
              </p>
            </motion.div>
          </motion.div>

          {/* Auth Card - Below logo */}
          <motion.div
            variants={cardVariants}
            className="w-full flex flex-col"
            style={{
              maxHeight: screenSize === 'mobile' 
                ? 'calc(100vh - 8rem)' // Logo (~3rem) + padding (1.5rem) + bottom margin (3.5rem) - increased bottom space
                : screenSize === 'tablet'
                ? 'calc(100vh - 10rem)' // Logo (~4rem) + padding (2rem) + bottom margin (4rem) - increased bottom space
                : 'calc(100vh - 10rem)', // Logo (~4rem) + padding (2rem) + bottom margin (4rem) - increased bottom space
              overflow: 'hidden',
            } as React.CSSProperties}
          >
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="w-full flex flex-col"
            >
              <Card 
                className="w-full shadow-lg border border-primary/20 bg-card dark:bg-card flex flex-col overflow-hidden"
                style={{
                  maxHeight: card.maxHeight,
                  maxWidth: card.maxWidth || '100%',
                  width: '100%',
                } as React.CSSProperties}
              >
                {/* Card Header with Tabs - Same for mobile and desktop */}
                <CardHeader 
                  className="flex-shrink-0 px-3 sm:px-4 md:px-6"
                  style={{
                    paddingTop: card.headerPadding?.top || (screenSize === 'mobile' ? '0.75rem' : '1rem'),
                    paddingBottom: card.headerPadding?.bottom || (screenSize === 'mobile' ? '0.5rem' : '0.75rem'),
                    gap: ('cardHeaderSpacing' in spacing ? spacing.cardHeaderSpacing : undefined) || '0.375rem',
                  } as React.CSSProperties}
                >
                  <CardTitle className="text-center text-sm sm:text-base md:text-lg font-semibold text-foreground">
                    {AUTH_UI_TEXT.welcomeMessage}
                  </CardTitle>
                  <CardDescription className="text-center text-[11px] sm:text-xs md:text-sm text-muted-foreground">
                    {activeTab === "signin" ? (
                      AUTH_UI_TEXT.signIn.description
                    ) : (
                      AUTH_UI_TEXT.signUp.description
                    )}
                  </CardDescription>
                  <TabsList className="w-full h-auto p-1 gap-1 bg-muted rounded-full flex items-stretch">
                    <TabsTrigger
                      value="signin"
                      className={AUTH_TAB_TRIGGER_CLASS}
                    >
                      {AUTH_UI_TEXT.signIn.title}
                    </TabsTrigger>
                    <TabsTrigger
                      value="signup"
                      className={AUTH_TAB_TRIGGER_CLASS}
                    >
                      {AUTH_UI_TEXT.signUp.title}
                    </TabsTrigger>
                  </TabsList>
                </CardHeader>

                <CardContent 
                  className="overflow-y-auto px-3 sm:px-4 md:px-6"
                  style={{
                    paddingTop: screenSize === 'mobile' 
                      ? card.contentPadding?.top || '0.5rem'
                      : screenSize === 'tablet'
                      ? card.contentPadding?.top || '0.75rem'
                      : card.contentPadding?.top || '0.75rem',
                    paddingBottom: screenSize === 'mobile'
                      ? card.contentPadding?.bottom || '0.75rem'
                      : screenSize === 'tablet'
                      ? card.contentPadding?.bottom || '1rem'
                      : card.contentPadding?.bottom || '1rem',
                    maxHeight: screenSize === 'mobile'
                      ? 'calc(100vh - 16rem)' // Account for logo, header, footer, padding - increased bottom space
                      : screenSize === 'tablet'
                      ? 'calc(100vh - 17rem)' // Account for logo, header, footer, padding - increased bottom space
                      : 'calc(100vh - 17rem)', // Account for logo, header, footer, padding - increased bottom space
                  } as React.CSSProperties}
                >
                  <TabsContent value="signin" className="mt-0">
                    <motion.form
                      onSubmit={handleSignIn}
                      className="space-y-2.5 sm:space-y-3"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3 }}
                      noValidate
                    >
                      <div className="space-y-1">
                        <Input
                          id="signin-email"
                          type="email"
                          placeholder={AUTH_UI_TEXT.signIn.emailPlaceholder}
                          value={signInEmail}
                          onChange={(e) =>
                            setSignInEmail(e.target.value)
                          }
                          onBlur={() => {
                            if (signInEmail) {
                              validateEmail(signInEmail, false);
                            }
                          }}
                          required
                          className="border-2 focus:border-primary transition-colors h-9 sm:h-10 text-xs sm:text-sm bg-background dark:bg-card shadow-sm"
                        />
                      </div>

                      <div className="space-y-1">
                        <div className="relative">
                          <Input
                            id="signin-password"
                            type={showSignInPassword ? "text" : "password"}
                            placeholder={AUTH_UI_TEXT.signIn.passwordLabel}
                            value={signInPassword}
                            onChange={(e) =>
                              setSignInPassword(e.target.value)
                            }
                            autoComplete="current-password"
                            required
                            className="border-2 focus:border-primary transition-colors h-9 sm:h-10 text-xs sm:text-sm bg-background dark:bg-card shadow-sm pr-10"
                          />
                          <button
                            type="button"
                            onClick={() => setShowSignInPassword(!showSignInPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                            aria-label={showSignInPassword ? "Hide password" : "Show password"}
                          >
                            {showSignInPassword ? (
                              <Icon name="eye-off" size={ICON_SIZE_MD} />
                            ) : (
                              <Icon name="eye" size={ICON_SIZE_MD} />
                            )}
                          </button>
                        </div>
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-1.5 sm:gap-2">
                            <Switch
                              id="remember-me"
                              checked={rememberMe}
                              onCheckedChange={(checked) => setRememberMe(checked)}
                            />
                            <Label
                              htmlFor="remember-me"
                              className="text-[11px] sm:text-xs text-gray-600 dark:text-muted-foreground cursor-pointer"
                            >
                              {AUTH_UI_TEXT.signIn.rememberMe}
                            </Label>
                          </div>
                          <button
                            type="button"
                            onClick={() => setShowForgotPasswordDialog(true)}
                            className="text-[11px] sm:text-xs transition-colors whitespace-nowrap"
                            style={{
                              color: AUTH_COLORS.primary,
                            } as React.CSSProperties}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.color = AUTH_COLORS.primaryHover;
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.color = AUTH_COLORS.primary;
                            }}
                          >
                            {AUTH_UI_TEXT.signIn.forgotPassword}
                          </button>
                        </div>
                      </div>

                      <div className="pt-1">
                        <Button
                          type="submit"
                          className="w-full shadow-lg border-0 text-xs sm:text-sm"
                          style={{
                            height: screenSize === 'mobile' ? AUTH_SCREEN.mobile.button.height : screenSize === 'tablet' ? AUTH_SCREEN.tablet.button.height : AUTH_SCREEN.desktop.button.height,
                            minHeight: screenSize === 'mobile' ? AUTH_SCREEN.mobile.button.height : screenSize === 'tablet' ? AUTH_SCREEN.tablet.button.height : AUTH_SCREEN.desktop.button.height,
                            background: AUTH_COLORS.primary,
                            backgroundSize: 'cover',
                            backgroundRepeat: 'no-repeat',
                            backgroundPosition: 'center',
                            color: AUTH_COLORS.buttonText,
                            padding: '0.5rem 1rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          } as React.CSSProperties}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = AUTH_COLORS.primaryHover;
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = AUTH_COLORS.primary;
                          }}
                          disabled={isLoading}
                          onClick={(e) => {
                            e.preventDefault();
                            handleSignIn(e);
                          }}
                        >
                          {isLoading ? (
                            <motion.div
                              animate={{ rotate: 360 }}
                              transition={{
                                duration: 1,
                                repeat: Infinity,
                                ease: "linear",
                              }}
                            >
                              ⏳
                            </motion.div>
                          ) : (
                            AUTH_UI_TEXT.signIn.button
                          )}
                        </Button>
                      </div>

                    </motion.form>
                  </TabsContent>

                  <TabsContent value="signup" className="mt-0">
                    <motion.form
                      onSubmit={handleSignUp}
                      className="space-y-2.5 sm:space-y-3"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                      noValidate
                    >
                      <div className="space-y-1">
                        <Input
                          id="signup-name"
                          type="text"
                          placeholder={AUTH_UI_TEXT.signUp.namePlaceholder}
                          value={signUpName}
                          onChange={(e) =>
                            setSignUpName(e.target.value)
                          }
                          required
                          className="border-2 focus:border-primary transition-colors h-9 sm:h-10 text-xs sm:text-sm bg-background dark:bg-card shadow-sm"
                        />
                      </div>

                      <div className="space-y-1">
                        <div className="relative">
                          <Input
                            id="signup-email"
                            type="email"
                            placeholder={AUTH_UI_TEXT.signUp.emailPlaceholder}
                            value={signUpEmail}
                            onChange={(e) => {
                              setSignUpEmail(e.target.value);
                              if (e.target.value) {
                                validateEmail(e.target.value, true);
                              } else {
                                setEmailError("");
                              }
                            }}
                            onBlur={() => {
                              if (signUpEmail) {
                                validateEmail(signUpEmail, true);
                              }
                            }}
                            required
                            className={`border-2 focus:border-primary transition-colors h-9 sm:h-10 text-xs sm:text-sm bg-background dark:bg-card shadow-sm pr-10 ${
                              emailError ? 'border-red-500' : ''
                            }`}
                          />
                          <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            {signUpEmail && (
                              emailError ? (
                                <Icon name="alert-circle" size={ICON_SIZE_XS} className="text-red-500" />
                              ) : (
                                <Icon name="check-circle" size={ICON_SIZE_XS} className="text-green-500" />
                              )
                            )}
                          </div>
                        </div>
                        {emailError && (
                          <p className="text-[11px] sm:text-xs text-red-500 flex items-center gap-1">
                            <Icon name="alert-circle" size={ICON_SIZE_XS} />
                            {emailError}
                          </p>
                        )}
                      </div>

                      <div className="space-y-1">
                        <div className="relative">
                          <Input
                            id="signup-password"
                            type={showSignUpPassword ? "text" : "password"}
                            placeholder={AUTH_UI_TEXT.signUp.passwordLabel}
                            value={signUpPassword}
                            onChange={(e) =>
                              setSignUpPassword(e.target.value)
                            }
                            autoComplete="new-password"
                            required
                            className="border-2 focus:border-primary transition-colors h-9 sm:h-10 text-xs sm:text-sm bg-background dark:bg-card shadow-sm pr-10"
                          />
                          <button
                            type="button"
                            onClick={() => setShowSignUpPassword(!showSignUpPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                            aria-label={showSignUpPassword ? "Hide password" : "Show password"}
                          >
                            {showSignUpPassword ? (
                              <Icon name="eye-off" size={ICON_SIZE_MD} />
                            ) : (
                              <Icon name="eye" size={ICON_SIZE_MD} />
                            )}
                          </button>
                        </div>
                        {/* Password Strength Indicator */}
                        {signUpPassword && (
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 bg-gray-200 dark:bg-muted rounded-full overflow-hidden">
                                <div
                                  className={`h-full transition-all duration-300 ${
                                    passwordStrength.strength === 'weak'
                                      ? 'bg-red-500 w-1/3'
                                      : passwordStrength.strength === 'medium'
                                      ? 'bg-yellow-500 w-2/3'
                                      : 'bg-green-500 w-full'
                                  }`}
                                />
                              </div>
                              <span className={`text-[10px] sm:text-xs font-medium ${
                                passwordStrength.strength === 'weak'
                                  ? 'text-red-500'
                                  : passwordStrength.strength === 'medium'
                                  ? 'text-yellow-500'
                                  : 'text-green-500'
                              }`}>
                                {passwordStrength.strength === 'weak' 
                                  ? AUTH_UI_TEXT.passwordStrength.weak
                                  : passwordStrength.strength === 'medium'
                                  ? AUTH_UI_TEXT.passwordStrength.medium
                                  : AUTH_UI_TEXT.passwordStrength.strong}
                              </span>
                            </div>
                            {passwordStrength.feedback.length > 0 && passwordStrength.strength !== 'strong' && (
                              <ul className="text-[11px] sm:text-xs text-gray-600 dark:text-muted-foreground space-y-0.5">
                                {passwordStrength.feedback.slice(0, 2).map((item, idx) => (
                                  <li key={idx} className="flex items-center gap-1">
                                    <span className="text-red-500">•</span>
                                    {item}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="space-y-1">
                        <div className="relative">
                          <Input
                            id="signup-confirm-password"
                            type={showConfirmPassword ? "text" : "password"}
                            placeholder={AUTH_UI_TEXT.signUp.confirmPasswordLabel}
                            value={signUpConfirmPassword}
                            onChange={(e) =>
                              setSignUpConfirmPassword(
                                e.target.value,
                              )
                            }
                            autoComplete="new-password"
                            required
                            className={`border-2 focus:border-primary transition-colors h-9 sm:h-10 text-xs sm:text-sm bg-background dark:bg-card shadow-sm pr-10 ${
                              signUpConfirmPassword && !passwordsMatch ? 'border-red-500' : ''
                            } ${
                              signUpConfirmPassword && passwordsMatch ? 'border-green-500' : ''
                            }`}
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                            aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                          >
                            {showConfirmPassword ? (
                              <Icon name="eye-off" size={ICON_SIZE_MD} />
                            ) : (
                              <Icon name="eye" size={ICON_SIZE_MD} />
                            )}
                          </button>
                        </div>
                        {signUpConfirmPassword && (
                          <p className={`text-[11px] sm:text-xs flex items-center gap-1 ${
                            passwordsMatch ? 'text-green-500' : 'text-red-500'
                          }`}>
                            {passwordsMatch ? (
                              <>
                                <Icon name="check-circle" size={ICON_SIZE_XS} />
                                {AUTH_UI_TEXT.validation.passwordsNoMatch.replace('do not match', 'match')}
                              </>
                            ) : (
                              <>
                                <Icon name="alert-circle" size={ICON_SIZE_XS} />
                                {AUTH_UI_TEXT.validation.passwordsNoMatch}
                              </>
                            )}
                          </p>
                        )}
                      </div>

                      {/* Avatar Selection */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: PANEL_FIELD_SPACING }} className="min-w-0">
                        <Label className="text-[11px] sm:text-xs text-gray-700 dark:text-gray-300">{AVATAR_UI_TEXT.chooseYourAvatar}</Label>
                        <AvatarSelection
                          selectedAvatar={signUpAvatar}
                          onAvatarSelect={setSignUpAvatar}
                          previewSeed={signUpName.trim() || signUpEmail.trim() || 'User'}
                          scrollable
                        />
                      </div>

                      {/* Terms and Privacy */}
                      <div className="flex items-start space-x-2 pt-0.5">
                        <Checkbox
                          id="accept-terms"
                          checked={acceptedTerms}
                          onCheckedChange={(checked) => setAcceptedTerms(checked === true)}
                          className="mt-0.5 !h-4 !w-4 flex-shrink-0"
                        />
                        <Label
                          htmlFor="accept-terms"
                          className="text-[11px] sm:text-xs text-gray-600 dark:text-muted-foreground cursor-pointer leading-tight"
                        >
                          {AUTH_UI_TEXT.signUp.acceptTerms.split('Terms of Service')[0]}
                          <button
                            type="button"
                            onClick={() => setShowTermsDialog(true)}
                            className="text-primary hover:text-primary/80 underline"
                          >
                            Terms of Service
                          </button>
                          {" "}and{" "}
                          <button
                            type="button"
                            onClick={() => setShowPrivacyDialog(true)}
                            className="text-primary hover:text-primary/80 underline"
                          >
                            Privacy Policy
                          </button>
                        </Label>
                      </div>

                      <div className="pt-0.5">
                        <Button
                          type="submit"
                          className="w-full shadow-lg border-0 text-xs sm:text-sm"
                          style={{
                            height: screenSize === 'mobile' ? AUTH_SCREEN.mobile.button.height : screenSize === 'tablet' ? AUTH_SCREEN.tablet.button.height : AUTH_SCREEN.desktop.button.height,
                            minHeight: screenSize === 'mobile' ? AUTH_SCREEN.mobile.button.height : screenSize === 'tablet' ? AUTH_SCREEN.tablet.button.height : AUTH_SCREEN.desktop.button.height,
                            background: AUTH_COLORS.primary,
                            backgroundSize: 'cover',
                            backgroundRepeat: 'no-repeat',
                            backgroundPosition: 'center',
                            color: AUTH_COLORS.buttonText,
                            padding: '0.5rem 1rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          } as React.CSSProperties}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = AUTH_COLORS.primaryHover;
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = AUTH_COLORS.primary;
                          }}
                          disabled={isLoading}
                          onClick={(e) => {
                            e.preventDefault();
                            handleSignUp(e);
                          }}
                          >
                            {isLoading ? (
                              <motion.div
                                animate={{ rotate: 360 }}
                                transition={{
                                  duration: 1,
                                  repeat: Infinity,
                                  ease: "linear",
                                }}
                              >
                                ⏳
                              </motion.div>
                            ) : (
                              AUTH_UI_TEXT.signUp.button
                            )}
                          </Button>
                      </div>
                    </motion.form>
                  </TabsContent>
                  </CardContent>
              </Card>
            </Tabs>
          </motion.div>
        </div>
      </motion.div>

      {/* Forgot Password Dialog */}
      <Dialog open={showForgotPasswordDialog} onOpenChange={setShowForgotPasswordDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Icon 
                name="lock"
                size={ICON_SIZE_LG}
                style={{ color: AUTH_COLORS.primary } as React.CSSProperties}
              />
              {AUTH_UI_TEXT.forgotPassword.title}
            </DialogTitle>
            <DialogDescription>
              {AUTH_UI_TEXT.forgotPassword.description}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reset-email">{AUTH_UI_TEXT.forgotPassword.emailLabel}</Label>
              <div className="relative">
                <Input
                  id="reset-email"
                  type="email"
                  placeholder={AUTH_UI_TEXT.signIn.emailPlaceholder}
                  value={forgotPasswordEmail}
                  onChange={(e) => setForgotPasswordEmail(e.target.value)}
                  required
                  className="pr-10"
                />
                <Icon name="mail" size={ICON_SIZE_MD} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowForgotPasswordDialog(false);
                  setForgotPasswordEmail("");
                }}
                disabled={isSendingReset}
              >
                {AUTH_UI_TEXT.forgotPassword.backToSignIn}
              </Button>
              <Button
                type="submit"
                disabled={isSendingReset || !forgotPasswordEmail}
                style={{
                  height: screenSize === 'mobile' ? AUTH_SCREEN.mobile.button.height : screenSize === 'tablet' ? AUTH_SCREEN.tablet.button.height : AUTH_SCREEN.desktop.button.height,
                  minHeight: screenSize === 'mobile' ? AUTH_SCREEN.mobile.button.height : screenSize === 'tablet' ? AUTH_SCREEN.tablet.button.height : AUTH_SCREEN.desktop.button.height,
                  background: AUTH_COLORS.primary,
                  backgroundSize: 'cover',
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'center',
                  color: AUTH_COLORS.buttonText,
                  padding: '0.5rem 1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                } as React.CSSProperties}
                onMouseEnter={(e) => {
                  if (!isSendingReset && forgotPasswordEmail) {
                    e.currentTarget.style.background = AUTH_COLORS.primaryHover;
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = AUTH_COLORS.primary;
                }}
              >
                {isSendingReset ? AUTH_UI_TEXT.loading : AUTH_UI_TEXT.forgotPassword.button}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Privacy Policy Dialog */}
      <PrivacyPolicyDialog
        open={showPrivacyDialog}
        onOpenChange={setShowPrivacyDialog}
      />

      {/* Terms of Service Dialog */}
      <TermsOfServiceDialog
        open={showTermsDialog}
        onOpenChange={setShowTermsDialog}
      />
    </div>
  );
}