import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq, count, sql } from "drizzle-orm";
import { requireAdmin } from "../middleware/requireAdmin.js";
import { PLAN_IDS, getPlan } from "../lib/plans.js";
import http from "http";

const router = Router();

router.get("/admin/users", requireAdmin, async (req, res) => {
  try {
    const users = await db
      .select({
        id: usersTable.id,
        name: usersTable.name,
        email: usersTable.email,
        role: usersTable.role,
        status: usersTable.status,
        plan: usersTable.plan,
        imagesUsed: usersTable.imagesUsed,
        videosUsed: usersTable.videosUsed,
        regenerationsUsed: usersTable.regenerationsUsed,
        createdAt: usersTable.createdAt,
        lastLoginAt: usersTable.lastLoginAt,
        approvedAt: usersTable.approvedAt,
      })
      .from(usersTable)
      .orderBy(sql`${usersTable.createdAt} desc`);
    res.json(users);
  } catch (err) {
    console.error("Admin users error:", err);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

router.patch("/admin/users/:id", requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { status, role, plan } = req.body;

    const me = (req as any).user;
    if (me.id === id && status && status !== "approved") {
      res.status(400).json({ error: "Cannot change your own status" });
      return;
    }

    if (plan && !PLAN_IDS.includes(plan)) {
      res.status(400).json({ error: `Invalid plan. Valid: ${PLAN_IDS.join(", ")}` });
      return;
    }

    const updates: Record<string, unknown> = {};
    if (status) {
      updates.status = status;
      if (status === "approved") updates.approvedAt = new Date();
    }
    if (role) updates.role = role;
    if (plan) updates.plan = plan;

    const [updated] = await db.update(usersTable).set(updates).where(eq(usersTable.id, id)).returning();
    if (!updated) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json({
      id: updated.id,
      name: updated.name,
      email: updated.email,
      role: updated.role,
      status: updated.status,
      plan: updated.plan,
    });
  } catch (err) {
    console.error("Admin update user error:", err);
    res.status(500).json({ error: "Failed to update user" });
  }
});

router.post("/admin/users/:id/reset-usage", requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [updated] = await db
      .update(usersTable)
      .set({ imagesUsed: 0, videosUsed: 0, regenerationsUsed: 0 })
      .where(eq(usersTable.id, id))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to reset usage" });
  }
});

router.delete("/admin/users/:id", requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const me = (req as any).user;
    if (me.id === id) {
      res.status(400).json({ error: "Cannot delete yourself" });
      return;
    }
    await db.delete(usersTable).where(eq(usersTable.id, id));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete user" });
  }
});

router.get("/admin/stats", requireAdmin, async (req, res) => {
  try {
    const [{ total }] = await db.select({ total: count() }).from(usersTable);
    const byStatus = await db
      .select({ status: usersTable.status, cnt: count() })
      .from(usersTable)
      .groupBy(usersTable.status);

    const statusMap: Record<string, number> = {};
    byStatus.forEach((r) => { statusMap[r.status] = Number(r.cnt); });

    let flow2apiStats = null;
    try {
      flow2apiStats = await new Promise<unknown>((resolve) => {
        const loginReq = http.request(
          { hostname: "localhost", port: 5000, path: "/api/login", method: "POST", headers: { "Content-Type": "application/json", "content-length": Buffer.byteLength('{"username":"admin","password":"admin"}') } },
          (loginRes) => {
            const chunks: Buffer[] = [];
            loginRes.on("data", (c: Buffer) => chunks.push(c));
            loginRes.on("end", () => {
              try {
                const { token } = JSON.parse(Buffer.concat(chunks).toString());
                const statsReq = http.request(
                  { hostname: "localhost", port: 5000, path: "/api/stats", method: "GET", headers: { Authorization: `Bearer ${token}` } },
                  (statsRes) => {
                    const sc: Buffer[] = [];
                    statsRes.on("data", (c: Buffer) => sc.push(c));
                    statsRes.on("end", () => resolve(JSON.parse(Buffer.concat(sc).toString())));
                  }
                );
                statsReq.on("error", () => resolve(null));
                statsReq.end();
              } catch { resolve(null); }
            });
          }
        );
        loginReq.on("error", () => resolve(null));
        loginReq.write('{"username":"admin","password":"admin"}');
        loginReq.end();
      });
    } catch { /* ignore */ }

    res.json({
      users: {
        total: Number(total),
        pending: statusMap["pending"] || 0,
        approved: statusMap["approved"] || 0,
        rejected: statusMap["rejected"] || 0,
        disabled: statusMap["disabled"] || 0,
      },
      flow2api: flow2apiStats,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

router.get("/admin/plans", requireAdmin, async (_req, res) => {
  res.json(
    PLAN_IDS.map((id) => ({ id, ...getPlan(id) }))
  );
});

export default router;
