import tailwindcssAnimate from 'tailwindcss-animate';

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './**/*.{js,ts,jsx,tsx,mdx}',
  ],
  safelist: [
    'from-[#B4E4FF]/90',
    'via-[#E0BBE4]/85',
    'to-[#FFDAB9]/90',
    'from-[#FAF9FC]',
    'via-[#F9F7FD]',
    'to-[#F3F0F9]',
    'bg-[#98D8C8]/30',
    'bg-[#DDA0DD]/30',
    'from-[#B4E4FF]',
    'to-[#98D8C8]',
    'from-[#DDA0DD]',
    'to-[#E0BBE4]',
    'from-[#FFDAB9]',
    'to-[#FFB6C1]',
    'bg-white/70',
    'bg-white/80',
    'bg-gray-900/70',
    'bg-gray-900/80',
    'bg-gray-900/95',
    'border-white/50',
    'blur-3xl',
    'backdrop-blur-sm',
    'backdrop-blur-md',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'pastel-mint': '#B8E6D5',
        'pastel-lavender': '#E6D5F0',
        'pastel-peach': '#FFD6BA',
        'pastel-sky': '#C9E4F7',
        'pastel-lilac': '#E1D4F0',
        'pastel-pink': '#FFD6E8',
        'pastel-yellow': '#FFF4CC',
        'pastel-sage': '#D4E8D4',
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        card: {
          DEFAULT: 'var(--card)',
          foreground: 'var(--card-foreground)',
        },
        popover: {
          DEFAULT: 'var(--popover)',
          foreground: 'var(--popover-foreground)',
        },
        primary: {
          DEFAULT: 'var(--primary)',
          foreground: 'var(--primary-foreground)',
        },
        secondary: {
          DEFAULT: 'var(--secondary)',
          foreground: 'var(--secondary-foreground)',
        },
        muted: {
          DEFAULT: 'var(--muted)',
          foreground: 'var(--muted-foreground)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          foreground: 'var(--accent-foreground)',
        },
        destructive: {
          DEFAULT: 'var(--destructive)',
          foreground: 'var(--destructive-foreground)',
        },
        border: 'var(--border)',
        input: 'var(--input)',
        'input-background': 'var(--input-background)',
        'switch-background': 'var(--switch-background)',
        ring: 'var(--ring)',
        chart: {
          '1': 'var(--chart-1)',
          '2': 'var(--chart-2)',
          '3': 'var(--chart-3)',
          '4': 'var(--chart-4)',
          '5': 'var(--chart-5)',
        },
        sidebar: {
          DEFAULT: 'var(--sidebar)',
          foreground: 'var(--sidebar-foreground)',
          primary: 'var(--sidebar-primary)',
          'primary-foreground': 'var(--sidebar-primary-foreground)',
          accent: 'var(--sidebar-accent)',
          'accent-foreground': 'var(--sidebar-accent-foreground)',
          border: 'var(--sidebar-border)',
          ring: 'var(--sidebar-ring)',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        body: ['Nunito', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [tailwindcssAnimate],
};

