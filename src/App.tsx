import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import {Layout} from "./components/Layout";
import {AuthForm} from "./components/AuthForm";
import {Organizations} from "./pages/Organizations";
import {UserOrganization} from "./pages/UserOrganization";

import {Teams} from "./pages/Teams";
import {UserTeams} from "./pages/UserTeams";

import {Profile} from "./pages/Profile";
import {Settings} from "./pages/Settings";
import {Profiles} from "./pages/Profiles";
import {Dashboard} from "./pages/Dashboard";
import {AdminDashboard} from "./pages/AdminDashboard";
import {Links} from "./pages/Links";
import {TopBarSettings} from "./pages/TopBarSettings";
import {LandingPage} from "./pages/LandingPage";
import {AIChat} from "./apps/ai-chat/AIChat";
import {Apps} from "./pages/Apps";
import {useProfile} from "./hooks/useProfile";
import {ProtectedRoute} from "./components/ProtectedRoute";

export default function App() {
  const {profile, loading} = useProfile();

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <Router>
      <Routes>
        {/* Public Routes */}
        <Route
          path="/"
          element={
            !profile ? (
              <LandingPage />
            ) : profile.is_global_admin ? (
              <Navigate to="/admin/dashboard" replace />
            ) : (
              <Navigate to="/dashboard" replace />
            )
          }
        />
        <Route path="/login" element={<AuthForm mode="login" />} />
        <Route path="/signup" element={<AuthForm mode="signup" />} />

        {/* Protected Admin Routes */}
        <Route
          path="/admin/dashboard"
          element={
            <ProtectedRoute requireAdmin>
              <Layout>
                <AdminDashboard />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/organizations"
          element={
            <ProtectedRoute requireAdmin>
              <Layout>
                <Organizations />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/teams"
          element={
            <ProtectedRoute requireAdmin>
              <Layout>
                <Teams />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/links"
          element={
            <ProtectedRoute requireAdmin>
              <Layout>
                <Links isAdminView />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/topbar"
          element={
            <ProtectedRoute requireAdmin>
              <Layout>
                <TopBarSettings />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/apps"
          element={
            <ProtectedRoute requireAdmin>
              <Layout>
                <Apps />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/profiles"
          element={
            <ProtectedRoute requireAdmin>
              <Layout>
                <Profiles />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute requireAdmin>
              <Layout>
                <Settings />
              </Layout>
            </ProtectedRoute>
          }
        />

        {/* User Routes */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Layout>
                <Dashboard />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/links"
          element={
            <ProtectedRoute>
              <Layout>
                <Links />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/user-organization"
          element={
            <ProtectedRoute>
              <Layout>
                <UserOrganization />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/user-teams"
          element={
            <ProtectedRoute>
              <Layout>
                <UserTeams />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/chat"
          element={
            <ProtectedRoute>
              <Layout>
                <AIChat />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Layout>
                <Profile />
              </Layout>
            </ProtectedRoute>
          }
        />

        {/* Catch all route */}
        <Route
          path="*"
          element={
            profile?.is_global_admin ? (
              <Navigate to="/admin/dashboard" replace />
            ) : (
              <Navigate to="/dashboard" replace />
            )
          }
        />
      </Routes>
    </Router>
  );
}
