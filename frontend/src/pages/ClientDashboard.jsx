import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import "../client-command-center.css";

import { apiRequest, getApiBaseUrl } from "../api";
import {
  getDeviceId,
  getDeviceName,
  setDeviceName,
  playEmergencyAlarm,
  sendDesktopNotification
} from "../utils/deviceHelper";

const ACK_STORAGE_PREFIX = "udp-alert-ack-";

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem("udpAlertUser") || "null");
  } catch {
    localStorage.removeItem("udpAlertUser");
    return null;
  }
}

function getAcknowledgedState(alertId) {
  if (!alertId || typeof window === "undefined") return false;
  return localStorage.getItem(`${ACK_STORAGE_PREFIX}${alertId}`) === "true";
}

export default function ClientDashboard() {
  const [user] = useState(getStoredUser);
  const [deviceId] = useState(getDeviceId);
  const [deviceNameState, setDeviceNameState] = useState(getDeviceName);
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(getDeviceName);

  const [connection, setConnection] = useState("Connecting");
  const [details, setDetails] = useState({
    deviceId: getDeviceId(),
    deviceName: getDeviceName(),
    clientPort: 41235,
    server: getApiBaseUrl(),
    transport: "Local LAN"
  });

  const [alert, setAlert] = useState(null);
  const [history, setHistory] = useState([]);
  const [acknowledged, setAcknowledged] = useState(false);
  const [events, setEvents] = useState([
    `${new Date().toLocaleTimeString()} — Initializing UDP Alert Command Center…`
  ]);

  const [isAcknowledging, setIsAcknowledging] = useState(false);
  const [showBroadcastForm, setShowBroadcastForm] = useState(false);
  const [alertTitle, setAlertTitle] = useState("");
  const [alertMessage, setAlertMessage] = useState("");
  const [alertPriority, setAlertPriority] = useState("HIGH");
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const wsRef = useRef(null);
  const lastSoundAlertId = useRef(null);

  function addEvent(text) {
    setEvents((old) => [`${new Date().toLocaleTimeString()} — ${text}`, ...old].slice(0, 10));
  }

  async function handleSendStationAlert(e) {
    e.preventDefault();
    if (!alertTitle.trim() || !alertMessage.trim()) {
      alert("Please enter both title and message.");
      return;
    }

    setIsBroadcasting(true);
    try {
      const result = await apiRequest("/alerts", {
        method: "POST",
        body: JSON.stringify({
          title: alertTitle.trim(),
          message: alertMessage.trim(),
          priority: alertPriority
        })
      });
      addEvent(`✓ Broadcast alert sent: "${alertTitle}"`);
      setAlertTitle("");
      setAlertMessage("");
      setShowBroadcastForm(false);
      alert(result.message || "Alert broadcast sent successfully.");
    } catch (err) {
      addEvent(`Broadcast error: ${err.message}`);
      alert(`Failed to send alert: ${err.message}`);
    } finally {
      setIsBroadcasting(false);
    }
  }

  // 1. WebSocket Bridge connection attempt (if user runs `npm run bridge` on ws://localhost:41236)
  useEffect(() => {
    let ws;
    let wsAlive = true;

    function tryConnectWs() {
      if (!wsAlive) return;
      try {
        ws = new WebSocket("ws://localhost:41236");
        wsRef.current = ws;

        ws.onopen = () => {
          setConnection("Registered (UDP Bridge)");
          addEvent("Connected to local UDP bridge (ws://localhost:41236)");
          ws.send(JSON.stringify({ type: "REGISTER" }));
        };

        ws.onmessage = (event) => {
          let packet;
          try {
            packet = JSON.parse(event.data);
          } catch {
            return;
          }

          if (packet.type === "STATUS") {
            setDetails((prev) => ({
              ...prev,
              ...packet,
              transport: "UDP (Raw Socket via Bridge)"
            }));
            if (packet.error) setConnection("Bridge error");
            else setConnection("Registered");
          } else if (packet.type === "ALERT" && packet.alert) {
            handleIncomingAlert(packet.alert, "UDP Bridge");
          } else if (packet.type === "ACK_SENT") {
            setAcknowledged(true);
            addEvent("UDP acknowledgement verified by server");
          }
        };

        ws.onerror = () => {
          // Normal if not running the Node bridge; fallback to HTTP LAN sync
        };

        ws.onclose = () => {
          // Silently fall back to HTTP
        };
      } catch {
        // Fallback to HTTP
      }
    }

    tryConnectWs();

    return () => {
      wsAlive = false;
      ws?.close();
    };
  }, []);

  // 2. HTTP LAN Sync with Server API
  useEffect(() => {
    let active = true;

    async function initialConnect() {
      try {
        const result = await apiRequest("/devices/connect", {
          method: "POST",
          body: JSON.stringify({ deviceId, deviceName: deviceNameState })
        });
        if (active) {
          setConnection("Registered");
          addEvent(`Station registered with Admin: "${deviceNameState}"`);
          setDetails((prev) => ({
            ...prev,
            server: getApiBaseUrl().replace("/api", ""),
            ip: result.device?.ip || "Local LAN",
            status: "ONLINE"
          }));
        }
      } catch (err) {
        if (active) {
          setConnection("Connection error");
          addEvent(`Registration attempt: ${err.message}`);
        }
      }
    }

    initialConnect();

    const intervalId = setInterval(async () => {
      try {
        const [heartbeatRes, alertsRes] = await Promise.all([
          apiRequest("/devices/heartbeat", {
            method: "POST",
            body: JSON.stringify({ deviceId, deviceName: deviceNameState })
          }),
          apiRequest("/alerts")
        ]);

        if (!active) return;
        setConnection("Registered");

        if (alertsRes.alerts?.length) {
          setHistory(alertsRes.alerts);
          // Look for an active alert
          const activeAlert = alertsRes.alerts.find(
            (a) => a.status === "SENT" || a.status === "PARTIALLY_ACKNOWLEDGED"
          );

          if (activeAlert) {
            handleIncomingAlert(activeAlert, "Local LAN");
          } else if (!alert) {
            // No active alert currently broadcasting
          }
        }
      } catch (err) {
        if (active) {
          setConnection("Disconnected — retrying");
        }
      }
    }, 3500);

    return () => {
      active = false;
      clearInterval(intervalId);
    };
  }, [deviceId, deviceNameState]);

  function handleIncomingAlert(incoming, transport = "UDP") {
    const alertId = incoming.id || incoming.alertId;
    const isAckedLocally = getAcknowledgedState(alertId);
    const isAckedOnServer = incoming.acknowledgedDeviceIds?.includes(deviceId);
    const isAcked = isAckedLocally || isAckedOnServer;

    setAlert({
      ...incoming,
      alertId,
      transportLabel: transport,
      receivedAt: incoming.receivedAt || incoming.createdAt || new Date().toISOString()
    });

    setAcknowledged(Boolean(isAcked));

    // Audio alarm & desktop notification if this is a newly arrived unacknowledged alert
    if (!isAcked && lastSoundAlertId.current !== alertId) {
      lastSoundAlertId.current = alertId;
      addEvent(`ALERT RECEIVED: ${incoming.title || "Emergency alert"}`);
      playEmergencyAlarm(incoming.priority);
      sendDesktopNotification(incoming.title, incoming.message);
    }
  }

  async function acknowledge() {
    const alertId = alert?.id || alert?.alertId;
    if (!alertId) {
      addEvent("Cannot acknowledge: no alert ID available");
      return;
    }
    if (acknowledged) {
      addEvent("This alert was already acknowledged");
      return;
    }

    setIsAcknowledging(true);
    addEvent("Sending acknowledgement to Admin…");

    try {
      // Send via WebSocket bridge if active
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "ACK", alertId }));
      }

      // Also send via HTTP API
      await apiRequest(`/alerts/${alertId}/ack`, {
        method: "POST",
        body: JSON.stringify({ deviceId, deviceName: deviceNameState })
      });

      localStorage.setItem(`${ACK_STORAGE_PREFIX}${alertId}`, "true");
      setAcknowledged(true);
      addEvent(`✓ Acknowledgement confirmed for alert #${alertId.slice(-6)}`);
    } catch (err) {
      addEvent(`Acknowledgement error: ${err.message}`);
    } finally {
      setIsAcknowledging(false);
    }
  }

  function handleSaveDeviceName() {
    const trimmed = tempName.trim();
    if (trimmed) {
      setDeviceName(trimmed);
      setDeviceNameState(trimmed);
      addEvent(`Device station renamed to: "${trimmed}"`);
      apiRequest("/devices/connect", {
        method: "POST",
        body: JSON.stringify({ deviceId, deviceName: trimmed })
      }).catch(() => {});
    }
    setIsEditingName(false);
  }

  function handleLogout() {
    apiRequest("/devices/disconnect", {
      method: "POST",
      body: JSON.stringify({ deviceId })
    }).catch(() => {});
    localStorage.removeItem("udpAlertUser");
  }

  function getPriorityLevel(priority) {
    const value = String(priority || "HIGH").trim().toUpperCase();
    if (["LOW", "MINOR"].includes(value)) return "low";
    if (["MODERATE", "MEDIUM", "MED"].includes(value)) return "moderate";
    return "high";
  }

  const isConnected = connection === "Registered" || connection.includes("Registered") || connection === "Bridge connected";

  return (
    <div className="udp-client-page">
      <div className="page">
        {/* Topbar matching attached UI */}
        <header className="topbar">
          <div className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M7 7.5h10M7 12h10M7 16.5h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              <rect x="3.5" y="3.5" width="17" height="17" rx="4" stroke="currentColor" strokeWidth="1.6" />
              <circle cx="17" cy="16.5" r="1" fill="currentColor" />
            </svg>
          </div>

          <div className="brand-copy">
            <h1>UDP Alert Command Center</h1>
            <p>Private network operations • Station: <strong>{deviceNameState}</strong></p>
          </div>

          <div className="topbar-actions">
            <div
              className={`status ${isConnected ? "good" : connection.includes("Error") || connection.includes("Disconnected") ? "bad" : "pending"}`}
              role="status"
              aria-live="polite"
            >
              <span className="status-dot" />
              {connection}
            </div>
            <button
              type="button"
              className="signout-link"
              onClick={() => setShowBroadcastForm((prev) => !prev)}
              style={{
                borderColor: showBroadcastForm ? "#dc2626" : "var(--line)",
                background: showBroadcastForm ? "rgba(220, 38, 38, 0.1)" : "var(--panel)",
                color: showBroadcastForm ? "#dc2626" : "inherit",
                cursor: "pointer"
              }}
              title="Broadcast emergency alert to all network devices"
            >
              {showBroadcastForm ? "✕ Close Alert Form" : "🔔 Send Alert"}
            </button>
            <Link to="/admin" className="signout-link" style={{ borderColor: "#38bdf8", color: "#38bdf8" }}>
              Admin Console
            </Link>
            <Link to="/login" className="signout-link" onClick={handleLogout}>
              Sign out
            </Link>
          </div>
        </header>

        <main>
          {showBroadcastForm && (
            <section className="card" style={{ marginBottom: "18px", border: "1px solid rgba(220, 38, 38, 0.4)", background: "rgba(220, 38, 38, 0.03)" }}>
              <div className="card-heading">
                <div>
                  <p className="card-kicker" style={{ color: "#dc2626" }}>STATION BROADCAST</p>
                  <h3>Send Emergency Alert</h3>
                </div>
                <span className="live-label" style={{ color: "#dc2626" }}><i></i> ALL STATIONS</span>
              </div>
              <form onSubmit={handleSendStationAlert} style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "12px" }}>
                <div>
                  <label htmlFor="station-alert-title" style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--heading)", marginBottom: "4px" }}>
                    Alert Title
                  </label>
                  <input
                    id="station-alert-title"
                    type="text"
                    value={alertTitle}
                    onChange={(e) => setAlertTitle(e.target.value)}
                    placeholder="e.g. Fire Alarm / Evacuation Needed"
                    style={{ width: "100%", padding: "8px 10px", fontSize: "13px", border: "1px solid #cbd5e1", borderRadius: "6px" }}
                  />
                </div>
                <div>
                  <label htmlFor="station-alert-message" style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--heading)", marginBottom: "4px" }}>
                    Alert Message
                  </label>
                  <textarea
                    id="station-alert-message"
                    rows="3"
                    value={alertMessage}
                    onChange={(e) => setAlertMessage(e.target.value)}
                    placeholder="Enter urgent dispatch details..."
                    style={{ width: "100%", padding: "8px 10px", fontSize: "13px", border: "1px solid #cbd5e1", borderRadius: "6px", resize: "vertical" }}
                  />
                </div>
                <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: "160px" }}>
                    <label htmlFor="station-alert-priority" style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--heading)", marginBottom: "4px" }}>
                      Priority
                    </label>
                    <select
                      id="station-alert-priority"
                      value={alertPriority}
                      onChange={(e) => setAlertPriority(e.target.value)}
                      style={{ width: "100%", padding: "8px 10px", fontSize: "13px", border: "1px solid #cbd5e1", borderRadius: "6px" }}
                    >
                      <option value="HIGH">High (Immediate)</option>
                      <option value="MEDIUM">Medium (Urgent)</option>
                      <option value="LOW">Low (Advisory)</option>
                    </select>
                  </div>
                  <div style={{ alignSelf: "flex-end" }}>
                    <button
                      type="submit"
                      disabled={isBroadcasting}
                      style={{
                        padding: "9px 20px",
                        fontSize: "13px",
                        fontWeight: 700,
                        background: "#dc2626",
                        color: "#fff",
                        border: "none",
                        borderRadius: "6px",
                        cursor: isBroadcasting ? "not-allowed" : "pointer",
                        opacity: isBroadcasting ? 0.7 : 1
                      }}
                    >
                      {isBroadcasting ? "Broadcasting…" : "Send Emergency Alert"}
                    </button>
                  </div>
                </div>
              </form>
            </section>
          )}
          {/* Intro Section with animated network illustration */}
          <section className="intro">
            <div className="intro-copy">
              <p className="eyebrow">PRIVATE NETWORK OPERATIONS</p>
              <h2>Situational awareness for critical local alerts</h2>
              <p>
                Receive, triage, and acknowledge LAN messages in real time. This client keeps alert
                visibility clear and dependable even without external internet connectivity.
              </p>
            </div>

            <svg className="network-art" viewBox="0 0 300 170" role="img" aria-label="Illustration of devices connected to a local network">
              <path className="network-line" d="M150 86 76 45M150 86 225 45M150 86 82 133M150 86 220 132" />
              <path className="network-dash" d="M150 86 76 45M150 86 225 45M150 86 82 133M150 86 220 132" />
              <rect className="network-hub" x="119" y="58" width="62" height="56" rx="13" />
              <rect className="network-hub-inner" x="131" y="70" width="38" height="31" rx="7" />
              <path className="network-hub-lines" d="M138 79h24M138 86h17M138 93h20" />
              <circle className="network-node node-one" cx="70" cy="40" r="20" />
              <circle className="network-node node-two" cx="231" cy="40" r="20" />
              <circle className="network-node node-three" cx="76" cy="138" r="20" />
              <circle className="network-node node-four" cx="225" cy="138" r="20" />
              <rect className="network-device" x="63" y="32" width="14" height="16" rx="3" />
              <path className="network-device" d="M226 34h10v12h-10zM224 48h14" />
              <rect className="network-device" x="69" y="130" width="14" height="16" rx="3" />
              <path className="network-device" d="M218 133h14v10h-14zM221 146h8" />
              <circle className="network-pulse" cx="150" cy="86" r="37" />
            </svg>
          </section>

          {/* Animated Ticker Track */}
          <div className="ticker" aria-label="Local network, UDP connection, internet not required">
            <div className="ticker-track" aria-hidden="true">
              <div className="ticker-group">
                <span>LOCAL NETWORK</span><b>·</b>
                <span>UDP ALERT MONITORING</span><b>·</b>
                <span>MULTI-DEVICE FLEET</span><b>·</b>
                <span>NO INTERNET REQUIRED</span><b>·</b>
                <span>PRIVATE STATION</span>
              </div>
              <div className="ticker-group">
                <span>LOCAL NETWORK</span><b>·</b>
                <span>UDP ALERT MONITORING</span><b>·</b>
                <span>MULTI-DEVICE FLEET</span><b>·</b>
                <span>NO INTERNET REQUIRED</span><b>·</b>
                <span>PRIVATE STATION</span>
              </div>
            </div>
          </div>

          {/* Main Alert Panel matching attached UI */}
          <section className={`alert-panel ${alert ? "has-alert" : ""}`} aria-live="polite">
            {alert ? (
              <>
                <div
                  className={`alert-symbol priority-${getPriorityLevel(alert.priority)}`}
                  aria-label={`${alert.priority || "HIGH"} priority alert`}
                >
                  !
                </div>
                <div className={`priority priority-${getPriorityLevel(alert.priority)}`}>
                  {alert.priority || "HIGH"} PRIORITY
                </div>
                <h2>{alert.title || "Emergency alert"}</h2>
                <p className="alert-message">{alert.message || "No message provided."}</p>
                <div className="alert-meta">
                  <span>Received: {new Date(alert.receivedAt || Date.now()).toLocaleString()}</span>
                  <span>Transport: {alert.transportLabel || "UDP / Local LAN"}</span>
                  <span>Station: {deviceNameState}</span>
                </div>
                <button
                  className="ack-button"
                  onClick={acknowledge}
                  disabled={acknowledged || isAcknowledging}
                >
                  {isAcknowledging
                    ? "SENDING ACKNOWLEDGEMENT…"
                    : acknowledged
                      ? "✓ ACKNOWLEDGEMENT SENT"
                      : "✓ ACKNOWLEDGE ALERT"}
                </button>
              </>
            ) : (
              <>
                <div className="waiting-icon" aria-hidden="true">
                  <span>✓</span>
                </div>
                <h2>Waiting for an alert</h2>
                <p>
                  Your client is ready. New server alerts broadcast by the Admin will appear here as
                  soon as they arrive.
                </p>
              </>
            )}
          </section>

          {/* Two Columns: Connection Details & Live Log */}
          <div className="columns">
            <section className="card">
              <div className="card-heading">
                <div>
                  <p className="card-kicker">NETWORK</p>
                  <h3>Connection details</h3>
                </div>
                <span className="card-icon" aria-hidden="true">↗</span>
              </div>
              <dl>
                <dt>Device Name</dt>
                <dd>
                  {isEditingName ? (
                    <span style={{ display: "inline-flex", gap: "4px" }}>
                      <input
                        type="text"
                        value={tempName}
                        onChange={(e) => setTempName(e.target.value)}
                        style={{ padding: "2px 6px", fontSize: "11px", border: "1px solid #cbd5e1", borderRadius: "4px" }}
                      />
                      <button
                        type="button"
                        onClick={handleSaveDeviceName}
                        style={{ padding: "2px 6px", fontSize: "11px", background: "var(--brand)", color: "#fff", border: "none", borderRadius: "4px" }}
                      >
                        Save
                      </button>
                    </span>
                  ) : (
                    <span>
                      {deviceNameState}{" "}
                      <button
                        type="button"
                        onClick={() => { setTempName(deviceNameState); setIsEditingName(true); }}
                        style={{ background: "none", border: "none", color: "var(--brand)", fontSize: "11px", textDecoration: "underline", padding: 0 }}
                      >
                        (edit)
                      </button>
                    </span>
                  )}
                </dd>
                <dt>Hardware ID</dt>
                <dd><code>{deviceId}</code></dd>
                <dt>Connected User</dt>
                <dd><strong>{user?.username || "station"}</strong></dd>
                <dt>Alert Server</dt>
                <dd>{details.server || "Local LAN Server"}</dd>
                <dt>UDP Port</dt>
                <dd>{details.clientPort || 41235}</dd>
                <dt>Internet</dt>
                <dd><span className="offline">Not required</span></dd>
              </dl>
            </section>

            <section className="card">
              <div className="card-heading">
                <div>
                  <p className="card-kicker">LIVE LOG</p>
                  <h3>Recent activity</h3>
                </div>
                <span className="live-label"><i /> Live</span>
              </div>
              {events.length ? (
                <ul className="events">
                  {events.map((e, i) => (
                    <li key={`${e}-${i}`}>{e}</li>
                  ))}
                </ul>
              ) : (
                <p className="muted">No activity yet.</p>
              )}
            </section>
          </div>

          {/* Inbox History Section matching attached UI */}
          <section className="card history">
            <div className="card-heading">
              <div>
                <p className="card-kicker">INBOX</p>
                <h3>Recent alerts</h3>
              </div>
              <span className="history-count">
                {history.length} {history.length === 1 ? "alert" : "alerts"}
              </span>
            </div>
            {history.length ? (
              history.map((item, i) => (
                <button
                  type="button"
                  className="history-row"
                  key={`${item.id || item.alertId || item.createdAt}-${i}`}
                  onClick={() => {
                    handleIncomingAlert(item, "History");
                  }}
                >
                  <span className="history-dot" />
                  <span>
                    <strong>{item.title || "Emergency alert"}</strong>
                    <small>{item.message || ""}</small>
                  </span>
                  <time>{new Date(item.createdAt || item.receivedAt || Date.now()).toLocaleTimeString()}</time>
                </button>
              ))
            ) : (
              <p className="muted">Alerts received by this client will appear here.</p>
            )}
          </section>
        </main>

        <footer>UDP Alert Command Center · Private network operations · Local alert monitoring</footer>
      </div>
    </div>
  );
}
