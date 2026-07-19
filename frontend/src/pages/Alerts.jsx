import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Trash2, Bell } from "lucide-react";

export default function Alerts() {
  const [rules, setRules] = useState([]);
  const [ticker, setTicker] = useState("");
  const [cond, setCond] = useState("price_above");
  const [val, setVal] = useState("");

  const load = () => api.get("/alerts").then(r => setRules(r.data.rules || []));
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!ticker) return toast.error("Ticker required");
    await api.post("/alerts", { ticker, condition: cond, value: val ? parseFloat(val) : null, note: "" });
    setTicker(""); setVal(""); load(); toast.success("Alert created");
  };
  const remove = async (id) => { await api.delete(`/alerts/${id}`); load(); };

  return (
    <div className="p-6" data-testid="alerts-page">
      <h1 className="text-3xl font-light tracking-tighter mb-4">Intelligent Alerts</h1>
      <div className="border border-line bg-panel rounded-md p-4 mb-4">
        <div className="overline mb-3">New Rule</div>
        <div className="grid grid-cols-4 gap-2">
          <Input placeholder="Ticker" value={ticker} onChange={(e) => setTicker(e.target.value.toUpperCase())} className="bg-base border-line font-mono" data-testid="alert-ticker" />
          <Select value={cond} onValueChange={setCond}>
            <SelectTrigger className="bg-base border-line"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="price_above">Price above</SelectItem>
              <SelectItem value="price_below">Price below</SelectItem>
              <SelectItem value="news">Any news</SelectItem>
              <SelectItem value="earnings">Earnings</SelectItem>
            </SelectContent>
          </Select>
          <Input placeholder="Value" value={val} onChange={(e) => setVal(e.target.value)} className="bg-base border-line font-mono" data-testid="alert-value" />
          <Button className="bg-terminal text-black hover:bg-terminal/90" onClick={add} data-testid="create-alert-btn"><Plus className="w-3.5 h-3.5 mr-1" />Create</Button>
        </div>
      </div>

      <div className="border border-line bg-panel rounded-md overflow-hidden">
        <div className="overline px-4 py-2.5 border-b border-line">Active Rules</div>
        <table className="w-full text-xs">
          <tbody>
            {rules.map(r => (
              <tr key={r.rule_id} className="border-b border-line hover:bg-surface">
                <td className="px-4 py-2"><Bell className="w-3.5 h-3.5 text-terminal inline mr-2" /><span className="font-mono">{r.ticker}</span></td>
                <td className="px-4 py-2 text-muted-foreground">{r.condition.replace(/_/g, " ")}</td>
                <td className="px-4 py-2 font-mono">{r.value != null ? "$" + r.value : ""}</td>
                <td className="px-4 py-2 text-right"><button onClick={() => remove(r.rule_id)} className="text-muted-foreground hover:text-negative"><Trash2 className="w-3 h-3" /></button></td>
              </tr>
            ))}
            {rules.length === 0 && <tr><td colSpan={4} className="text-center py-6 text-muted-foreground">No alerts.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
