import { Router, type IRouter, type Request, type Response } from "express";
import http from "http";
import { requireAuth } from "../middleware/requireAuth.js";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";
import { getPlan } from "../lib/plans.js";

const router: IRouter = Router();

const FLOW2API_PORT = parseInt(process.env.FLOW2API_PORT || "8000", 10);
const FLOW2API_API_KEY = process.env.FLOW2API_API_KEY || "han1234";

function isVideoModel(modelId: string): boolean {
  const lower = modelId.toLowerCase();
  return lower.includes("veo") || lower.includes("video") || lower.includes("sora") || lower.includes("kling") || lower.includes("wan") || lower.includes("hailuo") || lower.includes("luma") || lower.includes("minimax");
}

// Per-user queue for free plan — ensures 1 generation at a time per user
// Maps userId → tail of the promise chain
const freeUserQueue = new Map<number, Promise<void>>();

function runInUserQueue(userId: number, fn: () => Promise<void>): Promise<void> {
  const prev = freeUserQueue.get(userId) ?? Promise.resolve();
  const next = prev.then(() => fn()).catch(() => {});
  freeUserQueue.set(userId, next);
  // Clean up map entry once the chain is idle
  next.then(() => {
    if (freeUserQueue.get(userId) === next) freeUserQueue.delete(userId);
  });
  return next;
}

// Returns queue depth (how many are waiting before this user)
function getQueueDepth(userId: number): number {
  return freeUserQueue.has(userId) ? 1 : 0;
}

// Wrap the http proxy in a Promise so it can be awaited inside the queue
function doProxy(
  req: Request,
  res: Response,
  mediaType: "image" | "video" | "unknown",
  userId: number,
  userRole: string,
  opType: string
): Promise<void> {
  return new Promise<void>((resolve) => {
    const subPath = req.url;
    const bodyStr =
      req.method !== "GET" && req.method !== "HEAD"
        ? JSON.stringify(req.body)
        : "";

    const headers: Record<string, string | number> = {
      "content-type": "application/json",
      authorization: `Bearer ${FLOW2API_API_KEY}`,
    };
    if (bodyStr) headers["content-length"] = Buffer.byteLength(bodyStr);

    const timeoutMs = mediaType === "video" ? 30 * 60 * 1000 : 6 * 60 * 1000;

    const options: http.RequestOptions = {
      hostname: "localhost",
      port: FLOW2API_PORT,
      path: subPath,
      method: req.method,
      headers,
      timeout: timeoutMs,
    };

    let timedOut = false;

    const proxyReq = http.request(options, (proxyRes) => {
      const status = proxyRes.statusCode || 200;
      res.status(status);
      res.setHeader("Content-Type", proxyRes.headers["content-type"] || "application/json");
      const chunks: Buffer[] = [];
      proxyRes.on("data", (chunk: Buffer) => chunks.push(chunk));
      proxyRes.on("end", async () => {
        if (timedOut) { resolve(); return; }
        const buf = Buffer.concat(chunks);
        res.end(buf);

        if (status === 200 && userRole !== "admin" && req.method === "POST" && req.url.includes("/chat/completions")) {
          try {
            if (opType === "regeneration") {
              await db.update(usersTable)
                .set({ regenerationsUsed: sql`${usersTable.regenerationsUsed} + 1` })
                .where(eq(usersTable.id, userId));
            } else if (mediaType === "video") {
              await db.update(usersTable)
                .set({ videosUsed: sql`${usersTable.videosUsed} + 1` })
                .where(eq(usersTable.id, userId));
            } else {
              await db.update(usersTable)
                .set({ imagesUsed: sql`${usersTable.imagesUsed} + 1` })
                .where(eq(usersTable.id, userId));
            }
          } catch (e) {
            console.error("Usage tracking error:", e);
          }
        }
        resolve();
      });
    });

    proxyReq.on("timeout", () => {
      timedOut = true;
      proxyReq.destroy();
      if (!res.headersSent) {
        const label = mediaType === "video" ? "Video" : "Image";
        res.status(504).json({ error: `${label} generation timed out. Please try again.` });
      }
      resolve();
    });

    proxyReq.on("error", (err) => {
      if (timedOut) { resolve(); return; }
      if (!res.headersSent) {
        res.status(502).json({ error: "Flow2API unreachable", detail: err.message });
      }
      resolve();
    });

    if (bodyStr) proxyReq.write(bodyStr);
    proxyReq.end();
  });
}

router.use("/flow-proxy", requireAuth, async (req: Request, res: Response) => {
  const user = (req as any).user as { id: number; role: string };
  const opType = (req.headers["x-flow-op"] as string) || "generation";
  const mediaTypeHint = (req.headers["x-media-type"] as string) || "";

  // Determine media type
  let mediaType: "image" | "video" | "unknown" = "unknown";
  if (mediaTypeHint === "video") {
    mediaType = "video";
  } else if (mediaTypeHint === "image") {
    mediaType = "image";
  } else {
    const modelId: string = req.body?.model || "";
    if (modelId) mediaType = isVideoModel(modelId) ? "video" : "image";
  }

  const isGeneration = user.role !== "admin" && req.method === "POST" && req.url.includes("/chat/completions");

  if (isGeneration) {
    const [dbUser] = await db.select().from(usersTable).where(eq(usersTable.id, user.id)).limit(1);
    if (dbUser) {
      const plan = getPlan(dbUser.plan);
      const isFree = dbUser.plan === "free" || !dbUser.plan;

      // Enforce usage limits (non-free plans only — free is unlimited but queued)
      if (!isFree) {
        if (opType === "regeneration") {
          if (plan.regenerationsLimit !== -1 && dbUser.regenerationsUsed >= plan.regenerationsLimit) {
            res.status(429).json({ error: `Regeneration limit reached (${plan.regenerationsLimit}). Upgrade your plan.` });
            return;
          }
        } else if (mediaType === "video") {
          if (plan.videosLimit !== -1 && dbUser.videosUsed >= plan.videosLimit) {
            res.status(429).json({ error: `Video limit reached (${plan.videosLimit}). Upgrade your plan.` });
            return;
          }
        } else {
          if (plan.imagesLimit !== -1 && dbUser.imagesUsed >= plan.imagesLimit) {
            res.status(429).json({ error: `Image limit reached (${plan.imagesLimit}). Upgrade your plan.` });
            return;
          }
        }
      }

      // Free plan: queue — 1 generation at a time, unlimited count
      if (isFree) {
        const depth = getQueueDepth(user.id);
        if (depth > 0) {
          // Tell client they're queued
          res.setHeader("X-Queue-Position", String(depth));
        }
        await runInUserQueue(user.id, () =>
          doProxy(req, res, mediaType, user.id, user.role, opType)
        );
        return;
      }
    }
  }

  // Paid / admin / non-generation requests: proxy directly
  await doProxy(req, res, mediaType, user.id, user.role, opType);
});

export default router;
