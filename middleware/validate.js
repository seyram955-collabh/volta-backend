// ═══════════════════════════════════════════════════
//  Validation Middleware
// ═══════════════════════════════════════════════════

const VALID_ALERT_TYPES = [
  'SOS EMERGENCY',
  'FIRE ALERT',
  'MEDICAL EMERGENCY',
  'BOAT SINKING ALERT',
];

function validateAlert(req, res, next) {
  const { type, boatId, passenger, lat, lon } = req.body;
  const errors = [];

  // Required fields
  if (!type)      errors.push('Alert type is required');
  if (!boatId)    errors.push('Boat ID is required');
  if (!passenger) errors.push('Passenger name is required');
  if (lat === undefined || lat === null) errors.push('Latitude is required');
  if (lon === undefined || lon === null) errors.push('Longitude is required');

  // Type must be valid
  if (type && !VALID_ALERT_TYPES.includes(type)) {
    errors.push(`Invalid alert type. Must be one of: ${VALID_ALERT_TYPES.join(', ')}`);
  }

  // GPS must be valid numbers
  const latNum = parseFloat(lat);
  const lonNum = parseFloat(lon);
  if (lat !== undefined && (isNaN(latNum) || latNum < -90 || latNum > 90)) {
    errors.push('Latitude must be a valid number between -90 and 90');
  }
  if (lon !== undefined && (isNaN(lonNum) || lonNum < -180 || lonNum > 180)) {
    errors.push('Longitude must be a valid number between -180 and 180');
  }

  // Boat ID max length
  if (boatId && boatId.length > 30) {
    errors.push('Boat ID must be 30 characters or fewer');
  }

  // Passenger name max length
  if (passenger && passenger.length > 80) {
    errors.push('Passenger name must be 80 characters or fewer');
  }

  if (errors.length > 0) {
    return res.status(400).json({ success: false, errors });
  }

  next();
}

module.exports = { validateAlert };
