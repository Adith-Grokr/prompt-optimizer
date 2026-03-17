# Universal Prompt Optimizer — CSP → COP

An interactive constraint classification engine that transforms raw AI agent instructions into weighted, priority-ordered prompts using Constraint Optimization Problem (COP) formulation.

## Local Development

```bash
npm install
npm run dev
```

Opens at `http://localhost:5173`

## Deploy to GitHub + Netlify

### Step 1: Push to GitHub

```bash
# Create a new repo on github.com (click + → New repository)
# Name it: prompt-optimizer
# Keep it public, do NOT initialize with README

# Then in your terminal:
cd prompt-optimizer
git init
git add .
git commit -m "Initial commit: Universal Prompt Optimizer"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/prompt-optimizer.git
git push -u origin main
```

### Step 2: Deploy on Netlify

1. Go to [app.netlify.com](https://app.netlify.com)
2. Click **"Add new site"** → **"Import an existing project"**
3. Choose **GitHub** and authorize Netlify
4. Select your **prompt-optimizer** repo
5. Netlify auto-detects settings from `netlify.toml`:
   - Build command: `npm install && npm run build`
   - Publish directory: `dist`
6. Click **"Deploy site"**

Your site will be live at `https://your-site-name.netlify.app` within ~1 minute.

### Step 3: Custom Domain (Optional)

1. In Netlify dashboard → **Domain settings**
2. Click **"Add custom domain"**
3. Follow DNS setup instructions

## Auto-Deploy

Every time you push to `main`, Netlify rebuilds and deploys automatically.

```bash
# Make changes, then:
git add .
git commit -m "Update optimizer"
git push
# Netlify deploys automatically
```
