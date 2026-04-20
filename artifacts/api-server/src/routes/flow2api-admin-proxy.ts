import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import http from "http";

const router: IRouter = Router();

const FLOW2API_PORT = parseInt(process.env.FLOW2API_PORT || "8000", 10);

const FLOW2API_ADMIN_PREFIXES = [
  "/login",
  "/logout",
  "/stats",
  "/logs",
  "/tokens",
  "/token-refresh",
  "/admin/login",
  "/admin/logout",
  "/admin/change-password",
  "/admin/config",
  "/admin/password",
  "/config/",
  "/proxy/",
  "/system/",
  "/call-logic/",
];

function isFlow2APIAdminPath(path: string): boolean {
  return FLOW2API_ADMIN_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(prefix + "/") || (prefix.endsWith("/") && path.startsWith(prefix))
  );
}

function proxyToFlow2API(req: Request, res: Response) {
  const path = "/api" + req.url;
  const bodyStr =
    req.method !== "GET" && req.method !== "HEAD"
      ? JSON.stringify(req.body)
      : "";

  const headers: Record<string, string | number> = {
    "content-type": "application/json",
  };

  if (req.headers.authorization) {
    headers["authorization"] = req.headers.authorization;
  }

  if (bodyStr) {
    headers["content-length"] = Buffer.byteLength(bodyStr);
  }

  const options: http.RequestOptions = {
    hostname: "localhost",
    port: FLOW2API_PORT,
    path,
    method: req.method,
    headers,
  };

  const proxyReq = http.request(options, (proxyRes) => {
    const status = proxyRes.statusCode || 200;
    res.status(status);
    Object.entries(proxyRes.headers).forEach(([k, v]) => {
      if (v && k !== "transfer-encoding") res.setHeader(k, v as string);
    });
    proxyRes.pipe(res);
  });

  proxyReq.on("error", (err) => {
    res.status(502).json({ error: "Flow2API admin unreachable", detail: err.message });
  });

  if (bodyStr) proxyReq.write(bodyStr);
  proxyReq.end();
}

router.use((req: Request, res: Response, next: NextFunction) => {
  if (isFlow2APIAdminPath(req.path)) {
    proxyToFlow2API(req, res);
  } else {
    next();
  }
});

export default router;
