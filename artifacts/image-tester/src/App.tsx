import { Switch, Route, Redirect, useLocation } from "wouter";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { Toaster } from "@/components/ui/toaster";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import PendingApproval from "@/pages/PendingApproval";
import Tool from "@/pages/Tool";
import Admin from "@/pages/Admin";
import Pricing from "@/pages/Pricing";

function AppRoutes() {
  const { user, loading } = useAuth();
  const [location] = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#080810] flex items-center justify-center">
        <svg className="w-8 h-8 animate-spin text-violet-400" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  return (
    <Switch>
      <Route path="/login">
        {user && user.status === "approved" ? <Redirect to="/" /> : user ? <Redirect to="/pending" /> : <Login />}
      </Route>

      <Route path="/register">
        {user && user.status === "approved" ? <Redirect to="/" /> : user ? <Redirect to="/pending" /> : <Register />}
      </Route>

      <Route path="/pending">
        {!user ? <Redirect to="/login" /> : user.status === "approved" ? <Redirect to="/" /> : <PendingApproval />}
      </Route>

      <Route path="/admin">
        {!user ? <Redirect to="/login" /> :
          user.status !== "approved" ? <Redirect to="/pending" /> :
          user.role !== "admin" ? <Redirect to="/" /> :
          <Admin />}
      </Route>

      <Route path="/pricing">
        {!user ? <Redirect to="/login" /> : <Pricing />}
      </Route>

      <Route path="/">
        {!user ? <Redirect to="/login" /> :
          user.status !== "approved" ? <Redirect to="/pending" /> :
          <Tool />}
      </Route>

      <Route>
        <Redirect to="/" />
      </Route>
    </Switch>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
      <Toaster />
    </AuthProvider>
  );
}
