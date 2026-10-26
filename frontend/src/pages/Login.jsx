import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiRequest } from "../api";

function Login() {
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("admin");
  const [error, setError] = useState("");

  const handleLogin = async (e) => {

    e.preventDefault();

    setError("");

    if (!username || !password) {
      setError("Please enter username and password.");
      return;
    }

    try {
      const result = await apiRequest("/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password, role })
      });

      if (!result.token) throw new Error("The server did not return an authentication token.");
      localStorage.setItem("udpAlertUser", JSON.stringify({ ...result.user, token: result.token }));
      navigate(result.user.role === "admin" ? "/admin" : "/client");
    } catch (requestError) {
      setError(requestError.message);
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
            <p className="login-eyebrow">EMERGENCY COMMUNICATIONS</p>
            <h1>When the network goes quiet, <em>we don't.</em></h1>
            <p className="login-intro">
              A local-first alert channel for teams that need to stay connected,
              with or without internet access.
            </p>

            <div className="network-map" aria-label="Network roles: dispatch console connected to client devices">
              <div className="network-map-heading">
                <span>NETWORK MAP</span>
                <span>UDP / LOCAL</span>
              </div>
              <div className="network-map-body" aria-hidden="true">
                <div className="network-node dispatch-node">
                  <span className="node-indicator" />
                  <span><strong>DISPATCH</strong><small>CONTROL CONSOLE</small></span>
                </div>
                <div className="network-links"><i /><i /><i /></div>
                <div className="client-nodes">
                  <div className="network-node"><span className="node-square" /><span><strong>CLIENT</strong><small>RECEIVER</small></span></div>
                  <div className="network-node"><span className="node-square" /><span><strong>CLIENT</strong><small>RECEIVER</small></span></div>
                </div>
              </div>
            </div>
          </div>

          <footer className="brief-footer">
            <span>UDP ALERT SYSTEM</span>
            <span>BUILT FOR THE LOCAL NETWORK</span>
          </footer>
        </aside>

        <section className="login-main">
          <div className="login-main-topline">
            <span>OPERATOR ACCESS</span>
            <span className="access-index">01 — 02</span>
          </div>

          <div className="login-form-wrap">
            <p className="form-kicker">WELCOME BACK</p>
            <h2>Sign in to Uplink</h2>
            <p className="login-subtitle">Use your assigned account to continue.</p>

            <form onSubmit={handleLogin}>
              <div className="form-group">
                <label htmlFor="username">Username</label>
                <input
                  id="username"
                  type="text"
                  placeholder="Your username"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>

              <div className="form-group">
                <div className="password-label-row">
                  <label htmlFor="password">Password</label>
                  <span>ACCOUNT CREDENTIALS</span>
                </div>
                <input
                  id="password"
                  type="password"
                  placeholder="Your password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              <fieldset className="role-fieldset">
                <legend>Sign in as</legend>
                <div className="role-switch">
                  <button
                    type="button"
                    className={role === "admin" ? "role-option selected" : "role-option"}
                    aria-pressed={role === "admin"}
                    onClick={() => setRole("admin")}
                  >
                    Administrator
                  </button>
                  <button
                    type="button"
                    className={role === "client" ? "role-option selected" : "role-option"}
                    aria-pressed={role === "client"}
                    onClick={() => setRole("client")}
                  >
                    Client device
                  </button>
                </div>
              </fieldset>

              {error && <div className="login-error" role="alert">{error}</div>}

              <button type="submit" className="login-button">
                <span>Enter console</span>
                <span aria-hidden="true">&#8594;</span>
              </button>
            </form>

            <div className="connection-info">
              <span className="status-dot" />
              <span>Local network mode</span>
              <small>Internet not required</small>
            </div>
          </div>

          <footer className="login-main-footer">
            <span>SECURE LOCAL ACCESS</span>
            <span>UDP ALERT SYSTEM <b>·</b> v1.0</span>
          </footer>
        </section>
      </section>
    </main>
  );
}

export default Login;