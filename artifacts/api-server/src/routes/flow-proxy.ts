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

router.use("/flow-proxy", requireAuth, async (req: Request, res: Response) => {
  const user = (req as any).user as { id: number; role: string };
  const opType = (req.headers["x-flow-op"] as string) || "generation";
  const mediaTypeHint = (req.headers["x-media-type"] as string) || "";

  // Determine media type from request body
  let mediaType: "image" | "video" | "unknown" = "unknown";
  if (mediaTypeHint === "video") {
    mediaType = "video";
  } else if (mediaTypeHint === "image") {
    mediaType = "image";
  } else {
    // Infer from model id in body
    const modelId: string = req.body?.model || "";
    if (modelId) {
      mediaType = isVideoModel(modelId) ? "video" : "image";
    }
  }

  // Only enforce limits for non-admin users
  if (user.role !== "admin" && req.method === "POST" && req.url.includes("/chat/completions")) {
    const [dbUser] = await db.select().from(usersTable).where(eq(usersTable.id, user.id)).limit(1);
    if (dbUser) {
      const plan = getPlan(dbUser.plan);

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
  }

  // Proxy the request
  const subPath = req.url;
  const bodyStr =
    req.method !== "GET" && req.method !== "HEAD"
      ? JSON.stringify(req.body)
      : "";

  const headers: Record<string, string | number> = {
    "content-type": "application/json",
    authorization: `Bearer ${FLOW2API_API_KEY}`,
  };
  if (bodyStr) {
    headers["content-length"] = Buffer.byteLength(bodyStr);
  }

  // Video generation takes up to 25 minutes; image up to 5 minutes
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
    const contentType = proxyRes.headers["content-type"] || "application/json";
    res.setHeader("Content-Type", contentType);
    const chunks: Buffer[] = [];
    proxyRes.on("data", (chunk: Buffer) => chunks.push(chunk));
    proxyRes.on("end", async () => {
      if (timedOut) return;
      const buf = Buffer.concat(chunks);
      res.end(buf);

      // Track usage on success
      if (status === 200 && user.role !== "admin" && req.method === "POST" && req.url.includes("/chat/completions")) {
        try {
          if (opType === "regeneration") {
            await db.update(usersTable)
              .set({ regenerationsUsed: sql`${usersTable.regenerationsUsed} + 1` })
              .where(eq(usersTable.id, user.id));
          } else if (mediaType === "video") {
            await db.update(usersTable)
              .set({ videosUsed: sql`${usersTable.videosUsed} + 1` })
              .where(eq(usersTable.id, user.id));
          } else {
            await db.update(usersTable)
              .set({ imagesUsed: sql`${usersTable.imagesUsed} + 1` })
              .where(eq(usersTable.id, user.id));
          }
        } catch (e) {
          console.error("Usage tracking error:", e);
        }
      }
    });
  });

  proxyReq.on("timeout", () => {
    timedOut = true;
    proxyReq.destroy();
    const label = mediaType === "video" ? "Video" : "Image";
    if (!res.headersSent) {
      res.status(504).json({ error: `${label} generation timed out. Please try again.` });
    }
  });

  proxyReq.on("error", (err) => {
    if (timedOut) return;
    if (!res.headersSent) {
      res.status(502).json({ error: "Flow2API unreachable", detail: err.message });
    }
  });

  if (bodyStr) proxyReq.write(bodyStr);
  proxyReq.end();
});

export default router;
