#!/bin/bash

# TaskZM PWA Deployment Script for Railway
# Version 2.7.1
# Make executable with: chmod +x deploy.sh

echo "🚀 TaskZM Deployment to Railway"
echo "================================"
echo "Version: 2.7.1"
echo "Domain: www.taskzm.com"
echo ""

# Check if git is initialized
if [ ! -d ".git" ]; then
    echo "❌ Git repository not initialized"
    echo "Run: git init"
    exit 1
fi

# Verify critical files exist
echo "🔍 Verifying files..."
files_ok=true

if [ ! -f "styles/globals.css" ]; then
    echo "❌ Missing: styles/globals.css"
    files_ok=false
fi

if [ ! -f "postcss.config.js" ]; then
    echo "❌ Missing: postcss.config.js"
    files_ok=false
fi

if [ ! -f ".gitignore" ]; then
    echo "❌ Missing: .gitignore"
    files_ok=false
fi

if [ ! -f "railway.toml" ]; then
    echo "❌ Missing: railway.toml"
    files_ok=false
fi

if [ "$files_ok" = false ]; then
    echo ""
    echo "❌ Critical files missing. Deployment will fail."
    echo "Please ensure all required files are present."
    exit 1
fi

echo "✅ All critical files present"
echo ""

# Stage all changes
echo "📦 Staging changes..."
git add -A

# Check if there are changes to commit
if git diff --cached --quiet; then
    echo "✅ No changes to commit"
else
    # Commit changes
    echo "💾 Committing changes..."
    git commit -m "Deploy: TaskZM v2.7.1 with CSS fix"
fi

# Push to main branch
echo "⬆️  Pushing to GitHub..."
git push origin main

echo ""
echo "✅ Deployment initiated!"
echo ""
echo "Railway will now:"
echo "  1. Install dependencies (npm install)"
echo "  2. Build application (npm run build)"
echo "  3. Generate CSS files (Tailwind 4.0)"
echo "  4. Deploy to www.taskzm.com"
echo ""
echo "⏱️  Estimated time: 5-7 minutes"
echo ""
echo "📊 Monitor progress:"
echo "  https://railway.app/dashboard"
echo ""
echo "🌐 Test deployment:"
echo "  1. Visit: https://www.taskzm.com"
echo "  2. Hard refresh: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)"
echo "  3. Check styles load correctly"
echo ""
echo "✅ Done!"
