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
} from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
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
import { useAuth } from "../contexts/AuthContext";
import { toast } from "sonner";
import { motion } from "motion/react";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import taskzmLogo from "../assets/taskzm-logo.png";

export function AuthScreen() {
  const { signIn, signUp } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("signin");

  // Sign In State
  const [signInEmail, setSignInEmail] = useState("");
  const [signInPassword, setSignInPassword] = useState("");

  // Sign Up State
  const [signUpName, setSignUpName] = useState("");
  const [signUpEmail, setSignUpEmail] = useState("");
  const [signUpPassword, setSignUpPassword] = useState("");
  const [signUpConfirmPassword, setSignUpConfirmPassword] =
    useState("");

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await signIn(signInEmail, signInPassword);
      toast.success("Welcome back! 🎉");
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to sign in";

      // If invalid credentials, suggest signing up
      if (
        errorMessage.toLowerCase().includes("invalid") ||
        errorMessage.toLowerCase().includes("credentials")
      ) {
        toast.error(
          "Invalid credentials. Don't have an account?",
          {
            duration: 6000,
            action: {
              label: "Sign Up",
              onClick: () => setActiveTab("signup"),
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

    if (signUpPassword !== signUpConfirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (signUpPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
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
    <div className="min-h-screen relative flex items-center justify-center overflow-hidden">
      {/* Background Image with Overlay */}
      <div className="absolute inset-0 z-0">
        <ImageWithFallback
          src="https://images.unsplash.com/photo-1544654262-e295983be0f4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtaW5pbWFsaXN0JTIwZGVzayUyMG9yZ2FuaXplZHxlbnwxfHx8fDE3NjE2MTM4MDh8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral"
          alt="Minimalist organized workspace background"
          className="w-full h-full object-cover"
        />
        {/* Gradient overlay for better readability and pastel tones */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#B4E4FF]/90 via-[#E0BBE4]/85 to-[#FFDAB9]/90 dark:from-gray-900/95 dark:via-purple-900/90 dark:to-gray-800/95" />

        {/* Animated accent circles */}
        <motion.div
          className="absolute top-20 left-20 w-96 h-96 bg-[#98D8C8]/30 rounded-full blur-3xl"
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
          className="absolute bottom-20 right-20 w-96 h-96 bg-[#DDA0DD]/30 rounded-full blur-3xl"
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
        className="relative z-10 w-full max-w-7xl mx-auto px-4 py-2 lg:py-3"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 items-start lg:items-center">
          {/* Left Side - Branding & Features */}
          <motion.div
            className="text-center lg:text-left space-y-2"
            variants={itemVariants}
          >
            {/* Logo & Tagline */}
            <motion.div
              className="space-y-1"
              variants={logoVariants}
            >
              <motion.div
                className="inline-flex items-center gap-1 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm px-2 py-1 rounded-full shadow-lg border border-white/50"
                whileHover={{ scale: 1.05 }}
                transition={{ duration: 0.2 }}
              >
                <Sparkles className="w-3 h-3 text-[#7B68EE]" />
                <span className="text-[10px] sm:text-xs text-gray-700 dark:text-gray-200">
                  Neurodivergent-Friendly
                </span>
              </motion.div>

              <div className="flex flex-col items-center lg:items-start gap-1">
                <motion.img
                  src={taskzmLogo}
                  alt="TaskZM Logo"
                  className="w-[140px] sm:w-[160px] md:w-[180px] lg:w-[200px]"
                  whileHover={{ scale: 1.02 }}
                  transition={{ duration: 0.2 }}
                />

                <p className="text-sm sm:text-base text-gray-700 dark:text-gray-200 text-center lg:text-left">
                  Your Calm, Organized Task Companion
                </p>
              </div>
            </motion.div>

            {/* Feature Highlights - More Compact */}
            <motion.div
              className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 gap-1.5 max-w-2xl mx-auto lg:mx-0 pt-1"
              variants={itemVariants}
            >
              <motion.div
                className="flex items-center gap-1.5 bg-white/70 dark:bg-gray-900/70 backdrop-blur-md p-1.5 sm:p-2 rounded-md border border-white/50 shadow-md"
                whileHover={{ scale: 1.02, y: -1 }}
                transition={{ duration: 0.2 }}
              >
                <div className="w-6 h-6 sm:w-7 sm:h-7 bg-gradient-to-br from-[#B4E4FF] to-[#98D8C8] rounded flex items-center justify-center flex-shrink-0 shadow-sm">
                  <Calendar className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-[10px] sm:text-xs text-gray-900 dark:text-white font-medium leading-tight">
                    7-Day Kanban
                  </h3>
                  <p className="text-[9px] sm:text-[10px] text-gray-600 dark:text-gray-400 leading-tight hidden sm:block">
                    Visual planning
                  </p>
                </div>
              </motion.div>

              <motion.div
                className="flex items-center gap-1.5 bg-white/70 dark:bg-gray-900/70 backdrop-blur-md p-1.5 sm:p-2 rounded-md border border-white/50 shadow-md"
                whileHover={{ scale: 1.02, y: -1 }}
                transition={{ duration: 0.2 }}
              >
                <div className="w-6 h-6 sm:w-7 sm:h-7 bg-gradient-to-br from-[#DDA0DD] to-[#E0BBE4] rounded flex items-center justify-center flex-shrink-0 shadow-sm">
                  <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-[10px] sm:text-xs text-gray-900 dark:text-white font-medium leading-tight">
                    Time Blocking
                  </h3>
                  <p className="text-[9px] sm:text-[10px] text-gray-600 dark:text-gray-400 leading-tight hidden sm:block">
                    Today Agenda
                  </p>
                </div>
              </motion.div>

              <motion.div
                className="flex items-center gap-1.5 bg-white/70 dark:bg-gray-900/70 backdrop-blur-md p-1.5 sm:p-2 rounded-md border border-white/50 shadow-md"
                whileHover={{ scale: 1.02, y: -1 }}
                transition={{ duration: 0.2 }}
              >
                <div className="w-6 h-6 sm:w-7 sm:h-7 bg-gradient-to-br from-[#FFDAB9] to-[#FFB6C1] rounded flex items-center justify-center flex-shrink-0 shadow-sm">
                  <Zap className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-[10px] sm:text-xs text-gray-900 dark:text-white font-medium leading-tight">
                    AI Scheduler
                  </h3>
                  <p className="text-[9px] sm:text-[10px] text-gray-600 dark:text-gray-400 leading-tight hidden sm:block">
                    Smart planning
                  </p>
                </div>
              </motion.div>

              <motion.div
                className="flex items-center gap-1.5 bg-white/70 dark:bg-gray-900/70 backdrop-blur-md p-1.5 sm:p-2 rounded-md border border-white/50 shadow-md"
                whileHover={{ scale: 1.02, y: -1 }}
                transition={{ duration: 0.2 }}
              >
                <div className="w-6 h-6 sm:w-7 sm:h-7 bg-gradient-to-br from-[#98D8C8] to-[#B4E4FF] rounded flex items-center justify-center flex-shrink-0 shadow-sm">
                  <BarChart3 className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-[10px] sm:text-xs text-gray-900 dark:text-white font-medium leading-tight">
                    Analytics
                  </h3>
                  <p className="text-[9px] sm:text-[10px] text-gray-600 dark:text-gray-400 leading-tight hidden sm:block">
                    Track progress
                  </p>
                </div>
              </motion.div>

              <motion.div
                className="flex items-center gap-1.5 bg-white/70 dark:bg-gray-900/70 backdrop-blur-md p-1.5 sm:p-2 rounded-md border border-white/50 shadow-md"
                whileHover={{ scale: 1.02, y: -1 }}
                transition={{ duration: 0.2 }}
              >
                <div className="w-6 h-6 sm:w-7 sm:h-7 bg-gradient-to-br from-[#E0BBE4] to-[#DDA0DD] rounded flex items-center justify-center flex-shrink-0 shadow-sm">
                  <Timer className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-[10px] sm:text-xs text-gray-900 dark:text-white font-medium leading-tight">
                    Pomodoro
                  </h3>
                  <p className="text-[9px] sm:text-[10px] text-gray-600 dark:text-gray-400 leading-tight hidden sm:block">
                    Focus mode
                  </p>
                </div>
              </motion.div>

              <motion.div
                className="flex items-center gap-1.5 bg-white/70 dark:bg-gray-900/70 backdrop-blur-md p-1.5 sm:p-2 rounded-md border border-white/50 shadow-md"
                whileHover={{ scale: 1.02, y: -1 }}
                transition={{ duration: 0.2 }}
              >
                <div className="w-6 h-6 sm:w-7 sm:h-7 bg-gradient-to-br from-[#FFB6C1] to-[#FFDAB9] rounded flex items-center justify-center flex-shrink-0 shadow-sm">
                  <Trophy className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-[10px] sm:text-xs text-gray-900 dark:text-white font-medium leading-tight">
                    23 Awards
                  </h3>
                  <p className="text-[9px] sm:text-[10px] text-gray-600 dark:text-gray-400 leading-tight hidden sm:block">
                    Achievements
                  </p>
                </div>
              </motion.div>

              <motion.div
                className="flex items-center gap-1.5 bg-white/70 dark:bg-gray-900/70 backdrop-blur-md p-1.5 sm:p-2 rounded-md border border-white/50 shadow-md"
                whileHover={{ scale: 1.02, y: -1 }}
                transition={{ duration: 0.2 }}
              >
                <div className="w-6 h-6 sm:w-7 sm:h-7 bg-gradient-to-br from-[#DDA0DD] to-[#E0BBE4] rounded flex items-center justify-center flex-shrink-0 shadow-sm">
                  <Tag className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-[10px] sm:text-xs text-gray-900 dark:text-white font-medium leading-tight">
                    Folders
                  </h3>
                  <p className="text-[9px] sm:text-[10px] text-gray-600 dark:text-gray-400 leading-tight hidden sm:block">
                    Organize
                  </p>
                </div>
              </motion.div>

              <motion.div
                className="flex items-center gap-1.5 bg-white/70 dark:bg-gray-900/70 backdrop-blur-md p-1.5 sm:p-2 rounded-md border border-white/50 shadow-md"
                whileHover={{ scale: 1.02, y: -1 }}
                transition={{ duration: 0.2 }}
              >
                <div className="w-6 h-6 sm:w-7 sm:h-7 bg-gradient-to-br from-[#FFB6C1] to-[#FFDAB9] rounded flex items-center justify-center flex-shrink-0 shadow-sm">
                  <CheckCircle2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-[10px] sm:text-xs text-gray-900 dark:text-white font-medium leading-tight">
                    Alerts
                  </h3>
                  <p className="text-[9px] sm:text-[10px] text-gray-600 dark:text-gray-400 leading-tight hidden sm:block">
                    Smart
                  </p>
                </div>
              </motion.div>

              <motion.div
                className="flex items-center gap-1.5 bg-white/70 dark:bg-gray-900/70 backdrop-blur-md p-1.5 sm:p-2 rounded-md border border-white/50 shadow-md"
                whileHover={{ scale: 1.02, y: -1 }}
                transition={{ duration: 0.2 }}
              >
                <div className="w-6 h-6 sm:w-7 sm:h-7 bg-gradient-to-br from-[#98D8C8] to-[#B4E4FF] rounded flex items-center justify-center flex-shrink-0 shadow-sm">
                  <Users className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-[10px] sm:text-xs text-gray-900 dark:text-white font-medium leading-tight">
                    Team
                  </h3>
                  <p className="text-[9px] sm:text-[10px] text-gray-600 dark:text-gray-400 leading-tight hidden sm:block">
                    Collaborate
                  </p>
                </div>
              </motion.div>

              <motion.div
                className="flex items-center gap-1.5 bg-white/70 dark:bg-gray-900/70 backdrop-blur-md p-1.5 sm:p-2 rounded-md border border-white/50 shadow-md"
                whileHover={{ scale: 1.02, y: -1 }}
                transition={{ duration: 0.2 }}
              >
                <div className="w-6 h-6 sm:w-7 sm:h-7 bg-gradient-to-br from-[#B4E4FF] to-[#C9E4F7] rounded flex items-center justify-center flex-shrink-0 shadow-sm">
                  <Calendar className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-[10px] sm:text-xs text-gray-900 dark:text-white font-medium leading-tight">
                    Calendar
                  </h3>
                  <p className="text-[9px] sm:text-[10px] text-gray-600 dark:text-gray-400 leading-tight hidden sm:block">
                    Sync
                  </p>
                </div>
              </motion.div>
            </motion.div>
          </motion.div>

          {/* Right Side - Auth Card */}
          <motion.div
            variants={cardVariants}
            className="flex items-center justify-center"
          >
            <Card className="w-full max-w-md shadow-2xl border-2 border-white/60 backdrop-blur-xl bg-white/95 dark:bg-gray-900/95">
              <Tabs
                value={activeTab}
                onValueChange={setActiveTab}
                className="w-full"
              >
                <CardHeader className="space-y-2 pb-4">
                  <CardTitle className="text-center text-lg">
                    <motion.div
                      className="inline-flex items-center gap-2"
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
                  <CardDescription className="text-center text-xs">
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
                  <TabsList className="!flex w-full !h-12 sm:!h-14 !p-1.5 !gap-1.5 bg-gradient-to-r from-[#E8F5F1] to-[#F3E8FF] dark:from-gray-800 dark:to-purple-900/50 !rounded-lg">
                    <TabsTrigger
                      value="signin"
                      className="!flex-1 !h-auto !py-2.5 sm:!py-3 !px-3 sm:!px-4 text-xs sm:text-sm"
                    >
                      Sign In
                    </TabsTrigger>
                    <TabsTrigger
                      value="signup"
                      className="!flex-1 !h-auto !py-2.5 sm:!py-3 !px-3 sm:!px-4 text-xs sm:text-sm"
                    >
                      Sign Up
                    </TabsTrigger>
                  </TabsList>
                </CardHeader>

                <CardContent className="pb-5 pt-2">
                  <TabsContent value="signin" className="mt-0">
                    <motion.form
                      onSubmit={handleSignIn}
                      className="space-y-3"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <div className="space-y-1.5">
                        <Label htmlFor="signin-email">
                          Email
                        </Label>
                        <Input
                          id="signin-email"
                          type="email"
                          placeholder="you@example.com"
                          value={signInEmail}
                          onChange={(e) =>
                            setSignInEmail(e.target.value)
                          }
                          required
                          className="border-2 focus:border-[#7B68EE] transition-colors"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label
                          htmlFor="signin-password"
                          className="text-sm"
                        >
                          Password
                        </Label>
                        <Input
                          id="signin-password"
                          type="password"
                          placeholder="••••••••"
                          value={signInPassword}
                          onChange={(e) =>
                            setSignInPassword(e.target.value)
                          }
                          required
                          className="border-2 focus:border-[#7B68EE] transition-colors h-10"
                        />
                      </div>

                      <motion.div
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.98 }}
                        className="pt-1"
                      >
                        <Button
                          type="submit"
                          className="w-full h-11 bg-gradient-to-r from-[#7B68EE] to-[#DDA0DD] hover:from-[#6A5ACD] hover:to-[#DA70D6] shadow-lg text-sm"
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
                      <div className="relative py-2">
                        <div className="absolute inset-0 flex items-center">
                          <span className="w-full border-t border-gray-300 dark:border-gray-600" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
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
                          className="w-full h-11 border-2 border-[#7B68EE] text-[#7B68EE] hover:bg-[#7B68EE]/10 text-sm"
                          disabled={isLoading}
                        >
                          <Sparkles className="mr-2 h-4 w-4" />
                          Try Demo Account
                        </Button>
                      </motion.div>
                    </motion.form>
                  </TabsContent>

                  <TabsContent value="signup" className="mt-0">
                    <motion.form
                      onSubmit={handleSignUp}
                      className="space-y-3"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <div className="space-y-1.5">
                        <Label
                          htmlFor="signup-name"
                          className="text-sm"
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
                          className="border-2 focus:border-[#7B68EE] transition-colors h-10"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label
                          htmlFor="signup-email"
                          className="text-sm"
                        >
                          Email
                        </Label>
                        <Input
                          id="signup-email"
                          type="email"
                          placeholder="you@example.com"
                          value={signUpEmail}
                          onChange={(e) =>
                            setSignUpEmail(e.target.value)
                          }
                          required
                          className="border-2 focus:border-[#7B68EE] transition-colors h-10"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label
                          htmlFor="signup-password"
                          className="text-sm"
                        >
                          Password
                        </Label>
                        <Input
                          id="signup-password"
                          type="password"
                          placeholder="••••••••"
                          value={signUpPassword}
                          onChange={(e) =>
                            setSignUpPassword(e.target.value)
                          }
                          required
                          className="border-2 focus:border-[#7B68EE] transition-colors h-10"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label
                          htmlFor="signup-confirm-password"
                          className="text-sm"
                        >
                          Confirm Password
                        </Label>
                        <Input
                          id="signup-confirm-password"
                          type="password"
                          placeholder="••••••••"
                          value={signUpConfirmPassword}
                          onChange={(e) =>
                            setSignUpConfirmPassword(
                              e.target.value,
                            )
                          }
                          required
                          className="border-2 focus:border-[#7B68EE] transition-colors h-10"
                        />
                      </div>

                      <motion.div
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.98 }}
                        className="pt-1"
                      >
                        <Button
                          type="submit"
                          className="w-full h-11 bg-gradient-to-r from-[#7B68EE] to-[#DDA0DD] hover:from-[#6A5ACD] hover:to-[#DA70D6] shadow-lg text-sm"
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
                      <div className="text-center text-sm text-gray-600 dark:text-gray-400 bg-[#E8F5F1] dark:bg-gray-800 rounded-lg p-3">
                        <span className="inline-flex items-center gap-1">
                          <Sparkles className="h-4 w-4 text-[#7B68EE]" />
                          Free forever • Pro features available • No credit card required
                        </span>
                      </div>
                    </motion.form>
                  </TabsContent>
                </CardContent>
              </Tabs>
            </Card>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}