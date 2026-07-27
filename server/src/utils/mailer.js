import nodemailer from 'nodemailer';

let transporter;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return transporter;
}

async function sendVerificationEmail(email, rawToken) {
  const verifyUrl = `${process.env.CLIENT_URL}/verify-email/${rawToken}`;

  await getTransporter().sendMail({
    from: process.env.EMAIL_FROM,
    to: email,
    subject: 'Verify your Pairagraph email',
    html: `<p>Confirm your email to start writing on Pairagraph.</p>
           <p><a href="${verifyUrl}">${verifyUrl}</a></p>`,
  });
}

async function sendPasswordResetEmail(email, rawToken) {
  const resetUrl = `${process.env.CLIENT_URL}/reset-password/${rawToken}`;

  await getTransporter().sendMail({
    from: process.env.EMAIL_FROM,
    to: email,
    subject: 'Reset your Pairagraph password',
    html: `<p>Someone requested a password reset for this account. If that was you, choose a new password here:</p>
           <p><a href="${resetUrl}">${resetUrl}</a></p>
           <p>If you didn't request this, you can safely ignore this email.</p>`,
  });
}

async function sendGoogleAccountNoticeEmail(email) {
  await getTransporter().sendMail({
    from: process.env.EMAIL_FROM,
    to: email,
    subject: 'Password reset requested for your Pairagraph account',
    html: `<p>Someone requested a password reset for this account, but it's set up to sign in with Google.</p>
           <p>Use "Sign in with Google" instead — there's no separate password to reset.</p>`,
  });
}

// Exported as a single mutable object (rather than named exports) so tests can
// swap individual methods with node:test's mock.method without hitting real SMTP.
export const mailer = {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendGoogleAccountNoticeEmail,
};
