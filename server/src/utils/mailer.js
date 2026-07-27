import sgMail from '@sendgrid/mail';

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// EMAIL_FROM is stored as "Display Name <email@domain>"; SendGrid's helper
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

const from = parseFromAddress(process.env.EMAIL_FROM);

async function sendVerificationEmail(email, rawToken) {
  const verifyUrl = `${process.env.CLIENT_URL}/verify-email/${rawToken}`;

  await sgMail.send({
    from,
    to: email,
    subject: 'Verify your Pairagraph email',
    html: `<p>Confirm your email to start writing on Pairagraph.</p>
           <p><a href="${verifyUrl}">${verifyUrl}</a></p>`,
  });
}

async function sendPasswordResetEmail(email, rawToken) {
  const resetUrl = `${process.env.CLIENT_URL}/reset-password/${rawToken}`;

  await sgMail.send({
    from,
    to: email,
    subject: 'Reset your Pairagraph password',
    html: `<p>Someone requested a password reset for this account. If that was you, choose a new password here:</p>
           <p><a href="${resetUrl}">${resetUrl}</a></p>
           <p>If you didn't request this, you can safely ignore this email.</p>`,
  });
}

async function sendGoogleAccountNoticeEmail(email) {
  await sgMail.send({
    from,
    to: email,
    subject: 'Password reset requested for your Pairagraph account',
    html: `<p>Someone requested a password reset for this account, but it's set up to sign in with Google.</p>
           <p>Use "Sign in with Google" instead — there's no separate password to reset.</p>`,
  });
}

// Exported as a single mutable object (rather than named exports) so tests can
// swap individual methods with node:test's mock.method without hitting the real API.
export const mailer = {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendGoogleAccountNoticeEmail,
};
