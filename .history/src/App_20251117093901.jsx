import { ChakraProvider, Box } from "@chakra-ui/react";
import theme from "./theme";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import Header from "./components/Header";
import Footer from "./components/Footer";
import Home from "./pages/Home";
import CreatePost from "./pages/CreatePost";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import DashboardDept from "./pages/DashboardDept";
import Dashboard from "./pages/Dashboard";
import DashboardAnalytics from "./pages/DashboardAnalytics";
import Admin from "./pages/Admin";
import Profile from "./pages/Profile";
import PrivateRoute from "./components/PrivateRoute";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Chatbot from "./components/Chatbot";
import "leaflet/dist/leaflet.css";

function DeptRedirect() {
  const { profile } = useAuth();
  if (profile?.role === "dept" && profile?.department) {
    return <Navigate to={`/dashboard/${profile.department}`} replace />;
  }
  return <Navigate to="/" replace />;
}

function HomeRedirect() {
  const { profile } = useAuth();
  // Redirect admin to analytics dashboard
  if (profile?.role === "admin") {
    return <Navigate to="/dashboard" replace />;
  }
  // Redirect dept-admin to their department dashboard
  if (profile?.role === "dept" && profile?.department) {
    return <Navigate to={`/dashboard/${profile.department}`} replace />;
  }
  // Public users see normal home
  return <Home />;
}

function FooterWrapper() {
  const { user, profile } = useAuth();
  // Show footer only for non-logged users or public users
  if (!user || profile?.role === "public") {
    return <Footer />;
  }
  return null;
}

function ChatbotWrapper() {
  const { user } = useAuth();
  const location = window.location;
  
  // Don't show chatbot on login or signup pages, and only show when user is logged in
  const isAuthPage = location.pathname === "/login" || location.pathname === "/signup";
  
  if (user && !isAuthPage) {
    return <Chatbot />;
  }
  return null;
}

export default function App() {
  return (
    <ChakraProvider theme={theme}>
      <AuthProvider>
        <BrowserRouter>
          <Box minH="100vh" bg="gray.50">
            <Header />
            <Routes>
              <Route path="/" element={<HomeRedirect />} />

              {/* Feed - only for public users and admin */}
              <Route path="/feed" element={<Home showIntro={false} />} />

              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />

              {/* Create - only for public users */}
              <Route element={<PrivateRoute requireRole="public" />}>
                <Route path="/create" element={<CreatePost />} />
              </Route>

              <Route element={<PrivateRoute />}>
                <Route path="/profile" element={<Profile />} />
              </Route>

              {/* Dedicated routes so dept users only see their own link; admin can access all */}
              <Route
                element={
                  <PrivateRoute requireRole="dept" requireDept="Electricity" />
                }
              >
                <Route
                  path="/dashboard/Electricity"
                  element={<DashboardDept fixedDept="Electricity" />}
                />
              </Route>
              <Route
                element={
                  <PrivateRoute requireRole="dept" requireDept="Water" />
                }
              >
                <Route
                  path="/dashboard/Water"
                  element={<DashboardDept fixedDept="Water" />}
                />
              </Route>
              <Route
                element={
                  <PrivateRoute requireRole="dept" requireDept="Sewage" />
                }
              >
                <Route
                  path="/dashboard/Sewage"
                  element={<DashboardDept fixedDept="Sewage" />}
                />
              </Route>
              <Route
                element={<PrivateRoute requireRole="dept" requireDept="Road" />}
              >
                <Route
                  path="/dashboard/Road"
                  element={<DashboardDept fixedDept="Road" />}
                />
              </Route>

              {/* Dynamic route still supported */}
              <Route element={<PrivateRoute requireRole="dept" />}>
                <Route path="/dashboard/:dept" element={<DashboardDept />} />
              </Route>

              {/* Analytics Dashboard for Dept Admins */}
              <Route
                element={
                  <PrivateRoute requireRole="dept" requireDept="Electricity" />
                }
              >
                <Route
                  path="/analytics/Electricity"
                  element={<DashboardAnalytics />}
                />
              </Route>
              <Route
                element={
                  <PrivateRoute requireRole="dept" requireDept="Water" />
                }
              >
                <Route
                  path="/analytics/Water"
                  element={<DashboardAnalytics />}
                />
              </Route>
              <Route
                element={
                  <PrivateRoute requireRole="dept" requireDept="Sewage" />
                }
              >
                <Route
                  path="/analytics/Sewage"
                  element={<DashboardAnalytics />}
                />
              </Route>
              <Route
                element={<PrivateRoute requireRole="dept" requireDept="Road" />}
              >
                <Route
                  path="/analytics/Road"
                  element={<DashboardAnalytics />}
                />
              </Route>

              {/* Dynamic analytics route for dept admins */}
              <Route element={<PrivateRoute requireRole="dept" />}>
                <Route
                  path="/analytics/:dept"
                  element={<DashboardAnalytics />}
                />
              </Route>

              {/* Analytics Dashboard for Admin */}
              <Route element={<PrivateRoute requireRole="admin" />}>
                <Route path="/dashboard" element={<Dashboard />} />
              </Route>

              {/* Shortcut to go to correct dashboard for dept users */}
              <Route element={<PrivateRoute requireRole="dept" />}>
                <Route path="/dashboard" element={<DeptRedirect />} />
              </Route>

              <Route element={<PrivateRoute requireRole="admin" />}>
                <Route path="/admin" element={<Admin />} />
              </Route>
            </Routes>

            {/* AI Chatbot - Available on all pages */}
            <Chatbot />

            {/* Footer - Only for public and non-logged users */}
            <FooterWrapper />
          </Box>
        </BrowserRouter>
      </AuthProvider>
    </ChakraProvider>
  );
}
