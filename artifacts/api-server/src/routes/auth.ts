import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq, count } from "drizzle-orm";
import { signToken, verifyToken } from "../lib/auth.js";
import { getPlan } from "../lib/plans.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { generateOtp, otpExpiresAt, sendOtpEmail } from "../lib/email.js";

const router = Router();

function formatUser(user: typeof usersTable.$inferSelect) {
  const plan = getPlan(user.plan);
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    plan: user.plan,
    planName: plan.name,
    planPrice: plan.price,
    threads: plan.threads,
    imagesLimit: plan.imagesLimit,
    videosLimit: plan.videosLimit,
    regenerationsLimit: plan.regenerationsLimit,
    imagesUsed: user.imagesUsed,
    videosUsed: user.videosUsed,
    regenerationsUsed: user.regenerationsUsed,
  };
}

router.post("/auth/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      res.status(400).json({ error: "Name, email and password are required" });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ error: "Password must be at least 6 characters" });
      return;
    }

    const existing = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase())).limit(1);
    if (existing.length > 0) {
      const existingUser = existing[0];
      if (!existingUser.emailVerified) {
        const otp = generateOtp();
        const expires = otpExpiresAt();
        await db.update(usersTable).set({ otpCode: otp, otpExpiresAt: expires }).where(eq(usersTable.id, existingUser.id));
        await sendOtpEmail(existingUser.email, existingUser.name, otp);
        res.json({ requiresOtp: true, email: existingUser.email, message: "OTP resent to your email" });
        return;
      }
      res.status(409).json({ error: "Email already registered" });
      return;
    }

    const [{ total }] = await db.select({ total: count() }).from(usersTable);
    const isFirstUser = Number(total) === 0;

    const passwordHash = await bcrypt.hash(password, 10);
    const otp = isFirstUser ? null : generateOtp();
    const expires = isFirstUser ? null : otpExpiresAt();

    const [user] = await db.insert(usersTable).values({
      name,
      email: email.toLowerCase(),
      passwordHash,
      role: isFirstUser ? "admin" : "user",
      status: isFirstUser ? "approved" : "pending",
      emailVerified: isFirstUser,
      otpCode: otp,
      otpExpiresAt: expires,
      plan: "free",
    }).returning();

    if (isFirstUser) {
      const token = signToken({ userId: user.id, email: user.email, role: user.role });
      res.json({ token, user: formatUser(user) });
      return;
    }

    await sendOtpEmail(user.email, user.name, otp!);
    res.json({ requiresOtp: true, email: user.email });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ error: "Registration failed" });
  }
});

router.post("/auth/verify-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      res.status(400).json({ error: "Email and OTP are required" });
      return;
    }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase())).limit(1);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    if (user.emailVerified) {
      res.status(400).json({ error: "Email already verified" });
      return;
    }
    if (!user.otpCode || user.otpCode !== otp) {
      res.status(400).json({ error: "Invalid OTP code" });
      return;
    }
    if (!user.otpExpiresAt || user.otpExpiresAt < new Date()) {
      res.status(400).json({ error: "OTP has expired. Please request a new one." });
      return;
    }

    const [updated] = await db.update(usersTable).set({
      emailVerified: true,
      status: "approved",
      approvedAt: new Date(),
      otpCode: null,
      otpExpiresAt: null,
    }).where(eq(usersTable.id, user.id)).returning();

    const token = signToken({ userId: updated.id, email: updated.email, role: updated.role });
    res.json({ token, user: formatUser(updated) });
  } catch (err) {
    console.error("Verify OTP error:", err);
    res.status(500).json({ error: "Verification failed" });
  }
});

router.post("/auth/resend-otp", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      res.status(400).json({ error: "Email is required" });
      return;
    }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase())).limit(1);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    if (user.emailVerified) {
      res.status(400).json({ error: "Email already verified" });
      return;
    }

    const otp = generateOtp();
    const expires = otpExpiresAt();
    await db.update(usersTable).set({ otpCode: otp, otpExpiresAt: expires }).where(eq(usersTable.id, user.id));
    await sendOtpEmail(user.email, user.name, otp);
    res.json({ message: "OTP sent" });
  } catch (err) {
    console.error("Resend OTP error:", err);
    res.status(500).json({ error: "Failed to resend OTP" });
  }
});

router.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required" });
      return;
    }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase())).limit(1);
    if (!user) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    if (!user.emailVerified) {
      const otp = generateOtp();
      const expires = otpExpiresAt();
      await db.update(usersTable).set({ otpCode: otp, otpExpiresAt: expires }).where(eq(usersTable.id, user.id));
      await sendOtpEmail(user.email, user.name, otp);
      res.json({ requiresOtp: true, email: user.email, message: "Please verify your email first" });
      return;
    }

    await db.update(usersTable).set({ lastLoginAt: new Date() }).where(eq(usersTable.id, user.id));
    const token = signToken({ userId: user.id, email: user.email, role: user.role });
    res.json({ token, user: formatUser(user) });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Login failed" });
  }
});

router.get("/auth/me", async (req, res) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const payload = verifyToken(auth.slice(7));
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, payload.userId)).limit(1);
    if (!user) {
      res.status(401).json({ error: "User not found" });
      return;
    }
    res.json(formatUser(user));
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
});

router.get("/user/usage", requireAuth, async (req, res) => {
  const userId = (req as any).user.id as number;
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    const plan = getPlan(user.plan);
    res.json({
      plan: user.plan,
      planName: plan.name,
      planPrice: plan.price,
      threads: plan.threads,
      imagesLimit: plan.imagesLimit,
      videosLimit: plan.videosLimit,
      regenerationsLimit: plan.regenerationsLimit,
      imagesUsed: user.imagesUsed,
      videosUsed: user.videosUsed,
      regenerationsUsed: user.regenerationsUsed,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch usage" });
  }
});

export default router;
