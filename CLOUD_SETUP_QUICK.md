# ☁️ FPA Tracker is Now Cloud-Enabled!

Your app is now ready for **Supabase cloud synchronization**. This means all your devices can share the same database in real-time!

## 🚀 Quick Setup (5 minutes)

### Step 1: Sign Up for Supabase (Free)
1. Go to https://supabase.com and click "Start your project"
2. Sign up with Google, GitHub, or email
3. Create a new project (name it `fpa-tracker`, pick a region)
4. Wait 1-2 minutes for the project to create...

### Step 2: Get Your Credentials
Once your project is ready:
1. Click **Project Settings** (gear icon, bottom left)
2. Go to **API** section
3. Copy these three things:
   - **Project URL** (looks like: `https://xxxxx.supabase.co`)
   - **anon public key** (long string starting with `eyJh...`)
   - **service_role secret** (different long string, KEEP SECRET!)

### Step 3: Paste Credentials
1. Open `c:\Users\bryen\fpa\backend\.env` in any text editor
2. Fill in your three values:
   ```
   SUPABASE_URL=https://your-project-id.supabase.co
   SUPABASE_ANON_KEY=eyJhbGc....
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGc....
   ```
3. Save the file

### Step 4: Create Database Tables
1. In Supabase dashboard, click **SQL Editor**
2. Click **New Query**
3. Copy this SQL and run it:

```sql
CREATE TABLE fpas (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  fpa_number TEXT UNIQUE NOT NULL,
  landowner TEXT NOT NULL,
  timber_sale_name TEXT NOT NULL,
  landowner_type TEXT NOT NULL,
  application_status TEXT DEFAULT '',
  decision_deadline DATE,
  expiration_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE approved_activities (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  fpa_id BIGINT NOT NULL REFERENCES fpas(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'Not Started',
  start_date DATE,
  harvest_complete_date DATE,
  activity_complete_date DATE,
  comments TEXT,
  reforestation_required BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE renewal_history (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  fpa_id BIGINT NOT NULL REFERENCES fpas(id) ON DELETE CASCADE,
  renewal_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE fpas ENABLE ROW LEVEL SECURITY;
ALTER TABLE approved_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE renewal_history ENABLE ROW LEVEL SECURITY;
```

### Step 5: Start the Server
Open PowerShell in `c:\Users\bryen\fpa\backend` and run:
```
node server.js
```

You should see:
```
FPA Tracker server running on http://localhost:3000
Cloud-synced with Supabase ☁️
```

### Step 6: Open the App
Go to **http://localhost:3000** in your browser!

---

## ✨ What's New?

✅ **Cloud Sync** - Data syncs across all your devices  
✅ **Offline Support** - Still works offline, syncs when reconnected  
✅ **Real-time Updates** - Multiple devices see changes instantly  
✅ **Multi-Device** - Use on phone, tablet, multiple computers  
✅ **No External Hosting** - Supabase is your backend  

---

## 📱 Multi-Device Access

Now you can:
1. **Computer A**: Add FPA
2. **Phone (on WiFi)**: See it instantly at `http://fpa:3000`
3. **Computer B**: Edit it
4. **Phone**: See the update in real-time!

All from the same cloud database.

---

## 🎯 Next Steps (Optional)

**Want to access from anywhere (not just home WiFi)?**
- Use ngrok: `ngrok http 3000` (free, easy)
- Or Cloudflare Tunnel (permanent URL)
- See main README for details

---

**Need more detailed help?** See `SUPABASE_SETUP.md`

Happy tracking! 🌲
