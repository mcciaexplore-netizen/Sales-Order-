const nodemailer = require('nodemailer');

let cachedTransporter = null;

function getTransporter() {
  if (cachedTransporter !== null) return cachedTransporter;

  const host = process.env.SMTP_HOST;
  if (!host) {
    cachedTransporter = false;
    return false;
  }

  cachedTransporter = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });
  return cachedTransporter;
}

async function sendMail({ to, subject, text, html }) {
  const transporter = getTransporter();
  const from = process.env.SMTP_FROM || 'no-reply@sales-order.local';

  if (!transporter) {
    console.log('\n[email] SMTP not configured — email not sent.');
    console.log(`[email] To: ${to}`);
    console.log(`[email] Subject: ${subject}`);
    console.log(`[email] Body:\n${text}\n`);
    return { sent: false, reason: 'smtp-not-configured' };
  }

  try {
    const info = await transporter.sendMail({ from, to, subject, text, html });
    console.log(`[email] Sent to ${to} (messageId: ${info.messageId})`);
    return { sent: true, messageId: info.messageId };
  } catch (err) {
    console.error(`[email] Failed to send to ${to}:`, err.message);
    return { sent: false, reason: err.message };
  }
}

module.exports = { sendMail };
