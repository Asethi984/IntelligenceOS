import { useEffect, useState } from "react";
import api from "@/lib/api";

export default function Team() {
  const [members, setMembers] = useState([]);
  useEffect(() => { api.get("/team/members").then(r => setMembers(r.data)); }, []);

  return (
    <div className="p-6" data-testid="team-page">
      <h1 className="text-3xl font-light tracking-tighter mb-4">Team</h1>
      <div className="border border-line bg-panel rounded-md overflow-hidden">
        <div className="overline px-4 py-2.5 border-b border-line">Members</div>
        <table className="w-full text-xs">
          <thead><tr className="text-muted-foreground border-b border-line">{["Name","Email","Role","Plan"].map(h => <th key={h} className="text-left overline font-normal px-4 py-2">{h}</th>)}</tr></thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.user_id} className="border-b border-line hover:bg-surface">
                <td className="px-4 py-2 flex items-center gap-2"><div className="w-6 h-6 rounded-full bg-surface flex items-center justify-center text-xs font-mono">{(m.name || m.email || "?")[0]?.toUpperCase()}</div>{m.name || "—"}</td>
                <td className="px-4 py-2 font-mono text-muted-foreground">{m.email}</td>
                <td className="px-4 py-2"><span className="px-2 py-0.5 border border-line rounded text-[10px] uppercase tracking-widest">{m.role || "Viewer"}</span></td>
                <td className="px-4 py-2 font-mono">{m.plan || "Free"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
