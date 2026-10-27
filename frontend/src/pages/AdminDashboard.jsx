import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiRequest, getApiBaseUrl } from "../api";

import Dashboard from "../components/Dashboard";
import AlertForm from "../components/AlertForm";
import DeviceList from "../components/DeviceList";

function AdminDashboard() {
  const [devices, setDevices] = useState([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [alerts, setAlerts] = useState([]);

  const handleLogout = () => {
    localStorage.removeItem("udpAlertUser");
  };

  const refreshDashboard = async ({ silent = false } = {}) => {
    if (!silent) setIsRefreshing(true);
    try {
      const [deviceResult, alertResult] = await Promise.all([
        apiRequest("/devices"),
        apiRequest("/alerts")
      ]);
      setDevices(deviceResult.devices || []);
      setAlerts(alertResult.alerts || []);
    } catch (requestError) {
      if (!silent) alert(requestError.message);
    } finally {
      if (!silent) setIsRefreshing(false);
    }
  };

  useEffect(() => {
    refreshDashboard();
    const refreshInterval = window.setInterval(() => {
      refreshDashboard({ silent: true });
    }, 3000);

    return () => window.clearInterval(refreshInterval);
  }, []);

  const handleSendAlert = (alertData) => {
    const user = JSON.parse(localStorage.getItem("udpAlertUser") || "null");
    apiRequest("/alerts", {
      method: "POST",
      body: JSON.stringify({ ...alertData, senderId: user?.id || null })
    }).then((result) => {
      setAlerts((previousAlerts) => [result.alert, ...previousAlerts]);
      alert(result.message);
      refreshDashboard({ silent: true });
    }).catch((requestError) => alert(requestError.message));
  };

  const handleResolveAlert = async (alertId) => {
    try {
      await apiRequest(`/alerts/${alertId}/resolve`, { method: "POST" });
      refreshDashboard({ silent: true });
    } catch (error) {
      alert(`Failed to resolve alert: ${error.message}`);
    }
  };

  const handleDeleteAlert = async (alertId) => {
    if (!window.confirm("Are you sure you want to delete this alert?")) return;
    try {
      await apiRequest(`/alerts/${alertId}`, { method: "DELETE" });
      refreshDashboard({ silent: true });
    } catch (error) {
      alert(`Failed to delete alert: ${error.message}`);
    }
  };

  const handleDeleteDevice = async (deviceId) => {
    try {
      await apiRequest(`/devices/${deviceId}`, { method: "DELETE" });
      refreshDashboard({ silent: true });
    } catch (error) {
      alert(`Failed to remove device: ${error.message}`);
    }
  };

  const onlineDevices = devices.filter((device) => device.status === "ONLINE").length;
  const offlineDevices = devices.filter((device) => device.status === "OFFLINE").length;

  return (
    <Dashboard
      title="Admin Dispatch Console"
      description="Monitor multi-device network status and broadcast emergency alerts."
      className="admin-dashboard"
    >
      <div className="admin-toolbar">
        <div>
          <span className="admin-eyebrow">CONTROL ROOM / MULTI-DEVICE DISPATCH</span>
          <p>Administrator Console • Server API: <code>{getApiBaseUrl()}</code></p>
        </div>
        <div className="admin-toolbar-actions">
          <span className="listener-state"><span className="status-dot" />Dispatch active</span>
          <Link to="/client" className="logout-button" style={{ background: "rgba(14, 165, 233, 0.15)", borderColor: "rgba(14, 165, 233, 0.4)", color: "#38bdf8" }}>Client View</Link>
          <Link to="/login" className="logout-button" onClick={handleLogout}>Sign out</Link>
        </div>
      </div>

      <section className="stats-container admin-stats" aria-label="Network summary">
        <div className="stat-card">
          <span className="metric-label">Registered stations</span>
          <strong>{devices.length}</strong>
          <small>All known client devices</small>
        </div>
        <div className="stat-card metric-online">
          <span className="metric-label">Online</span>
          <strong>{onlineDevices}</strong>
          <small>Connected on LAN</small>
        </div>
        <div className="stat-card metric-offline">
          <span className="metric-label">Offline</span>
          <strong>{offlineDevices}</strong>
          <small>Inactive stations</small>
        </div>
        <div className="stat-card metric-alerts">
          <span className="metric-label">Alerts Broadcast</span>
          <strong>{alerts.length}</strong>
          <small>Recorded broadcasts</small>
        </div>
      </section>

      {/* Multi-Device Network Active Box */}
      <div style={{
        background: "rgba(14, 165, 233, 0.08)",
        border: "1px solid rgba(14, 165, 233, 0.25)",
        borderRadius: "8px",
        padding: "12px 18px",
        marginBottom: "1.5rem",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: "12px",
        fontSize: "0.85rem"
      }}>
        <div>
          <strong style={{ color: "#38bdf8", display: "block" }}>
            📶 Multi-Device Network Active
          </strong>
          <span style={{ color: "#94a3b8" }}>
            Stations and client devices connected on this network will appear automatically below with individual names and live acknowledgement tracking.
          </span>
        </div>
        <Link
          to="/client"
          style={{
            background: "rgba(14, 165, 233, 0.15)",
            border: "1px solid rgba(14, 165, 233, 0.4)",
            color: "#38bdf8",
            padding: "6px 12px",
            borderRadius: "6px",
            textDecoration: "none",
            fontSize: "0.8rem",
            fontWeight: 600,
            whiteSpace: "nowrap"
          }}
        >
          Open Client View →
        </Link>
      </div>

      <div className="dashboard-grid admin-workspace">
        <AlertForm onSend={handleSendAlert} />
        <DeviceList
          devices={devices}
          onRefresh={() => refreshDashboard()}
          isRefreshing={isRefreshing}
          onDeleteDevice={handleDeleteDevice}
        />
      </div>

      <section className="card alert-history admin-panel">
        <div className="panel-heading">
          <div>
            <h2>Alert Broadcast History</h2>
            <p>Live delivery status and acknowledgements per device.</p>
          </div>
          <span className="record-count">{alerts.length} records</span>
        </div>

        {alerts.length === 0 ? (
          <div className="empty-history">
            <h3>No alerts recorded</h3>
            <p>Broadcast alerts will appear here with per-device ACK tracking.</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="history-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Alert</th>
                  <th>Priority</th>
                  <th>Device ACKs</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map((alertItem) => {
                  const ackCount = alertItem.totalAcks || 0;
                  const ackDevices = alertItem.acknowledgements || [];
                  const isActive = alertItem.status === "SENT" || alertItem.status === "PARTIALLY_ACKNOWLEDGED";

                  return (
                    <tr key={alertItem.id}>
                      <td>{new Date(alertItem.createdAt).toLocaleTimeString()}</td>
                      <td>
                        <strong>{alertItem.title}</strong>
                        <small>{alertItem.message}</small>
                      </td>
                      <td>
                        <span className={`priority-tag priority-${alertItem.priority.toLowerCase()}`}>
                          {alertItem.priority}
                        </span>
                      </td>
                      <td>
                        <div>
                          <strong style={{ color: ackCount > 0 ? "#4ade80" : "#94a3b8" }}>
                            {ackCount} ACK(s)
                          </strong>
                          {ackDevices.length > 0 && (
                            <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "2px" }}>
                              {ackDevices.map((a) => a.deviceName).join(", ")}
                            </div>
                          )}
                        </div>
                      </td>
                      <td>
                        <span className={`history-status status-${alertItem.status.toLowerCase()}`}>
                          {alertItem.status}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: "6px" }}>
                          {isActive && (
                            <button
                              type="button"
                              onClick={() => handleResolveAlert(alertItem.id)}
                              style={{
                                background: "rgba(34, 197, 94, 0.15)",
                                border: "1px solid rgba(34, 197, 94, 0.4)",
                                color: "#86efac",
                                padding: "2px 8px",
                                borderRadius: "4px",
                                fontSize: "0.75rem",
                                cursor: "pointer"
                              }}
                              title="Mark alert as RESOLVED across all devices"
                            >
                              Resolve
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDeleteAlert(alertItem.id)}
                            style={{
                              background: "rgba(239, 68, 68, 0.1)",
                              border: "1px solid rgba(239, 68, 68, 0.3)",
                              color: "#f87171",
                              padding: "2px 8px",
                              borderRadius: "4px",
                              fontSize: "0.75rem",
                              cursor: "pointer"
                            }}
                            title="Delete this alert"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card udp-info admin-network-panel">
        <div className="panel-heading">
          <div>
            <h2>Network Configuration</h2>
            <p>Local transport settings for multi-device communication.</p>
          </div>
          <span className="network-protocol">UDP / HTTP HYBRID</span>
        </div>
        <div className="network-details">
          <div><span>UDP Port</span><strong>41234</strong></div>
          <div><span>HTTP API Port</span><strong>5000</strong></div>
          <div><span>Access Mode</span><strong>Authorized Network</strong></div>
          <div><span>Scope</span><strong>Local LAN / Multi-Device</strong></div>
        </div>
      </section>
    </Dashboard>
  );
}

export default AdminDashboard;
