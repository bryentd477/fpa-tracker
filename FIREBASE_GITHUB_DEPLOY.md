# Firebase Deployment via GitHub Actions

## Problem
Your corporate proxy (Netspark) blocks direct Firebase CLI deployment by intercepting SSL traffic to `*.googleapis.com` domains.

## Solution
Deploy using GitHub Actions - the deployment runs on GitHub's servers, completely bypassing your corporate network.

## Setup Steps

### 1. Push Code to GitHub
```bash
# Initialize git if not already done
git init
git add .
git commit -m "Ready for Firebase deployment"

# Create repo on GitHub.com, then:
git remote add origin https://github.com/YOUR_USERNAME/fpa-tracker.git
git branch -M main
git push -u origin main
```

### 2. Add Firebase Service Account to GitHub Secrets

1. Go to your GitHub repository
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Name: `FIREBASE_SERVICE_ACCOUNT`
5. Value: Copy the entire contents of `fpa-tracker-firebase-adminsdk-fbsvc-cdce50fbbf.json`
6. Click **Add secret**

### 3. Deploy

**Option A: Automatic (on every push to main)**
```bash
git add .
git commit -m "Deploy update"
git push origin main
```
↳ GitHub Actions will automatically build and deploy

**Option B: Manual deployment**
1. Go to your GitHub repo
2. Click **Actions** tab
3. Select **Deploy to Firebase Hosting** workflow
4. Click **Run workflow** → **Run workflow**

### 4. Monitor Deployment

- Watch progress in GitHub Actions tab
- Deployment takes ~2-5 minutes
- Your site will be live at: https://fpa-tracker.web.app

## How It Works

```
Your PC → GitHub (push code)
         ↓
GitHub Actions Server (no proxy!)
         ↓
Builds React app
         ↓
Deploys to Firebase Hosting ✓
```

Your corporate network never communicates with Firebase - GitHub's servers handle everything!

## Troubleshooting

**If deployment fails:**
1. Check GitHub Actions log for errors
2. Verify `FIREBASE_SERVICE_ACCOUNT` secret is correctly set
3. Ensure `fpa-tracker` project ID matches in `.firebaserc`

**Update deployment:**
Just push changes to GitHub - automatic deployment!

```bash
# Make changes to code
git add .
git commit -m "Updated feature X"
git push
# Deployment starts automatically
```

## Alternative: Deploy from Different Network

If you have access to a non-corporate network:
```bash
# From home WiFi or mobile hotspot
cd c:\Users\bryen\fpa
firebase deploy --only hosting
```

This will work because there's no Netspark proxy interfering with the connection.
