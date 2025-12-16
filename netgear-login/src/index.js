// src/index.js
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import App from "./pages/Login/App";
import Dashboard from "./components/Dashboard/Dashboard";

const root = ReactDOM.createRoot(document.getElementById("root"));

root.render(
  <BrowserRouter>
    <Routes>
      {/* Login */}
      <Route path="/" element={<App />} />

      {/* SAME COMPONENT, DIFFERENT URLS */}
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/monitoring" element={<Dashboard />} />
      <Route path="/configuration/system" element={<Dashboard />} />
      <Route path="/configuration/users" element={<Dashboard />} />

      {/* fallback */}
      <Route path="*" element={<Navigate to="/dashboard" />} />
    </Routes>
  </BrowserRouter>
);
