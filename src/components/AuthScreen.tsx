import React, { useState } from "react";
import {
  CheckCircle2,
  Sparkles,
  Calendar,
  Clock,
  BarChart3,
  Users,
  Zap,
  Timer,
  Trophy,
  Tag,
  Eye,
  EyeOff,
  Mail,
  Lock,
  AlertCircle,
  CheckCircle,
  Brain,
  Repeat,
  Shield,
  Activity,
} from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Checkbox } from "./ui/checkbox";
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
import { toast } from "sonner";
import { motion } from "motion/react";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import { PrivacyPolicyDialog } from "./PrivacyPolicyDialog";
import { TermsOfServiceDialog } from "./TermsOfServiceDialog";
import taskzmLogo from "../assets/taskzm-logo.png";
import { supabase } from '../lib/supabase-client';

// Password strength calculation
function getPasswordStrength(password: string): { strength: 'weak' | 'medium' | 'strong'; score: number; feedback: string[] } {
  let score = 0;
  const feedback: string[] = [];

  if (password.length >= 8) score += 1;
  else feedback.push('At least 8 characters');

  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  else feedback.push('Mix of uppercase and lowercase');

  if (/\d/.test(password)) score += 1;
  else feedback.push('Include numbers');

  if (/[^a-zA-Z0-9]/.test(password)) score += 1;
  else feedback.push('Include special characters');

  if (password.length >= 12) score += 1;

  let strength: 'weak' | 'medium' | 'strong' = 'weak';
  if (score >= 4) strength = 'strong';
  else if (score >= 2) strength = 'medium';

  return { strength, score, feedback };
}

interface FeatureCard {
  icon: typeof Calendar;
  title: string;
  subtitle: string;
}

const MARKETING_FEATURES: FeatureCard[] = [
  { icon: Calendar, title: "7-Day Kanban", subtitle: "Visual weekly planning" },
  { icon: Calendar, title: "Month Planner", subtitle: "Zoomed-out focus" },
  { icon: Clock, title: "Time Blocking", subtitle: "Smart agenda view" },
  { icon: Zap, title: "AI Scheduler", subtitle: "Smart planning in seconds" },
  { icon: Brain, title: "AI Insights", subtitle: "Weekly summaries" },
  { icon: BarChart3, title: "Analytics", subtitle: "Trends & tracking" },
  { icon: Timer, title: "Pomodoro + Stats", subtitle: "Deep work focus" },
  { icon: Users, title: "Team Collaboration", subtitle: "Unlimited members" },
  { icon: Tag, title: "Folders + Tags", subtitle: "Organize everything" },
  { icon: Trophy, title: "23 Awards", subtitle: "Motivational streaks" },
  { icon: Sparkles, title: "Smart Templates", subtitle: "Reusable flows" },
  { icon: Repeat, title: "Recurring Tasks", subtitle: "Automation built-in" },
  { icon: Shield, title: "Privacy-first", subtitle: "Encrypted & secure" },
  { icon: Activity, title: "Live Sync", subtitle: "Realtime updates" },
];

export function AuthScreen() {
  const { signIn, signUp } = useAuth();
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

  // Password strength
  const passwordStrength = getPasswordStrength(signUpPassword);
  const passwordsMatch = signUpPassword && signUpConfirmPassword && signUpPassword === signUpConfirmPassword;

  // Email validation
  const validateEmail = (email: string, isSignUp: boolean = false): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      if (isSignUp) {
        setEmailError("Please enter a valid email address");
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
      toast.error("Please enter your email address");
      return;
    }

    if (!validateEmail(forgotPasswordEmail, false)) {
      toast.error("Please enter a valid email address");
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

      toast.success("Password reset email sent! Check your inbox.", {
        duration: 5000,
      });
      setShowForgotPasswordDialog(false);
      setForgotPasswordEmail("");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to send reset email";
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
              label: "Reset Password",
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
    const demoEmail = `demo_${Date.now()}@taskzm.app`;
    const demoPassword = "demo123456";
    const demoName = "Demo User";

    try {
      // First try to create the demo account - pass isDemo=true flag
      await signUp(demoEmail, demoPassword, demoName, true);
      toast.success(
        "🎉 Demo account created! Explore TaskZM!",
        {
          duration: 4000,
        },
      );
    } catch (error) {
      console.error("Demo account creation error:", error);
      toast.error(
        "Failed to create demo account. Please try signing up manually.",
      );
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
      toast.error("Please accept the Terms of Service and Privacy Policy");
      return;
    }

    if (signUpPassword !== signUpConfirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (signUpPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    if (passwordStrength.strength === 'weak' && signUpPassword.length < 8) {
      toast.error("Password is too weak. Please use a stronger password.");
      return;
    }

    setIsLoading(true);

    try {
      await signUp(signUpEmail, signUpPassword, signUpName);
      toast.success(
        "🎉 Welcome to TaskZM! Your account is ready!",
        {
          duration: 4000,
        },
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to create account";

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

  return (
    <div className="min-h-screen relative flex items-center justify-center overflow-y-auto lg:overflow-hidden">
      {/* Background Image with Overlay */}
      <div className="absolute inset-0 z-0">
        <ImageWithFallback
          src="https://images.unsplash.com/photo-1544654262-e295983be0f4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtaW5pbWFsaXN0JTIwZGVzayUyMG9yZ2FuaXplZHxlbnwxfHx8fDE3NjE2MTM4MDh8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral"
          alt="Minimalist organized workspace background"
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
        className="relative z-10 w-full max-w-7xl mx-auto px-3 py-4 sm:px-4 sm:py-6 lg:py-8"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <div className="flex flex-col-reverse lg:grid lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8 items-start lg:items-center">
          {/* Left Side - Branding & Features */}
          <motion.div
            className="order-2 lg:order-1 text-center lg:text-left space-y-2.5 sm:space-y-3 w-full"
            variants={itemVariants}
          >
            <motion.div className="space-y-2 sm:space-y-2.5" variants={logoVariants}>
              <motion.div
                className="inline-flex items-center gap-1 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm px-2 py-0.5 sm:py-1 rounded-full shadow border border-white/50"
                whileHover={{ scale: 1.05 }}
              >
                <Sparkles className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-[#7B68EE]" />
                <span className="text-[9px] sm:text-[10px] md:text-xs text-gray-700 dark:text-gray-200">
                  Neurodivergent-friendly workflow
                </span>
              </motion.div>

              <div className="flex flex-col items-center lg:items-start gap-1">
                <motion.img
                  src={taskzmLogo}
                  alt="TaskZM Logo"
                  className="w-[100px] sm:w-[130px] md:w-[160px] lg:w-[180px]"
                  whileHover={{ scale: 1.02 }}
                />
                <p className="text-[11px] sm:text-xs md:text-sm text-gray-700 dark:text-gray-200 text-center lg:text-left px-2 sm:px-0 max-w-md">
                  Your calm, organized task companion—free forever, upgrade when you need more.
                </p>
              </div>
            </motion.div>

            <motion.div
              className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-md rounded-xl border-2 border-white/70 dark:border-gray-700/50 px-3 py-3 sm:px-4 sm:py-4 shadow-xl"
              variants={itemVariants}
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3 text-left">
                <div>
                  <p className="text-[10px] sm:text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
                    Everything you need
                  </p>
                  <h3 className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-gray-100">
                    14 smart features included
                  </h3>
                </div>
                <Badge className="self-start sm:self-auto bg-[#D4C5F9] text-gray-800 border-0 text-[9px] sm:text-[10px] px-2 py-0.5">No credit card</Badge>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 gap-1.5 sm:gap-2">
                {MARKETING_FEATURES.map(({ icon: Icon, title, subtitle }) => (
                  <motion.div
                    key={title}
                    className="flex items-center gap-1 bg-white dark:bg-gray-800/80 border border-gray-200/80 dark:border-gray-700/60 rounded-md px-1.5 py-1.5 sm:px-2 sm:py-1.5 shadow-sm hover:shadow transition-shadow"
                    whileHover={{ scale: 1.03, y: -1 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="w-5 h-5 sm:w-6 sm:h-6 bg-gradient-to-br from-[#B4E4FF] to-[#D4C5F9] rounded flex items-center justify-center flex-shrink-0 shadow-sm">
                      <Icon className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-white" />
                    </div>
                    <div className="min-w-0 flex-1 text-left">
                      <h3 className="text-[9px] sm:text-[10px] text-gray-900 dark:text-white font-medium leading-tight truncate">
                        {title}
                      </h3>
                      <p className="text-[8px] sm:text-[9px] text-gray-600 dark:text-gray-400 leading-tight truncate">
                        {subtitle}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </motion.div>

          {/* Right Side - Auth Card */}
          <motion.div
            variants={cardVariants}
            className="order-1 lg:order-2 flex items-center justify-center w-full"
          >
            <Card className="w-full max-w-lg sm:max-w-md shadow-2xl border border-white/60 backdrop-blur-xl bg-white/95 dark:bg-gray-900/95 max-h-[90vh] lg:max-h-none overflow-y-auto lg:overflow-visible">
              <Tabs
                value={activeTab}
                onValueChange={setActiveTab}
                className="w-full"
              >
                <CardHeader className="space-y-2 pb-3 sm:pb-4 px-4 sm:px-6 pt-4 sm:pt-6">
                  <CardTitle className="text-center text-base sm:text-lg">
                    <motion.div
                      className="inline-flex items-center gap-1.5 sm:gap-2"
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: 0.4 }}
                    >
                      <motion.div
                        animate={{
                          rotate: [0, 10, -10, 0],
                        }}
                        transition={{
                          duration: 2,
                          repeat: Infinity,
                          ease: "easeInOut",
                        }}
                      >
                        👋
                      </motion.div>
                      <span>Welcome to TaskZM!</span>
                    </motion.div>
                  </CardTitle>
                  <CardDescription className="text-center text-[11px] sm:text-xs px-2 sm:px-0">
                    {activeTab === "signin" ? (
                      <motion.span
                        key="signin-desc"
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                      >
                        Sign in to access your personalized task
                        dashboard
                      </motion.span>
                    ) : (
                      <motion.span
                        key="signup-desc"
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                      >
                        Create your free account and start
                        organizing today
                      </motion.span>
                    )}
                  </CardDescription>
                  <TabsList className="!flex w-full !h-10 sm:!h-12 md:!h-14 !p-1 !gap-1 sm:!gap-1.5 bg-gradient-to-r from-[#E8F5F1] to-[#F3E8FF] dark:from-gray-800 dark:to-purple-900/50 !rounded-lg">
                    <TabsTrigger
                      value="signin"
                      className="!flex-1 !h-auto !py-2 sm:!py-2.5 md:!py-3 !px-2 sm:!px-3 md:!px-4 text-[11px] sm:text-xs md:text-sm"
                    >
                      Sign In
                    </TabsTrigger>
                    <TabsTrigger
                      value="signup"
                      className="!flex-1 !h-auto !py-2 sm:!py-2.5 md:!py-3 !px-2 sm:!px-3 md:!px-4 text-[11px] sm:text-xs md:text-sm"
                    >
                      Sign Up
                    </TabsTrigger>
                  </TabsList>
                </CardHeader>

                <CardContent className="pb-4 sm:pb-5 pt-2 px-4 sm:px-6">
                  <TabsContent value="signin" className="mt-0">
                    <motion.form
                      onSubmit={handleSignIn}
                      className="space-y-2.5 sm:space-y-3"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <div className="space-y-1 sm:space-y-1.5">
                        <Label htmlFor="signin-email" className="text-xs sm:text-sm">
                          Email
                        </Label>
                        <div className="relative">
                          <Input
                            id="signin-email"
                            type="email"
                            placeholder="you@example.com"
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
                            className="border-2 focus:border-[#7B68EE] transition-colors h-9 sm:h-10 text-sm bg-white dark:bg-gray-800 shadow-sm pr-10"
                          />
                          <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        </div>
                      </div>

                      <div className="space-y-1 sm:space-y-1.5">
                        <div className="flex items-center justify-between">
                          <Label
                            htmlFor="signin-password"
                            className="text-xs sm:text-sm"
                          >
                            Password
                          </Label>
                          <button
                            type="button"
                            onClick={() => setShowForgotPasswordDialog(true)}
                            className="text-[10px] sm:text-xs text-[#7B68EE] hover:text-[#6A5ACD] transition-colors"
                          >
                            Forgot password?
                          </button>
                        </div>
                        <div className="relative">
                          <Input
                            id="signin-password"
                            type={showSignInPassword ? "text" : "password"}
                            placeholder="••••••••"
                            value={signInPassword}
                            onChange={(e) =>
                              setSignInPassword(e.target.value)
                            }
                            required
                            className="border-2 focus:border-[#7B68EE] transition-colors h-9 sm:h-10 text-sm bg-white dark:bg-gray-800 shadow-sm pr-10"
                          />
                          <button
                            type="button"
                            onClick={() => setShowSignInPassword(!showSignInPassword)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                            aria-label={showSignInPassword ? "Hide password" : "Show password"}
                          >
                            {showSignInPassword ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Remember Me */}
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="remember-me"
                          checked={rememberMe}
                          onCheckedChange={(checked) => setRememberMe(checked === true)}
                        />
                        <Label
                          htmlFor="remember-me"
                          className="text-[10px] sm:text-xs text-gray-600 dark:text-gray-400 cursor-pointer"
                        >
                          Remember me
                        </Label>
                      </div>

                      <motion.div
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.98 }}
                        className="pt-0.5 sm:pt-1"
                      >
                        <Button
                          type="submit"
                          className="w-full h-10 sm:h-11 bg-gradient-to-r from-[#7B68EE] to-[#DDA0DD] hover:from-[#6A5ACD] hover:to-[#DA70D6] shadow-lg text-xs sm:text-sm"
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
                            "Sign In"
                          )}
                        </Button>
                      </motion.div>

                      {/* Divider */}
                      <div className="relative py-1.5 sm:py-2">
                        <div className="absolute inset-0 flex items-center">
                          <span className="w-full border-t border-gray-300 dark:border-gray-600" />
                        </div>
                        <div className="relative flex justify-center text-[10px] sm:text-xs uppercase">
                          <span className="bg-white dark:bg-gray-900 px-2 text-gray-500">
                            Or
                          </span>
                        </div>
                      </div>

                      {/* Try Demo Button */}
                      <motion.div
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <Button
                          type="button"
                          onClick={handleDemoSignIn}
                          variant="outline"
                          className="w-full h-10 sm:h-11 border-2 border-[#7B68EE] text-[#7B68EE] hover:bg-[#7B68EE]/10 text-xs sm:text-sm"
                          disabled={isLoading}
                        >
                          <Sparkles className="mr-1.5 sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
                          Try Demo Account
                        </Button>
                      </motion.div>
                    </motion.form>
                  </TabsContent>

                  <TabsContent value="signup" className="mt-0">
                    <motion.form
                      onSubmit={handleSignUp}
                      className="space-y-2.5 sm:space-y-3"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <div className="space-y-1 sm:space-y-1.5">
                        <Label
                          htmlFor="signup-name"
                          className="text-xs sm:text-sm"
                        >
                          Name
                        </Label>
                        <Input
                          id="signup-name"
                          type="text"
                          placeholder="Your Name"
                          value={signUpName}
                          onChange={(e) =>
                            setSignUpName(e.target.value)
                          }
                          required
                          className="border-2 focus:border-[#7B68EE] transition-colors h-9 sm:h-10 text-sm bg-white/95 dark:bg-gray-800/95"
                        />
                      </div>

                      <div className="space-y-1 sm:space-y-1.5">
                        <Label
                          htmlFor="signup-email"
                          className="text-xs sm:text-sm"
                        >
                          Email
                        </Label>
                        <div className="relative">
                          <Input
                            id="signup-email"
                            type="email"
                            placeholder="you@example.com"
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
                            className={`border-2 focus:border-[#7B68EE] transition-colors h-9 sm:h-10 text-sm bg-white/95 dark:bg-gray-800/95 pr-10 ${
                              emailError ? 'border-red-500' : ''
                            }`}
                          />
                          <div className="absolute right-2 top-1/2 -translate-y-1/2">
                            {signUpEmail && (
                              emailError ? (
                                <AlertCircle className="w-4 h-4 text-red-500" />
                              ) : (
                                <CheckCircle className="w-4 h-4 text-green-500" />
                              )
                            )}
                          </div>
                        </div>
                        {emailError && (
                          <p className="text-[10px] text-red-500 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            {emailError}
                          </p>
                        )}
                      </div>

                      <div className="space-y-1 sm:space-y-1.5">
                        <Label
                          htmlFor="signup-password"
                          className="text-xs sm:text-sm"
                        >
                          Password
                        </Label>
                        <div className="relative">
                          <Input
                            id="signup-password"
                            type={showSignUpPassword ? "text" : "password"}
                            placeholder="••••••••"
                            value={signUpPassword}
                            onChange={(e) =>
                              setSignUpPassword(e.target.value)
                            }
                            required
                            className="border-2 focus:border-[#7B68EE] transition-colors h-9 sm:h-10 text-sm bg-white dark:bg-gray-800 shadow-sm pr-10"
                          />
                          <button
                            type="button"
                            onClick={() => setShowSignUpPassword(!showSignUpPassword)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                            aria-label={showSignUpPassword ? "Hide password" : "Show password"}
                          >
                            {showSignUpPassword ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                        {/* Password Strength Indicator */}
                        {signUpPassword && (
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
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
                              <span className={`text-[10px] font-medium ${
                                passwordStrength.strength === 'weak'
                                  ? 'text-red-500'
                                  : passwordStrength.strength === 'medium'
                                  ? 'text-yellow-500'
                                  : 'text-green-500'
                              }`}>
                                {passwordStrength.strength.toUpperCase()}
                              </span>
                            </div>
                            {passwordStrength.feedback.length > 0 && passwordStrength.strength !== 'strong' && (
                              <ul className="text-[10px] text-gray-600 dark:text-gray-400 space-y-0.5">
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

                      <div className="space-y-1 sm:space-y-1.5">
                        <Label
                          htmlFor="signup-confirm-password"
                          className="text-xs sm:text-sm"
                        >
                          Confirm Password
                        </Label>
                        <div className="relative">
                          <Input
                            id="signup-confirm-password"
                            type={showConfirmPassword ? "text" : "password"}
                            placeholder="••••••••"
                            value={signUpConfirmPassword}
                            onChange={(e) =>
                              setSignUpConfirmPassword(
                                e.target.value,
                              )
                            }
                            required
                            className={`border-2 focus:border-[#7B68EE] transition-colors h-9 sm:h-10 text-sm bg-white/95 dark:bg-gray-800/95 pr-10 ${
                              signUpConfirmPassword && !passwordsMatch ? 'border-red-500' : ''
                            } ${
                              signUpConfirmPassword && passwordsMatch ? 'border-green-500' : ''
                            }`}
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                            aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                          >
                            {showConfirmPassword ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                        {signUpConfirmPassword && (
                          <p className={`text-[10px] flex items-center gap-1 ${
                            passwordsMatch ? 'text-green-500' : 'text-red-500'
                          }`}>
                            {passwordsMatch ? (
                              <>
                                <CheckCircle className="w-3 h-3" />
                                Passwords match
                              </>
                            ) : (
                              <>
                                <AlertCircle className="w-3 h-3" />
                                Passwords do not match
                              </>
                            )}
                          </p>
                        )}
                      </div>

                      {/* Terms and Privacy */}
                      <div className="flex items-start space-x-2 pt-1">
                        <Checkbox
                          id="accept-terms"
                          checked={acceptedTerms}
                          onCheckedChange={(checked) => setAcceptedTerms(checked === true)}
                          className="mt-0.5"
                        />
                        <Label
                          htmlFor="accept-terms"
                          className="text-[10px] sm:text-xs text-gray-600 dark:text-gray-400 cursor-pointer leading-tight"
                        >
                          I agree to the{" "}
                          <button
                            type="button"
                            onClick={() => setShowTermsDialog(true)}
                            className="text-[#7B68EE] hover:text-[#6A5ACD] underline"
                          >
                            Terms of Service
                          </button>
                          {" "}and{" "}
                          <button
                            type="button"
                            onClick={() => setShowPrivacyDialog(true)}
                            className="text-[#7B68EE] hover:text-[#6A5ACD] underline"
                          >
                            Privacy Policy
                          </button>
                        </Label>
                      </div>

                      <motion.div
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.98 }}
                        className="pt-0.5 sm:pt-1"
                      >
                        <Button
                          type="submit"
                          className="w-full h-10 sm:h-11 bg-gradient-to-r from-[#7B68EE] to-[#DDA0DD] hover:from-[#6A5ACD] hover:to-[#DA70D6] shadow-lg text-xs sm:text-sm"
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
                            "Create Account"
                          )}
                        </Button>
                      </motion.div>

                      {/* Info message */}
                      <div className="text-center text-[10px] sm:text-xs md:text-sm text-gray-600 dark:text-gray-400 bg-[#E8F5F1] dark:bg-gray-800 rounded-lg p-2 sm:p-3">
                        <span className="inline-flex items-center gap-1 flex-wrap justify-center">
                          <Sparkles className="h-3 w-3 sm:h-4 sm:w-4 text-[#7B68EE] flex-shrink-0" />
                          <span>Free forever • Pro features available • No credit card required</span>
                        </span>
                      </div>
                    </motion.form>
                  </TabsContent>
                </CardContent>
              </Tabs>
              
              {/* App Store Badges */}
              <div className="px-4 sm:px-6 pb-4 sm:pb-5 pt-2 border-t border-gray-200/50 dark:border-gray-700/50">
                <p className="text-center text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 mb-2 sm:mb-3">
                  Mobile apps coming soon
                </p>
                <div className="flex items-center justify-center gap-2 sm:gap-3">
                  {/* App Store Badge */}
                  <motion.div
                    className="flex items-center gap-1.5 bg-black dark:bg-gray-800 rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 cursor-not-allowed opacity-60"
                    whileHover={{ scale: 1.02 }}
                    transition={{ duration: 0.2 }}
                  >
                    <svg
                      className="w-4 h-4 sm:w-5 sm:h-5"
                      viewBox="0 0 24 24"
                      fill="white"
                    >
                      <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C1.79 15.25 2.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
                    </svg>
                    <div className="flex flex-col">
                      <span className="text-[8px] sm:text-[9px] text-white/70 leading-tight">Download on the</span>
                      <span className="text-[10px] sm:text-xs font-semibold text-white leading-tight">App Store</span>
                    </div>
                  </motion.div>

                  {/* Google Play Badge */}
                  <motion.div
                    className="flex items-center gap-1.5 bg-black dark:bg-gray-800 rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 cursor-not-allowed opacity-60"
                    whileHover={{ scale: 1.02 }}
                    transition={{ duration: 0.2 }}
                  >
                    <svg
                      className="w-4 h-4 sm:w-5 sm:h-5"
                      viewBox="0 0 24 24"
                      fill="white"
                    >
                      <path d="M3,20.5V3.5C3,2.91 3.34,2.39 3.84,2.15L13.69,12L3.84,21.85C3.34,21.6 3,21.09 3,20.5M16.81,15.12L6.05,21.34L14.54,12.85L16.81,15.12M20.16,10.81C20.5,11.08 20.75,11.5 20.75,12C20.75,12.5 20.5,12.92 20.16,13.19L17.25,14.5L13.69,12L17.25,9.5L20.16,10.81M6.05,2.66L16.81,8.88L14.54,11.15L6.05,2.66Z" />
                    </svg>
                    <div className="flex flex-col">
                      <span className="text-[8px] sm:text-[9px] text-white/70 leading-tight">Get it on</span>
                      <span className="text-[10px] sm:text-xs font-semibold text-white leading-tight">Google Play</span>
                    </div>
                  </motion.div>
                </div>
              </div>
            </Card>
          </motion.div>
        </div>
      </motion.div>

      {/* Forgot Password Dialog */}
      <Dialog open={showForgotPasswordDialog} onOpenChange={setShowForgotPasswordDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-[#7B68EE]" />
              Reset Password
            </DialogTitle>
            <DialogDescription>
              Enter your email address and we'll send you a link to reset your password.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reset-email">Email</Label>
              <div className="relative">
                <Input
                  id="reset-email"
                  type="email"
                  placeholder="you@example.com"
                  value={forgotPasswordEmail}
                  onChange={(e) => setForgotPasswordEmail(e.target.value)}
                  required
                  className="pr-10"
                />
                <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
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
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSendingReset || !forgotPasswordEmail}
                className="bg-gradient-to-r from-[#7B68EE] to-[#DDA0DD] hover:from-[#6A5ACD] hover:to-[#DA70D6]"
              >
                {isSendingReset ? "Sending..." : "Send Reset Link"}
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