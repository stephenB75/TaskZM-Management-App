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
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Checkbox } from "./ui/checkbox";
import { Switch } from "./ui/switch";
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

  // Features Carousel State
  const [currentFeatureIndex, setCurrentFeatureIndex] = useState(0);
  const featuresPerPage = 6; // 2 rows x 3 columns for both mobile and desktop

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

  // Auto-scroll carousel
  React.useEffect(() => {
    const totalPages = Math.ceil(MARKETING_FEATURES.length / featuresPerPage);
    if (MARKETING_FEATURES.length <= featuresPerPage) return;
    
    const interval = setInterval(() => {
      setCurrentFeatureIndex((prev) =>
        prev === totalPages - 1 ? 0 : prev + 1
      );
    }, 4000); // Change slide every 4 seconds

    return () => clearInterval(interval);
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
    <div className="min-h-screen relative flex items-start lg:items-center justify-center py-4 sm:py-6 lg:py-0">
      {/* Background Image with Overlay */}
      <div className="fixed inset-0 z-0">
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
        className="relative z-10 w-full max-w-7xl mx-auto px-3 py-3 sm:px-4 sm:py-4 lg:py-6"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <div className="flex flex-col-reverse lg:grid lg:grid-cols-2 gap-3 sm:gap-4 lg:gap-6 items-start lg:items-stretch">
          {/* Left Side - Branding & Features */}
          <motion.div
            className="order-2 lg:order-1 text-center w-full lg:flex lg:flex-col lg:justify-center lg:h-full"
            variants={itemVariants}
          >
            {/* Branding Section */}
            <motion.div className="space-y-1.5 sm:space-y-2 flex flex-col items-center mb-2 sm:mb-2.5 lg:mb-3 lg:flex-shrink-0" variants={logoVariants}>
              <motion.div
                className="inline-flex items-center gap-1 bg-white/70 dark:bg-gray-900/70 backdrop-blur-sm px-1.5 py-0.5 rounded-full shadow-sm border border-white/50"
                whileHover={{ scale: 1.05 }}
              >
                <Sparkles className="w-2 h-2 sm:w-2.5 sm:h-2.5 text-[#7B68EE]" />
                <span className="text-[8px] sm:text-[9px] text-gray-700 dark:text-gray-200">
                  Neurodivergent-friendly
                </span>
              </motion.div>

              <div className="flex flex-col items-center gap-0.5">
                <motion.img
                  src={taskzmLogo}
                  alt="TaskZM Logo"
                  className="w-[80px] sm:w-[100px] md:w-[140px] lg:w-[160px]"
                  whileHover={{ scale: 1.02 }}
                />
                <p className="text-[9px] sm:text-[10px] text-gray-700 dark:text-gray-200 text-center px-2 sm:px-0 max-w-md">
                  Your calm, organized task companion
                </p>
              </div>
            </motion.div>

            {/* Features Carousel - Half height on desktop */}
            <motion.div
              className="space-y-2 lg:flex-1 lg:flex lg:flex-col lg:max-h-[280px] lg:min-h-0"
              variants={itemVariants}
            >
              {/* Header with Controls */}
              <div className="flex items-center justify-between gap-2 lg:flex-shrink-0">
                <h3 className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-gray-100">
                  14 Smart Features
                </h3>
                {/* Navigation Controls */}
                {MARKETING_FEATURES.length > featuresPerPage && (
                  <div className="flex items-center gap-0.5">
                    <button
                      onClick={() => {
                        setCurrentFeatureIndex((prev) => {
                          const totalPages = Math.ceil(MARKETING_FEATURES.length / featuresPerPage);
                          return prev === 0 ? totalPages - 1 : prev - 1;
                        });
                      }}
                      className="p-1 hover:bg-gray-100/80 dark:hover:bg-gray-800/80 rounded-full transition-all hover:scale-110"
                      aria-label="Previous features"
                    >
                      <ChevronLeft className="w-3.5 h-3.5 text-gray-600 dark:text-gray-400" />
                    </button>
                    <button
                      onClick={() => {
                        setCurrentFeatureIndex((prev) => {
                          const totalPages = Math.ceil(MARKETING_FEATURES.length / featuresPerPage);
                          return prev === totalPages - 1 ? 0 : prev + 1;
                        });
                      }}
                      className="p-1 hover:bg-gray-100/80 dark:hover:bg-gray-800/80 rounded-full transition-all hover:scale-110"
                      aria-label="Next features"
                    >
                      <ChevronRight className="w-3.5 h-3.5 text-gray-600 dark:text-gray-400" />
                    </button>
                  </div>
                )}
              </div>

              {/* Carousel Container with Gradient Fade - Half height on desktop */}
              <div className="relative overflow-hidden rounded-lg lg:flex-1 lg:min-h-0">
                {/* Gradient Fade Edges */}
                <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-white dark:from-gray-900 to-transparent z-10 pointer-events-none" />
                <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white dark:from-gray-900 to-transparent z-10 pointer-events-none" />
                
                <div className="overflow-hidden min-h-[75px] sm:min-h-[85px] lg:h-full lg:flex lg:items-center">
                  <motion.div
                    className="flex"
                    animate={{
                      x: `-${currentFeatureIndex * 100}%`,
                    }}
                    transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
                  >
                    {/* 3 columns (6 features per page) for both mobile and desktop */}
                    {Array.from({ length: Math.ceil(MARKETING_FEATURES.length / featuresPerPage) }).map((_, pageIndex) => {
                      const startIdx = pageIndex * featuresPerPage;
                      const endIdx = startIdx + featuresPerPage;
                      const pageFeatures = MARKETING_FEATURES.slice(startIdx, endIdx);
                      
                      return (
                        <div
                          key={pageIndex}
                          className="grid grid-cols-3 gap-x-2.5 sm:gap-x-3 gap-y-2.5 sm:gap-y-3 min-w-full flex-shrink-0 px-1"
                        >
                          {pageFeatures.map(({ icon: Icon, title }) => (
                            <motion.div
                              key={title}
                              className="flex flex-col items-center gap-1.5 text-center group"
                              whileHover={{ scale: 1.08, y: -2 }}
                              transition={{ duration: 0.2 }}
                            >
                            <div className="relative">
                              <div className="w-7 h-7 sm:w-8 sm:h-8 bg-gradient-to-br from-[#7B68EE] via-[#9B7EE8] to-[#D4C5F9] rounded-full flex items-center justify-center shadow-lg group-hover:shadow-xl transition-shadow border-2 border-white/60 dark:border-gray-700/50">
                                <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white drop-shadow-lg" />
                              </div>
                              {/* Glow effect on hover */}
                              <div className="absolute inset-0 bg-gradient-to-br from-[#7B68EE]/30 to-[#D4C5F9]/30 rounded-full blur-md opacity-0 group-hover:opacity-100 transition-opacity -z-10" />
                            </div>
                            <span className="text-[9px] sm:text-[10px] md:text-xs text-gray-900 dark:text-white font-semibold leading-tight px-0.5">
                              {title}
                            </span>
                            </motion.div>
                          ))}
                        </div>
                      );
                    })}
                  </motion.div>
                </div>
                
                {/* Enhanced Dots Indicator - Smaller on Mobile */}
                {(() => {
                  const totalPages = Math.ceil(MARKETING_FEATURES.length / featuresPerPage);
                  
                  if (totalPages <= 1) return null;
                  
                  return (
                    <div className="flex items-center justify-center gap-0.5 lg:gap-1 pt-1.5 lg:pt-2 lg:flex-shrink-0">
                      {Array.from({ length: totalPages }).map((_, index) => (
                        <button
                          key={index}
                          onClick={() => setCurrentFeatureIndex(index)}
                          className={`rounded-full transition-all duration-300 ${
                            index === currentFeatureIndex
                              ? "w-1.5 h-0.5 lg:w-3 lg:h-1 bg-gradient-to-r from-[#7B68EE] to-[#D4C5F9]"
                              : "w-0.5 h-0.5 lg:w-1 lg:h-1 bg-gray-400/40 dark:bg-gray-500/40 hover:bg-gray-500/60 dark:hover:bg-gray-400/60"
                          }`}
                          aria-label={`Go to page ${index + 1}`}
                        />
                      ))}
                    </div>
                  );
                })()}
              </div>
            </motion.div>
          </motion.div>

          {/* Right Side - Auth Card */}
          <motion.div
            variants={cardVariants}
            className="order-1 lg:order-2 flex items-center justify-center w-full"
          >
            <Card className="w-full max-w-lg sm:max-w-md shadow-2xl border border-white/60 backdrop-blur-xl bg-gradient-to-br from-[#B4E4FF]/85 via-[#E0BBE4]/80 to-[#FFDAB9]/85 dark:from-gray-800/95 dark:via-gray-850/95 dark:to-gray-900/95">
              <Tabs
                value={activeTab}
                onValueChange={setActiveTab}
                className="w-full"
              >
                <CardHeader className="space-y-1.5 pb-2 sm:pb-3 px-3 sm:px-4 pt-3 sm:pt-4">
                  <CardTitle className="text-center text-sm sm:text-base">
                    <motion.div
                      className="inline-flex items-center gap-1 sm:gap-1.5"
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
                  <CardDescription className="text-center text-[10px] sm:text-[11px] px-1 sm:px-0">
                    {activeTab === "signin" ? (
                      <motion.span
                        key="signin-desc"
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                      >
                        Sign in to access your task dashboard
                      </motion.span>
                    ) : (
                      <motion.span
                        key="signup-desc"
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                      >
                        Create your free account and start organizing
                      </motion.span>
                    )}
                  </CardDescription>
                  <TabsList className="!flex w-full !h-8 sm:!h-10 !p-0.5 !gap-0.5 sm:!gap-1 bg-gradient-to-r from-[#E8F5F1] to-[#F3E8FF] dark:from-gray-800 dark:to-purple-900/50 !rounded-lg">
                    <TabsTrigger
                      value="signin"
                      className="!flex-1 !h-auto !py-1.5 sm:!py-2 !px-2 sm:!px-3 text-[10px] sm:text-xs"
                    >
                      Sign In
                    </TabsTrigger>
                    <TabsTrigger
                      value="signup"
                      className="!flex-1 !h-auto !py-1.5 sm:!py-2 !px-2 sm:!px-3 text-[10px] sm:text-xs"
                    >
                      Sign Up
                    </TabsTrigger>
                  </TabsList>
                </CardHeader>

                <CardContent className="pb-2.5 sm:pb-3 pt-1.5 px-3 sm:px-4">
                  <TabsContent value="signin" className="mt-0">
                    <motion.form
                      onSubmit={handleSignIn}
                      className="space-y-1.5 sm:space-y-2"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <div className="space-y-0.5 sm:space-y-1">
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
                            className="border-2 focus:border-[#7B68EE] transition-colors h-8 sm:h-9 text-xs sm:text-sm bg-white dark:bg-gray-800 shadow-sm pr-10"
                          />
                          <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        </div>
                      </div>

                      <div className="space-y-0.5 sm:space-y-1">
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
                            className="border-2 focus:border-[#7B68EE] transition-colors h-8 sm:h-9 text-xs sm:text-sm bg-white dark:bg-gray-800 shadow-sm pr-10"
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
                      <div className="flex items-center justify-between gap-2">
                        <Label
                          htmlFor="remember-me"
                          className="text-[10px] sm:text-xs text-gray-600 dark:text-gray-400 cursor-pointer"
                        >
                          Remember me
                        </Label>
                        <Switch
                          id="remember-me"
                          checked={rememberMe}
                          onCheckedChange={(checked) => setRememberMe(checked)}
                        />
                      </div>

                      <motion.div
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <Button
                          type="submit"
                          className="w-full h-9 sm:h-10 bg-gradient-to-r from-[#7B68EE] to-[#DDA0DD] hover:from-[#6A5ACD] hover:to-[#DA70D6] shadow-lg text-[11px] sm:text-xs"
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
                      <div className="relative py-1">
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
                          className="w-full h-9 sm:h-10 border-2 border-[#7B68EE] text-[#7B68EE] hover:bg-[#7B68EE]/10 text-[11px] sm:text-xs"
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
                      className="space-y-1.5 sm:space-y-2"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <div className="space-y-0.5 sm:space-y-1">
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
                          className="border-2 focus:border-[#7B68EE] transition-colors h-8 sm:h-9 text-xs sm:text-sm bg-white dark:bg-gray-800 shadow-sm"
                        />
                      </div>

                      <div className="space-y-0.5 sm:space-y-1">
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
                            className={`border-2 focus:border-[#7B68EE] transition-colors h-8 sm:h-9 text-xs sm:text-sm bg-white dark:bg-gray-800 shadow-sm pr-10 ${
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

                      <div className="space-y-0.5 sm:space-y-1">
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
                            className="border-2 focus:border-[#7B68EE] transition-colors h-8 sm:h-9 text-xs sm:text-sm bg-white dark:bg-gray-800 shadow-sm pr-10"
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

                      <div className="space-y-0.5 sm:space-y-1">
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
                            className={`border-2 focus:border-[#7B68EE] transition-colors h-8 sm:h-9 text-xs sm:text-sm bg-white dark:bg-gray-800 shadow-sm pr-10 ${
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
                        className="pt-0.5"
                      >
                        <Button
                          type="submit"
                          className="w-full h-9 sm:h-10 bg-gradient-to-r from-[#7B68EE] to-[#DDA0DD] hover:from-[#6A5ACD] hover:to-[#DA70D6] shadow-lg text-[11px] sm:text-xs"
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
              <div className="px-4 sm:px-6 pb-4 sm:pb-5 pt-3 border-t border-gray-200/50 dark:border-gray-700/50">
                <p className="text-center text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 mb-3">
                  Mobile apps coming soon
                </p>
                <div className="flex items-center justify-center gap-3 sm:gap-4">
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
                      className="h-8 sm:h-10 w-auto"
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
                      className="h-8 sm:h-10 w-auto"
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