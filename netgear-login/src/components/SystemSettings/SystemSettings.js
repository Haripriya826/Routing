// src/SystemSettings.js
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../Dashboard/Dashboard.css";

// ⭐ Add Toastify imports
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

export default function SystemSettings() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [serverSettings, setServerSettings] = useState({ theme: "system" });
  const [theme, setTheme] = useState("system");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  const redirectTimerRef = useRef(null);

  const getToken = useCallback(() => {
    return (
      localStorage.getItem("authToken") ||
      localStorage.getItem("token") ||
      null
    );
  }, []);

  const applyThemeToDocument = useCallback((t) => {
    try {
      const root = document.documentElement;
      const body = document.body;

      if (t === "dark") {
        root.setAttribute("data-theme", "dark");
        root.classList.add("theme-dark");
        body && body.classList.add("theme-dark");

        localStorage.setItem("themeSetting", "dark");
        localStorage.setItem("theme", "dark");
      } else if (t === "light") {
        root.setAttribute("data-theme", "light");
        root.classList.remove("theme-dark");
        body && body.classList.remove("theme-dark");

        localStorage.setItem("themeSetting", "light");
        localStorage.setItem("theme", "light");
      } else {
        root.removeAttribute("data-theme");

        const prefersDark =
          typeof window !== "undefined" &&
          window.matchMedia &&
          window.matchMedia("(prefers-color-scheme: dark)").matches;

        root.classList.toggle("theme-dark", prefersDark);
        body && body.classList.toggle("theme-dark", prefersDark);

        localStorage.setItem("themeSetting", "system");
        localStorage.setItem("theme", prefersDark ? "dark" : "light");
      }
    } catch (e) {
      console.warn("applyThemeToDocument failed:", e);
    }
  }, []);

  useEffect(() => {
    let aborted = false;

    async function load() {
      setLoading(true);
      setErr(null);
      try {
        const token = localStorage.getItem("authToken");
        if (!token) {
          setErr("Not authenticated — please login.");
          redirectTimerRef.current = window.setTimeout(() => navigate("/"), 800);
          return;
        }

        const res = await fetch("http://localhost:5000/api/user/settings", {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        if (res.status === 401) {
          setErr("Session expired — redirecting…");
          localStorage.removeItem("authToken");
          localStorage.removeItem("token");
          localStorage.removeItem("username");
          redirectTimerRef.current = window.setTimeout(() => navigate("/"), 800);
          return;
        }

        if (!res.ok) {
          const b = await res.json().catch(() => ({}));
          throw new Error(b.message || `Server returned ${res.status}`);
        }

        const body = await res.json();
        if (!aborted) {
          const s = body?.settings || { theme: "system" };
          setServerSettings(s);
          setTheme(s.theme ?? "system");
          applyThemeToDocument(s.theme ?? "system");
        }
      } catch (e) {
        if (!aborted) setErr(e.message || "Failed to load settings");
      } finally {
        if (!aborted) setLoading(false);
      }
    }

    load();
    return () => {
      aborted = true;
      if (redirectTimerRef.current) {
        clearTimeout(redirectTimerRef.current);
        redirectTimerRef.current = null;
      }
    };
  }, [navigate, getToken, applyThemeToDocument]);

  const onSelectTheme = (t) => {
    setTheme(t);
    setErr(null);
    applyThemeToDocument(t);
  };

  const onSave = async () => {
    setSaving(true);
    setErr(null);

    try {
      const token = getToken();
      if (!token) throw new Error("No auth token, please login");

      const res = await fetch("http://localhost:5000/api/user/settings", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ theme }),
      });

      if (res.status === 401) {
        throw new Error("Session expired");
      }

      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.message || `Server returned ${res.status}`);
      }

      const body = await res.json();
      const updated = body?.settings || { theme };

      applyThemeToDocument(updated.theme ?? "system");
      setServerSettings(updated);

      // ⭐ SUCCESS TOAST
      toast.success("Saved Successfully!", {
        position: "top-center",
        autoClose: 2000,
      });

    } catch (e) {
      // ⭐ ERROR TOAST
      toast.error(e.message || "Failed to save", {
        position:"top-center",
        autoClose: 2000,
      });
    } finally {
      setSaving(false);
    }
  };

  const onReset = () => {
    const base = serverSettings.theme ?? "system";
    setTheme(base);
    applyThemeToDocument(base);

    // ⭐ RESET TOAST
    toast.info("Reverted to server value", {
      position: "top-center",
      autoClose: 1500,
    });
  };

  return (
    <div className="sys-settings-root">
      
      {/* Toast Container */}
     {/* Toast Container */}
        <ToastContainer
          position="top-center"
          autoClose={1800}
          hideProgressBar={false}
          newestOnTop={false}
          closeOnClick
          pauseOnHover
        />


      <div className="sys-settings-card">
        <h2>System Settings</h2>

        {loading ? (
          <div>Loading settings…</div>
        ) : err ? (
          <div className="sys-error" role="alert">{err}</div>
        ) : (
          <>
            <div className="radio-group" role="radiogroup" aria-label="Theme">
              <label className="radio-row">
                <input
                  type="radio"
                  name="theme"
                  value="system"
                  checked={theme === "system"}
                  onChange={() => onSelectTheme("system")}
                />
                <div className="radio-info">
                  <div className="radio-title">Default</div>
                  <div className="radio-desc">Follow system colors</div>
                </div>
              </label>

              <label className="radio-row">
                <input
                  type="radio"
                  name="theme"
                  value="light"
                  checked={theme === "light"}
                  onChange={() => onSelectTheme("light")}
                />
                <div className="radio-info">
                  <div className="radio-title">Light</div>
                  <div className="radio-desc">Force light theme</div>
                </div>
              </label>

              <label className="radio-row">
                <input
                  type="radio"
                  name="theme"
                  value="dark"
                  checked={theme === "dark"}
                  onChange={() => onSelectTheme("dark")}
                />
                <div className="radio-info">
                  <div className="radio-title">Dark</div>
                  <div className="radio-desc">Force dark theme</div>
                </div>
              </label>
            </div>

            <div className="sys-actions">
              <button className="btn" onClick={onSave} disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </button>
              <button className="btn muted" onClick={onReset} disabled={saving}>
                Reset
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
