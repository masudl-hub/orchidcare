import React from "react";

import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import Onboarding from "./pages/Onboarding";
import LoginPage from "./pages/LoginPage";
import BeginPage from "./pages/BeginPage";
import Dashboard from "./pages/Dashboard";
import Settings from "./pages/Settings";
import Plants from "./pages/Plants";
import NotFound from "./pages/NotFound";
import Proposal from "./pages/Proposal";
import OrchidPage from "./pages/OrchidPage";
import LiveCallPage from "./pages/LiveCallPage";
import DevCallPage from "./pages/DevCallPage";
import DemoPage from "./pages/DemoPage";
import PvpPage from "./pages/PvpPage";
import NamerPage from "./pages/NamerPage";
import DogerPage from "./pages/DogerPage";
import Privacy from "./pages/Privacy";
import AppPage from "./pages/AppPage";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<OrchidPage />} />
            <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/begin" element={<BeginPage />} />
            <Route path="/signup" element={<Navigate to="/begin" replace />} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/dashboard/collection" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/dashboard/profile" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/dashboard/activity" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            <Route path="/plants" element={<ProtectedRoute><Plants /></ProtectedRoute>} />
            <Route path="/proposal" element={<Proposal />} />
            <Route path="/call" element={<LiveCallPage />} />
            <Route path="/dev/call" element={<DevCallPage />} />
            <Route path="/demo" element={<DemoPage />} />
            <Route path="/get-demo" element={<DemoPage />} />
            <Route path="/pvp" element={<PvpPage />} />
            <Route path="/namer" element={<NamerPage />} />
            <Route path="/doger" element={<DogerPage />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/app" element={<AppPage />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;