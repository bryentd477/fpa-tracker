# Quick Start Guide - FPA Tracker

## 🚀 Quick Start (30 seconds)

### Windows Users:
1. Open the `fpa` folder
2. **Double-click `start.bat`**
3. Wait for the message: "Server running at: http://localhost:3000"
4. Open your browser and go to: **http://localhost:3000**
5. Done! Start adding FPAs

### macOS/Linux Users:
1. Open Terminal in the `fpa` folder
2. Run: `bash start.sh`
3. Wait for the message: "Server running at: http://localhost:3000"
4. Open your browser and go to: **http://localhost:3000**
5. Done! Start adding FPAs

## 📱 Access from Android Phone

1. Find your computer's IP address:
   - **Windows**: Open Command Prompt and type `ipconfig` (look for "IPv4 Address")
   
2. On your Android phone, open any browser and go to:
   ```
   http://[YOUR-IP-ADDRESS]:3000
   ```
   Example: `http://192.168.1.100:3000`

3. Bookmark this for quick access next time

## 🛑 Stop the Server

- Press **Ctrl+C** in the terminal/command prompt
- Or close the window

## 📖 Full Documentation

See **README.md** for complete documentation, features, and troubleshooting.

## ✅ First Time?

The app will:
1. Check for Node.js
2. Install all dependencies automatically (npm packages)
3. Build the React frontend
4. Create the SQLite database (fpa.db)
5. Start the server

All data is stored locally in the `backend/fpa.db` file - no external database needed!

---

**Need help?** Check the Troubleshooting section in README.md
