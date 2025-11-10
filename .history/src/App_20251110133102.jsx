import { ChakraProvider, Box } from "@chakra-ui/react";
import theme from "./theme";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Header from "./components/Header";
import Home from "./pages/Home";
import CreatePost from "./pages/CreatePost";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import DashboardDept from "./pages/DashboardDept";
import Dashboard from "./pages/Dashboard";
import Admin from "./pages/Admin";
import Profile from "./pages/Profile";
import PrivateRoute from "./components/PrivateRoute";
import { AuthProvider, useAuth } from "./context/AuthContext";

function DeptRedirect() {
  const { profile } = useAuth();
  if (profile?.role === "dept" && profile?.department) {
    return <Navigate to={`/dashboard/${profile.department}`} replace />;
  }
  return <Navigate to="/" replace />;
}

export default function App() {
  return (
    <ChakraProvider theme={theme}>
      <AuthProvider>
        <BrowserRouter>
          <Box minH="100vh" bg="gray.50">
            <Header />
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/feed" element={<Home showIntro={false} />} />

              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />

              <Route element={<PrivateRoute />}>
                <Route path="/create" element={<CreatePost />} />
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
          </Box>
        </BrowserRouter>
      </AuthProvider>
    </ChakraProvider>
  );
}
