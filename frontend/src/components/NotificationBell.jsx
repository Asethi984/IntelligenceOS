import { useEffect, useState, useRef } from "react";
import api from "@/lib/api";
import { Bell, X, CheckCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function NotificationBell() {
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const ref = useRef();
  const nav = useNavigate();

  const load = () => api.get("/notifications").then(r => { setItems(r.data.notifications); setUnread(r.data.unread_count); }).catch(() => {});
  useEffect(() => {
    load();
    const t = setInterval(load, 45000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const markRead = async (id) => { await api.post(`/notifications/${id}/read`); load(); };
  const markAll = async () => { await api.post("/notifications/read-all"); load(); };

  const clickItem = (n) => {
    markRead(n.notification_id);
    if (n.meta?.ticker) nav(`/company/${n.meta.ticker}`);
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(o => !o)} className="relative p-1.5 hover:bg-surface rounded-md transition-colors" data-testid="notification-bell">
        <Bell className="w-4 h-4 text-muted-foreground" />
        {unread > 0 && <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-terminal text-black text-[10px] font-mono rounded-full flex items-center justify-center">{unread > 9 ? "9+" : unread}</span>}
      </button>
      {open && (
        <div className="absolute right-0 top-8 w-96 bg-panel border border-line rounded-md shadow-2xl z-50 max-h-[70vh] flex flex-col" data-testid="notification-panel">
          <div className="flex items-center justify-between px-4 py-2 border-b border-line">
            <span className="overline">Notifications</span>
            <div className="flex items-center gap-2">
              {unread > 0 && (
                <button onClick={markAll} className="text-[10px] font-mono text-muted-foreground hover:text-terminal flex items-center gap-1" data-testid="mark-all-read-btn">
                  <CheckCheck className="w-3 h-3" /> Mark all read
                </button>
              )}
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground"><X className="w-3.5 h-3.5" /></button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {items.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground">No notifications yet.</div>
            ) : items.map(n => (
              <div key={n.notification_id} onClick={() => clickItem(n)}
                className={`px-4 py-3 border-b border-line cursor-pointer hover:bg-surface ${!n.read ? "bg-terminal/5" : ""}`} data-testid={`notification-${n.notification_id}`}>
                <div className="flex items-start gap-2">
                  {!n.read && <div className="w-1.5 h-1.5 rounded-full bg-terminal mt-1.5 flex-shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm">{n.title}</div>
                    <div className="text-xs text-muted-foreground mt-0.5" dangerouslySetInnerHTML={{ __html: n.body }} />
                    <div className="text-[10px] text-muted-foreground/70 font-mono mt-1">{new Date(n.created_at).toLocaleString()}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
