# FPA Tracker - Complete Deployment Guide

## 🎉 Your App is Live!

Your Forest Practice Applications (FPA) Tracker is now fully operational with cloud hosting and offline capabilities.

---

## 📱 Access Your App

### Primary URLs (Same App, Different Access Methods)
- **Web (Production)**: https://frontend-omega-brown-49.vercel.app ✅
- **iOS/Android**: Save as web app from browser menu → "Add to Home Screen"
- **Local Network**: http://fpa:8000 (requires Windows hosts file - already configured)
- **Direct Local**: http://localhost:8000 or http://192.168.0.242:8000

---

## 🏗️ Architecture

Your app uses a hybrid cloud approach:

```
┌─────────────────────┐
│ Frontend (Vercel)   │ ← Hosted in cloud (no PC needed)
│ React + PWA         │
└──────────┬──────────┘
           │
           ↓ API calls
┌─────────────────────┐
│ ngrok Tunnel        │ ← Public internet tunnel
│ (port 8000)         │
└──────────┬──────────┘
           │
           ↓
┌─────────────────────┐
│ Node.js Backend     │ ← Running on your PC
│ (localhost:8000)    │
└──────────┬──────────┘
           │
           ↓ (queries)
┌─────────────────────┐
│ Supabase Database   │ ← Cloud PostgreSQL
│ (Global)            │
└─────────────────────┘
```

---

## 🔧 Services Running on Your PC

**Currently Running:**
- ✅ Node.js server (PID 25132) on port 8000
- ✅ ngrok tunnel (PID 32392) routing to backend
- ✅ Both automatically start with `cd c:\Users\bryen\fpa\backend && node server.js`

**To Restart Backend:**
```powershell
cd c:\Users\bryen\fpa\backend
node server.js
```

**To Start ngrok (if not running):**
```powershell
C:\Users\bryen\ngrok.exe http 8000
```

---

## 📊 Features Available

✅ **Create & Track FPAs**
- Add new Forest Practice Applications
- 6 application statuses (Not Started, In Progress, In Decision Window, Approved, Expired, Withdrawn)
- Track conditional fields (Decision Deadline, Expiration Date)

✅ **Activity Management**
- 4-stage activity progression (Not Started → Started → Harvest Complete → Activity Complete)
- Approved activities tracking

✅ **Renewal History**
- Record and track FPA renewals
- Complete renewal documentation

✅ **Dashboard**
- Summary view grouped by status
- Total FPA count
- Quick status overview

✅ **Search & Filter**
- Find FPAs by number, landowner, or timber sale name
- Real-time search results

✅ **Offline Support**
- Works without internet (PWA technology)
- Auto-syncs when reconnected
- IndexedDB local caching

✅ **Mobile-Friendly**
- Responsive design for all devices
- Add to Home Screen (iOS/Android)
- Touch-optimized interface

---

## 🌐 Access from Outside Home Network

**Option 1: Vercel URL (Recommended for Others)**
- Share: https://frontend-omega-brown-49.vercel.app
- Works from anywhere, no VPN needed
- Note: Requires your backend server running & ngrok active

**Option 2: Local IP on WiFi**
- From phone on same WiFi: http://192.168.0.242:8000
- Works without internet (if backend running)

**Option 3: Via ngrok (Public Internet)**
- ngrok tunnel: https://plangent-hyman-chalkiest.ngrok-free.dev
- Requires VPN disabled
- Requires both backend & ngrok running

---

## 💾 Data Storage

**All data is stored in:** Supabase Cloud PostgreSQL
- **Database URL**: https://mxnsshmqyswuwltldsrp.supabase.co
- **Tables**: 
  - `fpas` - Your FPA records
  - `approved_activities` - Activity tracking
  - `renewal_history` - Renewal records
- **Benefits**: Accessible from anywhere, syncs across devices, secure backup

---

## 🔐 Environment Setup

**Backend Configuration** (`backend/.env`):
```
SUPABASE_URL=https://mxnsshmqyswuwltldsrp.supabase.co
SUPABASE_ANON_KEY=[configured]
SUPABASE_SERVICE_ROLE_KEY=[configured]
PORT=8000
NODE_ENV=development
```

**Frontend Configuration** (`frontend/.env.production`):
```
REACT_APP_API_URL=https://plangent-hyman-chalkiest.ngrok-free.dev
```

---

## ⚡ Future Improvements (Optional)

### To Make Backend Always On (No PC Needed):

**Option 1: Railway.app** (Recommended - Free Tier)
1. Go to https://railway.app
2. Create account
3. Create new service → Select "Django / Node.js"
4. Connect GitHub repo (we have git set up now!)
5. Set environment variables (Supabase keys)
6. Deploy - Railway reads Procfile automatically

**Option 2: Render.com** (Also Free)
1. Go to https://render.com
2. Create new Web Service
3. Connect GitHub
4. Build command: `npm install && cd backend && npm install`
5. Start command: `cd backend && node server.js`
6. Add environment variables
7. Deploy

**Option 3: Heroku** (Paid but simple, ~$7/month)
1. Create account
2. Connect GitHub
3. Enable auto-deploy from main branch
4. Add buildpacks for Node.js
5. Deploy

---

## 📝 Quick Command Reference

**Start Everything**:
```powershell
cd c:\Users\bryen\fpa\backend
node server.js
```

Then in another terminal:
```powershell
C:\Users\bryen\ngrok.exe http 8000
```

**Stop Everything**:
```powershell
taskkill /IM node.exe /F
taskkill /IM ngrok.exe /F
```

**Test Backend Connection**:
```powershell
Invoke-WebRequest http://localhost:8000/api/fpas
```

**Check ngrok Status**:
```powershell
Invoke-WebRequest http://localhost:4040/api/tunnels
```

---

## 🐛 Troubleshooting

**Frontend not updating data?**
- Open DevTools (F12) → Network tab
- Check if requests are going to correct backend URL
- Check browser console for errors

**Backend not responding?**
- Verify Node.js is running: `Get-Process node`
- Try restarting: Kill process and run `node server.js` again
- Check port 8000: `netstat -ano | findstr :8000`

**Can't access from phone?**
- Verify phone is on same WiFi
- Try http://192.168.0.242:8000 (not localhost)
- If using ngrok URL, verify VPN is disabled

**Data not showing?**
- Check Supabase console for data
- Verify environment variables are set
- Check browser offline cache (IndexedDB)

---

## 📞 Support

Your app uses these technologies:
- **Frontend**: React 18 + PWA
- **Backend**: Node.js + Express
- **Database**: Supabase (PostgreSQL)
- **Hosting**: Vercel (frontend)
- **Tunneling**: ngrok (temporary)

All code is in: `c:\Users\bryen\fpa\`
GitHub repo initialized and ready to push anytime!

---

## ✅ Checklist for Production

- [x] Frontend deployed to Vercel
- [x] Backend running on local machine
- [x] ngrok tunnel active
- [x] Supabase database configured
- [x] Environment variables set
- [x] Offline functionality working
- [ ] Optional: Deploy backend to permanent cloud service
- [ ] Optional: Set up custom domain (fpatracker.com)
- [ ] Optional: Enable HTTPS everywhere

---

**Status**: ✅ Ready to Use
**Last Updated**: February 18, 2026
