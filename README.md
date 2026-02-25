# FPA Tracker - Forest Practice Applications Lifecycle Management

A local, folder-based application to track Forest Practice Applications (FPAs) through their complete lifecycle. Run entirely from your folder with no web hosting or domain required. Accessible on desktop and Android devices via browser or WebView.

## Features

✨ **Complete FPA Lifecycle Management**
- Track FPA Number, Landowner, Timber Sale Name, Landowner Type (Large/Small)
- Application Status (Unassigned, In Decision Window, Approved, Withdrawn, Disapproved, Closed Out)
- Conditional fields based on status (Decision Deadline, Expiration Date)

✨ **Approved Activity Tracking**
- Track activity status: Not Started, Started, Harvest Complete, Activity Complete
- Record Start Date, Harvest Complete Date, Activity Complete Date
- Add comments and mark reforestation requirements
- Full historical tracking

✨ **Renewal Management**
- Store historical renewal dates for Approved FPAs
- Track renewal notes and dates
- Complete audit trail

✨ **Full CRUD Operations**
- Add, Edit, Delete, and Search FPAs
- Real-time search by FPA Number, Landowner, or Timber Sale Name
- Sort FPAs by multiple criteria

✨ **Dashboard & Reporting**
- Summary dashboard grouping FPAs by status
- Quick overview of application counts by status
- Click through to detailed FPA information

✨ **Responsive & Mobile-Friendly**
- Works on desktop, tablet, and Android devices
- Touch-optimized UI for mobile use
- Responsive grid layout

## Technology Stack

**Backend:**
- Node.js + Express.js
- SQLite3 database (stored locally in folder)
- RESTful API

**Frontend:**
- React 18
- Axios for API calls
- Custom CSS with responsive design

**Database:**
- SQLite3 (single file stored locally)
- No external database required

## Project Structure

```
fpa/
├── backend/
│   ├── server.js           # Express server & API routes
│   ├── db.js              # SQLite database setup & helpers
│   └── package.json       # Backend dependencies
├── frontend/
│   ├── public/
│   │   └── index.html     # HTML template
│   ├── src/
│   │   ├── App.jsx        # Main React component
│   │   ├── App.css        # All styling (responsive)
│   │   ├── index.jsx      # React entry point
│   │   └── components/
│   │       ├── Dashboard.jsx         # Status-based dashboard
│   │       ├── FPAList.jsx          # List all FPAs
│   │       ├── FPAForm.jsx          # Add/Edit FPA
│   │       ├── FPADetail.jsx        # View FPA details
│   │       ├── ActivityTracker.jsx  # Activity tracking
│   │       ├── RenewalHistory.jsx   # Renewal management
│   │       └── SearchBar.jsx        # Search functionality
│   └── package.json       # Frontend dependencies
├── package.json           # Root package.json
├── start.bat             # Windows startup script
└── README.md             # This file
```

## Installation & Setup

### Prerequisites
- Node.js 14.0+ (download from https://nodejs.org)
- npm (comes with Node.js)

### Quick Start (Windows)

1. **Download and extract the FPA Tracker folder** to your desired location

2. **Run the Windows startup script:**
   - Double-click `start.bat` in the fpa folder
   - This will automatically install all dependencies and start the server

3. **Open your browser:**
   - Navigate to http://localhost:3000
   - The app will be ready to use!

### Manual Installation (All Platforms)

1. **Open a terminal/command prompt** in the fpa folder

2. **Install all dependencies:**
   ```
   npm run install-all
   ```

3. **Build the React frontend:**
   ```
   npm run build
   ```

4. **Start the server:**
   ```
   npm start
   ```

5. **Open your browser:**
   - Go to http://localhost:3000

## Usage

### Adding an FPA
1. Click the "➕ Add FPA" button in the navigation
2. Fill in required fields (FPA Number, Landowner, Timber Sale Name, Landowner Type)
3. Set Application Status if known
4. Click "Create FPA"

### Editing an FPA
1. Click on an FPA in the Dashboard or All FPAs list
2. Click "✏️ Edit" button
3. Update fields as needed
4. Click "Update FPA"

### Viewing FPA Details
1. Click on any FPA card or row in the list
2. View all information in the Overview tab
3. If Approved, access Activity Tracking and Renewal History tabs

### Tracking Approved Activity
1. Open an Approved FPA
2. Click the "Activity" tab
3. Click "Edit" to update activity status
4. Track progress from Not Started → Started → Harvest Complete → Activity Complete
5. Record dates and mark reforestation requirements

### Managing Renewals
1. Open an Approved FPA
2. Click the "Renewals" tab
3. Click "+ Add Renewal" to record renewal dates
4. View complete renewal history
5. Delete old renewal records if needed

### Searching FPAs
1. Use the search bar to find FPAs by:
   - FPA Number (exact or partial match)
   - Landowner name
   - Timber Sale Name
2. Results update in real-time as you type

### Dashboard Overview
- View all FPAs grouped by Application Status
- See count of FPAs in each status
- Click any FPA card to view full details
- Color-coded status indicators for quick reference

## AI Chatbot Configuration (Optional)

The FPA Tracker includes an intelligent chatbot assistant that can:
- **Execute FPA commands**: Add, view, update, delete FPAs using natural language
- **Answer general questions**: When configured with Google Gemini AI, chat about anything
- **Voice input**: Use your voice for hands-free interaction

### Basic Usage (No Setup Required)
The chatbot works out-of-the-box with FPA-specific commands:
- "Add FPA 2819234 landowner Smith timber sale Pine Ridge"
- "Set FPA 2819234 status to Approved"
- "Show me FPA 2819234"
- "Delete FPA 2819234"

### Enabling AI Chat (Free Google Gemini API)
To enable general AI conversations beyond FPA commands:

1. **Get a free Google Gemini API key:**
   - Go to https://makersuite.google.com/app/apikey
   - Sign in with your Google account
   - Click "Create API Key"
   - Copy the generated key

2. **Configure the app:**
   - Open `frontend/.env` file in a text editor
   - Replace `REACT_APP_GEMINI_API_KEY=` with `REACT_APP_GEMINI_API_KEY=your_api_key_here`
   - Save the file

3. **Rebuild and restart:**
   ```
   npm run build
   npm start
   ```

4. **Test the AI:**
   - Open the chatbot (🤖 button in bottom right)
   - Try FPA commands AND general questions
   - The assistant will intelligently route commands vs. conversations

**Note:** Google Gemini offers a generous free tier. Your API key is stored locally and never shared.

### Voice Controls
The voice input button (🎤) is located in the header toolbar:
- Click it to activate voice input
- Speak your search query or command
- Works for search, forms, and chatbot

## Android & Mobile Access

### On Desktop:
- Simply open http://localhost:3000 in your browser

### On Android Device (Same WiFi Network):
1. Find your computer's IP address:
   - Windows: Open Command Prompt and type `ipconfig` (look for IPv4 Address)
   - Example: 192.168.1.100

2. On your Android device, open a browser and go to:
   - http://[YOUR-COMPUTER-IP]:3000
   - Example: http://192.168.1.100:3000

3. The app is fully touch-optimized for mobile use

### Optional: Create Android App Shortcut
- On Android Chrome: Tap menu → "Add to Home Screen"
- This creates a native-like app shortcut

## Database

The SQLite database is stored in the `backend` folder as `fpa.db`. This is a single file that persists all data locally. No external database or hosting is required.

**Database Tables:**
- `fpas` - Main FPA records
- `approved_activities` - Activity tracking for approved FPAs
- `renewal_history` - Historical renewal dates

## Stopping the Server

- **Windows:** Close the terminal window, or press Ctrl+C
- **Mac/Linux:** Press Ctrl+C in the terminal

## Troubleshooting

### Port 3000 Already in Use
Edit `backend/server.js` and change `const PORT = 3000;` to a different port (e.g., 3001)

### Dependencies Installation Failed
1. Make sure Node.js is installed: `node --version`
2. Try again with: `npm install --legacy-peer-deps`

### Database Issues
Delete `backend/fpa.db` to reset the database and start fresh

### Can't Access from Android
- Ensure both devices are on the same WiFi network
- Disable any VPN/proxy on either device
- Check Windows Firewall allows Node.js (you may be prompted when first starting)

## Development

To run in development mode with hot-reloading:
```
npm run dev
```

This requires the `concurrently` package (included in devDependencies).

## Production Deployment

To build for production:
```
npm run build
```

This optimizes the React frontend for deployment.

## License

MIT

## Support

For issues or questions, check the troubleshooting section above or review the code comments in the respective files.

---

**Built with ❤️ for Forest Practice Application Management**
