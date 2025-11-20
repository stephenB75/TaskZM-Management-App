/**
 * Authentication Screen Constants
 * 
 * Centralized constants for the sign-in/sign-up screen to avoid hardcoded values
 */

// Demo Account Configuration
export const DEMO_ACCOUNT_CONFIG = {
  emailDomain: '@taskzm.app',
  emailPrefix: 'demo_',
  password: 'demo123456',
  name: 'Demo User',
} as const;

// UI Text Constants
export const AUTH_UI_TEXT = {
  // Branding
  appName: 'TaskZM',
  welcomeMessage: 'Welcome to TaskZM!',
  tagline: 'Your calm, organized task companion',
  neurodivergentBadge: 'Neurodivergent-friendly',
  featuresHeader: '14 Smart Features',
  
  // Sign In
  signIn: {
    title: 'Sign In',
    description: 'Sign in to access your task dashboard',
    emailLabel: 'Email',
    emailPlaceholder: 'you@example.com',
    passwordLabel: 'Password',
    forgotPassword: 'Forgot password?',
    rememberMe: 'Remember me',
    button: 'Sign In',
    successMessage: 'Welcome back!',
  },
  
  // Sign Up
  signUp: {
    title: 'Sign Up',
    description: 'Create your free account and start organizing',
    nameLabel: 'Name',
    namePlaceholder: 'Your name',
    emailLabel: 'Email',
    emailPlaceholder: 'you@example.com',
    passwordLabel: 'Password',
    confirmPasswordLabel: 'Confirm Password',
    acceptTerms: 'I accept the Terms of Service and Privacy Policy',
    button: 'Sign Up',
    successMessage: '🎉 Welcome to TaskZM! Your account is ready!',
  },
  
  // Demo Account
  demo: {
    button: '✨ Try Demo Account',
    successMessage: '🎉 Demo account created! Explore TaskZM!',
    errorMessage: 'Failed to create demo account. Please try signing up manually.',
  },
  
  // Validation Messages
  validation: {
    emailRequired: 'Please enter a valid email address',
    passwordRequired: 'Password is required',
    passwordTooShort: 'Password must be at least 6 characters',
    passwordTooWeak: 'Password is too weak. Please use a stronger password.',
    passwordsNoMatch: 'Passwords do not match',
    termsRequired: 'Please accept the Terms of Service and Privacy Policy',
    nameRequired: 'Name is required',
  },
  
  // Password Strength
  passwordStrength: {
    weak: 'WEAK',
    medium: 'MEDIUM',
    strong: 'STRONG',
    feedback: {
      minLength: 'At least 8 characters',
      caseMix: 'Mix of uppercase and lowercase',
      numbers: 'Include numbers',
      specialChars: 'Include special characters',
    },
  },
  
  // Forgot Password
  forgotPassword: {
    title: 'Reset Password',
    description: 'Enter your email address and we\'ll send you a link to reset your password.',
    emailLabel: 'Email',
    button: 'Send Reset Link',
    successMessage: 'Password reset email sent! Check your inbox.',
    errorMessage: 'Failed to send reset email. Please try again.',
    backToSignIn: 'Back to Sign In',
  },
  
  // Mobile Apps
  mobileApps: {
    comingSoon: 'Mobile apps coming soon',
  },
  
  // General
  or: 'OR',
  loading: 'Loading...',
  error: {
    generic: 'An error occurred. Please try again.',
    accountCreationFailed: 'Failed to create account',
    signInFailed: 'Failed to sign in',
    userExists: 'An account with this email already exists',
    invalidCredentials: 'Invalid email or password',
  },
} as const;

// Color Constants (Theme Colors)
export const AUTH_COLORS = {
  primary: '#7B68EE',
  primaryHover: '#6A5ACD',
  primaryLight: '#9B7EE8',
  primaryGradient: {
    from: '#7B68EE',
    via: '#9B7EE8',
    to: '#D4C5F9',
  },
  secondary: '#DDA0DD',
  secondaryHover: '#DA70D6',
  background: {
    gradient: {
      from: '#B4E4FF',
      via: '#E0BBE4',
      to: '#FFDAB9',
    },
    accent1: '#98D8C8',
    accent2: '#DDA0DD',
  },
  card: {
    gradient: {
      from: '#B4E4FF',
      via: '#E0BBE4',
      to: '#FFDAB9',
    },
    tabs: {
      from: '#E8F5F1',
      to: '#F3E8FF',
    },
  },
} as const;

// Configuration Constants
export const AUTH_CONFIG = {
  featuresPerPage: 6, // 2 rows x 3 columns
  passwordMinLength: 6,
  passwordStrongLength: 8,
  passwordVeryStrongLength: 12,
  toastDuration: 4000, // milliseconds
  carouselAutoScrollInterval: 4000, // milliseconds
} as const;

// Background Image URL
export const AUTH_BACKGROUND_IMAGE = {
  url: 'https://images.unsplash.com/photo-1544654262-e295983be0f4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtaW5pbWFsaXN0JTIwZGVzayUyMG9yZ2FuaXplZHxlbnwxfHx8fDE3NjE2MTM4MDh8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
  alt: 'Minimalist organized workspace background',
} as const;

// Feature List (Marketing Features)
export interface AuthFeature {
  title: string;
  subtitle: string;
}

// Note: The actual feature icons are imported in AuthScreen.tsx
// This is just for reference of the feature titles
export const AUTH_FEATURES: AuthFeature[] = [
  { title: '7-Day Kanban', subtitle: 'Visual weekly planning' },
  { title: 'Month Planner', subtitle: 'Zoomed-out focus' },
  { title: 'Time Blocking', subtitle: 'Smart agenda view' },
  { title: 'AI Scheduler', subtitle: 'Smart planning in seconds' },
  { title: 'AI Insights', subtitle: 'Weekly summaries' },
  { title: 'Analytics', subtitle: 'Trends & tracking' },
  { title: 'Pomodoro + Stats', subtitle: 'Deep work focus' },
  { title: 'Team Collaboration', subtitle: 'Unlimited members' },
  { title: 'Folders + Tags', subtitle: 'Organize everything' },
  { title: '23 Awards', subtitle: 'Motivational streaks' },
  { title: 'Smart Templates', subtitle: 'Reusable flows' },
  { title: 'Recurring Tasks', subtitle: 'Automation built-in' },
  { title: 'Privacy-first', subtitle: 'Encrypted & secure' },
  { title: 'Live Sync', subtitle: 'Realtime updates' },
] as const;

