import React, { useCallback, useEffect, useRef, useState } from "react";
import "./UserSettings.css";

export default function UserSettings() {
  const [users, setUsers] = useState([]);

  // Logged in username (admin check)
  const currentUser = localStorage.getItem("username");

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState("view"); // "view" | "edit" | "create"
  const [openedViaView, setOpenedViaView] = useState(false); // track if opened via table View
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [limitMessage, setLimitMessage] = useState("");

  // Create fields
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [canMonitor, setCanMonitor] = useState(true);
  const [canConfigure, setCanConfigure] = useState(false);

  // Edit/View fields
  const [editUser, setEditUser] = useState(null);
  const [editUsername, setEditUsername] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editMonitor, setEditMonitor] = useState(false);
  const [editConfigure, setEditConfigure] = useState(false);

  // radio state controlling password field visibility in VIEW modal:
  // 'no' = Don't change password (hidden), 'yes' = Change password (shown)
  const [pwdRadio, setPwdRadio] = useState("no");
  const pwdInputRef = useRef(null);

  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  // ---------------------------------------------
  // LOAD USERS (stable callback to satisfy hooks lint)
  // ---------------------------------------------
  const loadUsers = useCallback(async () => {
    try {
      const token = localStorage.getItem("authToken");

      const res = await fetch("http://localhost:5000/api/admin/users", {
        headers: { Authorization: `Bearer ${token}` },
      });

      const body = await res.json();
      if (!res.ok) throw new Error(body.message || "Failed to fetch");

      setUsers(body.users || []);
    } catch (err) {
      setError("Failed to load users");
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // Focus password input when radio = 'yes'
  useEffect(() => {
    if (pwdRadio === "yes" && pwdInputRef.current) {
      pwdInputRef.current.focus();
    }
  }, [pwdRadio, pwdInputRef]);

  // Prepare visible users: hide the 'admin' row when the logged-in user is 'admin'
  const visibleUsers = users.filter((u) =>
    !(currentUser === "admin" && u.username === "admin")
  );

  // ---------------------------------------------
  // CREATE
  // ---------------------------------------------
  function openCreateModal() {
    if (users.length >= 6) {
      setLimitMessage("User limit reached");
      setShowLimitModal(true);
      return;
    }

    setModalMode("create");
    setOpenedViaView(false);
    resetCreateFields();
    setShowModal(true);
  }

  function resetCreateFields() {
    setNewUsername("");
    setNewPassword("");
    setCanMonitor(true);
    setCanConfigure(false);
    setError(null);
  }

  async function handleCreateUser(e) {
    e.preventDefault();
    setLoading(true);

    try {
      const token = localStorage.getItem("authToken");

      const res = await fetch("http://localhost:5000/api/admin/create-user", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: newUsername.trim(),
          password: newPassword,
          permissions: {
            canMonitor,
            canConfigure,
          },
        }),
      });

      const body = await res.json();
      if (!res.ok) throw new Error(body.message || "Failed to create user");

      setShowModal(false);
      await loadUsers();
    } catch (err) {
      setError(err.message || "Failed to create user");
    } finally {
      setLoading(false);
    }
  }

  // ---------------------------------------------
  // VIEW (open via table) — now editable with Submit
  // ---------------------------------------------
  function openViewModal(user) {
    setEditUser(user);
    setEditUsername(user.username || "");
    setEditMonitor(user.permissions?.canMonitor || false);
    setEditConfigure(user.permissions?.canConfigure || false);
    setEditPassword("");

    // reset radio to 'no' (don't change) by default
    setPwdRadio("no");

    // mark opened via view so Reset will blank fields
    setOpenedViaView(true);
    setModalMode("view");
    setShowModal(true);
  }

  // ---------------------------------------------
  // Reset for modal fields (clear the visible fields)
  // ---------------------------------------------
  function clearModalFields() {
    setEditUsername("");
    setEditPassword("");
    setEditMonitor(false);
    setEditConfigure(false);
    setPwdRadio("no");
  }

  // restore edit fields to the currently selected user's original values
  function resetEditFields() {
    if (!editUser) {
      setEditUsername("");
      setEditPassword("");
      setEditMonitor(false);
      setEditConfigure(false);
      setPwdRadio("no");
      return;
    }
    setEditUsername(editUser.username);
    setEditPassword("");
    setEditMonitor(editUser.permissions?.canMonitor || false);
    setEditConfigure(editUser.permissions?.canConfigure || false);
    setPwdRadio("no");
  }

  // ---------------------------------------------
  // SAVE EDIT (used by both view-submission and edit mode)
  // ---------------------------------------------
  async function saveEditedUser(e) {
    e.preventDefault();
    if (!editUser) return;

    setLoading(true);
    try {
      const token = localStorage.getItem("authToken");

      const body = {
        username: editUsername.trim(),
        permissions: {
          canMonitor: editMonitor,
          canConfigure: editConfigure,
        },
      };

      // include password only if radio = yes and password provided
      if (pwdRadio === "yes" && editPassword.trim()) {
        body.password = editPassword.trim();
      }

      const res = await fetch(
        `http://localhost:5000/api/admin/update-user/${editUser._id}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        }
      );

      const json = await res.json();
      if (!res.ok) {
        alert(json.message || "Failed to update user");
        return;
      }

      setShowModal(false);
      await loadUsers();
    } catch (err) {
      alert(err.message || "Failed to update user");
    } finally {
      setLoading(false);
    }
  }

  // ---------------------------------------------
  // DELETE USER
  // ---------------------------------------------
  async function deleteUser(id) {
    const u = users.find((x) => x._id === id);
    if (u?.username === "admin") {
      alert("Cannot delete the admin user.");
      return;
    }

    if (!window.confirm("Delete this user?")) return;

    const token = localStorage.getItem("authToken");

    await fetch(`http://localhost:5000/api/admin/delete-user/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

    await loadUsers();
  }

  // ---------------------------------------------
  // Modal close helper (reset openedViaView)
  // ---------------------------------------------
  function closeModal() {
    setShowModal(false);
    setOpenedViaView(false);
    setPwdRadio("no");
  }

  // ========================================================
  // UI
  // ========================================================
  return (
    <div style={{ padding: 10, paddingTop: 0 }}>
      <h2>User Management</h2>

      {currentUser === "admin" && (
        <button className="btn add-btn" onClick={openCreateModal}>
          ➕ Add User
        </button>
      )}

      {error && <div className="error">{error}</div>}

      <div className="table-scroll">
        <table className="user-table">
          <thead>
            <tr>
              <th>Username</th>
              <th>Permissions</th>
              <th>Details</th>
              {currentUser === "admin" && <th>Delete</th>}
            </tr>
          </thead>

          <tbody>
            {visibleUsers.map((u) => (
              <tr key={u._id}>
                <td>{u.username}</td>

                <td>
                  <div>{u.permissions?.canMonitor ? "Monitoring ✓" : "Monitoring ✗"}</div>
                  <div>{u.permissions?.canConfigure ? "System Settings ✓" : "System Settings ✗"}</div>
                </td>

                <td>
                  {/* Eye icon button (replaces "View" text). Accessible: title + aria-label */}
                  <button
                    className="btn small-btn"
                    onClick={() => openViewModal(u)}
                    title={`View ${u.username}`}
                    aria-label={`View ${u.username}`}
                    style={{ padding: 6, minWidth: 40 }}
                  >
                    {/* simple eye SVG */}
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      aria-hidden="true"
                      focusable="false"
                    >
                      <path
                        d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        fill="none"
                      />
                      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" fill="none" />
                    </svg>
                  </button>
                </td>

                {currentUser === "admin" && (
                  <td>
                    <button
                      className="delete-btn"
                      onClick={() => deleteUser(u._id)}
                      title={`Delete ${u.username}`}
                    >
                      🗑
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {visibleUsers.length === 0 && (
              <tr>
                <td colSpan={currentUser === "admin" ? 4 : 3} style={{ textAlign: "center", padding: 24 }}>
                  No users to display.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL */}
      {showModal && (
        <div className="modal-bg">
          <div className="modal">
            <div className="modal-header">
              <h3>
                {modalMode === "create"
                  ? "Create User"
                  : modalMode === "edit"
                  ? "Edit User"
                  : "User Details"}
              </h3>

              <button className="close-btn" onClick={closeModal}>
                ✖
              </button>
            </div>

            {/* VIEW MODE (now editable, with single Submit) */}
            {modalMode === "view" && (
              <form onSubmit={saveEditedUser} className="modal-body">
                <label>Username</label>
                <input
                  className="input"
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value)}
                />

                <label style={{ marginTop: 12 }}>Password</label>
                <div role="radiogroup">
                  <label style={{ display: "inline-flex", alignItems: "center", gap: 8, marginRight: 12 }}>
                    <input
                      type="radio"
                      name="pwdChange"
                      value="no"
                      checked={pwdRadio === "no"}
                      onChange={() => {
                        setPwdRadio("no");
                        setEditPassword("");
                      }}
                    />
                    <span>No change</span>
                  </label>

                  <label style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                    <input
                      type="radio"
                      name="pwdChange"
                      value="yes"
                      checked={pwdRadio === "yes"}
                      onChange={() => setPwdRadio("yes")}
                    />
                    <span>Change</span>
                  </label>
                </div>

                {pwdRadio === "yes" && (
                  <input
                    ref={pwdInputRef}
                    type="password"
                    className="input"
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    placeholder="Enter new password"
                    style={{ marginTop: 8 }}
                  />
                )}

                <label style={{ marginTop: 12 }}>Permissions</label>
                <div className="device-list">
                  <label>
                    <input type="checkbox" checked={editMonitor} onChange={() => setEditMonitor(!editMonitor)} />
                    Access Monitoring
                  </label>

                  <label>
                    <input type="checkbox" checked={editConfigure} onChange={() => setEditConfigure(!editConfigure)} />
                    Access System Settings
                  </label>
                </div>

                {/* Buttons */}
                <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                  <button
                    type="button"
                    className="btn muted"
                    onClick={clearModalFields}
                  >
                    Reset
                  </button>

                  {/* FINAL: Submit button */}
                  <button className="btn" type="submit" disabled={loading}>
                    {loading ? "Saving…" : "Submit"}
                  </button>
                </div>
              </form>
            )}

            {/* CREATE MODE */}
            {modalMode === "create" && (
              <form onSubmit={handleCreateUser} className="modal-body">
                <label>Username</label>
                <input className="input" value={newUsername} onChange={(e) => setNewUsername(e.target.value)} />

                <label>Password</label>
                <input type="password" className="input" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />

                <label style={{ marginTop: 12 }}>Permissions:</label>
                <div className="device-list">
                  <label>
                    <input type="checkbox" checked={canMonitor} onChange={() => setCanMonitor(!canMonitor)} />
                    Access Monitoring
                  </label>
                  <label>
                    <input type="checkbox" checked={canConfigure} onChange={() => setCanConfigure(!canConfigure)} />
                    Access System Settings
                  </label>
                </div>

                <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
                  <button type="button" className="btn muted" onClick={resetCreateFields}>
                    Reset
                  </button>
                  <button className="btn" type="submit">{loading ? "Saving…" : "Create User"}</button>
                </div>
              </form>
            )}

            {/* EDIT MODE (kept for compatibility if you use it elsewhere) */}
            {modalMode === "edit" && (
              <form onSubmit={saveEditedUser} className="modal-body">
                <label>Username</label>
                <input className="input" value={editUsername} onChange={(e) => setEditUsername(e.target.value)} />

                <label>New Password (optional)</label>
                <input type="password" className="input" value={editPassword} onChange={(e) => setEditPassword(e.target.value)} />

                <label style={{ marginTop: 12 }}>Permissions:</label>
                <div className="device-list">
                  <label>
                    <input type="checkbox" checked={editMonitor} onChange={() => setEditMonitor(!editMonitor)} />
                    Access Monitoring
                  </label>
                  <label>
                    <input type="checkbox" checked={editConfigure} onChange={() => setEditConfigure(!editConfigure)} />
                    Access System Settings
                  </label>
                </div>

                <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
                  {/* Reset: if opened via View blank, otherwise restore */}
                  <button
                    type="button"
                    className="btn muted"
                    onClick={() => {
                      if (openedViaView) clearModalFields();
                      else resetEditFields();
                    }}
                  >
                    Reset
                  </button>
                  <button className="btn" type="submit">{loading ? "Saving…" : "Save Changes"}</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {showLimitModal && (
        <div className="modal-bg">
          <div className="modal small-modal">
            <div className="modal-header">
              <h3>Limit Reached</h3>
              <button className="close-btn" onClick={() => setShowLimitModal(false)}>
                ✖
              </button>
            </div>

            <div className="modal-body">
              <p>{limitMessage}</p>

              <button
                className="btn"
                style={{ marginTop: "10px" }}
                onClick={() => setShowLimitModal(false)}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
