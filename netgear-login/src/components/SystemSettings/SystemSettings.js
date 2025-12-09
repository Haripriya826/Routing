// src/SystemSettings.js
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../Dashboard/Dashboard.css"; // re-use Dashboard.css so styles append in same file

export default function SystemSettings() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [serverSettings, setServerSettings] = useState({ theme: "system" });
  const [theme, setTheme] = useState("system");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);

  const getToken = () =>
    localStorage.getItem("authToken") || localStorage.getItem("token") || null;

  // Apply a theme scoped to the dashboard root (.dash-root) and persist setting
  const applyThemeScopedToDashRoot = (t) => {
    try {
      const dashRoot = document.querySelector(".dash-root");

      // persist setting for server/restore
      if (t === "dark") {
        localStorage.setItem("themeSetting", "dark");
        localStorage.setItem("theme", "dark");
      } else if (t === "light") {
        localStorage.setItem("themeSetting", "light");
        localStorage.setItem("theme", "light");
      } else {
        localStorage.setItem("themeSetting", "system");
        const prefersDark =
          window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
        localStorage.setItem("theme", prefersDark ? "dark" : "light");
      }

      if (!dashRoot) {
        // Nothing to style on this page (e.g., login) — keep it untouched.
        return;
      }

      // Clear existing classes
      dashRoot.classList.remove("theme-dark", "theme-light", "theme-system");

      if (t === "dark") {
        dashRoot.classList.add("theme-dark");
      } else if (t === "light") {
        dashRoot.classList.add("theme-light");
      } else {
        // system: preview based on prefers-color-scheme
        const prefersDark =
          window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
        if (prefersDark) dashRoot.classList.add("theme-dark");
        else dashRoot.classList.add("theme-light");
      }
    } catch (e) {
      console.warn("applyThemeScopedToDashRoot failed:", e);
    }
  };

  // read persisted choice (for quick preview)
  useEffect(() => {
    try {
      const stored = localStorage.getItem("themeSetting") || localStorage.getItem("theme");
      if (stored === "dark" || stored === "light" || stored === "system") {
        setTheme(stored === "dark" || stored === "light" ? stored : "system");
        applyThemeScopedToDashRoot(stored === "dark" || stored === "light" ? stored : "system");
      } else {
        // default: system
        applyThemeScopedToDashRoot("system");
      }
    } catch (e) {
      // ignore localStorage read errors
    }
  }, []);

  // load server settings on mount
  useEffect(() => {
    let aborted = false;
    async function load() {
      setLoading(true);
      setErr(null);
      try {
        const token = getToken();
        if (!token) {
          setErr("Not authenticated — please login.");
          setTimeout(() => navigate("/"), 800);
          return;
        }

        const res = await fetch("http://localhost:5000/api/user/settings", {
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
        });

        if (res.status === 401) {
          setErr("Session expired — redirecting to login...");
          try {
            localStorage.removeItem("authToken");
            localStorage.removeItem("token");
            localStorage.removeItem("username");
          } catch {}
          setTimeout(() => navigate("/"), 800);
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
          const serverTheme = s.theme ?? "system";
          setTheme(serverTheme);

          // Apply theme scoped to .dash-root so dashboard reflects it on load
          applyThemeScopedToDashRoot(serverTheme);
        }
      } catch (e) {
        console.error("load settings error", e);
        if (!aborted) setErr(e.message || "Failed to load settings");
      } finally {
        if (!aborted) setLoading(false);
      }
    }
    load();
    return () => {
      aborted = true;
    };
  }, [navigate]);

  // Change handler for radio buttons: applies immediately (preview) but not persisted until Save
  const onSelectTheme = (t) => {
    setTheme(t);
    setMsg(null);
    setErr(null);
    applyThemeScopedToDashRoot(t);
  };

  const onSave = async () => {
    setSaving(true);
    setMsg(null);
    setErr(null);
    try {
      const token = getToken();
      if (!token) throw new Error("No auth token, please login");

      const res = await fetch("http://localhost:5000/api/user/settings", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ theme })
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

      // persist locally and apply globally scoped to dashboard
      applyThemeScopedToDashRoot(updated.theme ?? "system");

      setServerSettings(updated);
      setMsg("Saved successfully");
    } catch (e) {
      console.error("save settings error", e);
      setErr(e.message || "Failed to save");
    } finally {
      setSaving(false);
      setTimeout(() => {
        setMsg(null);
        setErr(null);
      }, 2500);
    }
  };

  const onReset = () => {
    setTheme(serverSettings.theme ?? "system");
    applyThemeScopedToDashRoot(serverSettings.theme ?? "system");
    setMsg("Reverted to server value");
    setTimeout(() => setMsg(null), 1500);
  };

  return (
    <div className="sys-settings-root">
      <div className="sys-settings-card">
        <h2>System Settings</h2>

        {loading ? (
          <div>Loading settings…</div>
        ) : err ? (
          <div className="sys-error">{err}</div>
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
              <button
                className="btn link"
                onClick={() => {
                  try {
                    localStorage.removeItem("authToken");
                    localStorage.removeItem("token");
                  } catch {}
                  navigate("/dashboard");
                }}
              >
                Back to Dashboard
              </button>
            </div>

            {msg && <div className="sys-msg success">{msg}</div>}
            {!msg && err && <div className="sys-msg error">{err}</div>}
          </>
        )}
      </div>
    </div>
  );
}
