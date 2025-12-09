// src/App.js
import React, { useState, useRef, useEffect } from "react";
import "./App.css";
import leftImage1 from "../../assets/leftImage1.png";
import { useNavigate } from "react-router-dom";

export default function App() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const passwordRef = useRef(null);

  const [errors, setErrors] = useState({ username: false, password: false });
  const [serverMsg, setServerMsg] = useState("");

  // state to trigger silent reload
  const [reloadAfterFail, setReloadAfterFail] = useState(false);

  const navigate = useNavigate();

  // LOGIN FUNCTION — CLEAN & SIMPLE
  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerMsg("");
    setErrors({ username: false, password: false });
    setReloadAfterFail(false);

    if (!username.trim() || !password) {
      setErrors({
        username: !username.trim(),
        password: !password,
      });
      return;
    }

    try {
      const res = await fetch("http://localhost:5000/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });

      const data = await res.json().catch(() => ({}));

      // SUCCESS → go dashboard instantly
      if (res.ok && data.status === true) {
        if (data.token) localStorage.setItem("authToken", data.token);
        localStorage.setItem("username", username.trim());

        navigate("/dashboard"); // instant redirect
        return;
      }

      // FAILURE
      const message = data?.message || "Invalid credentials";
      setServerMsg(message);
      setErrors({ username: true, password: true });
      setReloadAfterFail(true);

    } catch (err) {
      console.error("Network/login error:", err);
      setServerMsg("Network error — could not reach authentication server.");
      setReloadAfterFail(true);
    }
  };

  // EFFECT → silent reload after 10s
  useEffect(() => {
    if (!reloadAfterFail) return;

    const t = setTimeout(() => window.location.reload(), 10000);
    return () => clearTimeout(t);
  }, [reloadAfterFail]);

  // RESET reload trigger when user types again
  const onUsernameChange = (val) => {
    setUsername(val);
    setReloadAfterFail(false);
    if (errors.username) setErrors((p) => ({ ...p, username: false }));
    if (serverMsg) setServerMsg("");
  };

  const onPasswordChange = (val) => {
    setPassword(val);
    setReloadAfterFail(false);
    if (errors.password) setErrors((p) => ({ ...p, password: false }));
    if (serverMsg) setServerMsg("");
  };

  return (
    <div className="page">
      <aside className="left-panel">
        <div className="left-inner">
          <h1 className="product-title">PR60X</h1>
          <div className="divider" />
          <p className="subtitle">
            Multi-Gigabit Dual WAN Pro Router
            <br />
            with Insight Cloud Management
          </p>
          <img className="device-img" src={leftImage1} alt="router device" />
        </div>
      </aside>

      <main className="right-panel">
        <div className="logo">NETGEAR</div>

        <form className="login-form" onSubmit={handleSubmit} noValidate>
          <h2 className="login-title">Log In</h2>

          {/* Username */}
          <div className={`floating-group ${errors.username ? "input-error" : ""}`}>
            <input
              id="username"
              name="username"
              className="input-field"
              type="text"
              value={username}
              onChange={(e) => onUsernameChange(e.target.value)}
              placeholder=" "
              autoComplete="username"
              aria-label="username"
            />
            <label htmlFor="username" className="float-label">
              Username
            </label>
          </div>

          {/* Password */}
          <div className={`floating-group ${errors.password ? "input-error" : ""}`}>
            <input
              id="password"
              name="password"
              ref={passwordRef}
              className="input-field"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => onPasswordChange(e.target.value)}
              placeholder=" "
              autoComplete="current-password"
              aria-label="password"
            />
            <label htmlFor="password" className="float-label">
              Password
            </label>

            <button
              type="button"
              className="pw-toggle"
              onClick={() => {
                setShowPassword((s) => !s);
                setTimeout(() => passwordRef.current?.focus(), 0);
              }}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <img
                  src="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/icons/eye-slash.svg"
                  alt="Hide password"
                  width="20"
                  height="20"
                />
              ) : (
                <img
                  src="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/icons/eye.svg"
                  alt="Show password"
                  width="20"
                  height="20"
                />
              )}
            </button>
          </div>

          {/* Submit */}
          <button className="submit" type="submit">
            Log In
          </button>

          {/* Error message only */}
          {serverMsg && (
            <p
              className={`status-text ${
                errors.username || errors.password ? "error-text" : ""
              }`}
            >
              {serverMsg}
            </p>
          )}
        </form>
      </main>
    </div>
  );
}
