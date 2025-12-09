// index.js / main.js
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./pages/Login/App";
import Dashboard from "./components/Dashboard/Dashboard";
import AttachedDevices from "./components/AttachedDevices/AttachedDevices";
import SystemSettings from "./components/SystemSettings/SystemSettings";
   
import { BrowserRouter, Routes, Route } from "react-router-dom";

const root = ReactDOM.createRoot(document.getElementById("root"));

root.render(
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<App />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/attached-devices" element={<AttachedDevices/>}/>
      <Route path="/System-settings" element={<SystemSettings/>}/>

    </Routes>
  </BrowserRouter>
);
