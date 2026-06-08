// ═══════════════════════════════════════════════════
//  SMS Service — Africa's Talking
//  Docs: https://developers.africastalking.com/docs/sms
// ═══════════════════════════════════════════════════

const AfricasTalking = require('africastalking');

// Initialize the SDK with your credentials from .env
const AT = AfricasTalking({
  apiKey:   process.env.AT_API_KEY,
  username: process.env.AT_USERNAME, // 'sandbox' for testing
});

const sms = AT.SMS;

// ─── Alert type → phone number mapping ───────────
const EMERGENCY_PHONES = {
  'SOS EMERGENCY':      process.env.PHONE_SOS,
  'FIRE ALERT':         process.env.PHONE_FIRE,
  'MEDICAL EMERGENCY':  process.env.PHONE_MEDICAL,
  'BOAT SINKING ALERT': process.env.PHONE_SINKING,
};

// ─── Build the SMS message text ───────────────────
function buildSmsMessage({ type, boatId, passenger, paxCount, vesselType, lat, lon, time }) {
  const mapsLink = `maps.google.com/?q=${lat},${lon}`;
  return (
    `🚨 VOLTA LAKE ALERT 🚨\n` +
    `Type: ${type}\n` +
    `Boat: ${boatId} (${vesselType})\n` +
    `Reported by: ${passenger}\n` +
    `Onboard: ${paxCount} people\n` +
    `GPS: ${Number(lat).toFixed(5)}, ${Number(lon).toFixed(5)}\n` +
    `Map: ${mapsLink}\n` +
    `Time: ${time}\n` +
    `-- Volta Lake Emergency System`
  );
}

// ─── Send SMS ─────────────────────────────────────
async function sendEmergencySMS({ type, boatId, passenger, paxCount, vesselType, lat, lon, phone }) {
  const time = new Date().toLocaleString('en-GH', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Africa/Accra',
  });

  const message = buildSmsMessage({ type, boatId, passenger, paxCount, vesselType, lat, lon, time });

  // Collect all recipients for this alert type
  const recipients = [];

  // The specific emergency line for this alert type
  const specificPhone = EMERGENCY_PHONES[type] || phone;
  if (specificPhone) recipients.push(specificPhone);

  // The master line receives all alerts (if configured and not duplicate)
  const masterPhone = process.env.PHONE_MASTER;
  if (masterPhone && masterPhone !== specificPhone) {
    recipients.push(masterPhone);
  }

  if (!recipients.length) {
    console.warn('⚠️  No phone numbers configured for alert type:', type);
    return { success: false, error: 'No recipients configured' };
  }

  try {
    console.log(`📱 Sending SMS to: ${recipients.join(', ')}`);
    console.log(`📋 Message:\n${message}`);

    const response = await sms.send({
      to:       recipients,
      message:  message,
      // from: 'VoltaLake', // Optional sender name — needs registration in production
    });

    const results = response.SMSMessageData?.Recipients || [];
    const allOk   = results.every(r => r.status === 'Success' || r.statusCode === 101);

    console.log('📨 SMS API response:', JSON.stringify(response, null, 2));

    return {
      success:    allOk,
      message:    message,
      recipients: results,
      raw:        response,
    };

  } catch (err) {
    console.error('❌ SMS send failed:', err.message);
    return {
      success: false,
      error:   err.message,
      message: message,
    };
  }
}

module.exports = { sendEmergencySMS, buildSmsMessage };
