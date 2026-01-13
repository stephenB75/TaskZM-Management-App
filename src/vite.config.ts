import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const envDir = path.resolve(__dirname, '..');
  const env = loadEnv(mode, envDir, '');
  
  // Debug: Log loaded env variables (only in dev mode)
  if (mode === 'development') {
    console.log('🔍 Vite envDir:', envDir);
    console.log('🔍 Loaded VITE_ variables:', Object.keys(env).filter(key => key.startsWith('VITE_')));
  }

  return {
    root: __dirname, // Set root to src/ directory (where index.html is)
    envDir: envDir, // Look for .env files in project root (parent of src/)
    plugins: [react()],
  base: '/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
      // Resolve versioned package imports
      'sonner': 'sonner',
      'lucide-react@0.487.0': 'lucide-react',
      'lucide-react@0.469.0': 'lucide-react',
      '@radix-ui/react-dialog@1.1.6': '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu@2.1.6': '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-select@2.1.6': '@radix-ui/react-select',
      '@radix-ui/react-tabs@1.1.3': '@radix-ui/react-tabs',
      '@radix-ui/react-slot@1.1.2': '@radix-ui/react-slot',
      '@radix-ui/react-slider@1.2.3': '@radix-ui/react-slider',
      '@radix-ui/react-tooltip@1.1.8': '@radix-ui/react-tooltip',
      '@radix-ui/react-toggle@1.1.2': '@radix-ui/react-toggle',
      '@radix-ui/react-toggle-group@1.1.2': '@radix-ui/react-toggle-group',
      '@radix-ui/react-label@2.1.2': '@radix-ui/react-label',
      '@radix-ui/react-accordion@1.2.3': '@radix-ui/react-accordion',
      '@radix-ui/react-alert-dialog@1.1.6': '@radix-ui/react-alert-dialog',
      '@radix-ui/react-aspect-ratio@1.1.2': '@radix-ui/react-aspect-ratio',
      '@radix-ui/react-avatar@1.1.3': '@radix-ui/react-avatar',
      '@radix-ui/react-checkbox@1.1.4': '@radix-ui/react-checkbox',
      '@radix-ui/react-collapsible@1.1.3': '@radix-ui/react-collapsible',
      '@radix-ui/react-context-menu@2.2.6': '@radix-ui/react-context-menu',
      '@radix-ui/react-hover-card@1.1.6': '@radix-ui/react-hover-card',
      '@radix-ui/react-menubar@1.1.6': '@radix-ui/react-menubar',
      '@radix-ui/react-navigation-menu@1.2.5': '@radix-ui/react-navigation-menu',
      '@radix-ui/react-popover@1.1.6': '@radix-ui/react-popover',
      '@radix-ui/react-progress@1.1.2': '@radix-ui/react-progress',
      '@radix-ui/react-radio-group@1.2.3': '@radix-ui/react-radio-group',
      '@radix-ui/react-scroll-area@1.2.3': '@radix-ui/react-scroll-area',
      '@radix-ui/react-separator@1.1.2': '@radix-ui/react-separator',
      '@radix-ui/react-switch@1.1.2': '@radix-ui/react-switch',
      '@radix-ui/react-toast@1.2.4': '@radix-ui/react-toast',
      'class-variance-authority@0.7.1': 'class-variance-authority',
      'next-themes@0.4.6': 'next-themes',
      'react-day-picker@8.10.1': 'react-day-picker',
      'react-hook-form@7.55.0': 'react-hook-form',
      'react-resizable-panels@2.1.7': 'react-resizable-panels',
      // Figma asset imports
      'figma:asset/f020a6c6df5d63544be1176abd3239b5ad2f7a86.png': path.resolve(__dirname, './assets/app-icon.png'),
      'figma:asset/app-icon.png': path.resolve(__dirname, './assets/app-icon.png'),
      // TaskZM Logo - using new black logo
      'figma:asset/taskzm-logo.png': path.resolve(__dirname, './assets/Taskzm_Logo_BLK-removebg.png'),
    },
  },
  server: {
    port: 3000,
    host: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          motion: ['motion'],
          ui: [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-select',
            '@radix-ui/react-tabs',
          ],
        },
      },
    },
  },
    // Public directory relative to root (src/public/)
    publicDir: path.resolve(__dirname, 'public')
  };
});
