import nodemailer from "nodemailer";

function getTransporter() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || "587");
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) return null;

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

export function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function otpExpiresAt(): Date {
  const d = new Date();
  d.setMinutes(d.getMinutes() + 15);
  return d;
}

export async function sendOtpEmail(to: string, name: string, otp: string): Promise<boolean> {
  const transporter = getTransporter();
  const from = process.env.SMTP_FROM || process.env.SMTP_USER || "noreply@flowbyrsa.com";
  const appName = "Flow by RSA";

  if (!transporter) {
    console.log(`[OTP] No SMTP configured — OTP for ${to}: ${otp}`);
    return true;
  }

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="background:#080810;color:#e4e4e7;font-family:sans-serif;margin:0;padding:32px 16px;">
  <div style="max-width:480px;margin:0 auto;background:#18181b;border-radius:16px;padding:32px;border:1px solid #27272a;">
    <div style="text-align:center;margin-bottom:24px;">
      <div style="display:inline-block;width:48px;height:48px;border-radius:12px;background:linear-gradient(135deg,#7c3aed,#4f46e5);text-align:center;line-height:48px;font-size:22px;margin-bottom:12px;">⚡</div>
      <h1 style="margin:0;font-size:20px;font-weight:700;color:#fff;">${appName}</h1>
      <p style="margin:4px 0 0;color:#71717a;font-size:13px;">AI Image &amp; Video Generation</p>
    </div>
    <h2 style="font-size:16px;font-weight:600;color:#fff;margin:0 0 8px;">Verify your email</h2>
    <p style="color:#a1a1aa;font-size:14px;margin:0 0 24px;">Hi ${name}, enter this OTP code to verify your email and activate your account:</p>
    <div style="background:#09090b;border:1px solid #3f3f46;border-radius:12px;padding:20px;text-align:center;margin-bottom:24px;">
      <span style="font-size:36px;font-weight:700;letter-spacing:12px;color:#a78bfa;">${otp}</span>
    </div>
    <p style="color:#71717a;font-size:12px;text-align:center;margin:0;">This code expires in <strong style="color:#a1a1aa;">15 minutes</strong>.<br>If you didn't register, ignore this email.</p>
  </div>
</body>
</html>`;

  try {
    await transporter.sendMail({
      from: `"${appName}" <${from}>`,
      to,
      subject: `${otp} — Your ${appName} verification code`,
      html,
    });
    return true;
  } catch (err) {
    console.error("[OTP] Email send failed:", err);
    return false;
  }
}
