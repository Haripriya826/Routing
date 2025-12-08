// src/Dashboard.js
import React, { useEffect, useRef, useState } from "react";
import "./Dashboard.css";
import { useNavigate } from "react-router-dom";
import AttachedDevices from "./components/AttachedDevices/AttachedDevices"; // uses your existing AttachedDevices component
import SystemSettings from "./components/SystemSettings/SystemSettings";   // new import for settings page

export default function Dashboard() {
  const navigate = useNavigate();
  const menuRef = useRef(null);

  // Sidebar selection: 'dashboard' | 'monitoring' | 'settings'
  const [sidebarSelection, setSidebarSelection] = useState("dashboard");

  // Theme setting: 'default' | 'light' | 'dark'
  const [themeSetting, setThemeSetting] = useState(() => {
    try {
      const ts = localStorage.getItem("themeSetting");
      if (ts) return ts;
      const old = localStorage.getItem("theme");
      if (old === "dark") return "dark";
      if (old === "light") return "light";
      return "default";
    } catch {
      return "default";
    }
  });

  // compute effective dark mode
  const computeEffectiveDark = (setting) => {
    try {
      if (setting === "dark") return true;
      if (setting === "light") return false;
      if (typeof window !== "undefined" && window.matchMedia) {
        return window.matchMedia("(prefers-color-scheme: dark)").matches;
      }
      return false;
    } catch {
      return false;
    }
  };

  // boolean for UI convenience
  const [darkMode, setDarkMode] = useState(() => computeEffectiveDark(themeSetting));

  // apply theme when themeSetting changes
  useEffect(() => {
    applyTheme(themeSetting);
    try {
      localStorage.setItem("themeSetting", themeSetting);
      // keep legacy key too
      localStorage.setItem("theme", themeSetting === "dark" ? "dark" : "light");
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [themeSetting]);

  // listen to system changes when default
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e) => {
      if (themeSetting === "default") {
        const eff = e.matches;
        setDarkMode(eff);
        try {
          document.documentElement.classList.toggle("theme-dark", eff);
        } catch {}
      }
    };

    if (themeSetting === "default") {
      const eff = mq.matches;
      setDarkMode(eff);
      try {
        document.documentElement.classList.toggle("theme-dark", eff);
      } catch {}
    }

    if (mq.addEventListener) mq.addEventListener("change", handler);
    else if (mq.addListener) mq.addListener(handler);

    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", handler);
      else if (mq.removeListener) mq.removeListener(handler);
    };
  }, [themeSetting]);

  function applyTheme(setting) {
    try {
      const root = document.documentElement;
      if (setting === "dark") {
        root.setAttribute("data-theme", "dark");
        root.classList.add("theme-dark");
        setDarkMode(true);
      } else if (setting === "light") {
        root.setAttribute("data-theme", "light");
        root.classList.remove("theme-dark");
        setDarkMode(false);
      } else {
        root.removeAttribute("data-theme");
        const eff = computeEffectiveDark("default");
        root.classList.toggle("theme-dark", eff);
        setDarkMode(eff);
      }
    } catch (err) {
      console.error("applyTheme error", err);
    }
  }

  // header toggle: flip between light/dark (affects themeSetting)
  const toggleHeaderTheme = () => {
    const currentlyDark = computeEffectiveDark(themeSetting);
    const newSetting = currentlyDark ? "light" : "dark";
    setThemeSetting(newSetting);
  };

  const [showMenu, setShowMenu] = useState(false);

  // other app state
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [routerData, setRouterData] = useState(null);

  // VLAN UI state
  const [vlanActiveTab, setVlanActiveTab] = useState("ipv4");
  const [vlanTypeId, setVlanTypeId] = useState(null);
  const [vlanTypes, setVlanTypes] = useState([]);

  const username = (typeof window !== "undefined" && localStorage.getItem("username")) || "Admin";
  const year = new Date().getFullYear();

  // click outside to close user menu
  useEffect(() => {
    function onDocClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const DEFAULT_VLAN_TYPES = [
    { id: 1, name: "Access (IPv4)", protocol: "ipv4" },
    { id: 2, name: "Trunk (IPv6)", protocol: "ipv6" },
    { id: 3, name: "Hybrid (Both)", protocol: "both" }
  ];

  // Fetch /api/me and normalize response to router object
  useEffect(() => {
    let aborted = false;

    async function fetchMe() {
      setLoading(true);
      setFetchError(null);
      try {
        const token = (localStorage.getItem("authToken") || localStorage.getItem("token")) || null;
        if (!token) {
          setFetchError("No auth token found (please login).");
          setTimeout(() => navigate("/"), 900);
          return;
        }

        const res = await fetch("http://localhost:5000/api/me", {
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
        });

        if (res.status === 401) {
          try { localStorage.removeItem("authToken"); localStorage.removeItem("token"); localStorage.removeItem("username"); } catch {}
          setFetchError("Session expired or invalid token — redirecting to login...");
          setTimeout(() => navigate("/"), 900);
          return;
        }

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.message || body?.error || `Server returned ${res.status}`);
        }

        const data = await res.json();

        const router = data?.router ?? data?.user ?? data;
        const normalized = normalizeRouterClient(router);

        if (!aborted) {
          setRouterData(normalized);

          // Initialize vlan types and selected id
          const typesFromJson = Array.isArray(normalized?.vlanStatus?.types) && normalized.vlanStatus.types.length > 0
            ? normalized.vlanStatus.types
            : DEFAULT_VLAN_TYPES;

          const normalizedTypes = typesFromJson.map((t) => {
            if (typeof t === "number" || typeof t === "string") {
              const found = DEFAULT_VLAN_TYPES.find(d => String(d.id) === String(t));
              return found || { id: Number(t), name: `Type ${t}`, protocol: "ipv4" };
            }
            return { id: t.id ?? t.value, name: t.name ?? String(t.id ?? t.value), protocol: t.protocol ?? "ipv4" };
          });

          setVlanTypes(normalizedTypes);

          const initialId =
            normalized?.vlanStatus?.typeId ??
            normalized?.vlanStatus?.type ??
            (normalizedTypes[0] && normalizedTypes[0].id);

          setVlanTypeId(initialId != null ? Number(initialId) : (normalizedTypes[0] && normalizedTypes[0].id));

          if (normalized?.vlanStatus?.ipv4) setVlanActiveTab("ipv4");
          else if (normalized?.vlanStatus?.ipv6) setVlanActiveTab("ipv6");
          else setVlanActiveTab("ipv4");
        }
      } catch (err) {
        console.error("fetch /api/me error:", err);
        if (!aborted) {
          if (err instanceof TypeError && /failed to fetch/i.test(err.message)) {
            setFetchError("Network error or CORS issue. Is the backend running?");
          } else {
            setFetchError(err.message || "Unknown error fetching data.");
          }
        }
      } finally {
        if (!aborted) setLoading(false);
      }
    }

    fetchMe();
    return () => { aborted = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Logout
  const handleLogout = async () => {
    try {
      const token = (localStorage.getItem("authToken") || localStorage.getItem("token")) || null;
      if (token) {
        await fetch("http://localhost:5000/api/efile/remove", {
          method: "DELETE",
          headers: { "x-auth-token": token }
        }).catch(() => {});
      }
    } catch (err) {
      console.error("efile remove error:", err);
    } finally {
      try { localStorage.removeItem("authToken"); localStorage.removeItem("token"); localStorage.removeItem("username"); } catch {}
      setShowMenu(false);
      navigate("/");
    }
  };

  // Safe accessor
  const val = (v) => {
    if (v === undefined || v === null) return "—";
    if (typeof v === "boolean") return v ? "Yes" : "No";
    return String(v);
  };

  // Client-side normalization
  function normalizeRouterClient(raw) {
    if (!raw || typeof raw !== "object") return raw || null;

    const r = { ...raw };

    r.systemInfo = r.systemInfo || {};
    r.systemInfo.model = r.systemInfo.model || r.model || r.deviceModel || "PR60X";
    r.systemInfo.region = r.systemInfo.region || r.region || "Worldwide";
    r.systemInfo.ethernetMAC = r.systemInfo.ethernetMAC || r.ethernetMAC || r.mac || "—";
    r.systemInfo.serialNumber = r.systemInfo.serialNumber || r.serialNumber || r.serial || "—";
    r.systemInfo.systemUpTime = r.systemInfo.systemUpTime || r.systemUpTime || "—";
    r.systemInfo.currentTime = r.systemInfo.currentTime || r.currentTime || new Date().toString();
    r.systemInfo.insightMode = r.systemInfo.insightMode || r.insightMode || "—";
    r.systemInfo.saseSecurity = r.systemInfo.saseSecurity || r.saseSecurity || "—";
    r.systemInfo.fanSpeed = r.systemInfo.fanSpeed || r.fanSpeed || "—";
    r.systemInfo.temperature = r.systemInfo.temperature || r.temperature || "—";
    r.systemInfo.firmwareVersion = r.systemInfo.firmwareVersion || r.firmwareVersion || "—";
    r.systemInfo.firmwareStatus = r.systemInfo.firmwareStatus || r.firmwareStatus || "—";

    r.connectivity = r.connectivity || {};
    if (!r.connectivity.WAN1Load) r.connectivity.WAN1Load = r.connectivity.WAN1load || r.WAN1Load || r.WAN1load || "—";
    if (!r.connectivity.WAN2Load) r.connectivity.WAN2Load = r.connectivity.WAN2load || r.WAN2Load || r.WAN2load || "—";
    if (r.connectivity.attachedDevices === undefined) r.connectivity.attachedDevices = r.attachedDevices ?? r.devices ?? "—";

    r.internetPortStatus = r.internetPortStatus || {};
    r.internetPortStatus.WAN1 = r.internetPortStatus.WAN1 || r.internetPortStatus.wan1 || { status: r.WAN1Status || "Offline", connectionType: r.WAN1Type || "DHCP" };
    r.internetPortStatus.WAN2 = r.internetPortStatus.WAN2 || r.internetPortStatus.wan2 || { status: r.WAN2Status || "Offline", connectionType: r.WAN2Type || "DHCP" };

    r.ethernetPortStatus = r.ethernetPortStatus || {};
    if (!Array.isArray(r.ethernetPortStatus.ports)) {
      const keys = Object.keys(r.ethernetPortStatus).length > 0 ? Object.keys(r.ethernetPortStatus) : (r.ports ? Object.keys(r.ports) : ["LAN1","LAN2","LAN3","LAN4","WAN1","WAN2"]);
      const ports = keys
        .filter(k => k !== "ports")
        .map(k => {
          const status = r.ethernetPortStatus[k] ?? (raw.ethernetPortStatus && raw.ethernetPortStatus[k]) ?? "0 Mbps";
          return { port: k, status };
        });
      r.ethernetPortStatus.ports = ports;
    }

    r.vpnStatus = r.vpnStatus || r.vpn || {};
    r.vlanStatus = r.vlanStatus || r.vlan || {
      activeVLAN: r.activeVLAN ?? 1,
      ipv4: r.ipv4 ?? true,
      ipv6: r.ipv6 ?? false,
      types: r.types || undefined,
      typeId: r.typeId ?? r.type ?? undefined
    };

    r.routerName = r.routerName || r.name || `PR60X-${r.userName || r.username || "unknown"}`;
    r.userName = r.userName || r.username || (r.routerName ? r.routerName.replace(/^PR60X-/, "") : "unknown");

    return r;
  }

  // system pairs
  const systemPairs = (r) => [
    ["Model", val(r?.systemInfo?.model || r?.model)],
    ["Region", val(r?.systemInfo?.region)],
    ["Ethernet MAC", val(r?.systemInfo?.ethernetMAC)],
    ["Serial", val(r?.systemInfo?.serialNumber)],
    ["Uptime", val(r?.systemInfo?.systemUpTime)],
    ["Current time", val(r?.systemInfo?.currentTime)],
    ["Insight Mode", val(r?.systemInfo?.insightMode)],
    ["SASE Security", val(r?.systemInfo?.saseSecurity)],
    ["Fan Speed", val(r?.systemInfo?.fanSpeed)],
    ["Temperature", val(r?.systemInfo?.temperature)],
    ["Firmware", val(r?.systemInfo?.firmwareVersion)],
    ["Firmware status", val(r?.systemInfo?.firmwareStatus)]
  ];

  // KVRow
  function KVRow({ label, value, leftClass = "kv-left", rightClass = "kv-right" }) {
    return (
      <div className="kv-row" role="row" aria-label={label}>
        <div className={leftClass} title={typeof value === "string" || typeof value === "number" ? String(value) : ""}>
          {label}
        </div>
        <div className={rightClass} title={typeof value === "string" || typeof value === "number" ? String(value) : ""}>
          {value}
        </div>
      </div>
    );
  }

  const renderKVGrid = (pairs) => (
    <div className="system-grid">
      {pairs.map(([label, value], i) => (
        <React.Fragment key={i}>
          <div className="kv-label" title={String(value)}>{label}</div>
          <div className="kv-value" title={String(value)}>{value}</div>
        </React.Fragment>
      ))}
    </div>
  );

  const renderEthTable = (eth) => {
    if (!eth) return <div className="json-pre">—</div>;

    if (Array.isArray(eth.ports) && eth.ports.length > 0) {
      return (
        <table className="eth-table" role="table">
          <tbody>
            {eth.ports.map((p, idx) => (
              <tr key={p.port ?? idx}>
                <td style={{ width: "80px", fontWeight: 700 }}>{p.port ?? `port${idx}`}</td>
                <td>{val(p.status ?? p.state ?? p.speed)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }

    const keys = Object.keys(eth).filter(k => k !== "ports");
    if (keys.length === 0) return <div className="json-pre">—</div>;

    return (
      <table className="eth-table" role="table">
        <tbody>
          {keys.map((k) => (
            <tr key={k}>
              <td style={{ width: "80px", fontWeight: 700 }}>{k}</td>
              <td>{val(eth[k])}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  // VPN rendering
  const renderVPN = (vpn) => {
    if (!vpn || (typeof vpn === "object" && Object.keys(vpn).length === 0)) {
      return <div className="json-pre">—</div>;
    }

    const sections = [
      { key: "siteToSite", label: "Site-to-Site" },
      { key: "clientToSite", label: "Client-to-Site" },
      { key: "openVPN", label: "OpenVPN" },
      { key: "wireGuard", label: "WireGuard" },
    ];

    const getSectionObj = (root, name) => {
      if (!root) return {};
      if (root[name]) return root[name];
      const snake = name.replace(/[A-Z]/g, m => `_${m.toLowerCase()}`);
      if (root[snake]) return root[snake];
      if (root[name.toLowerCase()]) return root[name.toLowerCase()];
      return {};
    };

    const pickNumber = (obj, keys) => {
      for (const k of keys) {
        if (obj && obj[k] !== undefined && obj[k] !== null) {
          if (typeof obj[k] === "boolean") return obj[k] ? 1 : 0;
          const n = Number(obj[k]);
          return Number.isFinite(n) ? n : obj[k];
        }
      }
      return 0;
    };

    return (
      <div className="vpn-table" role="table" aria-label="VPN status table">
        <div className="vpn-header" role="rowgroup">
          <div className="vpn-name-head" role="columnheader">Type</div>
          <div className="vpn-col-label" role="columnheader">In use</div>
          <div className="vpn-col-label" role="columnheader">Connected</div>
          <div className="vpn-col-label" role="columnheader">Disconnected</div>
        </div>

        <div className="vpn-divider" aria-hidden="true" />

        <div role="rowgroup">
          {sections.map((s) => {
            const sec = getSectionObj(vpn, s.key);

            const inUse = pickNumber(sec, ["inUse", "in_use", "inuse", "in_use_count", "in_use_total"]);
            const connected = pickNumber(sec, ["connected", "connected_count", "connectedClients", "connected_clients"]);
            const disconnected = pickNumber(sec, ["disconnected", "disconnected_count", "disconnectedClients", "disconnected_clients"]);

            return (
              <div key={s.key} className="vpn-row" role="row">
                <div className="vpn-name" role="cell">{s.label}</div>
                <div className="vpn-val" role="cell">{inUse}</div>
                <div className="vpn-val" role="cell">{connected}</div>
                <div className="vpn-val" role="cell">{disconnected}</div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // handle VLAN type change (client side)
  const onChangeVlanType = (newId) => {
    const idNum = Number(newId);
    setVlanTypeId(idNum);
    // persist later if required
  };

  // --- RENDER ---

  // SETTINGS view (keep sidebar visible and show SystemSettings full width)
  if (sidebarSelection === "settings") {
    return (
      <div className={`dash-root ${darkMode ? "theme-dark" : ""}`}>
        <header className="dash-header">
          <div className="header-left">
            <div className="brand">NETGEAR</div>
          </div>

          <div className="header-desc">
            <div className="model">{routerData?.systemInfo?.model ?? routerData?.model ?? "PR60X"}</div>
            <div className="header-sub">Multi-Gigabit Dual WAN Pro Router</div>
          </div>

          <div className="header-right">
            <button
              onClick={toggleHeaderTheme}
              className="icon-btn"
              title={darkMode ? "Switch to light" : "Switch to dark"}
              aria-pressed={darkMode}
            >
              <img
                className="hdr-icon"
                alt={darkMode ? "light" : "dark"}
                src={darkMode ? "https://cdn-icons-png.flaticon.com/512/869/869869.png" : "https://cdn-icons-png.flaticon.com/512/869/869869.png"}
              />
            </button>

            <div className="lang-wrap" role="status" aria-label="Language">
              <img src="https://cdn-icons-png.flaticon.com/512/3177/3177361.png" alt="lang" className="hdr-icon" />
              <div className="lang-text">(EN)</div>
            </div>

            <div className="user-wrapper" ref={menuRef}>
              <button className="icon-btn" onClick={() => setShowMenu((s) => !s)} title={username} aria-haspopup="true" aria-expanded={showMenu}>
                <img src="https://cdn-icons-png.flaticon.com/512/3177/3177440.png" alt="user" className="hdr-icon" />
              </button>

              {showMenu && (
                <div className="user-menu" role="menu">
                  <div className="user-name" title={username}>{username}</div>
                  <button className="logout-btn" onClick={handleLogout}>Logout</button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="dash-grid">
          <aside className="sidebar">
            <ul>
              <li
                className={sidebarSelection === "dashboard" ? "active" : ""}
                onClick={() => setSidebarSelection("dashboard")}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setSidebarSelection("dashboard"); }}
              >
                <span>🏠</span> <span>Dashboard</span>
              </li>

              <li
                className={sidebarSelection === "monitoring" ? "active" : ""}
                onClick={() => setSidebarSelection("monitoring")}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setSidebarSelection("monitoring"); }}
              >
                <span>📊</span> <span>Monitoring</span>
              </li>

              <li
                className={sidebarSelection === "settings" ? "active" : ""}
                onClick={() => setSidebarSelection("settings")}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setSidebarSelection("settings"); }}
              >
                <span>⚙️</span> <span>System Settings</span>
              </li>
            </ul>
          </aside>

          <main className="monitoring-full">
            <SystemSettings />
          </main>
        </div>

        <footer className="footer">© {year} Netgear | All Rights Reserved</footer>
      </div>
    );
  }

  // If user clicked Monitoring, show the AttachedDevices 'page' (full area).
  if (sidebarSelection === "monitoring") {
    return (
      <div className={`dash-root ${darkMode ? "theme-dark" : ""}`}>
        <header className="dash-header">
          <div className="header-left">
            <div className="brand">NETGEAR</div>
          </div>

          <div className="header-desc">
            <div className="model">{routerData?.systemInfo?.model ?? routerData?.model ?? "PR60X"}</div>
            <div className="header-sub">Multi-Gigabit Dual WAN Pro Router</div>
          </div>

          <div className="header-right">
            <button
              onClick={toggleHeaderTheme}
              className="icon-btn"
              title={darkMode ? "Switch to light" : "Switch to dark"}
              aria-pressed={darkMode}
            >
              <img
                className="hdr-icon"
                alt={darkMode ? "light" : "dark"}
                src={darkMode ? "https://cdn-icons-png.flaticon.com/512/869/869869.png" : "https://cdn-icons-png.flaticon.com/512/869/869869.png"}
              />
            </button>

            <div className="lang-wrap" role="status" aria-label="Language">
              <img src="https://cdn-icons-png.flaticon.com/512/3177/3177361.png" alt="lang" className="hdr-icon" />
              <div className="lang-text">(EN)</div>
            </div>

            <div className="user-wrapper" ref={menuRef}>
              <button className="icon-btn" onClick={() => setShowMenu((s) => !s)} title={username} aria-haspopup="true" aria-expanded={showMenu}>
                <img src="https://cdn-icons-png.flaticon.com/512/3177/3177440.png" alt="user" className="hdr-icon" />
              </button>

              {showMenu && (
                <div className="user-menu" role="menu">
                  <div className="user-name" title={username}>{username}</div>
                  <button className="logout-btn" onClick={handleLogout}>Logout</button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="dash-grid">
          <aside className="sidebar">
            <ul>
              <li
                className={sidebarSelection === "dashboard" ? "active" : ""}
                onClick={() => setSidebarSelection("dashboard")}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setSidebarSelection("dashboard"); }}
              >
                <span>🏠</span> <span>Dashboard</span>
              </li>

              <li
                className={sidebarSelection === "monitoring" ? "active" : ""}
                onClick={() => setSidebarSelection("monitoring")}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setSidebarSelection("monitoring"); }}
              >
                <span>📊</span> <span>Monitoring</span>
              </li>

              <li
                className={sidebarSelection === "settings" ? "active" : ""}
                onClick={() => setSidebarSelection("settings")}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setSidebarSelection("settings"); }}
              >
                <span>⚙️</span> <span>System Settings</span>
              </li>
            </ul>
          </aside>

          <main className="monitoring-full">
            {/* AttachedDevices is shown full-width here */}
            <AttachedDevices />
          </main>
        </div>

        <footer className="footer">© {year} Netgear | All Rights Reserved</footer>
      </div>
    );
  }

  // Default dashboard layout (when not in monitoring or settings)
  return (
    <div className={`dash-root ${darkMode ? "theme-dark" : ""}`}>
      <header className="dash-header">
        <div className="header-left">
          <div className="brand">NETGEAR</div>
        </div>

        <div className="header-desc">
          <div className="model">{routerData?.systemInfo?.model ?? routerData?.model ?? "PR60X"}</div>
          <div className="header-sub">Multi-Gigabit Dual WAN Pro Router</div>
        </div>

        <div className="header-right">
          <button
            onClick={toggleHeaderTheme}
            className="icon-btn"
            title={darkMode ? "Switch to light" : "Switch to dark"}
            aria-pressed={darkMode}
          >
            <img
              className="hdr-icon"
              alt={darkMode ? "light" : "dark"}
              src={darkMode ? "https://cdn-icons-png.flaticon.com/512/869/869869.png" : "https://cdn-icons-png.flaticon.com/512/869/869869.png"}
            />
          </button>

          <div className="lang-wrap" role="status" aria-label="Language">
            <img src="https://cdn-icons-png.flaticon.com/512/3177/3177361.png" alt="lang" className="hdr-icon" />
            <div className="lang-text">(EN)</div>
          </div>

          <div className="user-wrapper" ref={menuRef}>
            <button className="icon-btn" onClick={() => setShowMenu((s) => !s)} title={username} aria-haspopup="true" aria-expanded={showMenu}>
              <img src="https://cdn-icons-png.flaticon.com/512/3177/3177440.png" alt="user" className="hdr-icon" />
            </button>

            {showMenu && (
              <div className="user-menu" role="menu">
                <div className="user-name" title={username}>{username}</div>
                <button className="logout-btn" onClick={handleLogout}>Logout</button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="dash-grid">
        <aside className="sidebar">
          <ul>
            <li
              className={sidebarSelection === "dashboard" ? "active" : ""}
              onClick={() => setSidebarSelection("dashboard")}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setSidebarSelection("dashboard"); }}
            >
              <span>🏠</span> <span>Dashboard</span>
            </li>

            <li
              className={sidebarSelection === "monitoring" ? "active" : ""}
              onClick={() => setSidebarSelection("monitoring")}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setSidebarSelection("monitoring"); }}
            >
              <span>📊</span> <span>Monitoring</span>
            </li>

            <li
              className={sidebarSelection === "settings" ? "active" : ""}
              onClick={() => setSidebarSelection("settings")}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setSidebarSelection("settings"); }}
            >
              <span>⚙️</span> <span>System Settings</span>
            </li>
          </ul>
        </aside>

        <main className="col-connectivity">
          <section className="card connectivity-card">
            <div className="card-title">Connectivity</div>
            <div className="card-body">
              {loading ? (
                <div>Loading connectivity…</div>
              ) : fetchError ? (
                <div style={{ color: "crimson" }}>{fetchError}</div>
              ) : (
                <div style={{ width: "100%", display: "grid", gap: 8 }}>
                  <KVRow label="Attached devices" value={val(routerData?.connectivity?.attachedDevices)} />
                  <KVRow label="WAN1 load" value={val(routerData?.connectivity?.WAN1Load)} />
                  <KVRow label="WAN2 load" value={val(routerData?.connectivity?.WAN2Load)} />
                </div>
              )}
            </div>
          </section>
        </main>

        <main className="col-middle">
          <section className="card system-card">
            <div className="card-title">System Information</div>
            <div className="card-body">
              {loading ? (
                <div>Loading system information…</div>
              ) : fetchError ? (
                <div style={{ color: "crimson" }}>{fetchError}</div>
              ) : (
                renderKVGrid(systemPairs(routerData || {}))
              )}
            </div>

            <div className="card-footer">
              <button className="btn" onClick={() => alert("Reboot (demo)")}>Reboot</button>
              <button className="btn muted" onClick={() => alert("Check for update (demo)")}>Check for Update</button>
            </div>
          </section>

          <section className="card internet-port-card" style={{ marginTop: 16 }}>
            <div className="card-title">Internet Port Status</div>
            <div className="card-body">
              {loading ? (
                <div>Loading internet ports…</div>
              ) : fetchError ? (
                <div style={{ color: "crimson" }}>{fetchError}</div>
              ) : (
                <div style={{ display: "grid", gap: 8 }}>
                  <KVRow label="WAN1 status" value={val(routerData?.internetPortStatus?.WAN1?.status)} />
                  <KVRow label="WAN1 type" value={val(routerData?.internetPortStatus?.WAN1?.connectionType)} />
                  <KVRow label="WAN2 status" value={val(routerData?.internetPortStatus?.WAN2?.status)} />
                  <KVRow label="WAN2 type" value={val(routerData?.internetPortStatus?.WAN2?.connectionType)} />
                </div>
              )}
            </div>
          </section>
        </main>

        <aside className="right-col">
          <section className="card small-card">
            <div className="card-title">Ethernet Port Status</div>
            <div className="card-body">
              {loading ? <div>Loading ethernet…</div> : renderEthTable(routerData?.ethernetPortStatus)}
            </div>
          </section>

          <section className="card small-card1">
            <div className="card-title">VPN Status</div>
            <div className="card-body">
              {loading ? <div>Loading VPN…</div> : renderVPN(routerData?.vpnStatus)}
            </div>
          </section>

          <section className="card small-card2">
            <div className="card-title">VLAN Status</div>
            <div className="card-body">
              {loading ? (
                <div>Loading VLAN…</div>
              ) : (
                <>
                  <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
                    <div style={{ minWidth: "120px", fontWeight: 700 }}>VLAN Status</div>
                    <select
                      value={vlanTypeId != null ? String(vlanTypeId) : ""}
                      onChange={(e) => onChangeVlanType(e.target.value)}
                      className="vlan-select"
                      aria-label="VLAN Type ID"
                    >
                      {vlanTypes.map(t => (
                        <option key={t.id} value={String(t.id)}>{String(t.id)}</option>
                      ))}
                    </select>
                  </div>

                  <div className="vlan-tabs" role="tablist" aria-label="VLAN protocol tabs">
                    <button
                      role="tab"
                      aria-selected={vlanActiveTab === "ipv4"}
                      className={`vlan-tab ${routerData?.vlanStatus?.ipv4 ? "enabled" : "disabled"} ${vlanActiveTab === "ipv4" ? "active" : ""}`}
                      onClick={() => setVlanActiveTab("ipv4")}>
                      IPv4
                    </button>

                    <button
                      role="tab"
                      aria-selected={vlanActiveTab === "ipv6"}
                      className={`vlan-tab ${routerData?.vlanStatus?.ipv6 ? "enabled" : "disabled"} ${vlanActiveTab === "ipv6" ? "active" : ""}`}
                      onClick={() => setVlanActiveTab("ipv6")}
                    >
                      IPv6
                    </button>
                  </div>
                </>
              )}
            </div>
          </section>
        </aside>
      </div>

      <footer className="footer">© {year} Netgear | All Rights Reserved</footer>
    </div>
  );
}
