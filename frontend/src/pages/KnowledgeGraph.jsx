import { useCallback, useEffect, useState } from "react";
import ReactFlow, { Background, Controls } from "reactflow";
import "reactflow/dist/style.css";
import api from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function KnowledgeGraph() {
  const [ticker, setTicker] = useState("AAPL");
  const [input, setInput] = useState("AAPL");
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);

  const load = useCallback(async (t) => {
    const { data } = await api.get(`/graph/${t}`);
    setNodes(data.nodes || []);
    setEdges(data.edges || []);
  }, []);

  useEffect(() => { load(ticker); }, [ticker, load]);

  return (
    <div className="p-6" data-testid="graph-page">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-3xl font-light tracking-tighter">Knowledge Graph</h1>
        <div className="flex gap-2">
          <Input value={input} onChange={(e) => setInput(e.target.value.toUpperCase())} className="bg-base border-line font-mono w-32" data-testid="graph-ticker" />
          <Button size="sm" className="bg-terminal text-black hover:bg-terminal/90" onClick={() => setTicker(input)} data-testid="load-graph-btn">Explore</Button>
        </div>
      </div>
      <div className="border border-line bg-panel rounded-md" style={{ height: "70vh" }}>
        <ReactFlow nodes={nodes} edges={edges} fitView>
          <Background color="#22262E" gap={20} />
          <Controls className="!bg-panel" />
        </ReactFlow>
      </div>
    </div>
  );
}
