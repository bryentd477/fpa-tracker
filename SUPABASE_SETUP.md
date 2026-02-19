# Supabase Cloud Setup Guide

Your FPA Tracker now uses **Supabase** - a cloud database that syncs across all your devices automatically!

## Step 1: Create a Supabase Account (Free)

1. Go to https://supabase.com
2. Click "Start your project"
3. Sign up with email (or Google/GitHub)
4. Create a new organization
5. Create a new project in your organization
   - **Name:** `fpa-tracker` (or whatever you prefer)
   - **Password:** Copy this somewhere safe (for login)
   - **Region:** Choose closest to you
   - Click "Create new project" and wait 1-2 minutes...

## Step 2: Get Your Credentials

Once your project is ready:

1. Go to **Project Settings** (gear icon bottom left)
2. Click **API** in the left menu
3. You'll see:
   - **Project URL** - Copy this entire URL
   - **anon public** - Copy this key
   - **service_role secret** - Copy this key (keep it secret!)

## Step 3: Copy Credentials to Your App

1. Open VS Code and go to `c:\Users\bryen\fpa\backend`
2. Copy the `.env.example` file and rename it to `.env`
3. Fill in your credentials:

```
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=eyJhbGc....(long string)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc....(different long string)
PORT=3000
NODE_ENV=development
```

Save the file.

## Step 4: Create Database Tables

In Supabase dashboard:

1. Click **SQL Editor** (left sidebar)
2. Click **New Query**
3. Copy and paste this SQL, then hit **Run**:

```sql
-- FPAs table
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

-- Approved Activities table
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

-- Renewal History table
CREATE TABLE renewal_history (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  fpa_id BIGINT NOT NULL REFERENCES fpas(id) ON DELETE CASCADE,
  renewal_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security (optional but recommended)
ALTER TABLE fpas ENABLE ROW LEVEL SECURITY;
ALTER TABLE approved_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE renewal_history ENABLE ROW LEVEL SECURITY;
```

## Step 5: Install Dependencies & Start

1. Open terminal in `c:\Users\bryen\fpa\backend`
2. Run:
   ```
   npm install
   ```
3. Start your server:
   ```
   node server.js
   ```

You should see:
```
FPA Tracker server running on http://localhost:3000
Cloud-synced with Supabase ☁️
```

## Step 6: Test & Use

- Open http://localhost:3000
- Add some test FPAs
- Go to Supabase dashboard → **Table Editor** → `fpas` to see live data
- On your Android phone, go to `http://fpa:3000` (same WiFi)
- Changes sync instantly! ☁️

## 🔄 Multi-Device Sync

Now you can:

1. **Computer A** - Add FPA
2. **Phone** - Instantly see it (refresh if needed)
3. **Computer B** - Edit that FPA
4. **Phone** - See the update in real-time

All data is in the cloud! No more local databases.

## 📱 Away from Home?

With Supabase, you can access from **anywhere**:

1. Use **ngrok** or **Cloudflare Tunnel** (see main README)
2. Or just use the offline sync: make changes offline, they sync when reconnected to cloud

## 🔐 Security Note

- **Keep `.env` file private** (never share `SUPABASE_SERVICE_ROLE_KEY`)
- It's already in `.gitignore` 
- The `SUPABASE_ANON_KEY` is public (safe for frontend)

## Troubleshooting

**"Cannot find module '@supabase/supabase-js'"**
→ Run: `npm install`

**"Missing Supabase credentials"**
→ Check that `.env` file exists and has all three values

**"PGRST...: relation "fpas" does not exist"**
→ Didn't create the SQL tables. Copy/paste the SQL from Step 4 again

**"Connection refused"**
→ Check you filled in the correct SUPABASE_URL (should have `.supabase.co` in it)

---

Once set up, your data syncs automatically across all devices! 🚀

For more help: https://supabase.com/docs
