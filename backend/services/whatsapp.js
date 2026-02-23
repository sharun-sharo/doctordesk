/**
 * Send WhatsApp message via Twilio WhatsApp API.
 * Requires: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM in .env.
 * Optional: TWILIO_WHATSAPP_CONTENT_SID for template messages (with ContentVariables).
 *
 * Simple text: sendWhatsApp(toPhone, body)
 * Template:    sendWhatsApp(toPhone, { contentSid: 'HX...', contentVariables: { '1': '12/1', '2': '3pm' } })
 */

function formatPhoneForWhatsApp(phone) {
  if (!phone || typeof phone !== 'string') return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 10) return null;
  if (digits.length === 10) return `whatsapp:+91${digits}`;
  if (digits.startsWith('91') && digits.length >= 12) return `whatsapp:+${digits}`;
  if (digits.length >= 10) return `whatsapp:+${digits}`;
  return null;
}

/**
 * @param {string} toPhone - Patient phone (e.g. 9566551345 or +919566551345)
 * @param {string|{ body?: string, contentSid?: string, contentVariables?: Record<string, string> }} bodyOrOptions - Plain text body, or { contentSid, contentVariables } for template
 */
async function sendWhatsApp(toPhone, bodyOrOptions) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM;

  if (!accountSid || !authToken || !from) {
    throw new Error('WhatsApp not configured: set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM in .env');
  }

  const to = formatPhoneForWhatsApp(toPhone);
  if (!to) {
    throw new Error('Invalid or missing patient phone number for WhatsApp');
  }

  const params = new URLSearchParams();
  params.set('To', to);
  params.set('From', from.startsWith('whatsapp:') ? from : `whatsapp:${from}`);

  const isTemplate = typeof bodyOrOptions === 'object' && bodyOrOptions != null && bodyOrOptions.contentSid;
  if (isTemplate) {
    params.set('ContentSid', bodyOrOptions.contentSid);
    if (bodyOrOptions.contentVariables && Object.keys(bodyOrOptions.contentVariables).length > 0) {
      params.set('ContentVariables', JSON.stringify(bodyOrOptions.contentVariables));
    }
  } else {
    const body = typeof bodyOrOptions === 'string' ? bodyOrOptions : (bodyOrOptions && bodyOrOptions.body) || '';
    params.set('Body', body);
  }

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

module.exports = { sendWhatsApp, formatPhoneForWhatsApp };
