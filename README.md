# 🚤 Volta Lake Emergency Response — Backend

A Node.js + Express backend for the Volta Lake Emergency Response System.
Receives alerts from the frontend, sends SMS via Africa's Talking, and stores all alerts in a SQLite database.

---

## 📁 Project Structure

```
volta-backend/
├── server.js               ← Entry point
├── .env.example            ← Copy to .env and fill in your keys
├── package.json
├── routes/
│   └── alert.js            ← API endpoints
├── services/
│   └── sms.js              ← Africa's Talking SMS integration
├── db/
│   ├── database.js         ← SQLite setup & queries
│   └── alerts.db           ← Auto-created on first run
└── middleware/
    └── validate.js         ← Input validation
```

---

## 🚀 Setup (Step by Step)

### 1. Install Node.js
Download from https://nodejs.org (use the LTS version)

### 2. Clone / download this folder
```bash
cd volta-backend
```

### 3. Install dependencies
```bash
npm install
```

### 4. Create your .env file
```bash
cp .env.example .env
```
Then open `.env` and fill in your real values.

### 5. Get your Africa's Talking API key
1. Sign up at https://africastalking.com
2. Go to **Sandbox** to test for free
3. Copy your **API Key** from Settings → API Key
4. Set `AT_USERNAME=sandbox` and `AT_API_KEY=your_key` in `.env`

### 6. Run the server
```bash
# Development (auto-restarts on file changes)
npm run dev

# Production
npm start
```

You should see:
```
✅ Database initialized
🚤 ═══════════════════════════════════════════
   Volta Lake Emergency Response System
   Server running on http://localhost:3000
```

---

## 📡 API Endpoints

### `POST /api/alert/send`
Send an emergency alert. Called by the frontend.

**Request body:**
```json
{
  "type":       "SOS EMERGENCY",
  "boatId":     "VL-2045",
  "passenger":  "Kofi Mensah",
  "paxCount":   "8",
  "vesselType": "Fishing Boat",
  "lat":        6.52441,
  "lon":        0.12340,
  "phone":      "+233241111111"
}
```

**Valid alert types:**
- `SOS EMERGENCY`
- `FIRE ALERT`
- `MEDICAL EMERGENCY`
- `BOAT SINKING ALERT`

**Response:**
```json
{
  "success": true,
  "alertId": 1,
  "sms": {
    "sent": true,
    "message": "🚨 VOLTA LAKE ALERT ..."
  }
}
```

---

### `GET /api/alert/history`
Returns all past alerts (newest first).

Query params:
- `limit` — number of results (default: 50, max: 200)
- `offset` — for pagination
- `type` — filter by alert type

Example: `GET /api/alert/history?limit=10&type=FIRE ALERT`

---

### `GET /api/alert/stats`
Returns summary counts.

```json
{
  "success": true,
  "total": 42,
  "today": 3,
  "byType": [
    { "type": "SOS EMERGENCY", "count": 15 },
    { "type": "FIRE ALERT", "count": 8 }
  ]
}
```

---

### `GET /api/alert/:id`
Get a single alert by its database ID.

---

### `GET /health`
Health check.

---

## 🔌 Connecting the Frontend

In your `volta_emergency.html`, update the `sendAlert` function to POST to your backend instead of just logging locally. Replace the end of the `sendAlert` function with:

```javascript
// After getting GPS coordinates, send to backend
const response = await fetch('http://localhost:3000/api/alert/send', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    type, boatId, passenger, paxCount, vesselType,
    lat, lon, phone
  })
});

const data = await response.json();
if (!data.success) throw new Error('Backend error');
// data.sms.sent tells you if SMS was delivered
```

---

## 🌐 Deploying to Production

### Option A — Railway (Easiest)
1. Push this folder to a GitHub repo
2. Go to https://railway.app → New Project → Deploy from GitHub
3. Add your `.env` variables in Railway's dashboard
4. Railway gives you a public URL like `https://volta-backend.up.railway.app`

### Option B — Render
1. Push to GitHub
2. Go to https://render.com → New Web Service
3. Set start command: `npm start`
4. Add environment variables

### Option C — VPS (DigitalOcean / Hetzner)
```bash
# On your server
git clone your-repo
cd volta-backend
npm install --production
# Use PM2 to keep it running
npm install -g pm2
pm2 start server.js --name volta-backend
pm2 save
```

---

## 🧪 Testing with cURL

```bash
# Health check
curl http://localhost:3000/health

# Send a test alert
curl -X POST http://localhost:3000/api/alert/send \
  -H "Content-Type: application/json" \
  -d '{
    "type": "SOS EMERGENCY",
    "boatId": "VL-TEST-01",
    "passenger": "Test User",
    "paxCount": "5",
    "vesselType": "Fishing Boat",
    "lat": 6.5244,
    "lon": 0.1234,
    "phone": "+233241111111"
  }'

# Get history
curl http://localhost:3000/api/alert/history

# Get stats
curl http://localhost:3000/api/alert/stats
```

---

## ⚠️ Notes

- **SQLite** is used for simplicity. For high traffic, swap to PostgreSQL.
- The database file `db/alerts.db` is auto-created on first run.
- Rate limiting is set to **10 alerts per IP per 15 minutes** to prevent spam.
- Africa's Talking **sandbox mode** does not send real SMS — use it for testing only. Switch `AT_USERNAME` to your real username and `AT_API_KEY` to your live key for production.

---

## 📞 Emergency Numbers (Ghana)
Update these in your `.env` file with the real Volta Lake Authority numbers:
- `PHONE_SOS` — General SOS line
- `PHONE_FIRE` — Fire response
- `PHONE_MEDICAL` — Medical emergency
- `PHONE_SINKING` — Boat sinking response
- `PHONE_MASTER` — Master line (receives all alert types)
