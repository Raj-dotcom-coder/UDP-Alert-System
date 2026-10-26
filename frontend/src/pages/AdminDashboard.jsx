import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiRequest } from "../api";

import Dashboard from "../components/Dashboard";
import AlertForm from "../components/AlertForm";
import DeviceList from "../components/DeviceList";

function AdminDashboard() {

  const [devices, setDevices] = useState([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // --------------------------------
  // Alert history
  // --------------------------------

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
      setDevices(deviceResult.devices);
      setAlerts(alertResult.alerts);
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

  // --------------------------------
  // Send Alert
  // --------------------------------

  const handleSendAlert = (alertData) => {

    const user = JSON.parse(localStorage.getItem("udpAlertUser") || "null");
    apiRequest("/alerts", {
      method: "POST",
      body: JSON.stringify({ ...alertData, senderId: user?.id || null })
    }).then((result) => {
      setAlerts((previousAlerts) => [result.alert, ...previousAlerts]);
      alert(result.message);
    }).catch((requestError) => alert(requestError.message));
  };

  // --------------------------------
  // Statistics
  // --------------------------------
  const onlineDevices = devices.filter((device) => device.status === "ONLINE").length;
  const offlineDevices = devices.filter((device) => device.status === "OFFLINE").length;

  return (
    <Dashboard
      title="Network overview"
      description="Monitor devices and issue local emergency alerts."
      className="admin-dashboard"
    >
      <div className="admin-toolbar">
        <div>
          <span className="admin-eyebrow">CONTROL ROOM / UDP</span>
          <p>Administrator access</p>
        </div>
        <div className="admin-toolbar-actions">
          <span className="listener-state"><span className="status-dot" />Listener ready</span>
          <Link to="/login" className="logout-button" onClick={handleLogout}>Sign out</Link>
        </div>
      </div>

      <section className="stats-container admin-stats" aria-label="Network summary">
        <div className="stat-card">
          <span className="metric-label">Registered devices</span>
          <strong>{devices.length}</strong>
          <small>All known clients</small>
        </div>
        <div className="stat-card metric-online">
          <span className="metric-label">Online</span>
          <strong>{onlineDevices}</strong>
          <small>Active on local network</small>
        </div>
        <div className="stat-card metric-offline">
          <span className="metric-label">Offline</span>
          <strong>{offlineDevices}</strong>
          <small>Not recently seen</small>
        </div>
        <div className="stat-card metric-alerts">
          <span className="metric-label">Alerts sent</span>
          <strong>{alerts.length}</strong>
          <small>Recorded messages</small>
        </div>
      </section>

      <div className="dashboard-grid admin-workspace">
        <AlertForm onSend={handleSendAlert} />
        <DeviceList devices={devices} onRefresh={() => refreshDashboard()} isRefreshing={isRefreshing} />
      </div>

      <section className="card alert-history admin-panel">
        <div className="panel-heading">
          <div>
            <h2>Alert history</h2>
            <p>Recent messages sent from this console.</p>
          </div>
          <span className="record-count">{alerts.length} records</span>
        </div>

        {alerts.length === 0 ? (
          <div className="empty-history">
            <h3>No alerts recorded</h3>
            <p>Sent alerts will appear here with their delivery status.</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="history-table">
              <thead>
                <tr><th>Time</th><th>Alert</th><th>Priority</th><th>Status</th></tr>
              </thead>
              <tbody>
                {alerts.map((alertItem) => (
                  <tr key={alertItem.id}>
                    <td>{new Date(alertItem.createdAt).toLocaleString()}</td>
                    <td>
                      <strong>{alertItem.title}</strong>
                      <small>{alertItem.message}</small>
                    </td>
                    <td><span className={`priority-tag priority-${alertItem.priority.toLowerCase()}`}>{alertItem.priority}</span></td>
                    <td><span className={`history-status status-${alertItem.status.toLowerCase()}`}>{alertItem.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card udp-info admin-network-panel">
        <div className="panel-heading">
          <div>
            <h2>Network configuration</h2>
            <p>Local transport settings for this alert service.</p>
          </div>
          <span className="network-protocol">UDP / IPv4</span>
        </div>
        <div className="network-details">
          <div><span>Listener port</span><strong>41234</strong></div>
          <div><span>Network scope</span><strong>Local LAN</strong></div>
          <div><span>Internet access</span><strong>Not required</strong></div>
          <div><span>Transport</span><strong>Connectionless UDP</strong></div>
        </div>
      </section>

    </Dashboard>
  );
}

export default AdminDashboard;