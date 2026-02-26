/**
 * Send SMS via Twilio Messages API.
 * Requires: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_SMS_FROM in .env.
 * TWILIO_SMS_FROM = your Twilio phone number (e.g. +16615181820).
 */

function formatPhoneE164(phone) {
  if (!phone || typeof phone !== 'string') return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 10) return null;
  if (digits.length === 10) return `+91${digits}`;
  if (digits.startsWith('91') && digits.length >= 12) return `+${digits}`;
  if (digits.length >= 10) return `+${digits}`;
  return null;
}

/**
 * @param {string} toPhone - Patient phone (e.g. 9566551345 or +919566551345)
 * @param {string} body - SMS text
 */
async function sendSms(toPhone, body) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_SMS_FROM || process.env.TWILIO_WHATSAPP_FROM;

  if (!accountSid || !authToken || !from) {
    throw new Error('SMS not configured: set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_SMS_FROM in .env');
  }

  const to = formatPhoneE164(toPhone);
  if (!to) {
    throw new Error('Invalid or missing patient phone number for SMS');
  }

  const cleanFrom = from.startsWith('+') ? from : from.replace(/^whatsapp:/, '');
  const params = new URLSearchParams();
  params.set('To', to);
  params.set('From', cleanFrom);
  params.set('Body', body || '');

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data.message || data.error_message || res.statusText || 'Twilio request failed';
    throw new Error(msg);
  }
  return data;
}

module.exports = { sendSms, formatPhoneE164 };
