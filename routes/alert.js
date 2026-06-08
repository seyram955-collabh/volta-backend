// ═══════════════════════════════════════════════════
//  Alert Routes
//  POST /api/alert/send     → Send emergency alert
//  GET  /api/alert/history  → Get all alerts
//  GET  /api/alert/stats    → Get alert statistics
//  GET  /api/alert/:id      → Get single alert
// ═══════════════════════════════════════════════════

const express  = require('express');
const router   = express.Router();

const { sendEmergencySMS }                        = require('../services/sms');
const { saveAlert, updateSmsStatus, getAlerts, getAlertById, getStats } = require('../db/database');
const { validateAlert }                           = require('../middleware/validate');

// ─── POST /api/alert/send ─────────────────────────
// Called by the frontend when user taps an alert button
router.post('/send', validateAlert, async (req, res) => {
  const {
    type,
    boatId,
    passenger,
    paxCount    = 'Unknown',
    vesselType  = 'Unknown',
    lat,
    lon,
    phone,
  } = req.body;

  const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

  console.log(`\n🚨 INCOMING ALERT — ${type}`);
  console.log(`   Boat: ${boatId} | Passenger: ${passenger}`);
  console.log(`   GPS: ${lat}, ${lon} | IP: ${ipAddress}`);

  // 1. Save alert to database immediately (even if SMS fails)
  let alertId;
  try {
    alertId = saveAlert({
      type,
      boatId,
      passenger,
      paxCount,
      vesselType,
      lat: parseFloat(lat),
      lon: parseFloat(lon),
      phone: phone || '',
      smsStatus:  'pending',
      smsMessage: '',
      ipAddress,
    });
    console.log(`   ✅ Saved to DB — Alert ID: ${alertId}`);
  } catch (dbErr) {
    console.error('   ❌ DB save failed:', dbErr.message);
    return res.status(500).json({ success: false, error: 'Failed to record alert' });
  }

  // 2. Send SMS via Africa's Talking
  let smsResult;
  try {
    smsResult = await sendEmergencySMS({
      type, boatId, passenger, paxCount, vesselType,
      lat: parseFloat(lat),
      lon: parseFloat(lon),
      phone,
    });

    // Update DB with SMS result
    updateSmsStatus(alertId, smsResult.success ? 'sent' : 'failed');

    if (smsResult.success) {
      console.log(`   📱 SMS sent successfully`);
    } else {
      console.warn(`   ⚠️  SMS failed: ${smsResult.error}`);
    }
  } catch (smsErr) {
    console.error('   ❌ SMS error:', smsErr.message);
    updateSmsStatus(alertId, 'failed');
    smsResult = { success: false, error: smsErr.message };
  }

  // 3. Respond to frontend
  // We return success:true even if SMS failed — the alert is recorded.
  // The frontend should show it was dispatched.
  res.status(200).json({
    success:    true,
    alertId,
    type,
    boatId,
    passenger,
    paxCount,
    vesselType,
    lat:        parseFloat(lat),
    lon:        parseFloat(lon),
    sms: {
      sent:       smsResult.success,
      message:    smsResult.message || null,
      error:      smsResult.success ? null : smsResult.error,
    },
    timestamp: new Date().toISOString(),
  });
});


// ─── GET /api/alert/history ───────────────────────
// Returns paginated alert history
router.get('/history', (req, res) => {
  const limit  = Math.min(parseInt(req.query.limit)  || 50, 200);
  const offset = parseInt(req.query.offset) || 0;
  const type   = req.query.type || null;

  try {
    const alerts = getAlerts({ limit, offset, type });
    res.json({ success: true, count: alerts.length, alerts });
  } catch (err) {
    console.error('History fetch error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch history' });
  }
});


// ─── GET /api/alert/stats ─────────────────────────
// Returns summary statistics
router.get('/stats', (req, res) => {
  try {
    const stats = getStats();
    res.json({ success: true, ...stats });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch stats' });
  }
});


// ─── GET /api/alert/:id ───────────────────────────
// Returns a single alert by ID
router.get('/:id', (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ success: false, error: 'Invalid alert ID' });

  try {
    const alert = getAlertById(id);
    if (!alert) return res.status(404).json({ success: false, error: 'Alert not found' });
    res.json({ success: true, alert });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch alert' });
  }
});


module.exports = router;
