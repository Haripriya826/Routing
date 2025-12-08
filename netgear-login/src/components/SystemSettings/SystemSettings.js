// src/SystemSettings.js
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Dashboard.css"; // re-use Dashboard.css so styles append in same file

export default function SystemSettings() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [serverSettings, setServerSettings] = useState({ theme: "system" });
  const [theme, setTheme] = useState("system");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);

  const getToken = () => localStorage.getItem("authToken") || localStorage.getItem("token") || null;

  // Apply a theme immediately to the document element and localStorage
  const applyThemeToDocument = (t) => {
    try {
      const root = document.documentElement;
      if (t === "dark") {
        root.setAttribute("data-theme", "dark");
        root.classList.add("theme-dark");
        localStorage.setItem("themeSetting", "dark");
        localStorage.setItem("theme", "dark");
      } else if (t === "light") {
        root.setAttribute("data-theme", "light");
        root.classList.remove("theme-dark");
        localStorage.setItem("themeSetting", "light");
        localStorage.setItem("theme", "light");
      } else {
        // system
        root.removeAttribute("data-theme");
        // set class based on system preference
        const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
        root.classList.toggle("theme-dark", prefersDark);
        localStorage.setItem("themeSetting", "system");
        // maintain legacy key but keep it as light/dark for older reads
        localStorage.setItem("theme", prefersDark ? "dark" : "light");
      }
    } catch (e) {
      // ignore DOM/storage failures on some environments
      console.warn("applyThemeToDocument failed:", e);
    }
  };

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
          try { localStorage.removeItem("authToken"); localStorage.removeItem("token"); localStorage.removeItem("username"); } catch {}
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

          // Apply the theme immediately so the page reflects it on load
          applyThemeToDocument(serverTheme);
        }
      } catch (e) {
        console.error("load settings error", e);
        if (!aborted) setErr(e.message || "Failed to load settings");
      } finally {
        if (!aborted) setLoading(false);
      }
    }
    load();
    return () => { aborted = true; };
  }, [navigate]);

  // Change handler for radio buttons: applies immediately (preview) but not persisted until Save
  const onSelectTheme = (t) => {
    setTheme(t);
    setMsg(null);
    setErr(null);
    // apply preview immediately to whole app
    applyThemeToDocument(t);
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

      // persist locally and apply globally
      applyThemeToDocument(updated.theme ?? "system");

      setServerSettings(updated);
      setMsg("Saved successfully");
    } catch (e) {
      console.error("save settings error", e);
      setErr(e.message || "Failed to save");
    } finally {
      setSaving(false);
      setTimeout(() => { setMsg(null); setErr(null); }, 2500);
    }
  };

  const onReset = () => {
    setTheme(serverSettings.theme ?? "system");
    applyThemeToDocument(serverSettings.theme ?? "system");
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
                  try { localStorage.removeItem("authToken"); localStorage.removeItem("token"); } catch {}
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
