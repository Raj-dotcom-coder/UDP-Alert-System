import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { apiRequest, getApiBaseUrl, setApiBaseUrl } from "../api";
import { getDeviceName, setDeviceName, getDeviceId } from "../utils/deviceHelper";

function Login() {
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("client");
  const [deviceNameInput, setDeviceNameInput] = useState(getDeviceName());
  const [serverUrlInput, setServerUrlInput] = useState(getApiBaseUrl());
  const [showNetworkSettings, setShowNetworkSettings] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize unique device id
  useEffect(() => {
    getDeviceId();
  }, []);

  const handleRoleChange = (newRole) => {
    setRole(newRole);
    setError("");
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");

    if (!username || !password) {
      setError("Please enter both username and password.");
      return;
    }

    if (role === "client" && deviceNameInput.trim()) {
      setDeviceName(deviceNameInput.trim());
    }

    if (serverUrlInput.trim()) {
      setApiBaseUrl(serverUrlInput.trim());
    }

    setIsSubmitting(true);

    try {
      const result = await apiRequest("/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password, role })
      });

      if (!result.token) {
        throw new Error("The server did not return an authentication token.");
      }

      localStorage.setItem("udpAlertUser", JSON.stringify({ ...result.user, token: result.token }));
      navigate(result.user.role === "admin" ? "/admin" : "/client");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="login-page">
      <section className="login-shell" aria-label="UDP Alert System sign in">
        <aside className="login-brief">
          <header className="login-brand">
            <span className="brand-mark" aria-hidden="true">U</span>
            <span className="brand-name">
              <strong>UPLINK</strong>
              <small>LOCAL ALERT NETWORK</small>
            </span>
            <span className="brand-code">OPS / 01</span>
          </header>

          <div className="login-brief-content">
            <p className="login-eyebrow">MULTI-DEVICE LOCAL NETWORK</p>
            <h1>Connect any device to the <em>admin console.</em></h1>
            <p className="login-intro">
              Connect multiple client devices securely across Wi-Fi or LAN.
              Each device retains its own unique identity and acknowledgement record.
            </p>

            <div className="network-map" aria-label="Network roles: dispatch console connected to client devices">
              <div className="network-map-heading">
                <span>NETWORK TOPOLOGY</span>
                <span>UDP & HTTP</span>
              </div>
              <div className="network-map-body" aria-hidden="true">
                <div className="network-node dispatch-node">
                  <span className="node-indicator" />
                  <span><strong>ADMIN</strong><small>DISPATCH CONSOLE</small></span>
                </div>
                <div className="network-links"><i /><i /><i /></div>
                <div className="client-nodes">
                  <div className="network-node"><span className="node-square" /><span><strong>DEVICE 1</strong><small>MOBILE</small></span></div>
                  <div className="network-node"><span className="node-square" /><span><strong>DEVICE 2</strong><small>LAPTOP</small></span></div>
                  <div className="network-node"><span className="node-square" /><span><strong>DEVICE 3</strong><small>TERMINAL</small></span></div>
                </div>
              </div>
            </div>
          </div>

          <footer className="brief-footer">
            <span>UDP ALERT SYSTEM</span>
            <span>BUILT FOR MULTI-DEVICE NETWORKS</span>
          </footer>
        </aside>

        <section className="login-main">
          <div className="login-main-topline">
            <span>NETWORK ACCESS</span>
            <span className="access-index">DEVICE ENROLLMENT</span>
          </div>

          <div className="login-form-wrap">
            <p className="form-kicker">EMERGENCY COMMUNICATIONS</p>
            <h2>Sign in to Network</h2>
            <p className="login-subtitle">Connect this station to the Admin Dispatch console.</p>

            <fieldset className="role-fieldset" style={{ marginBottom: "1.25rem" }}>
              <legend>Sign in as</legend>
              <div className="role-switch">
                <button
                  type="button"
                  className={role === "client" ? "role-option selected" : "role-option"}
                  aria-pressed={role === "client"}
                  onClick={() => handleRoleChange("client")}
                >
                  Client device
                </button>
                <button
                  type="button"
                  className={role === "admin" ? "role-option selected" : "role-option"}
                  aria-pressed={role === "admin"}
                  onClick={() => handleRoleChange("admin")}
                >
                  Administrator
                </button>
              </div>
            </fieldset>

            <form onSubmit={handleLogin}>
              <div className="form-group">
                <label htmlFor="username">Username</label>
                <input
                  id="username"
                  type="text"
                  placeholder="Enter username"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>

              <div className="form-group">
                <div className="password-label-row">
                  <label htmlFor="password">Password</label>
                </div>
                <input
                  id="password"
                  type="password"
                  placeholder="Enter password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              {role === "client" && (
                <div className="form-group" style={{ marginTop: "4px" }}>
                  <div className="password-label-row">
                    <label htmlFor="deviceName">This Device Name / Station</label>
                    <span style={{ color: "#38bdf8" }}>UNIQUE ID: {getDeviceId()}</span>
                  </div>
                  <input
                    id="deviceName"
                    type="text"
                    placeholder="e.g. Reception Desk, Security Tablet, Lab PC"
                    value={deviceNameInput}
                    onChange={(e) => setDeviceNameInput(e.target.value)}
                  />
                  <small style={{ color: "#64748b", fontSize: "0.75rem", marginTop: "4px", display: "block" }}>
                    Helps the administrator identify this specific device on the network overview.
                  </small>
                </div>
              )}

              {/* Network settings toggle */}
              <div style={{ margin: "14px 0 8px 0" }}>
                <button
                  type="button"
                  onClick={() => setShowNetworkSettings(!showNetworkSettings)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#94a3b8",
                    cursor: "pointer",
                    padding: 0,
                    fontSize: "0.8rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px"
                  }}
                >
                  <span>{showNetworkSettings ? "▼" : "▶"}</span>
                  <span>Network Server Address {showNetworkSettings ? "(Hide)" : "(Configure Admin IP)"}</span>
                </button>

                {showNetworkSettings && (
                  <div style={{
                    marginTop: "10px",
                    padding: "12px",
                    background: "rgba(15, 23, 42, 0.6)",
                    border: "1px solid rgba(148, 163, 184, 0.15)",
                    borderRadius: "6px"
                  }}>
                    <label htmlFor="serverUrl" style={{ fontSize: "0.75rem", color: "#94a3b8", display: "block", marginBottom: "4px" }}>
                      Admin Server API URL (Use Admin machine's LAN IP if connecting from another device):
                    </label>
                    <input
                      id="serverUrl"
                      type="text"
                      value={serverUrlInput}
                      onChange={(e) => setServerUrlInput(e.target.value)}
                      placeholder="http://192.168.1.100:5000/api"
                      style={{ fontSize: "0.8rem", padding: "6px 10px" }}
                    />
                    <small style={{ color: "#64748b", fontSize: "0.72rem", display: "block", marginTop: "4px" }}>
                      Default auto-connects to <code>{typeof window !== 'undefined' ? window.location.hostname : 'localhost'}:5000</code>.
                    </small>
                  </div>
                )}
              </div>

              {error && <div className="login-error" role="alert">{error}</div>}

              <button type="submit" className="login-button" disabled={isSubmitting}>
                <span>{isSubmitting ? "Connecting..." : role === "client" ? "Connect Device to Admin" : "Enter Admin Console"}</span>
                <span aria-hidden="true">&#8594;</span>
              </button>
            </form>

            <div className="connection-info">
              <span className="status-dot" />
              <span>Multi-device LAN mode active</span>
              <small>Internet not required</small>
            </div>
          </div>

          <footer className="login-main-footer">
            <span>SECURE LOCAL ACCESS</span>
            <span>UDP ALERT SYSTEM <b>·</b> v2.0 MULTI-DEVICE</span>
          </footer>
        </section>
      </section>
    </main>
  );
}

export default Login;
