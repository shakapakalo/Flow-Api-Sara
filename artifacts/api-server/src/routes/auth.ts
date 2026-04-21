import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq, count } from "drizzle-orm";
import { signToken, verifyToken } from "../lib/auth.js";
import { getPlan } from "../lib/plans.js";
import { requireAuth } from "../middleware/requireAuth.js";

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
      res.status(409).json({ error: "Email already registered" });
      return;
    }

    const [{ total }] = await db.select({ total: count() }).from(usersTable);
    const isFirstUser = Number(total) === 0;

    const passwordHash = await bcrypt.hash(password, 10);

    const [user] = await db.insert(usersTable).values({
      name,
      email: email.toLowerCase(),
      passwordHash,
      role: isFirstUser ? "admin" : "user",
      status: "approved",
      emailVerified: true,
      plan: "free",
    }).returning();

    const token = signToken({ userId: user.id, email: user.email, role: user.role });
    res.json({ token, user: formatUser(user) });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ error: "Registration failed" });
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
