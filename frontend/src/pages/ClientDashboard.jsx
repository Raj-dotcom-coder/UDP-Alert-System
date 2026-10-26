import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { apiRequest } from "../api";
import Dashboard from "../components/Dashboard";
import Notification from "../components/Notification";

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem("udpAlertUser") || "null");
  } catch {
    localStorage.removeItem("udpAlertUser");
    return null;
  }
}

function ClientDashboard() {
  const [user] = useState(getStoredUser);
  const [device, setDevice] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionState, setConnectionState] = useState("disconnected");
  const [connectionError, setConnectionError] = useState("");
  const [connectionMessage, setConnectionMessage] = useState("");
  const [alert, setAlert] = useState(null);
  const [isAcknowledging, setIsAcknowledging] = useState(false);

  useEffect(() => {
    if (!isConnected) return undefined;

    let active = true;
    const syncSession = async () => {
      try {
        const [, alertResult] = await Promise.all([
          apiRequest("/devices/heartbeat", { method: "POST", body: JSON.stringify({}) }),
          apiRequest("/alerts")
        ]);
        if (!active) return;

        const currentAlert = alertResult.alerts.find((item) => item.status === "SENT");
        setAlert(currentAlert ? { ...currentAlert, receivedAt: currentAlert.createdAt } : null);
        setDevice((previous) => previous ? { ...previous, lastSeen: new Date().toISOString() } : previous);
        setConnectionError("");
      } catch (requestError) {
        if (active) setConnectionError(requestError.message);
      }
    };

    syncSession();
    const intervalId = window.setInterval(syncSession, 5000);
    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [isConnected]);

  const handleConnect = async () => {
    setConnectionState("connecting");
    setConnectionError("");
    try {
      const result = await apiRequest("/devices/connect", {
        method: "POST",
        body: JSON.stringify({})
      });
      setDevice(result.device);
      setConnectionMessage(result.message);
      setIsConnected(true);
      setConnectionState("connected");
    } catch (requestError) {
      setConnectionState("disconnected");
      setConnectionError(requestError.message);
    }
  };

  const handleDisconnect = async () => {
    setIsConnected(false);
    setConnectionState("disconnected");
    setAlert(null);
    setConnectionError("");
    try {
      await apiRequest("/devices/disconnect", {
        method: "POST",
        body: JSON.stringify({})
      });
    } catch (requestError) {
      setConnectionError(requestError.message);
    }
  };

  const handleAcknowledge = async (alertData) => {
    if (!device?.deviceId || !alertData?.id) return;
    setIsAcknowledging(true);
    try {
      await apiRequest(`/alerts/${alertData.id}/ack`, {
        method: "POST",
        body: JSON.stringify({ deviceId: device.deviceId })
      });
      setAlert(null);
    } catch (requestError) {
      setConnectionError(requestError.message);
    } finally {
      setIsAcknowledging(false);
    }
  };

  const handleLogout = () => {
    if (isConnected) {
      apiRequest("/devices/disconnect", {
        method: "POST",
        body: JSON.stringify({})
      }).catch(() => {});
    }
    localStorage.removeItem("udpAlertUser");
  };

  return (
    <Dashboard
      title="Client device"
      description="Connect this browser to receive local network alerts."
      className="client-dashboard"
    >
      <div className="dashboard-toolbar">
        <div>
          <strong>{device?.name || `${user?.username || "Client"} browser`}</strong>
          <p>{isConnected ? "This dashboard is checking for new alerts." : "This browser is not connected."}</p>
        </div>
        <div className="client-toolbar-actions">
          <button
            type="button"
            className={`client-connect-button${isConnected ? " connected" : ""}`}
            onClick={isConnected ? handleDisconnect : handleConnect}
            disabled={connectionState === "connecting"}
          >
            <span aria-hidden="true">{isConnected ? "×" : "+"}</span>
            {connectionState === "connecting" ? "Connecting" : isConnected ? "Disconnect" : "Connect client"}
          </button>
          <Link to="/login" className="logout-button" onClick={handleLogout}>Sign out</Link>
        </div>
      </div>

      {connectionError && <p className="client-connection-error" role="alert">{connectionError}</p>}

      <section className="client-status-card" aria-live="polite">
        <div className="client-status-icon" aria-hidden="true">{isConnected ? "◉" : "○"}</div>
        <div>
          <h2>{isConnected ? "Client connected" : "Client disconnected"}</h2>
          <p>{isConnected ? connectionMessage || "Session is active. Alerts are checked every five seconds." : "Connect this browser to join the alert network."}</p>
        </div>
        <div className={`connection-status${isConnected ? " connected" : " disconnected"}`}>
          <span className={`status-dot${isConnected ? "" : " status-dot-offline"}`} />
          {isConnected ? "ONLINE" : "OFFLINE"}
        </div>
      </section>

      <section className="notification-section">
        <h2>Notifications</h2>
        <Notification
          alert={isConnected ? alert : null}
          isConnected={isConnected}
          transportLabel="HTTP session"
          isAcknowledging={isAcknowledging}
          onAcknowledge={handleAcknowledge}
        />
      </section>

      <section className="card client-device-card">
        <div className="card-header">
          <h2>Device information</h2>
          <p>Browser session details.</p>
        </div>
        <div className="device-information">
          <div className="information-item"><span>Device name</span><strong>{device?.name || `${user?.username || "Client"} browser`}</strong></div>
          <div className="information-item"><span>IP address</span><strong>{device?.ip || "Available after connection"}</strong></div>
          <div className="information-item"><span>Connection</span><strong>HTTP polling</strong></div>
          <div className="information-item"><span>Internet</span><strong className="offline">Not required on local LAN</strong></div>
        </div>
      </section>
    </Dashboard>
  );
}

export default ClientDashboard;