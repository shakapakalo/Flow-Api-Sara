import { Router } from "express";

const router = Router();

router.get("/proxy-download", async (req, res) => {
  const url = req.query["url"] as string;
  const filename = (req.query["filename"] as string) || "download";

  if (!url) {
    res.status(400).json({ error: "url required" });
    return;
  }

  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });

    if (!response.ok) {
      res.status(502).json({ error: "Failed to fetch media" });
      return;
    }

    const contentType = response.headers.get("content-type") || "application/octet-stream";
    const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, "_");

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${safeFilename}"`);
    res.setHeader("Cache-Control", "no-cache");

    const arrayBuffer = await response.arrayBuffer();
    res.send(Buffer.from(arrayBuffer));
  } catch (err) {
    res.status(500).json({ error: "Download failed" });
  }
});

export default router;
