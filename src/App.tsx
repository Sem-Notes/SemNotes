import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Home from "./pages/Home";
import Profile from "./pages/Profile";
import Upload from "./pages/Upload";
import Explore from "./pages/Explore";
import Auth from "./pages/Auth";
import OnboardingForm from "./components/OnboardingForm";
import { AuthProvider } from "./auth/AuthContext";
import SubjectDetail from "./pages/SubjectDetail";
import NoteDetail from "./pages/NoteDetail";
import Admin from "./pages/Admin";
import { ThemeProvider } from "./components/ui/theme-provider";
import ProtectedRoute from "./auth/ProtectedRoute";
import Onboarding from "./pages/Onboarding";
import AuthCallback from "./pages/AuthCallback";

// Create a client with optimized caching strategy
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Retry failed queries 1 time
      retry: 1,
      // Cache data for 5 minutes by default
      staleTime: 5 * 60 * 1000,
      // Refetch when window gets focus
      refetchOnWindowFocus: true,
      // Immediately show stale data while refetching
      refetchOnMount: true,
    },
  },
});

const App = () => (
  <div className="min-h-screen bg-background">
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="dark" storageKey="theme">
        <TooltipProvider>
          <BrowserRouter>
            <AuthProvider>
              <Toaster />
              <Sonner position="top-center" />
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/auth/callback" element={<AuthCallback />} />
                <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
                <Route path="/home" element={<ProtectedRoute><Home /></ProtectedRoute>} />
                <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
                <Route path="/subjects/:id" element={<ProtectedRoute><SubjectDetail /></ProtectedRoute>} />
                <Route path="/notes/:id" element={<ProtectedRoute><NoteDetail /></ProtectedRoute>} />
                <Route path="/upload" element={<ProtectedRoute><Upload /></ProtectedRoute>} />
                <Route path="/explore" element={<ProtectedRoute><Explore /></ProtectedRoute>} />
                <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </ThemeProvider>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  </div>
);

export default App;
