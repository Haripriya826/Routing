// src/AttachedDevices.js
import React, { useState, useEffect, useMemo, useCallback } from "react";
import "./AttachedDevices.css";
import { useAutoRefreshContext } from "../../context/AutoRefreshContext";

const PAGE_SIZE = 10;

export default function AttachedDevices() {
  const { refreshTick } = useAutoRefreshContext();

  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [devices, setDevices] = useState([]);

  // -----------------------------
  // FETCH DEVICES (REUSABLE)
  // -----------------------------
  const fetchDevices = useCallback(async () => {
    try {
      const token = localStorage.getItem("authToken");
      if (!token) return;

      const res = await fetch("http://localhost:5000/api/devices", {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      const json = await res.json();
      if (!json.status) return;

      setDevices(json.devices || []);
    } catch (err) {
      console.error("Error loading devices:", err);
    }
  }, []);

  // -----------------------------
  // INITIAL LOAD
  // -----------------------------
  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  // -----------------------------
  // AUTO REFRESH (ONLY WHEN TICK CHANGES)
  // -----------------------------
  useEffect(() => {
    fetchDevices();
  }, [refreshTick, fetchDevices]);

  // -----------------------------
  // FILTER LOGIC
  // -----------------------------
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return devices;

    return devices.filter((d) =>
      `${d.deviceName} ${d.ipAddress} ${d.macAddress} ${d.vlan}`
        .toLowerCase()
        .includes(q)
    );
  }, [query, devices]);

  // -----------------------------
  // PAGINATION
  // -----------------------------
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);

  const pageItems = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  function gotoPage(p) {
    setPage(Math.min(Math.max(p, 1), totalPages));
  }

  return (
    <div className="attached-root">
      <div className="attached-header">
        <h2>Attached Devices</h2>

        <div className="attached-controls">
          <span className="total">
            Total: <strong>{total}</strong>
          </span>

          <input
            className="search"
            placeholder="Search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
          />

          <button className="btn go" onClick={() => gotoPage(1)}>
            Go
          </button>

          {/* ✅ Manual refresh uses SAME function */}
          <button className="btn refresh" onClick={fetchDevices}>
            Refresh
          </button>
        </div>
      </div>

      {/* TABLE */}
      <div className="table-wrap">
        <table className="device-table">
          <thead>
            <tr>
              <th>Device Name</th>
              <th>IP Address</th>
              <th>IPv6 Address</th>
              <th>MAC Address</th>
              <th>Port</th>
              <th>VLAN</th>
            </tr>
          </thead>

          <tbody>
            {pageItems.length === 0 ? (
              <tr>
                <td colSpan="6" className="empty">
                  No devices found.
                </td>
              </tr>
            ) : (
              pageItems.map((d) => (
                <tr key={d.id}>
                  <td>{d.deviceName}</td>
                  <td>{d.ipAddress}</td>
                  <td>{d.ipv6Address || "---"}</td>
                  <td>{d.macAddress}</td>
                  <td>{d.port}</td>
                  <td>{d.vlan}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* PAGINATION */}
      <div className="pagination">
        <button onClick={() => gotoPage(page - 1)} disabled={page <= 1}>
          Prev
        </button>

        <button className="active">{currentPage}</button>

        <button onClick={() => gotoPage(page + 1)} disabled={page >= totalPages}>
          Next
        </button>

        <span className="page-info">
          Page {currentPage} / {totalPages}
        </span>
      </div>
    </div>
  );
}
