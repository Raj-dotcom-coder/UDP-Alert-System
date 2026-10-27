import React from "react";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";

import Login from "./pages/Login";
import AdminDashboard from "./pages/AdminDashboard";
import ClientDashboard from "./pages/ClientDashboard";

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem("udpAlertUser") || "null");
  } catch {
    localStorage.removeItem("udpAlertUser");
    return null;
  }
}

function RequireRole({ role, children }) {
  const user = getStoredUser();
  if (!user?.token) return <Navigate to="/login" replace />;
  const allowed = Array.isArray(role) ? role : [role];
  if (!allowed.includes(user.role)) return <Navigate to="/login" replace />;
  return children;
}

function App() {
  return (
    <HashRouter>
      <Routes>

        {/* Login Page */}
        <Route path="/login" element={<Login />} />

        <Route
          path="/admin"
          element={<RequireRole role={["admin", "client"]}><AdminDashboard /></RequireRole>}
        />

        <Route
          path="/client"
          element={<RequireRole role={["admin", "client"]}><ClientDashboard /></RequireRole>}
        />

        {/* Default Route */}
        <Route
          path="/"
          element={<Navigate to="/login" replace />}
        />

        {/* Invalid Route */}
        <Route
          path="*"
          element={<Navigate to="/login" replace />}
        />

      </Routes>
    </HashRouter>
  );
}

export default App;