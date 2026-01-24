import React, { useState } from "react";
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
import { toast } from "sonner";
import { motion } from "motion/react";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import { PrivacyPolicyDialog } from "./PrivacyPolicyDialog";
import { TermsOfServiceDialog } from "./TermsOfServiceDialog";
import taskzmLogoBlack from "../assets/Taskzm_Logo_BLK-removebg.png";  // Black logo for light mode
import taskzmLogoGray from "../assets/taskzm-logo-gray.png";  // Gray logo for dark mode
import { supabase } from '../lib/supabase-client';
import { 
  DEMO_ACCOUNT_CONFIG, 
  AUTH_UI_TEXT, 
  AUTH_CONFIG,
  AUTH_BACKGROUND_IMAGE,
  AUTH_COLORS
} from '../lib/auth-constants';
import { getUserFriendlyErrorMessage } from '../lib/error-utils';
import { AUTH_SCREEN, VIEWPORT_BREAKPOINTS, PANEL_GAP_MEDIUM, PANEL_GAP_SMALL, PANEL_FIELD_SPACING } from '../lib/layout-constants';
import { useIsMobile } from './ui/use-mobile';
import { AvatarSelection, type AvatarGender } from './AvatarSelection';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { AVATAR_UI_TEXT } from '../lib/avatar-constants';

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
  const [signUpGender, setSignUpGender] = useState<"male" | "female">(AVATAR_UI_TEXT.defaultGender);
  const [signUpAvatar, setSignUpAvatar] = useState<string | undefined>(undefined);


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
      const { error } = await supabase.auth.resetPasswordForEmail(forgotPasswordEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
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
    
    if (!validateEmail(signInEmail, false)) {
      toast.error("Please enter a valid email address");
      return;
    }

    setIsLoading(true);

    try {
      await signIn(signInEmail, signInPassword);
      
      // Store remember me preference
      if (rememberMe) {
        localStorage.setItem('taskzm_remember_email', signInEmail);
      } else {
        localStorage.removeItem('taskzm_remember_email');
      }
      
      toast.success("Welcome back! 🎉");
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to sign in";

      // If invalid credentials, suggest signing up or forgot password
      if (
        errorMessage.toLowerCase().includes("invalid") ||
        errorMessage.toLowerCase().includes("credentials")
      ) {
        toast.error(
          "Invalid credentials. Forgot your password?",
          {
            duration: 6000,
            action: {
              label: AUTH_UI_TEXT.forgotPassword.title,
              onClick: () => {
                setForgotPasswordEmail(signInEmail);
                setShowForgotPasswordDialog(true);
              },
            },
          },
        );
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoSignIn = async () => {
    setIsLoading(true);
    // Create a demo account with timestamp to ensure uniqueness
    const demoEmail = `${DEMO_ACCOUNT_CONFIG.emailPrefix}${Date.now()}${DEMO_ACCOUNT_CONFIG.emailDomain}`;
    const demoPassword = DEMO_ACCOUNT_CONFIG.password;
    const demoName = DEMO_ACCOUNT_CONFIG.name;

    try {
      // First try to create the demo account - pass isDemo=true flag
      await signUp(demoEmail, demoPassword, demoName, true);
      toast.success(
        AUTH_UI_TEXT.demo.successMessage,
        {
          duration: AUTH_CONFIG.toastDuration,
        },
      );
    } catch (error) {
      console.error("Demo account creation error:", error);
      
      // Provide more specific error messages
      const userFriendlyMessage = getUserFriendlyErrorMessage(error, AUTH_UI_TEXT.demo.errorMessage);
      
      toast.error(userFriendlyMessage, {
        duration: AUTH_CONFIG.toastDuration * 1.5, // Show longer for errors
      });
    } finally {
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
      await signUp(signUpEmail, signUpPassword, signUpName, false, signUpAvatar);
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
        toast.error("Account already exists. Try signing in!", {
          duration: 5000,
          action: {
            label: "Sign In",
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
    const rememberedEmail = localStorage.getItem('taskzm_remember_email');
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
      className="min-h-screen w-full overflow-x-hidden relative flex items-start sm:items-center justify-center"
      style={{
        paddingTop: padding.vertical,
        paddingBottom: padding.bottom,
        paddingLeft: padding.horizontal,
        paddingRight: padding.horizontal,
      } as React.CSSProperties}
    >
      {/* Background Image with Overlay - Full viewport coverage */}
      <div className="fixed inset-0 z-0 w-screen h-screen">
        <ImageWithFallback
          src={AUTH_BACKGROUND_IMAGE.url}
          alt={AUTH_BACKGROUND_IMAGE.alt}
          className="w-full h-full object-cover"
        />
        {/* Gradient overlay for better readability and pastel tones */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#B4E4FF]/90 via-[#E0BBE4]/85 to-[#FFDAB9]/90 dark:from-gray-900/95 dark:via-purple-900/90 dark:to-gray-800/95" />

        {/* Animated accent circles - hidden on mobile */}
        <motion.div
          className="hidden md:block absolute top-20 left-20 w-96 h-96 bg-[#98D8C8]/30 rounded-full blur-3xl"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
        <motion.div
          className="hidden md:block absolute bottom-20 right-20 w-96 h-96 bg-[#DDA0DD]/30 rounded-full blur-3xl"
          animate={{
            scale: [1.2, 1, 1.2],
            opacity: [0.4, 0.6, 0.4],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      </div>

      {/* Main Content */}
      <motion.div
        className="relative z-10 w-full mx-auto"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        style={{
          maxWidth: card.maxWidth || '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '100vh',
        } as React.CSSProperties}
      >
        <div 
          className="flex flex-col items-center justify-center w-full"
          style={{
            maxHeight: '100vh',
            overflow: 'hidden',
          } as React.CSSProperties}
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
                  <TabsList className="w-full h-8 sm:h-9 md:h-10 p-1 gap-1 bg-muted rounded-lg flex items-center">
                    <TabsTrigger
                      value="signin"
                      className="flex-1 h-6 sm:h-7 md:h-8 px-2 sm:px-3 md:px-4 text-[11px] sm:text-xs md:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
                    >
                      {AUTH_UI_TEXT.signIn.title}
                    </TabsTrigger>
                    <TabsTrigger
                      value="signup"
                      className="flex-1 h-6 sm:h-7 md:h-8 px-2 sm:px-3 md:px-4 text-[11px] sm:text-xs md:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
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
                            height: screenSize === 'mobile' ? AUTH_SCREEN.mobile.button.height : screenSize === 'tablet' ? '2.5rem' : '2.75rem',
                            minHeight: screenSize === 'mobile' ? AUTH_SCREEN.mobile.button.height : screenSize === 'tablet' ? '2.5rem' : '2.75rem',
                            background: `linear-gradient(to right, ${AUTH_COLORS.primary}, ${AUTH_COLORS.secondary})`,
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
                            e.currentTarget.style.background = `linear-gradient(to right, ${AUTH_COLORS.primaryHover}, ${AUTH_COLORS.secondaryHover})`;
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = `linear-gradient(to right, ${AUTH_COLORS.primary}, ${AUTH_COLORS.secondary})`;
                          }}
                          disabled={isLoading}
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

                      {/* Divider */}
                      <div className="relative py-1.5 sm:py-2">
                        <div className="absolute inset-0 flex items-center">
                          <span className="w-full border-t border-gray-300 dark:border-border" />
                        </div>
                        <div className="relative flex justify-center text-[10px] sm:text-xs uppercase">
                          <span className="bg-card dark:bg-background px-2 text-muted-foreground">
                            {AUTH_UI_TEXT.or}
                          </span>
                        </div>
                      </div>

                      {/* Try Demo Button */}
                      <Button
                        type="button"
                        onClick={handleDemoSignIn}
                        variant="outline"
                        className="w-full border-2 border-primary text-primary hover:bg-primary/10 text-xs sm:text-sm"
                        style={{
                          height: screenSize === 'mobile' ? AUTH_SCREEN.mobile.button.height : screenSize === 'tablet' ? '2.5rem' : '2.75rem',
                          minHeight: screenSize === 'mobile' ? AUTH_SCREEN.mobile.button.height : screenSize === 'tablet' ? '2.5rem' : '2.75rem',
                        } as React.CSSProperties}
                        disabled={isLoading}
                      >
                        <Icon name="sparkles" size={ICON_SIZE_SM} weight="duotone" className="mr-2" />
                        {AUTH_UI_TEXT.demo.button}
                      </Button>
                    </motion.form>
                  </TabsContent>

                  <TabsContent value="signup" className="mt-0">
                    <motion.form
                      onSubmit={handleSignUp}
                      className="space-y-2.5 sm:space-y-3"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
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

                      {/* Gender Selection */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: PANEL_FIELD_SPACING }}>
                        <Label className="text-[11px] sm:text-xs text-gray-700 dark:text-gray-300">{AVATAR_UI_TEXT.selectGender}</Label>
                        <RadioGroup
                          value={signUpGender}
                          onValueChange={(value) => {
                            setSignUpGender(value as "male" | "female");
                            setSignUpAvatar(undefined); // Reset avatar when gender changes
                          }}
                          style={{ display: 'flex', gap: PANEL_GAP_MEDIUM }}
                        >
                          <div className="flex items-center" style={{ gap: PANEL_GAP_SMALL }}>
                            <RadioGroupItem value="male" id="gender-male" />
                            <Label htmlFor="gender-male" className="text-[11px] sm:text-xs cursor-pointer">
                              {AVATAR_UI_TEXT.male}
                            </Label>
                          </div>
                          <div className="flex items-center" style={{ gap: PANEL_GAP_SMALL }}>
                            <RadioGroupItem value="female" id="gender-female" />
                            <Label htmlFor="gender-female" className="text-[11px] sm:text-xs cursor-pointer">
                              {AVATAR_UI_TEXT.female}
                            </Label>
                          </div>
                        </RadioGroup>
                      </div>

                      {/* Avatar Selection */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: PANEL_FIELD_SPACING }}>
                        <Label className="text-[11px] sm:text-xs text-gray-700 dark:text-gray-300">{AVATAR_UI_TEXT.chooseYourAvatar}</Label>
                        <AvatarSelection
                          selectedAvatar={signUpAvatar}
                          gender={signUpGender}
                          onAvatarSelect={setSignUpAvatar}
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
                            height: screenSize === 'mobile' ? AUTH_SCREEN.mobile.button.height : screenSize === 'tablet' ? '2.5rem' : '2.75rem',
                            minHeight: screenSize === 'mobile' ? AUTH_SCREEN.mobile.button.height : screenSize === 'tablet' ? '2.5rem' : '2.75rem',
                            background: `linear-gradient(to right, ${AUTH_COLORS.primary}, ${AUTH_COLORS.secondary})`,
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
                            e.currentTarget.style.background = `linear-gradient(to right, ${AUTH_COLORS.primaryHover}, ${AUTH_COLORS.secondaryHover})`;
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = `linear-gradient(to right, ${AUTH_COLORS.primary}, ${AUTH_COLORS.secondary})`;
                          }}
                          disabled={isLoading}
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

                      {/* Info message */}
                      <div className="text-center text-[10px] sm:text-xs md:text-sm text-gray-600 dark:text-muted-foreground rounded-lg p-2 sm:p-3"
                        style={{
                          backgroundColor: AUTH_COLORS.card.tabs.from,
                        } as React.CSSProperties}
                      >
                        <span className="inline-flex items-center gap-1 flex-wrap justify-center">
                          <Icon 
                            name="sparkles" 
                            size={ICON_SIZE_MD} 
                            weight="duotone" 
                            className="flex-shrink-0" 
                            style={{ color: AUTH_COLORS.primary } as React.CSSProperties}
                          />
                          <span>Free forever • Pro features available • No credit card required</span>
                        </span>
                      </div>
                    </motion.form>
                  </TabsContent>
                  </CardContent>
                {/* App Store Badges */}
                <div 
                  className="pb-3 sm:pb-4 md:pb-5 pt-2 sm:pt-3 border-t border-gray-200/50 dark:border-border/50 flex-shrink-0 px-3 sm:px-4 md:px-6"
                >
                <p className="text-center text-[10px] sm:text-xs text-gray-500 dark:text-muted-foreground mb-2 sm:mb-3">
                  {AUTH_UI_TEXT.mobileApps.comingSoon}
                </p>
                <div className="flex items-center justify-center gap-2 sm:gap-3 md:gap-4 flex-wrap">
                  {/* App Store Badge */}
                  <motion.div
                    className="cursor-not-allowed opacity-70 hover:opacity-80 transition-opacity"
                    whileHover={{ scale: 1.02 }}
                    transition={{ duration: 0.2 }}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="120"
                      height="40"
                      viewBox="0 0 119.66407 40"
                      className="h-7 sm:h-8 md:h-10 w-auto"
                    >
                      <g>
                        <g>
                          <g>
                            <path
                              d="M110.13477,0H9.53468c-.3667,0-.729,0-1.09473.002-.30615.002-.60986.00781-.91895.0127A13.21476,13.21476,0,0,0,5.5171.19141a6.66509,6.66509,0,0,0-1.90088.627A6.43779,6.43779,0,0,0,1.99757,1.99707,6.25844,6.25844,0,0,0,.81935,3.61816a6.60119,6.60119,0,0,0-.625,1.90332,12.993,12.993,0,0,0-.1792,2.002C.00587,7.83008.00489,8.1377,0,8.44434V31.5586c.00489.3105.00587.6113.01515.9219a12.99232,12.99232,0,0,0,.1792,2.0019,6.58756,6.58756,0,0,0,.625,1.9043A6.20778,6.20778,0,0,0,1.99757,38.001a6.27445,6.27445,0,0,0,1.61865,1.1787,6.70082,6.70082,0,0,0,1.90088.6308,13.45514,13.45514,0,0,0,2.0039.1768c.30909.0068.6128.0107.91895.0107C8.80567,40,9.168,40,9.53468,40H110.13477c.3594,0,.7246,0,1.084-.002.3047,0,.6172-.0039.9219-.0107a13.279,13.279,0,0,0,2-.1768,6.80432,6.80432,0,0,0,1.9082-.6308,6.27742,6.27742,0,0,0,1.6172-1.1787,6.39482,6.39482,0,0,0,1.1816-1.6143,6.60413,6.60413,0,0,0,.6191-1.9043,13.50643,13.50643,0,0,0,.1856-2.0019c.0039-.3106.0039-.6114.0039-.9219.0078-.3633.0078-.7246.0078-1.0938V9.53613c0-.36621,0-.72949-.0078-1.09179,0-.30664,0-.61426-.0039-.9209a13.5071,13.5071,0,0,0-.1856-2.002,6.6177,6.6177,0,0,0-.6191-1.90332,6.46619,6.46619,0,0,0-2.7988-2.7998,6.76754,6.76754,0,0,0-1.9082-.627,13.04394,13.04394,0,0,0-2-.17676c-.3047-.00488-.6172-.01074-.9219-.01269-.3594-.002-.7246-.002-1.084-.002Z"
                              fill="#a6a6a6"
                            />
                            <path
                              d="M8.44483,39.125c-.30468,0-.602-.0039-.90429-.0107a12.68714,12.68714,0,0,1-1.86914-.1631,5.88381,5.88381,0,0,1-1.65674-.5479,5.40573,5.40573,0,0,1-1.397-1.0166,5.32082,5.32082,0,0,1-1.02051-1.3965,5.72186,5.72186,0,0,1-.543-1.6572,12.41351,12.41351,0,0,1-.1665-1.875c-.00634-.2109-.01464-.9131-.01464-.9131V8.44434S.88185,7.75293.8877,7.5498a12.37039,12.37039,0,0,1,.16553-1.87207,5.7555,5.7555,0,0,1,.54346-1.6621A5.37349,5.37349,0,0,1,2.61183,2.61768,5.56543,5.56543,0,0,1,4.01417,1.59521a5.82309,5.82309,0,0,1,1.65332-.54394A12.58589,12.58589,0,0,1,7.543.88721L8.44532.875H111.21387l.9131.0127a12.38493,12.38493,0,0,1,1.8584.16259,5.93833,5.93833,0,0,1,1.6709.54785,5.59374,5.59374,0,0,1,2.415,2.41993,5.76267,5.76267,0,0,1,.5352,1.64892,12.995,12.995,0,0,1,.1738,1.88721c.0029.2832.0029.5874.0029.89014.0079.375.0079.73193.0079,1.09179V30.4648c0,.3633,0,.7178-.0079,1.0752,0,.3252,0,.6231-.0039.9297a12.73126,12.73126,0,0,1-.1709,1.8535,5.739,5.739,0,0,1-.54,1.67,5.48029,5.48029,0,0,1-1.0156,1.3857,5.4129,5.4129,0,0,1-1.3994,1.0225,5.86168,5.86168,0,0,1-1.668.5498,12.54218,12.54218,0,0,1-1.8692.1631c-.2929.0068-.5996.0107-.8974.0107l-1.084.002Z"
                              fill="#000"
                            />
                          </g>
                          <g>
                            <g>
                              <g>
                                <path
                                  d="M24.76888,20.30068a4.94881,4.94881,0,0,1,2.35656-4.15206,5.06566,5.06566,0,0,0-3.99116-2.15768c-1.67924-.17626-3.30719,1.00483-4.1629,1.00483-.87227,0-2.18977-.98733-3.6085-.95814a5.31529,5.31529,0,0,0-4.47292,2.72787c-1.934,3.34842-.49141,8.26947,1.3612,10.97608.9269,1.32535,2.01018,2.8058,3.42763,2.7533,1.38706-.05753,1.9051-.88448,3.5794-.88448,1.65876,0,2.14479.88448,3.591.8511,1.48838-.02416,2.42613-1.33124,3.32051-2.66914a10.962,10.962,0,0,0,1.51842-3.09251A4.78205,4.78205,0,0,1,24.76888,20.30068Z"
                                  fill="#fff"
                                />
                                <path
                                  d="M22.03725,12.21089a4.87248,4.87248,0,0,0,1.11452-3.49062,4.95746,4.95746,0,0,0-3.20758,1.65961,4.63634,4.63634,0,0,0-1.14371,3.36139A4.09905,4.09905,0,0,0,22.03725,12.21089Z"
                                  fill="#fff"
                                />
                              </g>
                            </g>
                            <g>
                              <path
                                d="M42.30227,27.13965h-4.7334l-1.13672,3.35645H34.42727l4.4834-12.418h2.083l4.4834,12.418H43.438ZM38.0591,25.59082h3.752l-1.84961-5.44727h-.05176Z"
                                fill="#fff"
                              />
                              <path
                                d="M55.15969,25.96973c0,2.81348-1.50586,4.62109-3.77832,4.62109a3.0693,3.0693,0,0,1-2.84863-1.584h-.043v4.48438h-1.8584V21.44238H48.4302v1.50586h.03418a3.21162,3.21162,0,0,1,2.88281-1.60059C53.645,21.34766,55.15969,23.16406,55.15969,25.96973Zm-1.91016,0c0-1.833-.94727-3.03809-2.39258-3.03809-1.41992,0-2.375,1.23047-2.375,3.03809,0,1.82422.95508,3.0459,2.375,3.0459C52.30227,29.01563,53.24953,27.81934,53.24953,25.96973Z"
                                fill="#fff"
                              />
                              <path
                                d="M65.12453,25.96973c0,2.81348-1.50586,4.62109-3.77832,4.62109a3.0693,3.0693,0,0,1-2.84863-1.584h-.043v4.48438h-1.8584V21.44238H58.395v1.50586h.03418A3.21162,3.21162,0,0,1,61.312,21.34766C63.60988,21.34766,65.12453,23.16406,65.12453,25.96973Zm-1.91016,0c0-1.833-.94727-3.03809-2.39258-3.03809-1.41992,0-2.375,1.23047-2.375,3.03809,0,1.82422.95508,3.0459,2.375,3.0459C62.26711,29.01563,63.21438,27.81934,63.21438,25.96973Z"
                                fill="#fff"
                              />
                              <path
                                d="M71.71047,27.03613c.1377,1.23145,1.334,2.04,2.96875,2.04,1.56641,0,2.69336-.80859,2.69336-1.91895,0-.96387-.67969-1.541-2.28906-1.93652l-1.60937-.3877c-2.28027-.55078-3.33887-1.61719-3.33887-3.34766,0-2.14258,1.86719-3.61426,4.51855-3.61426,2.624,0,4.42285,1.47168,4.4834,3.61426h-1.876c-.1123-1.23926-1.13672-1.9873-2.63379-1.9873s-2.52148.75684-2.52148,1.8584c0,.87793.6543,1.39453,2.25488,1.79l1.36816.33594c2.54785.60254,3.60645,1.626,3.60645,3.44238,0,2.32324-1.85059,3.77832-4.79395,3.77832-2.75391,0-4.61328-1.4209-4.7334-3.667Z"
                                fill="#fff"
                              />
                              <path
                                d="M83.34621,19.2998v2.14258h1.72168v1.47168H83.34621v4.99121c0,.77539.34473,1.13672,1.10156,1.13672a5.80752,5.80752,0,0,0,.61133-.043v1.46289a5.10351,5.10351,0,0,1-1.03223.08594c-1.833,0-2.54785-.68848-2.54785-2.44434V22.91406H80.16262V21.44238H81.479V19.2998Z"
                                fill="#fff"
                              />
                              <path
                                d="M86.065,25.96973c0-2.84863,1.67773-4.63867,4.29395-4.63867,2.625,0,4.29492,1.79,4.29492,4.63867,0,2.85645-1.66113,4.63867-4.29492,4.63867C87.72609,30.6084,86.065,28.82617,86.065,25.96973Zm6.69531,0c0-1.9541-.89551-3.10742-2.40137-3.10742s-2.40039,1.16211-2.40039,3.10742c0,1.96191.89453,3.10645,2.40039,3.10645S92.76027,27.93164,92.76027,25.96973Z"
                                fill="#fff"
                              />
                              <path
                                d="M96.18606,21.44238h1.77246v1.541h.043a2.1594,2.1594,0,0,1,2.17773-1.63574,2.86616,2.86616,0,0,1,.63672.06934v1.73828a2.59794,2.59794,0,0,0-.835-.1123,1.87264,1.87264,0,0,0-1.93652,2.083v5.37012h-1.8584Z"
                                fill="#fff"
                              />
                              <path
                                d="M109.3843,27.83691c-.25,1.64355-1.85059,2.77148-3.89844,2.77148-2.63379,0-4.26855-1.76465-4.26855-4.5957,0-2.83984,1.64355-4.68164,4.19043-4.68164,2.50488,0,4.08008,1.7207,4.08008,4.46582v.63672h-6.39453v.1123a2.358,2.358,0,0,0,2.43555,2.56445,2.04834,2.04834,0,0,0,2.09082-1.27344Zm-6.28223-2.70215h4.52637a2.1773,2.1773,0,0,0-2.2207-2.29785A2.292,2.292,0,0,0,103.10207,25.13477Z"
                                fill="#fff"
                              />
                            </g>
                          </g>
                        </g>
                        <g>
                          <g>
                            <path
                              d="M37.82619,8.731a2.63964,2.63964,0,0,1,2.80762,2.96484c0,1.90625-1.03027,3.002-2.80762,3.002H35.67092V8.731Zm-1.22852,5.123h1.125a1.87588,1.87588,0,0,0,1.96777-2.146,1.881,1.881,0,0,0-1.96777-2.13379h-1.125Z"
                              fill="#fff"
                            />
                            <path
                              d="M41.68068,12.44434a2.13323,2.13323,0,1,1,4.24707,0,2.13358,2.13358,0,1,1-4.24707,0Zm3.333,0c0-.97607-.43848-1.54687-1.208-1.54687-.77246,0-1.207.5708-1.207,1.54688,0,.98389.43457,1.55029,1.207,1.55029C44.57522,13.99463,45.01369,13.42432,45.01369,12.44434Z"
                              fill="#fff"
                            />
                            <path
                              d="M51.57326,14.69775h-.92187l-.93066-3.31641h-.07031l-.92676,3.31641h-.91309l-1.24121-4.50293h.90137l.80664,3.436h.06641l.92578-3.436h.85254l.92578,3.436h.07031l.80273-3.436h.88867Z"
                              fill="#fff"
                            />
                            <path
                              d="M53.85354,10.19482H54.709v.71533h.06641a1.348,1.348,0,0,1,1.34375-.80225,1.46456,1.46456,0,0,1,1.55859,1.6748v2.915h-.88867V12.00586c0-.72363-.31445-1.0835-.97168-1.0835a1.03294,1.03294,0,0,0-1.0752,1.14111v2.63428h-.88867Z"
                              fill="#fff"
                            />
                            <path
                              d="M59.09377,8.437h.88867v6.26074h-.88867Z"
                              fill="#fff"
                            />
                            <path
                              d="M61.21779,12.44434a2.13346,2.13346,0,1,1,4.24756,0,2.1338,2.1338,0,1,1-4.24756,0Zm3.333,0c0-.97607-.43848-1.54687-1.208-1.54687-.77246,0-1.207.5708-1.207,1.54688,0,.98389.43457,1.55029,1.207,1.55029C64.11232,13.99463,64.5508,13.42432,64.5508,12.44434Z"
                              fill="#fff"
                            />
                            <path
                              d="M66.4009,13.42432c0-.81055.60352-1.27783,1.6748-1.34424l1.21973-.07031v-.38867c0-.47559-.31445-.74414-.92187-.74414-.49609,0-.83984.18213-.93848.50049h-.86035c.09082-.77344.81836-1.26953,1.83984-1.26953,1.12891,0,1.76563.562,1.76563,1.51318v3.07666h-.85547v-.63281h-.07031a1.515,1.515,0,0,1-1.35254.707A1.36026,1.36026,0,0,1,66.4009,13.42432Zm2.89453-.38477v-.37646l-1.09961.07031c-.62012.0415-.90137.25244-.90137.64941,0,.40527.35156.64111.835.64111A1.0615,1.0615,0,0,0,69.29543,13.03955Z"
                              fill="#fff"
                            />
                            <path
                              d="M71.34816,12.44434c0-1.42285.73145-2.32422,1.86914-2.32422a1.484,1.484,0,0,1,1.38086.79h.06641V8.437h.88867v6.26074h-.85156v-.71143h-.07031a1.56284,1.56284,0,0,1-1.41406.78564C72.0718,14.772,71.34816,13.87061,71.34816,12.44434Zm.918,0c0,.95508.4502,1.52979,1.20313,1.52979.749,0,1.21191-.583,1.21191-1.52588,0-.93848-.46777-1.52979-1.21191-1.52979C72.72121,10.91846,72.26613,11.49707,72.26613,12.44434Z"
                              fill="#fff"
                            />
                            <path
                              d="M79.23,12.44434a2.13323,2.13323,0,1,1,4.24707,0,2.13358,2.13358,0,1,1-4.24707,0Zm3.333,0c0-.97607-.43848-1.54687-1.208-1.54687-.77246,0-1.207.5708-1.207,1.54688,0,.98389.43457,1.55029,1.207,1.55029C82.12453,13.99463,82.563,13.42432,82.563,12.44434Z"
                              fill="#fff"
                            />
                            <path
                              d="M84.66945,10.19482h.85547v.71533h.06641a1.348,1.348,0,0,1,1.34375-.80225,1.46456,1.46456,0,0,1,1.55859,1.6748v2.915H87.605V12.00586c0-.72363-.31445-1.0835-.97168-1.0835a1.03294,1.03294,0,0,0-1.0752,1.14111v2.63428h-.88867Z"
                              fill="#fff"
                            />
                            <path
                              d="M93.51516,9.07373v1.1416h.97559v.74854h-.97559V13.2793c0,.47168.19434.67822.63672.67822a2.96657,2.96657,0,0,0,.33887-.02051v.74023a2.9155,2.9155,0,0,1-.4834.04541c-.98828,0-1.38184-.34766-1.38184-1.21582v-2.543h-.71484v-.74854h.71484V9.07373Z"
                              fill="#fff"
                            />
                            <path
                              d="M95.70461,8.437h.88086v2.48145h.07031a1.3856,1.3856,0,0,1,1.373-.80664,1.48339,1.48339,0,0,1,1.55078,1.67871v2.90723H98.69v-2.688c0-.71924-.335-1.0835-.96289-1.0835a1.05194,1.05194,0,0,0-1.13379,1.1416v2.62988h-.88867Z"
                              fill="#fff"
                            />
                            <path
                              d="M104.76125,13.48193a1.828,1.828,0,0,1-1.95117,1.30273A2.04531,2.04531,0,0,1,100.73,12.46045a2.07685,2.07685,0,0,1,2.07617-2.35254c1.25293,0,2.00879.856,2.00879,2.27V12.688h-3.17969v.0498a1.1902,1.1902,0,0,0,1.19922,1.29,1.07934,1.07934,0,0,0,1.07129-.5459Zm-3.126-1.45117h2.27441a1.08647,1.08647,0,0,0-1.1084-1.1665A1.15162,1.15162,0,0,0,101.63527,12.03076Z"
                              fill="#fff"
                            />
                          </g>
                        </g>
                      </g>
                    </svg>
                  </motion.div>

                  {/* Google Play Badge */}
                  <motion.div
                    className="cursor-not-allowed opacity-70 hover:opacity-80 transition-opacity"
                    whileHover={{ scale: 1.02 }}
                    transition={{ duration: 0.2 }}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="155"
                      height="40"
                      viewBox="0 0 155 40"
                      className="h-7 sm:h-8 md:h-10 w-auto"
                    >
                      {/* Outer border */}
                      <rect width="155" height="40" rx="6" fill="#a6a6a6" />
                      {/* Black background */}
                      <rect x="1" y="1" width="153" height="38" rx="5" fill="#000" />
                      
                      {/* Google Play Logo - Colorful triangular play button */}
                      <g transform="translate(10, 9)">
                        {/* Blue triangle (top-left) */}
                        <path d="M1.5 1.5L1.5 22.5L13.5 12L1.5 1.5Z" fill="#4285F4" />
                        {/* Green triangle (top-right) */}
                        <path d="M13.5 12L1.5 22.5L13.5 22.5L22.5 12L13.5 12Z" fill="#34A853" />
                        {/* Yellow triangle (bottom-right) */}
                        <path d="M13.5 12L22.5 12L13.5 1.5L13.5 12Z" fill="#FBBC04" />
                        {/* Red triangle (bottom-left) */}
                        <path d="M1.5 1.5L13.5 1.5L13.5 12L1.5 1.5Z" fill="#EA4335" />
                      </g>
                      
                      {/* Text: GET IT ON */}
                      <text
                        x="38"
                        y="15"
                        fontSize="7.5"
                        fill="#fff"
                        fontFamily="Roboto, Arial, sans-serif"
                        fontWeight="400"
                        letterSpacing="1"
                      >
                        GET IT ON
                      </text>
                      {/* Text: Google Play */}
                      <text
                        x="38"
                        y="28"
                        fontSize="10.5"
                        fill="#fff"
                        fontFamily="Roboto, Arial, sans-serif"
                        fontWeight="500"
                      >
                        Google Play
                      </text>
                    </svg>
                  </motion.div>
                </div>
              </div>
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
                  height: screenSize === 'mobile' ? AUTH_SCREEN.mobile.button.height : screenSize === 'tablet' ? '2.5rem' : '2.75rem',
                  minHeight: screenSize === 'mobile' ? AUTH_SCREEN.mobile.button.height : screenSize === 'tablet' ? '2.5rem' : '2.75rem',
                  background: `linear-gradient(to right, ${AUTH_COLORS.primary}, ${AUTH_COLORS.secondary})`,
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
                    e.currentTarget.style.background = `linear-gradient(to right, ${AUTH_COLORS.primaryHover}, ${AUTH_COLORS.secondaryHover})`;
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = `linear-gradient(to right, ${AUTH_COLORS.primary}, ${AUTH_COLORS.secondary})`;
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