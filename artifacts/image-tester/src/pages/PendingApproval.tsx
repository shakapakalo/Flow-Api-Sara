import { useAuth } from "@/context/AuthContext";

export default function PendingApproval() {
  const { user, logout } = useAuth();

  const statusConfig = {
    pending: {
      icon: "⏳",
      color: "text-amber-400",
      bg: "bg-amber-500/10 border-amber-500/30",
      title: "Approval Pending",
      message: "Your account is awaiting admin approval. You'll be able to access the tool once approved.",
    },
    rejected: {
      icon: "✕",
      color: "text-red-400",
      bg: "bg-red-500/10 border-red-500/30",
      title: "Access Denied",
      message: "Your account request was not approved. Please contact the admin for more information.",
    },
    disabled: {
      icon: "⊘",
      color: "text-zinc-400",
      bg: "bg-zinc-500/10 border-zinc-500/30",
      title: "Account Disabled",
      message: "Your account has been disabled. Please contact the admin.",
    },
  };

  const status = (user?.status as keyof typeof statusConfig) || "pending";
  const cfg = statusConfig[status] || statusConfig.pending;

  return (
    <div className="min-h-screen bg-[#080810] flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 mb-6 shadow-lg shadow-violet-500/20">
          <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        </div>

        <div className={`mb-6 px-4 py-4 rounded-2xl border ${cfg.bg}`}>
          <div className="text-3xl mb-2">{cfg.icon}</div>
          <h2 className={`text-lg font-semibold mb-2 ${cfg.color}`}>{cfg.title}</h2>
          <p className="text-zinc-400 text-sm">{cfg.message}</p>
        </div>

        {user && (
          <p className="text-zinc-500 text-sm mb-6">
            Signed in as <span className="text-zinc-300">{user.email}</span>
          </p>
        )}

        <button
          onClick={logout}
          className="px-6 py-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-medium transition-colors"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
