import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { adminGetUsers, adminGetStats, adminUpdateUser, adminDeleteUser, adminResetUsage } from "@/lib/api";

interface AdminUser {
  id: number; name: string; email: string; role: string; status: string;
  plan: string; imagesUsed: number; videosUsed: number; regenerationsUsed: number;
  createdAt: string; lastLoginAt?: string;
}
interface Stats {
  users: { total: number; pending: number; approved: number; rejected: number; disabled: number };
  flow2api: { total_tokens: number; active_tokens: number; total_images: number; total_videos: number; today_images: number; today_videos: number } | null;
}

const STATUS_COLORS: Record<string, string> = {
  approved: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  pending: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  rejected: "bg-red-500/15 text-red-400 border-red-500/30",
  disabled: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
};

const PLAN_COLORS: Record<string, string> = {
  free:         "text-zinc-400",
  starter:      "text-blue-400",
  lite:         "text-cyan-400",
  elite:        "text-emerald-400",
  super_veo:    "text-fuchsia-400",
  infinity:     "text-violet-400",
  infinity_pro: "text-amber-400",
};

const PLANS = [
  { id: "free",         name: "Free (Rs 0)" },
  { id: "starter",     name: "Starter (Rs 1,500)" },
  { id: "lite",        name: "Lite (Rs 2,500)" },
  { id: "elite",       name: "Elite (Rs 3,000)" },
  { id: "super_veo",   name: "Super VEO (Rs 5,000)" },
  { id: "infinity",    name: "Infinity (Rs 7,000)" },
  { id: "infinity_pro",name: "Infinity Pro (Rs 15,000)" },
];

const PLAN_LIMITS: Record<string, { images: number; videos: number; regen: number }> = {
  free:         { images: 10,    videos: 5,    regen: 10 },
  starter:      { images: 1000,  videos: 800,  regen: -1 },
  lite:         { images: 1000,  videos: 1500, regen: -1 },
  elite:        { images: 1000,  videos: 2000, regen: -1 },
  super_veo:    { images: 1000,  videos: -1,   regen: -1 },
  infinity:     { images: 10000, videos: -1,   regen: -1 },
  infinity_pro: { images: 10000, videos: -1,   regen: -1 },
};

export default function Admin() {
  const { user: me } = useAuth();
  const [, setLocation] = useLocation();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<number | null>(null);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const [u, s] = await Promise.all([adminGetUsers(), adminGetStats()]);
      setUsers(u);
      setStats(s);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const updateUser = async (id: number, changes: { status?: string; role?: string; plan?: string }) => {
    setUpdating(id);
    try {
      await adminUpdateUser(id, changes);
      await load();
    } catch (err) { alert(String(err)); }
    finally { setUpdating(null); }
  };

  const resetUsage = async (id: number, name: string) => {
    if (!confirm(`Reset usage counters for "${name}"?`)) return;
    setUpdating(id);
    try { await adminResetUsage(id); await load(); }
    catch (err) { alert(String(err)); }
    finally { setUpdating(null); }
  };

  const deleteUser = async (id: number, name: string) => {
    if (!confirm(`Delete user "${name}"? This cannot be undone.`)) return;
    setUpdating(id);
    try { await adminDeleteUser(id); await load(); }
    catch (err) { alert(String(err)); }
    finally { setUpdating(null); }
  };

  const filteredUsers = users
    .filter((u) => filter === "all" || u.status === filter)
    .filter((u) => !search || u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()));

  const fmt = (d?: string | null) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const usageBar = (used: number, limit: number) => {
    if (limit === -1) return <span className="text-xs text-zinc-500">∞</span>;
    const pct = Math.min(100, (used / limit) * 100);
    const color = pct >= 100 ? "bg-red-500" : pct >= 75 ? "bg-amber-500" : "bg-emerald-500";
    return (
      <div className="flex items-center gap-1.5">
        <div className="w-14 h-1.5 bg-zinc-700 rounded-full overflow-hidden">
          <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
        </div>
        <span className="text-xs text-zinc-500">{used}/{limit}</span>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#080810] text-zinc-100 font-sans">
      <header className="border-b border-zinc-800/60 bg-[#0a0a14]/90 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-4">
          <button onClick={() => setLocation("/")}
            className="flex items-center gap-1.5 text-zinc-400 hover:text-white text-sm transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
            Back
          </button>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
              </svg>
            </div>
            <div>
              <span className="font-bold text-sm text-white">Flow</span>
              <span className="text-sm text-violet-400"> by RSA</span>
              <span className="text-zinc-500 text-sm"> — Admin Panel</span>
            </div>
          </div>
          <div className="ml-auto">
            <a href="/manage" target="_blank" rel="noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-300 transition-colors border border-zinc-700">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
              Flow2API Admin
            </a>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Stats grid */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {[
              { label: "Total Users", value: stats.users.total, color: "text-white" },
              { label: "Pending", value: stats.users.pending, color: "text-amber-400" },
              { label: "Approved", value: stats.users.approved, color: "text-emerald-400" },
              { label: "Rejected", value: stats.users.rejected, color: "text-red-400" },
              ...(stats.flow2api ? [
                { label: "Images Today", value: stats.flow2api.today_images, color: "text-violet-400" },
                { label: "Videos Today", value: stats.flow2api.today_videos, color: "text-cyan-400" },
              ] : []),
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-zinc-500 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Plan legend */}
        <div className="flex flex-wrap gap-2">
          {PLANS.map((p) => (
            <span key={p.id} className={`text-xs px-2.5 py-1 rounded-full border border-zinc-700 bg-zinc-900 ${PLAN_COLORS[p.id]}`}>
              {p.name}
            </span>
          ))}
        </div>

        {/* Users table */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-800 flex items-center gap-3 flex-wrap">
            <h2 className="text-sm font-semibold text-white">Users</h2>
            <div className="flex-1"/>
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or email..."
              className="px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-violet-500 w-44" />
            <select value={filter} onChange={(e) => setFilter(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-xs text-zinc-300 focus:outline-none focus:border-violet-500">
              <option value="all">All statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="disabled">Disabled</option>
            </select>
            <button onClick={load} className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 transition-colors">
              <svg className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-800/60">
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-zinc-500">Name</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-zinc-500">Email</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-zinc-500">Role</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-zinc-500">Status</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-zinc-500">Plan</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-zinc-500">Images</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-zinc-500">Videos</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-zinc-500">Regen</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-zinc-500">Joined</th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium text-zinc-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => {
                  const isMe = u.id === me?.id;
                  const busy = updating === u.id;
                  const limits = PLAN_LIMITS[u.plan] || PLAN_LIMITS.free;
                  return (
                    <tr key={u.id} className="border-b border-zinc-800/40 hover:bg-zinc-800/20 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                            {u.name[0]?.toUpperCase()}
                          </div>
                          <span className="text-sm text-zinc-200 whitespace-nowrap">{u.name}</span>
                          {isMe && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-500/20 text-violet-400 border border-violet-500/30">you</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-zinc-400 whitespace-nowrap">{u.email}</td>
                      <td className="px-4 py-3">
                        <select value={u.role} disabled={isMe || busy}
                          onChange={(e) => updateUser(u.id, { role: e.target.value })}
                          className="text-xs bg-zinc-800 border border-zinc-700 rounded-md px-2 py-1 text-zinc-300 focus:outline-none focus:border-violet-500 disabled:opacity-50">
                          <option value="user">User</option>
                          <option value="admin">Admin</option>
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full border whitespace-nowrap ${STATUS_COLORS[u.status] || STATUS_COLORS.disabled}`}>
                          {u.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <select value={u.plan} disabled={busy}
                          onChange={(e) => updateUser(u.id, { plan: e.target.value })}
                          className={`text-xs bg-zinc-800 border border-zinc-700 rounded-md px-2 py-1 focus:outline-none focus:border-violet-500 disabled:opacity-50 ${PLAN_COLORS[u.plan] || "text-zinc-300"}`}>
                          {PLANS.map((p) => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">{usageBar(u.imagesUsed, limits.images)}</td>
                      <td className="px-4 py-3">{usageBar(u.videosUsed, limits.videos)}</td>
                      <td className="px-4 py-3">{usageBar(u.regenerationsUsed, limits.regen)}</td>
                      <td className="px-4 py-3 text-xs text-zinc-500 whitespace-nowrap">{fmt(u.createdAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 justify-end flex-wrap">
                          {u.status === "pending" && (
                            <>
                              <button disabled={busy} onClick={() => updateUser(u.id, { status: "approved" })}
                                className="px-2.5 py-1 rounded-md bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 text-xs font-medium border border-emerald-500/30 transition-colors disabled:opacity-40 whitespace-nowrap">
                                Approve
                              </button>
                              <button disabled={busy} onClick={() => updateUser(u.id, { status: "rejected" })}
                                className="px-2.5 py-1 rounded-md bg-red-500/15 hover:bg-red-500/25 text-red-400 text-xs font-medium border border-red-500/30 transition-colors disabled:opacity-40">
                                Reject
                              </button>
                            </>
                          )}
                          {u.status === "approved" && !isMe && (
                            <button disabled={busy} onClick={() => updateUser(u.id, { status: "disabled" })}
                              className="px-2.5 py-1 rounded-md bg-zinc-700/50 hover:bg-zinc-700 text-zinc-400 text-xs transition-colors disabled:opacity-40">
                              Disable
                            </button>
                          )}
                          {(u.status === "rejected" || u.status === "disabled") && (
                            <button disabled={busy} onClick={() => updateUser(u.id, { status: "approved" })}
                              className="px-2.5 py-1 rounded-md bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 text-xs border border-emerald-500/30 transition-colors disabled:opacity-40 whitespace-nowrap">
                              Re-approve
                            </button>
                          )}
                          <button disabled={busy} onClick={() => resetUsage(u.id, u.name)}
                            title="Reset usage counters"
                            className="px-2 py-1 rounded-md bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-xs border border-blue-500/20 transition-colors disabled:opacity-40 whitespace-nowrap">
                            Reset
                          </button>
                          {!isMe && (
                            <button disabled={busy} onClick={() => deleteUser(u.id, u.name)}
                              className="p-1 rounded-md hover:bg-red-500/15 text-zinc-600 hover:text-red-400 transition-colors disabled:opacity-40">
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                            </button>
                          )}
                          {busy && <svg className="w-4 h-4 animate-spin text-violet-400" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredUsers.length === 0 && (
                  <tr><td colSpan={10} className="px-4 py-8 text-center text-sm text-zinc-500">No users found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
