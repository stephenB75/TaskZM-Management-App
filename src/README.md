# TaskZM 🎯

**Version 1.0.3** — Analytics Motion Sync (neurodivergent-friendly task management with AI-assisted planning)

> 👋 **New here?** Start with **[START_HERE.md](START_HERE.md)** for a complete guide!

---

## ✨ Features

### Core Features (Free)
- 📅 **Today Agenda** - Timeline view of your daily tasks
- 🗓️ **7-Day Kanban** - Visual weekly planning board
- 📆 **Month Calendar** - Full calendar view with task management
- 📥 **Inbox** - Unscheduled task collection
- 📦 **Archive** - Completed task history

### Pro Features ($3.99/month)
- 🤖 **AI Scheduler** - Smart task scheduling with category hours
- 📊 **Analytics** - Task completion insights and trends
- ⏱️ **Task Hours** - Time tracking per category
- 🔄 **Calendar Sync** - External calendar integration

### Additional Features
- 🏆 **Awards System** - 23 achievements to unlock
- ⏰ **Pomodoro Timer** - Focus timer with sound alerts
- 🌙 **Dark Mode** - System-aware theming
- 📱 **PWA** - Install on iOS, Android, and desktop
- 🔒 **Offline Mode** - Works without internet
- ⚡ **Auto-Sync** - 30-second cloud synchronization

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Development Server
```bash
npm run dev
```
Visit `http://localhost:3000`

### 3. Build for Production
```bash
npm run build
```

---

## 🌐 Deploy to Railway

### Quick Deploy (Recommended)
```bash
chmod +x deploy.sh
./deploy.sh
```

Railway will automatically build and deploy to **www.taskzm.com** in 5-7 minutes.

📖 **Quick Links:**
- 🚀 [QUICK_DEPLOY_CARD.md](QUICK_DEPLOY_CARD.md) - 3-step guide
- 📖 [DEPLOY_INSTRUCTIONS.md](DEPLOY_INSTRUCTIONS.md) - Full guide
- 📊 [DEPLOYMENT_STATUS.md](DEPLOYMENT_STATUS.md) - Checklist

---

## 🔧 Environment Setup

Create a `.env` file:

```bash
# Supabase (Required for backend features)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key

# Payments (Optional - for Pro tier)
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_xxxxx
```

**Note:** Environment variables for Railway should be configured in the Railway dashboard, not in `.env`

---

## 🏗️ Tech Stack

- **Frontend:** React 18 + TypeScript + Tailwind CSS 4.0
- **Animation:** Motion (Framer Motion)
- **Backend:** Supabase (Edge Functions + Auth + Database)
- **Payments:** Stripe
- **Build:** Vite 6
- **Deployment:** Railway

---

## 📱 Progressive Web App

TaskZM is a fully-featured PWA:

- ✅ Installable on iOS, Android, and desktop
- ✅ Offline support with service worker
- ✅ HTTPS enabled (required for PWA)
- ✅ App manifest configured
- ✅ Icons optimized (192x192, 512x512)

**Install on mobile:**
- **iOS:** Safari → Share → "Add to Home Screen"
- **Android:** Chrome → "Install TaskZM"

---

## 📚 Documentation

All documentation is in the `/docs` folder:

- 📖 **[Quick Reference](docs/reference/QUICK_REFERENCE.md)**
- 🚀 **[Deployment Guide](docs/DEPLOYMENT_GUIDE.md)**
- 👨‍💻 **[Developer Handoff](docs/DEVELOPER_HANDOFF.md)**
- 🏗️ **[Architecture](docs/architecture/)**
- ✨ **[Features](docs/features/)**
- 🔧 **[Fixes & Troubleshooting](docs/fixes/)**
- ✅ **[Validation Reports](docs/validation/)**

---

## 🎨 Design System

**Neurodivergent-Friendly Colors:**
- 🌿 **Mint** (#B8E6D5) - Work, Primary
- 💜 **Lavender** (#E6D5F0) - Personal
- 🍑 **Peach** (#FDD5B4) - Projects
- 🌤️ **Sky Blue** (#C9E4F7) - Accents
- 🦄 **Lilac** (#D4C5F9) - Accents

**Design Principles:**
- Minimal visual clutter
- Smooth animations (60 FPS)
- Clear feedback on all actions
- Accessible contrast ratios
- Keyboard navigation support

---

## 📦 Project Structure

```
taskzm/
├── components/          # React components (30+)
│   ├── ui/             # shadcn components (42)
│   └── *.tsx           # Feature components
├── contexts/           # React contexts (11)
├── hooks/              # Custom hooks (2)
├── lib/                # Utilities
├── supabase/           # Backend functions
├── public/             # Static assets (PWA files)
├── styles/             # Global CSS
├── docs/               # Documentation (70+ files)
└── deploy.sh           # Deployment script
```

---

## ✅ Status

**Version:** 1.0.3 "Analytics Motion Sync"  
**Release Date:** November 24, 2025  
**Status:** ✅ Production Ready

- ✅ Analytics panel crash resolved and status card animation synced with mobile
- ✅ Dark mode header now updates instantly on theme switch
- ✅ Today Agenda drag-and-drop parity between desktop and mobile
- ✅ Demo account analytics verified (status pie chart + hover actions)
- ✅ All 30+ components smoke-tested
- ✅ PWA/mobile responsive + offline ready
- ✅ Payment integration ready (Stripe + RevenueCat)
- ✅ Deployed at **www.taskzm.com**

---

## 💳 Subscription Tiers

### Free Tier
- Unlimited tasks
- All core views (Today, Kanban, Calendar, Inbox, Archive)
- Custom tags and categories
- Pomodoro timer
- Awards system
- Offline support

### Pro Tier ($3.99/month)
- Everything in Free
- AI Scheduler
- Advanced Analytics
- Task Hours tracking
- Calendar Sync
- Team collaboration

---

## 🤝 Contributing

1. Read [docs/DEVELOPER_HANDOFF.md](docs/DEVELOPER_HANDOFF.md)
2. Follow [docs/architecture/CRITICAL_PATTERNS.md](docs/architecture/CRITICAL_PATTERNS.md)
3. Test thoroughly
4. Submit PR

---

## 📄 License

See [Attributions.md](Attributions.md) for third-party licenses.

---

## 🆘 Support & Documentation

### 🚀 Quick Guides
- [FINAL_SUMMARY.md](FINAL_SUMMARY.md) - **Complete project summary**
- [QUICK_DEPLOY_CARD.md](QUICK_DEPLOY_CARD.md) - 3-step deployment
- [TEST_YOUR_APP.md](TEST_YOUR_APP.md) - Testing checklist

### 🔍 Error Analysis (Important!)
- [ERROR_PROOF.md](ERROR_PROOF.md) - **Mathematical proof: Console errors ≠ TaskZM errors**
- [BROWSER_ERRORS_EXPLAINED.md](BROWSER_ERRORS_EXPLAINED.md) - Why extensions cause errors

### 📚 Full Documentation
- [DEPLOYMENT_STATUS.md](DEPLOYMENT_STATUS.md) - Production checklist
- [FOLDER_STRUCTURE.md](FOLDER_STRUCTURE.md) - Project structure
- [docs/](docs/) - Complete documentation (70+ files)
- [docs/reference/QUICK_REFERENCE.md](docs/reference/QUICK_REFERENCE.md) - API reference

---

**Built with ❤️ for neurodivergent users**

*TaskZM - Your friendly task manager* 🎯✨
