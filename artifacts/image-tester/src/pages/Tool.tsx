import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { fetchModels, generateMedia, fetchUsage, parseMediaFromContent, downloadAllAsZip, type UsageInfo } from "@/lib/api";
import { useLocation } from "wouter";

interface FlowModel { id: string; object: string; owned_by: string; description: string; }
interface GenResult {
  id: string; promptIndex: number; promptText: string; modelId: string;
  status: "loading" | "success" | "error";
  mediaUrl?: string; mediaType?: "image" | "video"; error?: string; duration?: number;
  sourceImageUrl?: string; sourceImageIndex?: number;
  retrying?: number;
}

type AppMode = "images" | "videos" | "img2img";
type InputMode = "single" | "bulk";

function getImageFamily(m: FlowModel) {
  const d = m.description;
  if (d.includes("GEM_PIX_2")) return "Nano Banana";
  if (d.includes("GEM_PIX")) return "Gemini 2.5";
  if (d.includes("NARWHAL")) return "Nano Banana 2";
  if (d.includes("IMAGEN")) return "Imagen 4";
  return "Other";
}
function getVideoType(id: string) {
  if (id.includes("_t2v_")) return "Text→Video";
  if (id.includes("_i2v_")) return "Image→Video";
  if (id.includes("_r2v_")) return "Reference→Video";
  if (id.includes("_interpolation_")) return "Interpolation";
  return "Other";
}
function needsRefImg(id: string) { return id.includes("_i2v_") || id.includes("_interpolation_"); }
function needsRefVid(id: string) { return id.includes("_r2v_"); }
function isInterpolation(id: string) { return id.includes("_interpolation_"); }
function supportsLastFrame(id: string) { return id.includes("_fl") || id.includes("_interpolation_"); }

function shortName(id: string): string {
  let s = id;
  s = s.replace(/^gemini-3\.1-/, "Nano Banana 2 ");
  s = s.replace(/^gemini-3\.0-/, "Nano Banana ");
  s = s.replace(/^gemini-(\d+\.\d+)-/, "$1 ");
  s = s.replace(/^imagen-4-/, "Img4 ");
  s = s.replace(/-image-/i, "· ");
  s = s.replace(/\blm\b/gi, "");
  s = s.replace(/landscape/gi, "Landscape").replace(/portrait/gi, "Portrait").replace(/square/gi, "Square").replace(/widescreen/gi, "Widescreen");
  s = s.replace(/^veo-(\d+\.\d+)[-_]/i, "VEO $1 ");
  s = s.replace(/_t2v_/gi, " T2V ").replace(/_i2v_/gi, " I2V ").replace(/_r2v_/gi, " R2V ").replace(/_interpolation_/gi, " Interp ");
  s = s.replace(/_4k/gi, " 4K").replace(/-4k/gi, " 4K");
  s = s.replace(/_1080p/gi, " 1080p").replace(/-1080p/gi, " 1080p");
  s = s.replace(/_hd[-_]/gi, " HD ").replace(/_sd[-_]/gi, " SD ");
  s = s.replace(/\bstandard\b/gi, "").replace(/\b16x9\b/gi, "").replace(/\b9x16\b/gi, "9:16");
  s = s.replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
  return s;
}

function getModelSize(id: string): string {
  const l = id.toLowerCase();
  if (l.includes("landscape")) return "Landscape";
  if (l.includes("portrait")) return "Portrait";
  if (l.includes("square")) return "Square";
  if (l.includes("widescreen")) return "Widescreen";
  return "Other";
}

function groupModels<T extends FlowModel>(models: T[], fn: (m: T) => string) {
  const g: Record<string, T[]> = {};
  models.forEach((m) => { const k = fn(m); (g[k] ??= []).push(m); });
  return g;
}

const IMG_COLORS: Record<string, string> = {
  "Gemini 2.5":    "bg-blue-500/20 border-blue-500/40 text-blue-300",
  "Nano Banana":   "bg-violet-500/20 border-violet-500/40 text-violet-300",
  "Nano Banana 2": "bg-purple-500/20 border-purple-500/40 text-purple-300",
  "Imagen 4":      "bg-emerald-500/20 border-emerald-500/40 text-emerald-300",
  Other:           "bg-zinc-500/20 border-zinc-500/40 text-zinc-300",
};
const VID_COLORS: Record<string, string> = {
  "Text→Video": "bg-violet-500/20 border-violet-500/40 text-violet-300",
  "Image→Video": "bg-cyan-500/20 border-cyan-500/40 text-cyan-300",
  "Reference→Video": "bg-amber-500/20 border-amber-500/40 text-amber-300",
  Interpolation: "bg-pink-500/20 border-pink-500/40 text-pink-300",
  Other: "bg-zinc-500/20 border-zinc-500/40 text-zinc-300",
};

export default function Tool() {
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();
  const [mode, setMode] = useState<AppMode>("images");
  const [inputMode, setInputMode] = useState<InputMode>("single");
  const [models, setModels] = useState<FlowModel[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [prompt, setPrompt] = useState("A majestic mountain landscape at golden hour, photorealistic");
  const [bulkPrompts, setBulkPrompts] = useState("");
  const [results, setResults] = useState<GenResult[]>([]);
  const [generating, setGenerating] = useState(false);
  const [filterFamily, setFilterFamily] = useState("all");
  const [filterSize, setFilterSize] = useState("all");
  const [refImage, setRefImage] = useState<string | null>(null);
  const [refImages, setRefImages] = useState<string[]>([]);
  const [refVideoUrl, setRefVideoUrl] = useState("");
  const [lastFrame, setLastFrame] = useState<string | null>(null);
  const [threads, setThreads] = useState(1);
  const [downloading, setDownloading] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [usage, setUsage] = useState<UsageInfo | null>(null);
  const [modelSearch, setModelSearch] = useState("");
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imgFileInputRef = useRef<HTMLInputElement>(null);
  const multiImgInputRef = useRef<HTMLInputElement>(null);
  const lastFrameInputRef = useRef<HTMLInputElement>(null);

  const imageModels = models.filter((m) => m.description.includes("Image generation"));
  const videoModels = models.filter((m) => m.description.includes("Video generation"));
  const activeModels = mode === "videos" ? videoModels : imageModels;
  const groupFn = mode === "videos" ? (m: FlowModel) => getVideoType(m.id) : getImageFamily;
  const activeGroups = groupModels(activeModels, groupFn);
  const familyOrder = mode === "videos"
    ? ["Text→Video", "Image→Video", "Reference→Video", "Interpolation"]
    : ["Gemini 2.5", "Nano Banana", "Nano Banana 2", "Imagen 4"];
  const families = familyOrder.filter((f) => activeGroups[f]);
  const colorMap = mode === "videos" ? VID_COLORS : IMG_COLORS;
  const baseFiltered = filterFamily === "all" ? activeModels : activeGroups[filterFamily] || [];
  const sizeFiltered = (filterSize === "all" || mode === "videos")
    ? baseFiltered
    : baseFiltered.filter((m) => getModelSize(m.id) === filterSize);
  const filteredModels = modelSearch.trim()
    ? sizeFiltered.filter((m) => m.id.toLowerCase().includes(modelSearch.toLowerCase()) || shortName(m.id).toLowerCase().includes(modelSearch.toLowerCase()))
    : sizeFiltered;
  const availableSizes = mode !== "videos"
    ? Array.from(new Set(activeModels.map((m) => getModelSize(m.id)))).filter(s => s !== "Other")
    : [];
  const anyI2v = Array.from(selected).some(needsRefImg);
  const anyR2v = Array.from(selected).some(needsRefVid);
  const anyLastFrame = Array.from(selected).some(supportsLastFrame);
  const anyInterpolation = Array.from(selected).some(isInterpolation);

  const planId = (usage?.plan || (user as any)?.plan || "free") as string;
  const isAdmin = user?.role === "admin";
  const isPaidPlan = isAdmin || !["free"].includes(planId);
  const isModelLocked = (id: string): boolean => {
    if (isAdmin) return false;
    if (!isPaidPlan) {
      if (id.includes("_r2v_")) return true;
      if (id.includes("_fl")) return true;
      if (id.includes("_interpolation_")) return true;
    }
    return false;
  };

  const WA_NUMBER = "923103508162";
  const waLink = (planName?: string) => {
    const msg = encodeURIComponent(`Hi! I want to upgrade my Flow by RSA plan${planName ? ` (currently on ${planName})` : ""}. Please help me.`);
    return `https://wa.me/${WA_NUMBER}?text=${msg}`;
  };
  const isLimitError = (msg: string) => /limit reached|upgrade your plan/i.test(msg);

  const loadModels = useCallback(async () => {
    setLoadingModels(true);
    try { setModels(await fetchModels()); }
    catch (err) { console.error(err); }
    finally { setLoadingModels(false); }
  }, []);

  const loadUsage = useCallback(async () => {
    try {
      const u = await fetchUsage();
      setUsage(u);
      // Apply plan thread limit: clamp threads to plan max
      setThreads((prev) => Math.min(prev, u.threads));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadModels(); loadUsage(); }, [loadModels, loadUsage]);
  useEffect(() => { setSelected(new Set()); setFilterFamily("all"); setFilterSize("all"); setResults([]); setModelSearch(""); setRefImage(null); setRefImages([]); setLastFrame(null); }, [mode]);

  const toggle = (id: string) => {
    if (!isPaidPlan) {
      setSelected((p) => p.has(id) ? new Set() : new Set([id]));
      return;
    }
    setSelected((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };
  const selectAll = (ids: string[]) => setSelected((p) => { const n = new Set(p); ids.forEach((id) => n.add(id)); return n; });
  const deselectAll = (ids: string[]) => setSelected((p) => { const n = new Set(p); ids.forEach((id) => n.delete(id)); return n; });

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setRefImage(ev.target?.result as string);
    reader.readAsDataURL(file);
  };
  const handleMultiUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    files.slice(0, 50).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string;
        setRefImages((prev) => prev.length < 50 ? [...prev, dataUrl] : prev);
      };
      reader.readAsDataURL(file);
    });
    if (multiImgInputRef.current) multiImgInputRef.current.value = "";
  };
  const removeRefImgAt = (idx: number) => setRefImages((prev) => prev.filter((_, i) => i !== idx));
  const clearRefImage = () => {
    setRefImage(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (imgFileInputRef.current) imgFileInputRef.current.value = "";
  };
  const handleLastFrameUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setLastFrame(ev.target?.result as string);
    reader.readAsDataURL(file);
  };
  const clearLastFrame = () => {
    setLastFrame(null);
    if (lastFrameInputRef.current) lastFrameInputRef.current.value = "";
  };

  const buildMessages = (modelId: string, promptText: string, imageOverride?: string) => {
    const img = imageOverride ?? refImage;
    if ((mode === "img2img" || needsRefImg(modelId)) && img) {
      const content: object[] = [{ type: "text", text: promptText }, { type: "image_url", image_url: { url: img } }];
      if (supportsLastFrame(modelId) && lastFrame)
        content.push({ type: "image_url", image_url: { url: lastFrame } });
      return [{ role: "user", content }];
    }
    if (needsRefVid(modelId) && refVideoUrl)
      return [{ role: "user", content: `${promptText}\n\nReference video: ${refVideoUrl}` }];
    if (mode === "images" && img)
      return [{ role: "user", content: [{ type: "text", text: promptText }, { type: "image_url", image_url: { url: img } }] }];
    return [{ role: "user", content: promptText }];
  };

  const runGeneration = async (promptTexts: string[], modelIds: string[], sourceImages?: string[]) => {
    const entries: GenResult[] = [];
    if (sourceImages && sourceImages.length > 0) {
      sourceImages.forEach((imgUrl, imgIdx) =>
        modelIds.forEach((mid) =>
          entries.push({ id: `img${imgIdx}-${mid}`, promptIndex: imgIdx, promptText: promptTexts[0], modelId: mid, status: "loading", sourceImageUrl: imgUrl, sourceImageIndex: imgIdx })
        )
      );
    } else {
      promptTexts.forEach((pt, pi) =>
        modelIds.forEach((mid) =>
          entries.push({ id: `${pi}-${mid}`, promptIndex: pi, promptText: pt, modelId: mid, status: "loading" })
        )
      );
    }
    setResults(entries);
    setGenerating(true);

    const processEntry = async (entry: GenResult) => {
      const start = Date.now();
      const mediaType = mode === "videos" ? "video" : "image";
      try {
        const content = await generateMedia(
          entry.modelId,
          buildMessages(entry.modelId, entry.promptText, entry.sourceImageUrl),
          (attempt) => setResults((prev) =>
            prev.map((r) => r.id === entry.id ? { ...r, retrying: attempt } : r)
          ),
          { mediaType },
        );
        const media = parseMediaFromContent(content);
        const duration = Date.now() - start;
        setResults((prev) =>
          prev.map((r) => r.id === entry.id
            ? { ...r, status: media ? "success" : "error", mediaUrl: media?.url, mediaType: media?.type, duration, error: media ? undefined : "No media in response", retrying: undefined }
            : r)
        );
      } catch (err) {
        const errMsg = String(err).replace(/^Error:\s*/, "");
        if (isLimitError(errMsg)) {
          setUpgradeReason(errMsg);
          setShowUpgradeModal(true);
        }
        setResults((prev) =>
          prev.map((r) => r.id === entry.id
            ? { ...r, status: "error", error: errMsg, duration: Date.now() - start, retrying: undefined }
            : r)
        );
      }
    };

    // Thread pool — run `threads` jobs concurrently
    const queue = [...entries];
    await Promise.all(
      Array.from({ length: threads }, async () => {
        while (queue.length > 0) {
          const entry = queue.shift();
          if (entry) await processEntry(entry);
        }
      })
    );
    setGenerating(false);
    loadUsage();
  };

  const handleGenerate = () => {
    if (selected.size === 0) return;
    const modelIds = Array.from(selected);
    if (mode === "img2img") {
      if (refImages.length === 0 || !prompt.trim()) return;
      runGeneration([prompt.trim()], modelIds, refImages);
    } else if (inputMode === "single") {
      if (!prompt.trim()) return;
      runGeneration([prompt.trim()], modelIds);
    } else {
      const prompts = bulkPrompts.split("\n").map((p) => p.trim()).filter(Boolean).slice(0, 50);
      if (prompts.length === 0) return;
      runGeneration(prompts, modelIds);
    }
  };

  const regenerateOne = async (result: GenResult) => {
    const start = Date.now();
    setResults((prev) => prev.map((r) => r.id === result.id ? { ...r, status: "loading", mediaUrl: undefined, error: undefined, retrying: undefined } : r));
    try {
      const content = await generateMedia(
        result.modelId,
        buildMessages(result.modelId, result.promptText, result.sourceImageUrl),
        (attempt) => setResults((prev) =>
          prev.map((r) => r.id === result.id ? { ...r, retrying: attempt } : r)
        ),
        { isRegeneration: true },
      );
      const media = parseMediaFromContent(content);
      const duration = Date.now() - start;
      setResults((prev) =>
        prev.map((r) => r.id === result.id
          ? { ...r, status: media ? "success" : "error", mediaUrl: media?.url, mediaType: media?.type, duration, error: media ? undefined : "No media in response", retrying: undefined }
          : r)
      );
    } catch (err) {
      const errMsg = String(err).replace(/^Error:\s*/, "");
      if (isLimitError(errMsg)) {
        setUpgradeReason(errMsg);
        setShowUpgradeModal(true);
      }
      setResults((prev) =>
        prev.map((r) => r.id === result.id ? { ...r, status: "error", error: errMsg, duration: Date.now() - start, retrying: undefined } : r)
      );
    }
    loadUsage();
  };

  const downloadOne = (r: GenResult) => {
    if (!r.mediaUrl) return;
    const ext = r.mediaType === "video" ? "mp4" : "jpg";
    const a = document.createElement("a");
    a.href = r.mediaUrl;
    a.download = `${r.modelId}.${ext}`;
    a.click();
  };

  const handleBulkDownload = async () => {
    const ok = results.filter((r) => r.status === "success" && r.mediaUrl);
    if (!ok.length) return;
    setDownloading(true);
    await downloadAllAsZip(ok.map((r) => ({ modelId: r.modelId, promptText: r.promptText, promptIndex: r.promptIndex, mediaUrl: r.mediaUrl!, mediaType: r.mediaType! })));
    setDownloading(false);
  };

  const successCount = results.filter((r) => r.status === "success").length;
  const loadingCount = results.filter((r) => r.status === "loading").length;
  const errorCount = results.filter((r) => r.status === "error").length;

  const prompts = inputMode === "bulk"
    ? bulkPrompts.split("\n").map((p) => p.trim()).filter(Boolean)
    : [prompt.trim()];
  const totalJobs = mode === "img2img"
    ? refImages.length * selected.size
    : prompts.length * selected.size;

  return (
    <div className="min-h-screen bg-[#080810] text-zinc-100 font-sans flex flex-col">
      {/* Header */}
      <header className="border-b border-zinc-800/60 bg-[#0a0a14]/90 backdrop-blur sticky top-0 z-40">
        <div className="max-w-[1400px] mx-auto px-4 h-14 flex items-center justify-between gap-4">
          {/* Logo */}
          <div className="flex items-center gap-2.5 flex-shrink-0">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
              <svg className="w-4.5 h-4.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <div>
              <span className="font-bold text-sm text-white">Flow</span>
              <span className="font-medium text-sm text-violet-400"> by RSA</span>
            </div>
          </div>

          {/* Mode switcher */}
          <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-lg p-0.5">
            <button onClick={() => setMode("images")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${mode === "images" ? "bg-violet-600 text-white shadow" : "text-zinc-400 hover:text-zinc-200"}`}>
              Images ({imageModels.length})
            </button>
            <button onClick={() => setMode("videos")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${mode === "videos" ? "bg-violet-600 text-white shadow" : "text-zinc-400 hover:text-zinc-200"}`}>
              Videos ({videoModels.length})
            </button>
            <button onClick={() => setMode("img2img")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${mode === "img2img" ? "bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white shadow" : "text-zinc-400 hover:text-zinc-200"}`}>
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
              Img2Img
            </button>
          </div>

          {/* User menu */}
          <div className="relative flex-shrink-0">
            <button onClick={() => setShowUserMenu((s) => !s)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-800/60 hover:bg-zinc-800 border border-zinc-700/50 transition-all">
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-xs font-bold text-white">
                {user?.name?.[0]?.toUpperCase()}
              </div>
              <span className="text-xs text-zinc-300 max-w-[100px] truncate">{user?.name}</span>
              <svg className="w-3.5 h-3.5 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
            </button>
            {showUserMenu && (
              <div className="absolute right-0 top-full mt-1.5 w-48 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl overflow-hidden z-50">
                <div className="px-3 py-2.5 border-b border-zinc-800">
                  <p className="text-xs font-medium text-white truncate">{user?.name}</p>
                  <p className="text-xs text-zinc-500 truncate">{user?.email}</p>
                </div>
                <button onClick={() => { setShowUserMenu(false); setLocation("/pricing"); }}
                  className="w-full px-3 py-2 text-left text-xs text-zinc-300 hover:bg-zinc-800 flex items-center gap-2 transition-colors">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                  Pricing Plans
                </button>
                {user?.role === "admin" && (
                  <button onClick={() => { setShowUserMenu(false); setLocation("/admin"); }}
                    className="w-full px-3 py-2 text-left text-xs text-zinc-300 hover:bg-zinc-800 flex items-center gap-2 transition-colors">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
                    Admin Panel
                  </button>
                )}
                <button onClick={logout}
                  className="w-full px-3 py-2 text-left text-xs text-red-400 hover:bg-zinc-800 flex items-center gap-2 transition-colors">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="flex-1 max-w-[1400px] mx-auto w-full px-4 py-5 grid grid-cols-[290px_1fr] gap-5">
        {/* Sidebar */}
        <aside className="flex flex-col gap-4">
          {/* Img2Img — multiple source images card (top, required) */}
          {mode === "img2img" && (
            <div className="rounded-xl border border-fuchsia-800/60 bg-fuchsia-950/20 p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded bg-gradient-to-br from-fuchsia-500 to-pink-500 flex items-center justify-center flex-shrink-0">
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01"/></svg>
                  </div>
                  <label className="text-xs font-semibold text-fuchsia-300 uppercase tracking-wide">Source Images <span className="text-fuchsia-600 normal-case font-normal">required</span></label>
                </div>
                <span className={`text-xs font-medium ${refImages.length >= 50 ? "text-red-400" : refImages.length > 0 ? "text-fuchsia-400" : "text-zinc-600"}`}>
                  {refImages.length}/50
                </span>
              </div>
              {/* Thumbnails grid */}
              {refImages.length > 0 && (
                <div className="grid grid-cols-4 gap-1.5 mb-3">
                  {refImages.map((img, idx) => (
                    <div key={idx} className="relative rounded-md overflow-hidden border border-fuchsia-800/40 aspect-square group">
                      <img src={img} alt={`src-${idx}`} className="w-full h-full object-cover" />
                      <button onClick={() => removeRefImgAt(idx)}
                        className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/80 flex items-center justify-center text-[9px] text-zinc-300 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
                      <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-[8px] text-center text-fuchsia-300 py-0.5">{idx + 1}</div>
                    </div>
                  ))}
                </div>
              )}
              {refImages.length < 50 && (
                <button onClick={() => multiImgInputRef.current?.click()}
                  className="w-full py-4 rounded-lg border-2 border-dashed border-fuchsia-800/70 hover:border-fuchsia-500 text-xs text-zinc-500 hover:text-fuchsia-300 transition-colors flex flex-col items-center justify-center gap-1.5 bg-fuchsia-950/20">
                  <svg className="w-6 h-6 text-fuchsia-700" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4"/></svg>
                  <span>{refImages.length > 0 ? "Add more images" : "Click to upload images"}</span>
                  <span className="text-[10px] text-zinc-600">PNG, JPG, WEBP • up to 50</span>
                </button>
              )}
              {refImages.length > 0 && (
                <button onClick={() => setRefImages([])} className="mt-2 text-[10px] text-fuchsia-700 hover:text-fuchsia-400 transition-colors w-full text-center">
                  Clear all images
                </button>
              )}
              <input ref={multiImgInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleMultiUpload} />
            </div>
          )}

          {/* Input mode toggle */}
          <div className={`rounded-xl border bg-zinc-900/40 p-4 ${mode === "img2img" ? "border-fuchsia-800/40" : "border-zinc-800"}`}>
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">
                {mode === "img2img" ? "Transform Prompt" : "Prompt Mode"}
              </label>
              {mode !== "img2img" && isPaidPlan && (
                <div className="flex bg-zinc-800 rounded-md p-0.5">
                  <button onClick={() => setInputMode("single")}
                    className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${inputMode === "single" ? "bg-zinc-700 text-white" : "text-zinc-500 hover:text-zinc-300"}`}>
                    Single
                  </button>
                  <button onClick={() => setInputMode("bulk")}
                    className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${inputMode === "bulk" ? "bg-violet-600 text-white" : "text-zinc-500 hover:text-zinc-300"}`}>
                    Bulk
                  </button>
                </div>
              )}
            </div>

            {inputMode === "single" ? (
              <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={4}
                placeholder={mode === "img2img" ? "Describe how to transform the image..." : "Describe what you want to generate..."}
                className="w-full px-3 py-2.5 rounded-lg bg-zinc-800/80 border border-zinc-700 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-violet-500 resize-none" />
            ) : (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-zinc-500">One prompt per line (max 50)</span>
                  <span className={`text-xs font-medium ${prompts.length >= 50 ? "text-red-400" : prompts.length > 0 ? "text-violet-400" : "text-zinc-600"}`}>
                    {prompts.length}/50
                  </span>
                </div>
                <textarea value={bulkPrompts} onChange={(e) => setBulkPrompts(e.target.value)} rows={8}
                  placeholder={mode === "img2img"
                    ? "Make it a painting\nChange to night time\nAdd snow and winter"
                    : "A sunset over mountains\nA cat on a rooftop\nA futuristic city at night"}
                  className="w-full px-3 py-2.5 rounded-lg bg-zinc-800/80 border border-zinc-700 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-violet-500 resize-none font-mono" />
              </div>
            )}

            {/* Ref image — video i2v/interpolation (required) */}
            {mode === "videos" && anyI2v && (
              <div className="mt-3 space-y-2">
                {/* First Frame */}
                <div>
                  <label className="text-xs font-medium text-cyan-400 uppercase tracking-wide mb-1.5 block">
                    {anyLastFrame ? "First Frame" : "Reference Image"}
                    {" "}<span className="text-cyan-600 normal-case font-normal">(required)</span>
                  </label>
                  {refImage ? (
                    <div className="relative rounded-lg overflow-hidden border border-cyan-700/60">
                      <img src={refImage} alt="first frame" className="w-full h-20 object-cover" />
                      <button onClick={clearRefImage}
                        className="absolute top-1 right-1 w-5 h-5 rounded bg-black/70 flex items-center justify-center text-xs text-zinc-300 hover:text-white">✕</button>
                    </div>
                  ) : (
                    <button onClick={() => fileInputRef.current?.click()}
                      className="w-full py-2.5 rounded-lg border border-dashed border-cyan-800 hover:border-cyan-500 text-xs text-zinc-500 hover:text-cyan-400 transition-colors flex items-center justify-center gap-2">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
                      Upload first frame
                    </button>
                  )}
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
                </div>

                {/* Last Frame — only for _fl_ or interpolation models */}
                {anyLastFrame && (
                  <div>
                    <label className="text-xs font-medium text-fuchsia-400 uppercase tracking-wide mb-1.5 block">
                      Last Frame
                      {" "}<span className="text-fuchsia-700 normal-case font-normal">
                        {anyInterpolation ? "(required)" : "(optional)"}
                      </span>
                    </label>
                    {lastFrame ? (
                      <div className="relative rounded-lg overflow-hidden border border-fuchsia-700/60">
                        <img src={lastFrame} alt="last frame" className="w-full h-20 object-cover" />
                        <button onClick={clearLastFrame}
                          className="absolute top-1 right-1 w-5 h-5 rounded bg-black/70 flex items-center justify-center text-xs text-zinc-300 hover:text-white">✕</button>
                      </div>
                    ) : (
                      <button onClick={() => lastFrameInputRef.current?.click()}
                        className="w-full py-2.5 rounded-lg border border-dashed border-fuchsia-900 hover:border-fuchsia-500 text-xs text-zinc-500 hover:text-fuchsia-400 transition-colors flex items-center justify-center gap-2">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
                        Upload last frame
                      </button>
                    )}
                    <input ref={lastFrameInputRef} type="file" accept="image/*" className="hidden" onChange={handleLastFrameUpload} />
                  </div>
                )}
              </div>
            )}

            {/* Ref image — images mode (optional) */}
            {mode === "images" && (
              <div className="mt-3">
                <label className="text-xs font-medium text-violet-400 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                  Reference Image
                  <span className="text-zinc-600 normal-case font-normal text-[10px]">optional · img2img</span>
                </label>
                {refImage ? (
                  <div className="relative rounded-lg overflow-hidden border border-violet-700/50">
                    <img src={refImage} alt="ref" className="w-full h-20 object-cover" />
                    <button onClick={clearRefImage}
                      className="absolute top-1 right-1 w-5 h-5 rounded bg-black/70 flex items-center justify-center text-xs text-zinc-300 hover:text-white">✕</button>
                  </div>
                ) : (
                  <button onClick={() => imgFileInputRef.current?.click()}
                    className="w-full py-2.5 rounded-lg border border-dashed border-zinc-700 hover:border-violet-500 text-xs text-zinc-500 hover:text-violet-400 transition-colors flex items-center justify-center gap-2">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
                    Upload for img2img
                  </button>
                )}
                <input ref={imgFileInputRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
              </div>
            )}

            {/* Ref video */}
            {mode === "videos" && anyR2v && (
              <div className="mt-3">
                <label className="text-xs font-medium text-amber-400 uppercase tracking-wide mb-1.5 block">Reference Video URL</label>
                <input value={refVideoUrl} onChange={(e) => setRefVideoUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-amber-500" />
              </div>
            )}

            {/* Plan usage bar */}
            {usage && (
              <div className="mt-3 p-2.5 rounded-lg bg-zinc-800/60 border border-zinc-700/60 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wide">{usage.planName === "Free" ? "Promotion" : usage.planName} Plan</span>
                  <span className="text-[10px] text-zinc-600">{usage.threads} thread{usage.threads !== 1 ? "s" : ""} max</span>
                </div>
                {[
                  { label: "Images", used: usage.imagesUsed, limit: usage.imagesLimit },
                  { label: "Videos", used: usage.videosUsed, limit: usage.videosLimit },
                  { label: "Regen", used: usage.regenerationsUsed, limit: usage.regenerationsLimit },
                ].map(({ label, used, limit }) => (
                  <div key={label} className="flex items-center gap-2">
                    <span className="text-[10px] text-zinc-500 w-10 flex-shrink-0">{label}</span>
                    {limit === -1 ? (
                      <span className="text-[10px] text-emerald-500">Unlimited</span>
                    ) : (
                      <>
                        <div className="flex-1 h-1 bg-zinc-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${used >= limit ? "bg-red-500" : used >= limit * 0.75 ? "bg-amber-500" : "bg-violet-500"}`}
                            style={{ width: `${Math.min(100, (used / limit) * 100)}%` }}
                          />
                        </div>
                        <span className={`text-[10px] flex-shrink-0 ${used >= limit ? "text-red-400" : "text-zinc-500"}`}>{used}/{limit}</span>
                      </>
                    )}
                  </div>
                ))}
                <a href={waLink(usage?.planName)} target="_blank" rel="noopener noreferrer"
                  className="mt-1 w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-600/30 text-[10px] font-semibold text-emerald-400 transition-colors">
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  Upgrade Plan
                </a>
              </div>
            )}

            {/* Thread count */}
            <div className="flex items-center justify-between mt-3">
              <span className="text-xs text-zinc-500 flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                Threads
              </span>
              <div className="flex bg-zinc-800 rounded-md p-0.5 gap-0.5">
                {[1, 2, 4, 6, 8].map((n) => {
                  const maxThreads = usage?.threads ?? 8;
                  const allowed = n <= maxThreads;
                  return (
                    <button key={n} onClick={() => allowed && setThreads(n)}
                      title={allowed ? "" : `Requires a higher plan (max ${maxThreads})`}
                      className={`w-7 h-6 rounded text-xs font-bold transition-all ${threads === n ? "bg-violet-600 text-white" : allowed ? "text-zinc-500 hover:text-zinc-300" : "text-zinc-700 cursor-not-allowed"}`}>
                      {n}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Generate */}
            <button onClick={handleGenerate}
              disabled={generating || selected.size === 0 || !prompt.trim() || (mode === "img2img" && refImages.length === 0)}
              className={`mt-3 w-full py-2.5 rounded-lg text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-lg ${mode === "img2img" ? "bg-gradient-to-r from-fuchsia-600 to-pink-600 hover:from-fuchsia-500 hover:to-pink-500 shadow-fuchsia-500/20" : "bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 shadow-violet-500/20"}`}>
              {generating ? (
                <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Generating...</>
              ) : mode === "img2img" && refImages.length === 0 ? (
                <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01"/></svg>Upload images first</>
              ) : (
                <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                {totalJobs > 1 ? `Generate ${totalJobs} jobs` : "Generate"}</>
              )}
            </button>
          </div>

          {/* Models panel */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 flex-1 overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
              <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Models</label>
              <div className="flex gap-1">
                <button onClick={() => selectAll(filteredModels.filter((m) => !isModelLocked(m.id)).map((m) => m.id))}
                  className="text-xs text-violet-400 hover:text-violet-300 px-2 py-0.5 rounded hover:bg-violet-500/10 transition-colors">All</button>
                <span className="text-zinc-700">·</span>
                <button onClick={() => deselectAll(filteredModels.map((m) => m.id))}
                  className="text-xs text-zinc-500 hover:text-zinc-400 px-2 py-0.5 rounded hover:bg-zinc-700/50 transition-colors">None</button>
              </div>
            </div>
            {/* Search */}
            <div className="px-3 pt-2.5 pb-2 border-b border-zinc-800/50">
              <div className="relative">
                <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"/>
                </svg>
                <input value={modelSearch} onChange={(e) => setModelSearch(e.target.value)}
                  placeholder="Search models..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-zinc-800/70 border border-zinc-700/60 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-violet-500 transition-colors" />
                {modelSearch && (
                  <button onClick={() => setModelSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                  </button>
                )}
              </div>
            </div>
            {/* Size filter (images/img2img only) */}
            {availableSizes.length > 1 && (
              <div className="px-4 py-2 border-b border-zinc-800/50">
                <div className="flex items-center gap-1 flex-wrap">
                  <button onClick={() => setFilterSize("all")}
                    className={`px-2 py-0.5 rounded-full text-xs font-medium transition-all ${filterSize === "all" ? "bg-zinc-600 text-white" : "bg-zinc-800/60 text-zinc-500 hover:text-zinc-300"}`}>
                    All sizes
                  </button>
                  {availableSizes.includes("Landscape") && (
                    <button onClick={() => setFilterSize("Landscape")}
                      className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-all ${filterSize === "Landscape" ? "bg-sky-600 text-white" : "bg-zinc-800/60 text-zinc-500 hover:text-zinc-300"}`}>
                      Landscape
                    </button>
                  )}
                  {availableSizes.includes("Portrait") && (
                    <button onClick={() => setFilterSize("Portrait")}
                      className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-all ${filterSize === "Portrait" ? "bg-purple-600 text-white" : "bg-zinc-800/60 text-zinc-500 hover:text-zinc-300"}`}>
                      Portrait
                    </button>
                  )}
                  {availableSizes.includes("Square") && (
                    <button onClick={() => setFilterSize("Square")}
                      className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-all ${filterSize === "Square" ? "bg-emerald-600 text-white" : "bg-zinc-800/60 text-zinc-500 hover:text-zinc-300"}`}>
                      Square
                    </button>
                  )}
                  {availableSizes.includes("Widescreen") && (
                    <button onClick={() => setFilterSize("Widescreen")}
                      className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-all ${filterSize === "Widescreen" ? "bg-amber-600 text-white" : "bg-zinc-800/60 text-zinc-500 hover:text-zinc-300"}`}>
                      Widescreen
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Family filter */}
            <div className="px-4 py-2 border-b border-zinc-800/50 flex flex-wrap gap-1.5">
              <button onClick={() => setFilterFamily("all")}
                className={`px-2.5 py-0.5 rounded-full text-xs font-medium transition-all ${filterFamily === "all" ? "bg-violet-600 text-white" : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"}`}>
                All ({activeModels.length})
              </button>
              {families.map((f) => (
                <button key={f} onClick={() => setFilterFamily(f)}
                  className={`px-2.5 py-0.5 rounded-full text-xs font-medium border transition-all ${filterFamily === f ? colorMap[f] + " border-current" : "bg-zinc-800/50 border-transparent text-zinc-500 hover:text-zinc-200"}`}>
                  {f.replace("→", "→")} ({activeGroups[f]?.length || 0})
                </button>
              ))}
            </div>
            {/* Model list */}
            <div className="overflow-y-auto max-h-[380px] p-2 space-y-1">
              {loadingModels ? (
                <div className="flex items-center justify-center py-8">
                  <svg className="w-5 h-5 animate-spin text-violet-400" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                </div>
              ) : filteredModels.map((m) => {
                const family = groupFn(m);
                const cc = colorMap[family] || colorMap.Other;
                const isSelected = selected.has(m.id);
                const locked = isModelLocked(m.id);
                const lockLabel = m.id.includes("_r2v_") ? "Extend Video — paid plan" : "First & End Frame — paid plan";
                return (
                  <div key={m.id}
                    onClick={() => {
                      if (locked) {
                        setUpgradeReason(`${lockLabel}. Upgrade to Starter or higher to unlock.`);
                        setShowUpgradeModal(true);
                        return;
                      }
                      toggle(m.id);
                    }}
                    title={locked ? lockLabel : m.id}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all ${locked ? "opacity-45 cursor-not-allowed border border-transparent" : isSelected ? "bg-violet-600/20 border border-violet-600/40 cursor-pointer" : "hover:bg-zinc-800/60 border border-transparent cursor-pointer"}`}>
                    <div className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-all ${locked ? "border-zinc-700 bg-zinc-800" : isSelected ? "bg-violet-600 border-violet-600" : "border-zinc-600"}`}>
                      {locked
                        ? <svg className="w-2.5 h-2.5 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
                        : isSelected && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>
                      }
                    </div>
                    <span className={`text-xs flex-1 leading-tight ${locked ? "text-zinc-500" : "text-zinc-200"}`} title={m.id}>{shortName(m.id)}</span>
                    {locked
                      ? <span className="text-[9px] px-1.5 py-0.5 rounded-full border border-amber-700/50 bg-amber-900/30 text-amber-500 flex-shrink-0">UPGRADE</span>
                      : <span className={`text-[10px] px-1.5 py-0.5 rounded-full border flex-shrink-0 ${cc}`}>
                          {family.replace("Gemini ", "G").replace("→", "→").replace("Text→Video", "T2V").replace("Image→Video", "I2V").replace("Reference→Video", "R2V").replace("Interpolation", "Interp").replace("Imagen 4", "Img4")}
                        </span>
                    }
                  </div>
                );
              })}
            </div>
            {selected.size > 0 && (
              <div className="px-4 py-2 border-t border-zinc-800 text-xs text-zinc-500">
                {selected.size} model{selected.size !== 1 ? "s" : ""} selected
              </div>
            )}
          </div>
        </aside>

        {/* Main content */}
        <main className="flex flex-col gap-4">
          {/* Stats bar */}
          {results.length > 0 && (
            <div className="flex items-center gap-4 px-4 py-3 rounded-xl border border-zinc-800 bg-zinc-900/40">
              <div className="flex items-center gap-4 flex-1">
                {loadingCount > 0 && (
                  <span className="flex items-center gap-1.5 text-xs text-zinc-400">
                    <svg className="w-3.5 h-3.5 animate-spin text-violet-400" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                    {loadingCount} generating
                  </span>
                )}
                {successCount > 0 && <span className="flex items-center gap-1 text-xs text-emerald-400"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block"/> {successCount} done</span>}
                {errorCount > 0 && <span className="flex items-center gap-1 text-xs text-red-400"><span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block"/> {errorCount} failed</span>}
              </div>
              {successCount > 0 && (
                <button onClick={handleBulkDownload} disabled={downloading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-xs font-medium text-white transition-colors disabled:opacity-50">
                  {downloading ? <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> : <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>}
                  Download All ({successCount})
                </button>
              )}
            </div>
          )}

          {/* Results grid */}
          {results.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-20">
              <div className="w-16 h-16 rounded-2xl bg-zinc-800/60 flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-zinc-400 font-medium mb-1">No generations yet</h3>
              <p className="text-zinc-600 text-sm">Select models, enter a prompt, and click Generate</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
              {results.map((r) => (
                <ResultCard key={r.id} result={r} onRegenerate={regenerateOne} onDownload={downloadOne} />
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function ResultCard({ result, onRegenerate, onDownload }: { result: GenResult; onRegenerate: (r: GenResult) => void; onDownload: (r: GenResult) => void }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 overflow-hidden flex flex-col">
      {/* Card header */}
      <div className="px-3 py-2 border-b border-zinc-800/60 flex items-center gap-2">
        <span className="text-xs text-zinc-400 flex-1 truncate" title={result.modelId}>{shortName(result.modelId)}</span>
        {result.duration && result.status !== "loading" && (
          <span className="text-[10px] text-zinc-600 flex-shrink-0">{(result.duration / 1000).toFixed(1)}s</span>
        )}
      </div>

      {/* Source image thumbnail (img2img mode) */}
      {result.sourceImageUrl && (
        <div className="px-3 py-1.5 bg-fuchsia-950/30 border-b border-fuchsia-800/30 flex items-center gap-2">
          <img src={result.sourceImageUrl} alt="src" className="w-7 h-7 rounded object-cover border border-fuchsia-700/50 flex-shrink-0" />
          <span className="text-[10px] text-fuchsia-400 truncate">Source #{(result.sourceImageIndex ?? 0) + 1}</span>
        </div>
      )}

      {/* Prompt label */}
      {result.promptText && (
        <div className="px-3 py-1.5 bg-zinc-800/30 border-b border-zinc-800/40">
          <p className="text-[11px] text-zinc-500 truncate" title={result.promptText}>{result.promptText}</p>
        </div>
      )}

      {/* Media area */}
      <div className="relative bg-zinc-950 aspect-square flex items-center justify-center">
        {result.status === "loading" && (
          <div className="flex flex-col items-center gap-2">
            <svg className="w-6 h-6 animate-spin text-violet-400" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
            {result.retrying ? (
              <div className="flex flex-col items-center gap-0.5">
                <span className="text-xs text-amber-400 font-medium">Retrying {result.retrying}/3</span>
                <span className="text-[10px] text-zinc-600">Previous attempt failed</span>
              </div>
            ) : (
              <span className="text-xs text-zinc-500">Generating...</span>
            )}
          </div>
        )}
        {result.status === "success" && result.mediaType === "image" && result.mediaUrl && (
          <img src={result.mediaUrl} alt={result.modelId}
            className={`w-full h-full object-contain transition-all cursor-zoom-in ${expanded ? "object-contain" : "object-cover"}`}
            onClick={() => setExpanded((s) => !s)} />
        )}
        {result.status === "success" && result.mediaType === "video" && result.mediaUrl && (
          <video src={result.mediaUrl} controls autoPlay loop muted playsInline className="w-full h-full object-contain" />
        )}
        {result.status === "error" && (
          <div className="flex flex-col items-center gap-2 p-4 text-center">
            <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center">
              <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
            </div>
            <p className="text-xs text-red-400 leading-relaxed">{result.error?.slice(0, 100)}</p>
          </div>
        )}
      </div>

      {/* Card actions */}
      <div className="px-3 py-2 border-t border-zinc-800/60 flex gap-2">
        <button onClick={() => onRegenerate(result)} disabled={result.status === "loading"}
          className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-300 transition-colors disabled:opacity-40">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
          Retry
        </button>
        {result.status === "success" && result.mediaUrl && (
          <button onClick={() => onDownload(result)}
            className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-violet-600/20 hover:bg-violet-600/30 text-xs text-violet-300 border border-violet-600/30 transition-colors">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
            Download
          </button>
        )}
      </div>
    </div>
  );
}
