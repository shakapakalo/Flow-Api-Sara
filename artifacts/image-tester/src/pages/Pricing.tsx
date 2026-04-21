import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";

interface Plan {
  id: string;
  name: string;
  price: number;
  badge?: string;
  gradient: string;
  textColor: string;
  borderColor: string;
  genLimit: string;
  threads: number;
  features: { label: string; included: boolean; note?: string; isNew?: boolean }[];
}

const PLANS: Plan[] = [
  {
    id: "starter",
    name: "Starter",
    price: 1500,
    gradient: "from-blue-600 to-blue-800",
    textColor: "text-blue-100",
    borderColor: "border-blue-500",
    genLimit: "800",
    threads: 4,
    features: [
      { label: "Veo 3.0 Model", included: true },
      { label: "Speed Limit: 4 Threads", included: true },
      { label: "Service Limit: 1 Device", included: true },
      { label: "Text-to-Video", included: true },
      { label: "Image-to-Video", included: true },
      { label: "Extend Video", included: true, isNew: true },
      { label: "First & End Frame", included: true },
      { label: "Character Consistency 100%", included: true },
      { label: "Nova Remote Pro", included: true },
      { label: "Video Resolution: 720p", included: true },
      { label: "Image Resolution: 1K", included: true },
      { label: "Image Generation: 1,000", included: true },
      { label: "Portrait / Landscape", included: true },
      { label: "Bulk Generation", included: true },
      { label: "Veo Prompt AI (after 50)", included: true },
    ],
  },
  {
    id: "lite",
    name: "Lite",
    price: 2500,
    gradient: "from-cyan-500 to-teal-700",
    textColor: "text-cyan-100",
    borderColor: "border-cyan-400",
    genLimit: "1,500",
    threads: 4,
    features: [
      { label: "Veo 3.0 Model", included: true },
      { label: "Speed Limit: 4 Threads", included: true },
      { label: "Service Limit: 1 Device", included: true },
      { label: "Text-to-Video", included: true },
      { label: "Image-to-Video", included: true },
      { label: "Extend Video", included: true, isNew: true },
      { label: "First & End Frame", included: true },
      { label: "Character Consistency 100%", included: true },
      { label: "Nova Remote Pro", included: true },
      { label: "Video Resolution: 720p", included: true },
      { label: "Image Resolution: 1K", included: true },
      { label: "Image Generation: 1,000", included: true },
      { label: "Portrait / Landscape", included: true },
      { label: "Bulk Generation", included: true },
      { label: "Veo Prompt AI (after 50)", included: true },
    ],
  },
  {
    id: "elite",
    name: "Elite",
    price: 3000,
    badge: "POPULAR",
    gradient: "from-purple-600 to-violet-800",
    textColor: "text-purple-100",
    borderColor: "border-purple-400",
    genLimit: "2,000",
    threads: 4,
    features: [
      { label: "Veo 3.0 Model", included: true },
      { label: "Speed Limit: 4 Threads", included: true },
      { label: "Service Limit: 1 Device", included: true },
      { label: "Text-to-Video", included: true },
      { label: "Image-to-Video", included: true },
      { label: "Extend Video", included: true },
      { label: "First & End Frame", included: true, isNew: true },
      { label: "Character Consistency 100%", included: true },
      { label: "Nova Remote Pro", included: true },
      { label: "Video Resolution: 720p", included: true },
      { label: "Image Resolution: 1K", included: true },
      { label: "Image Generation: 1,000", included: true },
      { label: "Portrait / Landscape", included: true },
      { label: "Bulk Generation", included: true },
      { label: "Veo Prompt AI (after 50)", included: true },
    ],
  },
  {
    id: "infinity",
    name: "Infinity",
    price: 7000,
    gradient: "from-amber-500 to-orange-700",
    textColor: "text-amber-100",
    borderColor: "border-amber-400",
    genLimit: "Unlimited",
    threads: 4,
    features: [
      { label: "Veo 3.0 Model", included: true },
      { label: "Speed Limit: 4 Threads", included: true },
      { label: "Service Limit: 1 Device", included: true },
      { label: "Text-to-Video", included: true },
      { label: "Image-to-Video", included: true },
      { label: "Extend Video", included: true },
      { label: "First & End Frame", included: true },
      { label: "Character Consistency 100%", included: true },
      { label: "Store Banana Pro", included: true },
      { label: "Video Banana 2", included: true, isNew: true },
      { label: "Video Resolution: 720p, 4K", included: true },
      { label: "Image Resolution: 1K, 4K", included: true },
      { label: "Image Generation: 10,000", included: true },
      { label: "Portrait / Landscape", included: true },
      { label: "PDG Add", included: true, isNew: true },
      { label: "Unlimited Bulk Generation", included: true },
      { label: "Veo Prompt AI (after 200)", included: true },
    ],
  },
  {
    id: "infinity_pro",
    name: "Infinity Pro",
    price: 15000,
    gradient: "from-red-600 to-rose-800",
    textColor: "text-red-100",
    borderColor: "border-red-400",
    genLimit: "Unlimited",
    threads: 8,
    features: [
      { label: "Veo 3.0 Model", included: true },
      { label: "Speed Limit: 8 Threads", included: true },
      { label: "Service Limit: 1 Device", included: true },
      { label: "Text-to-Video", included: true },
      { label: "Image-to-Video", included: true },
      { label: "Extend Video", included: true },
      { label: "Image-to-Video (Advanced)", included: true },
      { label: "Character Consistency 100%", included: true },
      { label: "Store Banana Pro", included: true },
      { label: "Video Banana 2", included: true, isNew: true },
      { label: "Video Resolution: 720p, 4K", included: true },
      { label: "Image Resolution: 1K, 4K", included: true },
      { label: "Image Generation: 10,000", included: true },
      { label: "Portrait / Landscape", included: true },
      { label: "PDG Add", included: true, isNew: true },
      { label: "GEO Add", included: true, isNew: true },
      { label: "Unlimited Bulk Generation", included: true },
      { label: "Veo Prompt AI (after 200)", included: true },
    ],
  },
];

const SUPER_VEO: Plan = {
  id: "super_veo",
  name: "Super VEO",
  price: 5000,
  badge: "SPECIAL OFFER",
  gradient: "from-violet-600 via-purple-600 to-indigo-700",
  textColor: "text-violet-100",
  borderColor: "border-violet-400",
  genLimit: "Unlimited",
  threads: 4,
  features: [
    { label: "Veo 3.0 Model", included: true },
    { label: "Speed Limit: 4 Threads", included: true },
    { label: "Text-to-Video", included: true },
    { label: "Image-to-Video", included: true },
    { label: "Extend Video", included: true },
    { label: "First & End Frame", included: true, isNew: true },
    { label: "Store Banana Pro", included: true },
    { label: "Image Resolution: 1K", included: true },
    { label: "Portrait / Landscape", included: true },
    { label: "Veo Prompt AI (after 50)", included: true },
    { label: "Bulk Generation", included: true },
  ],
};

function CheckIcon({ ok }: { ok: boolean }) {
  if (ok) return (
    <svg className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
    </svg>
  );
  return (
    <svg className="w-3.5 h-3.5 text-zinc-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function PlanCard({ plan, currentPlan }: { plan: Plan; currentPlan?: string }) {
  const isActive = plan.id === currentPlan;
  return (
    <div className={`relative rounded-2xl border-2 ${isActive ? "border-white shadow-2xl shadow-white/10 scale-[1.02]" : plan.borderColor + "/40"} bg-gradient-to-b ${plan.gradient} flex flex-col overflow-hidden transition-all`}>
      {plan.badge && (
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-0.5">
          <span className="bg-white text-[10px] font-black text-zinc-900 px-3 py-0.5 rounded-full uppercase tracking-widest shadow">{plan.badge}</span>
        </div>
      )}
      {isActive && (
        <div className="absolute top-2 right-2">
          <span className="text-[10px] bg-white/20 border border-white/30 text-white px-2 py-0.5 rounded-full font-semibold">Your Plan</span>
        </div>
      )}
      <div className="p-5 pb-3">
        <p className={`text-xs font-bold uppercase tracking-widest mb-1 ${plan.textColor} opacity-80`}>{plan.name}</p>
        <div className="flex items-end gap-1 mb-1">
          <span className="text-xs text-white/60 font-medium">Rs</span>
          <span className="text-4xl font-black text-white leading-none">{plan.price.toLocaleString()}</span>
          <span className="text-xs text-white/60 mb-1">/mo</span>
        </div>
        <div className="mt-2 mb-3">
          <span className={`text-xs px-3 py-1 rounded-full font-bold bg-white/20 text-white border border-white/20`}>
            {plan.genLimit === "Unlimited" ? "✦ Unlimited Generation" : `${plan.genLimit} Video Generations`}
          </span>
        </div>
      </div>
      <div className="flex-1 px-5 pb-5 space-y-2">
        {plan.features.map((f) => (
          <div key={f.label} className={`flex items-center gap-2 ${!f.included ? "opacity-40" : ""}`}>
            <CheckIcon ok={f.included} />
            <span className="text-xs text-white/90">{f.label}</span>
            {f.isNew && f.included && (
              <span className="text-[9px] bg-rose-500 text-white px-1.5 py-0.5 rounded font-bold uppercase ml-auto">NEW</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Pricing() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-[#080810] text-zinc-100 font-sans">
      {/* Header */}
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
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <div>
              <span className="font-bold text-sm text-white">Flow</span>
              <span className="font-medium text-sm text-violet-400"> by RSA</span>
              <span className="text-zinc-500 text-sm"> — Pricing</span>
            </div>
          </div>
          {user && (
            <div className="ml-auto text-xs text-zinc-500">
              Current plan: <span className="text-violet-400 font-semibold capitalize">{((user as any).planName || user.plan || "free") === "free" ? "Promotion" : ((user as any).planName || user.plan)}</span>
            </div>
          )}
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-10">
        {/* Title */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-black text-white mb-2">Choose Your Plan</h1>
          <p className="text-zinc-400 text-sm">Powerful AI image & video generation — pick what fits your needs</p>
          {user && (
            <p className="mt-3 text-xs text-zinc-600">Contact admin to upgrade your plan</p>
          )}
        </div>

        {/* Main plans grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          {/* Promotion Card */}
          <div className="relative rounded-2xl border-2 border-emerald-400/70 bg-gradient-to-b from-emerald-700 to-teal-900 flex flex-col overflow-hidden animate-pulse-border">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-0.5">
              <span className="bg-emerald-400 text-[10px] font-black text-zinc-900 px-3 py-0.5 rounded-full uppercase tracking-widest shadow">PROMOTION</span>
            </div>
            <div className="p-5 pb-3 pt-7">
              <p className="text-xs font-bold uppercase tracking-widest mb-1 text-emerald-100 opacity-80">Special Offer</p>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-3xl font-black text-white leading-none">🎁</span>
              </div>
              <p className="text-sm font-black text-white leading-snug mt-2">Exclusive Deal</p>
              <p className="text-[11px] text-emerald-200/80 mt-1">Contact us for latest promotions & discounts</p>
            </div>
            <div className="flex-1 px-5 pb-3 space-y-2 mt-1">
              <div className="flex items-center gap-2">
                <svg className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/></svg>
                <span className="text-xs text-white/90">Special Discounts</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/></svg>
                <span className="text-xs text-white/90">Limited Time Offer</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/></svg>
                <span className="text-xs text-white/90">Custom Plans Available</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/></svg>
                <span className="text-xs text-white/90">Priority Support</span>
              </div>
            </div>
            <div className="px-4 pb-5">
              <a href={`https://wa.me/923103508162?text=${encodeURIComponent("Hi! I want to know about your current promotions and special offers for Flow by RSA.")}`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-xs font-bold text-white transition-colors shadow-lg shadow-emerald-900/50">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                Claim Offer
              </a>
            </div>
          </div>
          {PLANS.map((plan) => (
            <PlanCard key={plan.id} plan={plan} currentPlan={(user as any)?.plan} />
          ))}
        </div>

        {/* Super VEO special */}
        <div className="max-w-md mx-auto">
          <div className={`relative rounded-2xl border-2 ${SUPER_VEO.id === (user as any)?.plan ? "border-white shadow-2xl" : "border-violet-500/60"} bg-gradient-to-br ${SUPER_VEO.gradient} overflow-hidden`}>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-0.5">
              <span className="bg-white text-[10px] font-black text-zinc-900 px-4 py-0.5 rounded-full uppercase tracking-widest shadow">SPECIAL OFFER</span>
            </div>
            <div className="p-6 pt-8 text-center">
              <p className="text-lg font-black text-white uppercase tracking-widest mb-1">Super VEO</p>
              <p className="text-xs text-violet-200 mb-3">Text + Ultra Subscription</p>
              <div className="flex items-end justify-center gap-1 mb-3">
                <span className="text-sm text-white/60">Rs</span>
                <span className="text-5xl font-black text-white leading-none">5,000</span>
                <span className="text-sm text-white/60 mb-1">/mo</span>
              </div>
              <div className="mb-5">
                <span className="text-sm px-4 py-1.5 rounded-full font-bold bg-white/20 text-white border border-white/20">✦ Unlimited Generation</span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-left">
                {SUPER_VEO.features.map((f) => (
                  <div key={f.label} className="flex items-center gap-2">
                    <CheckIcon ok={f.included} />
                    <span className="text-xs text-white/90">{f.label}</span>
                    {f.isNew && <span className="text-[9px] bg-rose-500 text-white px-1 py-0.5 rounded font-bold">NEW</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer note */}
        <div className="text-center mt-8 text-xs text-zinc-600">
          All prices in Pakistani Rupees (PKR) · Contact admin to change your plan
        </div>
      </div>
    </div>
  );
}
