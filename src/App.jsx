import { ChakraProvider, Box } from "@chakra-ui/react";
import theme from "./theme";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import Header from "./views/components/Header";
import Footer from "./views/components/Footer";
import Home from "./views/pages/Home";
import CreatePost from "./views/pages/CreatePost";
import Login from "./views/pages/Login";
import Signup from "./views/pages/Signup";
import DashboardDept from "./views/pages/DashboardDept";
import Dashboard from "./views/pages/Dashboard";
import DashboardAnalytics from "./views/pages/DashboardAnalytics";
import Admin from "./views/pages/Admin";
import Profile from "./views/pages/Profile";
import IssueDetail from "./views/pages/IssueDetail";
import PrivateRoute from "./views/components/PrivateRoute";
import { AuthProvider, useAuth } from "./controllers/AuthContext";
import Chatbot from "./views/components/Chatbot";
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
  if (profile?.role === "admin") {
    return <Navigate to="/dashboard" replace />;
  }
  if (profile?.role === "dept" && profile?.department) {
    return <Navigate to={`/dashboard/${profile.department}`} replace />;
  }
  return <Home />;
}

function FooterWrapper() {
  const { user, profile } = useAuth();
  if (!user || profile?.role === "public") {
    return <Footer />;
  }
  return null;
}

function ChatbotWrapper() {
  const { user } = useAuth();
  const location = useLocation();

  const isAuthPage =
    location.pathname === "/login" || location.pathname === "/signup";

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

              <Route path="/feed" element={<Home showIntro={false} />} />

              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />

              <Route element={<PrivateRoute requireRole="public" />}>
                <Route path="/create" element={<CreatePost />} />
              </Route>

              <Route element={<PrivateRoute />}>
                <Route path="/profile" element={<Profile />} />
              </Route>

              <Route element={<PrivateRoute />}>
                <Route path="/issue/:id" element={<IssueDetail />} />
              </Route>

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

              <Route element={<PrivateRoute requireRole="dept" />}>
                <Route path="/dashboard/:dept" element={<DashboardDept />} />
              </Route>

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

              <Route element={<PrivateRoute requireRole="dept" />}>
                <Route
                  path="/analytics/:dept"
                  element={<DashboardAnalytics />}
                />
              </Route>

              <Route element={<PrivateRoute requireRole="admin" />}>
                <Route path="/dashboard" element={<Dashboard />} />
              </Route>

              <Route element={<PrivateRoute requireRole="dept" />}>
                <Route path="/dashboard" element={<DeptRedirect />} />
              </Route>

              <Route element={<PrivateRoute requireRole="admin" />}>
                <Route path="/admin" element={<Admin />} />
              </Route>
            </Routes>

            <ChatbotWrapper />

            <FooterWrapper />
          </Box>
        </BrowserRouter>
      </AuthProvider>
    </ChakraProvider>
  );
}
