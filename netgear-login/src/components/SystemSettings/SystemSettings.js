// src/SystemSettings.js
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../Dashboard/Dashboard.css"; // re-use Dashboard.css

export default function SystemSettings() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [serverSettings, setServerSettings] = useState({ theme: "system" });
  const [theme, setTheme] = useState("system");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);

  // stable refs for timers so we can clear them on unmount
  const redirectTimerRef = useRef(null);
  const clearMsgTimerRef = useRef(null);

  // stable helper to fetch token
  const getToken = useCallback(() => {
    return (
      localStorage.getItem("authToken") ||
      localStorage.getItem("token") ||
      null
    );
  }, []);

  // Apply a theme immediately to the document element, BODY, and localStorage
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
        // system
        root.removeAttribute("data-theme");

        const prefersDark =
          typeof window !== "undefined" &&
          window.matchMedia &&
          window.matchMedia("(prefers-color-scheme: dark)").matches;

        root.classList.toggle("theme-dark", prefersDark);
        body && body.classList.toggle("theme-dark", prefersDark);

        localStorage.setItem("themeSetting", "system");
        // legacy key as actual theme
        localStorage.setItem("theme", prefersDark ? "dark" : "light");
      }
    } catch (e) {
      // Warn but don't throw so UI still works
      // eslint-disable-next-line no-console
      console.warn("applyThemeToDocument failed:", e);
    }
  }, []);

  // Load server settings on mount
  useEffect(() => {
    let aborted = false;

    async function load() {
      setLoading(true);
      setErr(null);
      try {
        const token = getToken();
        if (!token) {
          setErr("Not authenticated — please login.");
          // redirect after a short delay
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
          setErr("Session expired — redirecting to login...");
          try {
            localStorage.removeItem("authToken");
            localStorage.removeItem("token");
            localStorage.removeItem("username");
          } catch {}
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
          const serverTheme = s.theme ?? "system";
          setTheme(serverTheme);

          // Apply the theme immediately so the whole app reflects it
          applyThemeToDocument(serverTheme);
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error("load settings error", e);
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
    // getToken and applyThemeToDocument are stable via useCallback
    // include navigate because it's stable provided by react-router
  }, [navigate, getToken, applyThemeToDocument]);

  // Change handler for radio buttons: applies immediately (preview)
  const onSelectTheme = (t) => {
    setTheme(t);
    setMsg(null);
    setErr(null);
    applyThemeToDocument(t);
  };

  const onSave = async () => {
    setSaving(true);
    setMsg(null);
    setErr(null);

    // clear any previous clearMsg timer
    if (clearMsgTimerRef.current) {
      clearTimeout(clearMsgTimerRef.current);
      clearMsgTimerRef.current = null;
    }

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

      // persist locally and apply globally
      applyThemeToDocument(updated.theme ?? "system");
      setServerSettings(updated);
      setMsg("Saved successfully");
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("save settings error", e);
      setErr(e.message || "Failed to save");
    } finally {
      setSaving(false);

      // clear message after a while
      clearMsgTimerRef.current = window.setTimeout(() => {
        setMsg(null);
        setErr(null);
        clearMsgTimerRef.current = null;
      }, 2500);
    }
  };

  const onReset = () => {
    const base = serverSettings.theme ?? "system";
    setTheme(base);
    applyThemeToDocument(base);
    setMsg("Reverted to server value");

    if (clearMsgTimerRef.current) {
      clearTimeout(clearMsgTimerRef.current);
      clearMsgTimerRef.current = null;
    }
    clearMsgTimerRef.current = window.setTimeout(() => {
      setMsg(null);
      clearMsgTimerRef.current = null;
    }, 1500);
  };

  // clear any timers on unmount
  useEffect(() => {
    return () => {
      if (redirectTimerRef.current) {
        clearTimeout(redirectTimerRef.current);
        redirectTimerRef.current = null;
      }
      if (clearMsgTimerRef.current) {
        clearTimeout(clearMsgTimerRef.current);
        clearMsgTimerRef.current = null;
      }
    };
  }, []);

  return (
    <div className="sys-settings-root">
      <div className="sys-settings-card">
        <h2>System Settings</h2>

        {loading ? (
          <div>Loading settings…</div>
        ) : err ? (
          <div className="sys-error" role="alert">{err}</div>
        ) : (
          <>
            <div
              className="radio-group"
              role="radiogroup"
              aria-label="Theme"
            >
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
              <button
                className="btn muted"
                onClick={onReset}
                disabled={saving}
              >
                Reset
              </button>
            </div>

            {msg && <div className="sys-msg success" role="status">{msg}</div>}
            {!msg && err && <div className="sys-msg error" role="alert">{err}</div>}
          </>
        )}
      </div>
    </div>
  );
}
