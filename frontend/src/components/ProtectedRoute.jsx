import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  if (loading) return <div className="h-screen flex items-center justify-center text-muted-foreground font-mono text-xs">Loading intelligence…</div>;
  if (!user) { navigate("/login"); return null; }
  return children;
}
