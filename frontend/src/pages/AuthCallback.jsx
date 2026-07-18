import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
export default function AuthCallback() {
  const nav = useNavigate();
  const { setUser } = useAuth();

  useEffect(() => {
    const hash = window.location.hash;
    const match = hash.match(/session_id=([^&]+)/);
    if (!match) { nav("/login"); return; }
    const session_id = match[1];
    (async () => {
      try {
        const { data } = await api.post("/auth/oauth/session", { session_id });
        setUser(data.user);
        window.history.replaceState({}, document.title, "/");
        nav("/", { replace: true, state: { user: data.user } });
      } catch (e) {
        nav("/login");
      }
    })();
  }, [nav, setUser]);

  return (
    <div className="h-screen flex items-center justify-center bg-base">
      <div className="font-mono text-xs text-muted-foreground">
        <div>› Verifying session…</div>
        <div>› Establishing secure connection…</div>
      </div>
    </div>
  );
}
