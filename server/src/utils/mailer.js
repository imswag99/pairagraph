import { BrevoClient } from '@getbrevo/brevo';

const brevo = new BrevoClient({ apiKey: process.env.BREVO_API_KEY });

// EMAIL_FROM is stored as "Display Name <email@domain>"; Brevo's helper
// expects { name, email } rather than parsing that string itself. Strip a
// wrapping pair of double quotes first — unlike a local .env file, Render's
// dashboard stores the value exactly as typed, quotes and all.
function parseFromAddress(raw) {
  const unquoted = raw?.trim().replace(/^"(.*)"$/, '$1');
  const match = unquoted?.match(/^(.*?)\s*<(.+)>$/);
  if (match) {
    return { name: match[1].replace(/^"|"$/g, ''), email: match[2] };
  }
  return { email: unquoted };
}

const sender = parseFromAddress(process.env.EMAIL_FROM);

// The report email is the first place arbitrary user-submitted text (the
// "details" field) gets embedded in an HTML email, rather than only
// server-generated tokens/URLs — escape it so it can't break the markup.
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

async function sendVerificationEmail(email, rawToken) {
  const verifyUrl = `${process.env.CLIENT_URL}/verify-email/${rawToken}`;

  await brevo.transactionalEmails.sendTransacEmail({
    sender,
    to: [{ email }],
    subject: 'Verify your Pairagraph email',
    htmlContent: `<p>Confirm your email to start writing on Pairagraph.</p>
           <p><a href="${verifyUrl}">${verifyUrl}</a></p>`,
  });
}

async function sendPasswordResetEmail(email, rawToken) {
  const resetUrl = `${process.env.CLIENT_URL}/reset-password/${rawToken}`;

  await brevo.transactionalEmails.sendTransacEmail({
    sender,
    to: [{ email }],
    subject: 'Reset your Pairagraph password',
    htmlContent: `<p>Someone requested a password reset for this account. If that was you, choose a new password here:</p>
           <p><a href="${resetUrl}">${resetUrl}</a></p>
           <p>If you didn't request this, you can safely ignore this email.</p>`,
  });
}

async function sendGoogleAccountNoticeEmail(email) {
  await brevo.transactionalEmails.sendTransacEmail({
    sender,
    to: [{ email }],
    subject: 'Password reset requested for your Pairagraph account',
    htmlContent: `<p>Someone requested a password reset for this account, but it's set up to sign in with Google.</p>
           <p>Use "Sign in with Google" instead — there's no separate password to reset.</p>`,
  });
}

async function sendReportNotificationEmail({ reporter, reportedUser, collaborationId, reason, details }) {
  await brevo.transactionalEmails.sendTransacEmail({
    sender,
    to: [{ email: sender.email }],
    subject: 'New report on Pairagraph',
    htmlContent: `<p>${escapeHtml(reporter.displayName)} (${escapeHtml(reporter.email)}) reported ${escapeHtml(reportedUser.displayName)} (${escapeHtml(reportedUser.email)}).</p>
           <p><strong>Reason:</strong> ${escapeHtml(reason)}</p>
           ${details ? `<p><strong>Details:</strong> ${escapeHtml(details)}</p>` : ''}
           <p>Collaboration ID: ${escapeHtml(collaborationId.toString())}</p>`,
  });
}

async function sendGalleryReportNotificationEmail({ reporter, collaborationId, reason, details }) {
  await brevo.transactionalEmails.sendTransacEmail({
    sender,
    to: [{ email: sender.email }],
    subject: 'New gallery report on Pairagraph',
    htmlContent: `<p>${escapeHtml(reporter.displayName)} (${escapeHtml(reporter.email)}) reported a published piece.</p>
           <p><strong>Reason:</strong> ${escapeHtml(reason)}</p>
           ${details ? `<p><strong>Details:</strong> ${escapeHtml(details)}</p>` : ''}
           <p>Collaboration ID: ${escapeHtml(collaborationId.toString())}</p>`,
  });
}

async function sendYourTurnEmail(email, { collaborationId, writingType }) {
  const url = `${process.env.CLIENT_URL}/collaborations/${collaborationId}`;

  await brevo.transactionalEmails.sendTransacEmail({
    sender,
    to: [{ email }],
    subject: "It's your turn on Pairagraph",
    htmlContent: `<p>Your writing partner just took their turn on your ${writingType} — it's your turn now.</p>
           <p><a href="${url}">${url}</a></p>`,
  });
}

// Exported as a single mutable object (rather than named exports) so tests can
// swap individual methods with node:test's mock.method without hitting the real API.
export const mailer = {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendGoogleAccountNoticeEmail,
  sendReportNotificationEmail,
  sendGalleryReportNotificationEmail,
  sendYourTurnEmail,
};
