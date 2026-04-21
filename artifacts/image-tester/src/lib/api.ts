const API_BASE = "/api/flow-proxy";

function getToken(): string {
  return localStorage.getItem("flow_rsa_token") || "";
}

function authHeaders(extra?: Record<string, string>): Record<string, string> {
  return { Authorization: `Bearer ${getToken()}`, ...extra };
}

export async function apiLogin(email: string, password: string) {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Login failed");
  return data as { token: string; user: UserProfile };
}

export async function apiRegister(name: string, email: string, password: string) {
  const res = await fetch("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Registration failed");
  return data as { token: string; user: UserProfile } | { pending: true; message: string };
}

export interface UserProfile {
  id: number;
  name: string;
  email: string;
  role: string;
  status: string;
  plan: string;
  planName: string;
  planPrice: number;
  threads: number;
  imagesLimit: number;
  videosLimit: number;
  regenerationsLimit: number;
  imagesUsed: number;
  videosUsed: number;
  regenerationsUsed: number;
}

export interface UsageInfo {
  plan: string;
  planName: string;
  planPrice: number;
  threads: number;
  imagesLimit: number;
  videosLimit: number;
  regenerationsLimit: number;
  imagesUsed: number;
  videosUsed: number;
  regenerationsUsed: number;
}

export async function fetchUsage(): Promise<UsageInfo> {
  const res = await fetch("/api/user/usage", { headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to fetch usage");
  return data as UsageInfo;
}

export async function fetchModels() {
  const res = await fetch(`${API_BASE}/v1/models`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return (data.data || []) as Array<{ id: string; object: string; owned_by: string; description: string }>;
}

function sanitizeError(raw: string): string {
  try {
    const j = JSON.parse(raw);
    raw = j.error?.message || j.error || raw;
  } catch { /* not json */ }
  return String(raw)
    .replace(/[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]+/g, "")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, 300) || "Generation failed";
}

export async function generateMedia(
  modelId: string,
  messages: unknown[],
  onRetry?: (attempt: number, total: number) => void,
  opts?: { isRegeneration?: boolean; mediaType?: "image" | "video" },
) {
  const MAX = 3;
  let lastErr!: Error;
  const extraHeaders: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (opts?.isRegeneration) {
    extraHeaders["X-Flow-Op"] = "regeneration";
  }
  if (opts?.mediaType) {
    extraHeaders["X-Media-Type"] = opts.mediaType;
  }

  for (let attempt = 0; attempt < MAX; attempt++) {
    if (attempt > 0) {
      onRetry?.(attempt + 1, MAX);
      await new Promise((r) => setTimeout(r, 1500 * attempt));
    }
    try {
      const res = await fetch(`${API_BASE}/v1/chat/completions`, {
        method: "POST",
        headers: authHeaders(extraHeaders),
        body: JSON.stringify({ model: modelId, messages }),
      });
      if (!res.ok) {
        const raw = await res.text();
        throw new Error(`HTTP ${res.status}: ${sanitizeError(raw)}`);
      }
      const data = await res.json();
      return (data.choices?.[0]?.message?.content || "") as string;
    } catch (e) {
      lastErr = e as Error;
    }
  }
  throw lastErr;
}

export async function adminGetUsers() {
  const res = await fetch("/api/admin/users", { headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error);
  return data as Array<{
    id: number; name: string; email: string; role: string; status: string;
    plan: string; imagesUsed: number; videosUsed: number; regenerationsUsed: number;
    createdAt: string; lastLoginAt?: string;
  }>;
}

export async function adminUpdateUser(id: number, updates: { status?: string; role?: string; plan?: string }) {
  const res = await fetch(`/api/admin/users/${id}`, {
    method: "PATCH",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(updates),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error);
  return data;
}

export async function adminResetUsage(id: number) {
  const res = await fetch(`/api/admin/users/${id}/reset-usage`, {
    method: "POST",
    headers: authHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error);
  return data;
}

export async function adminDeleteUser(id: number) {
  const res = await fetch(`/api/admin/users/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error);
  return data;
}

export async function adminGetStats() {
  const res = await fetch("/api/admin/stats", { headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error);
  return data as {
    users: { total: number; pending: number; approved: number; rejected: number; disabled: number };
    flow2api: { total_tokens: number; active_tokens: number; total_images: number; total_videos: number; today_images: number; today_videos: number } | null;
  };
}

export function parseMediaFromContent(content: string): { url: string; type: "image" | "video" } | null {
  const imgDataMatch = content.match(/!\[.*?\]\((data:image\/[^)]+)\)/);
  if (imgDataMatch) return { url: imgDataMatch[1], type: "image" };
  const imgUrlMatch = content.match(/!\[.*?\]\((https?:\/\/[^)]+)\)/);
  if (imgUrlMatch) return { url: imgUrlMatch[1], type: "image" };
  const videoTagMatch = content.match(/<video[^>]+src=['"]([^'"]+)['"]/i);
  if (videoTagMatch) return { url: videoTagMatch[1], type: "video" };
  const mp4Match = content.match(/(https?:\/\/[^\s"'<>]+\.mp4[^\s"'<>]*)/i);
  if (mp4Match) return { url: mp4Match[1], type: "video" };
  return null;
}

export async function downloadAllAsZip(results: Array<{ modelId: string; promptText: string; promptIndex: number; mediaUrl: string; mediaType: "image" | "video" }>) {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  const folder = zip.folder("flow-rsa-exports")!;
  let count = 0;
  for (const r of results) {
    const ext = r.mediaType === "video" ? "mp4" : "jpg";
    const safeName = r.modelId.replace(/[^a-z0-9-]/gi, "_");
    const filename = `${String(r.promptIndex + 1).padStart(2, "0")}_${safeName}.${ext}`;
    try {
      if (r.mediaUrl.startsWith("data:")) {
        const base64 = r.mediaUrl.split(",")[1];
        folder.file(filename, base64, { base64: true });
      } else {
        const proxyUrl = `/api/proxy-download?url=${encodeURIComponent(r.mediaUrl)}&filename=${encodeURIComponent(filename)}`;
        const response = await fetch(proxyUrl);
        if (!response.ok) throw new Error("proxy failed");
        const blob = await response.blob();
        folder.file(filename, blob);
      }
      count++;
    } catch { /* skip failed */ }
  }
  if (count === 0) return 0;
  const content = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(content);
  const a = document.createElement("a");
  a.href = url;
  a.download = "flow-rsa-exports.zip";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  return count;
}
