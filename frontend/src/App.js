import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import "@/App.css";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Layout from "@/components/Layout";
import Login from "@/pages/Login";
import AuthCallback from "@/pages/AuthCallback";
import CommandCenter from "@/pages/CommandCenter";
import Markets from "@/pages/Markets";
import CompanyDetail from "@/pages/CompanyDetail";
import Portfolio from "@/pages/Portfolio";
import Research from "@/pages/Research";
import AIAgents from "@/pages/AIAgents";
import Screeners from "@/pages/Screeners";
import Valuation from "@/pages/Valuation";
import Documents from "@/pages/Documents";
import Alerts from "@/pages/Alerts";
import KnowledgeGraph from "@/pages/KnowledgeGraph";
import Team from "@/pages/Team";
import Settings from "@/pages/Settings";
import Pipeline from "@/pages/Pipeline";
import Journal from "@/pages/Journal";
import Timeline from "@/pages/Timeline";

function AppRouter() {
  const location = useLocation();
  if (location.hash?.includes("session_id=")) {
    return <AuthCallback />;
  }
  return (
    <Routes>
      <Route path="/login" element={<Login mode="login" />} />
      <Route path="/signup" element={<Login mode="signup" />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route path="/" element={<CommandCenter />} />
        <Route path="/markets" element={<Markets />} />
        <Route path="/company/:ticker" element={<CompanyDetail />} />
        <Route path="/portfolio" element={<Portfolio />} />
        <Route path="/research" element={<Research />} />
        <Route path="/agents" element={<AIAgents />} />
        <Route path="/screeners" element={<Screeners />} />
        <Route path="/valuation" element={<Valuation />} />
        <Route path="/documents" element={<Documents />} />
        <Route path="/alerts" element={<Alerts />} />
        <Route path="/graph" element={<KnowledgeGraph />} />
        <Route path="/pipeline" element={<Pipeline />} />
        <Route path="/journal" element={<Journal />} />
        <Route path="/timeline/:ticker" element={<Timeline />} />
        <Route path="/team" element={<Team />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AuthProvider>
          <AppRouter />
          <Toaster theme="dark" />
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;
