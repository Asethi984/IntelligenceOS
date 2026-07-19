import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();

  useEffect(() => {
    if (!loading && !user) {
      // Send unauthenticated users to public landing (preserve return path via state)
      nav("/welcome", { replace: true, state: { from: loc.pathname } });
    }
  }, [loading, user, nav, loc.pathname]);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-base">
        <div className="font-mono text-xs text-muted-foreground">
          <div>› Loading intelligence…</div>
        </div>
      </div>
    );
  }
  if (!user) return null;
  return children;
}
