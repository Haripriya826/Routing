import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AutoRefreshProvider } from "./context/AutoRefreshContext";
import App from "./pages/Login/App";
import Dashboard from "./components/Dashboard/Dashboard";

const root = ReactDOM.createRoot(document.getElementById("root"));

root.render(
  <BrowserRouter>
    <AutoRefreshProvider>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/monitoring" element={<Dashboard />} />
        <Route path="/configuration/system" element={<Dashboard />} />
        <Route path="/configuration/users" element={<Dashboard />} />
        <Route path="*" element={<Navigate to="/dashboard" />} />
      </Routes>
    </AutoRefreshProvider>
  </BrowserRouter>
);
