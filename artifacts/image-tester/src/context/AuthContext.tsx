import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: "admin" | "user";
  status: "pending" | "approved" | "rejected" | "disabled";
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

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  login: (token: string, user: AuthUser) => void;
  logout: () => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    const stored = localStorage.getItem("flow_rsa_token");
    if (!stored) { setLoading(false); return; }
    try {
      const res = await fetch("/api/auth/me", { headers: { Authorization: `Bearer ${stored}` } });
      if (!res.ok) { localStorage.removeItem("flow_rsa_token"); setUser(null); setToken(null); }
      else { const u = await res.json(); setUser(u); setToken(stored); }
    } catch { localStorage.removeItem("flow_rsa_token"); setUser(null); setToken(null); }
    finally { setLoading(false); }
  };

  useEffect(() => { refresh(); }, []);

  const login = (t: string, u: AuthUser) => {
    localStorage.setItem("flow_rsa_token", t);
    setToken(t);
    setUser(u);
  };

  const logout = () => {
    localStorage.removeItem("flow_rsa_token");
    setUser(null);
    setToken(null);
  };

  return <AuthContext.Provider value={{ user, token, loading, login, logout, refresh }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
