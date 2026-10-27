import React from "react";

function DeviceList({ devices = [], onRefresh, isRefreshing = false, onDeleteDevice }) {
  return (
    <div className="card device-list">
      <div className="card-header device-list-header">
        <div>
          <h2>Connected Network Devices</h2>
          <p>Client devices and stations currently registered on this network.</p>
        </div>
        <button
          type="button"
          className="device-refresh-button"
          onClick={onRefresh}
          disabled={isRefreshing}
          aria-label={isRefreshing ? "Refreshing devices" : "Refresh devices"}
          title="Refresh devices"
        >
          <span aria-hidden="true">{isRefreshing ? "…" : "↻"}</span>
          <span>{isRefreshing ? "Refreshing" : "Refresh"}</span>
        </button>
      </div>

      {devices.length === 0 ? (
        <div className="no-devices">
          <div className="no-device-icon">📡</div>
          <h3>No Devices Connected</h3>
          <p>Waiting for client devices to sign in and connect...</p>
        </div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Device Station</th>
                <th>Hardware ID</th>
                <th>IP Address</th>
                <th>Connection</th>
                <th>Status</th>
                <th>Last Seen</th>
                {onDeleteDevice && <th>Action</th>}
              </tr>
            </thead>
            <tbody>
              {devices.map((device) => {
                const isOnline = device.status === "ONLINE";
                return (
                  <tr key={device.id || device.deviceId}>
                    <td>
                      <div className="device-name" style={{ fontWeight: 600 }}>
                        {device.name || "Client device"}
                      </div>
                      <small style={{ color: "#94a3b8", fontSize: "0.75rem" }}>
                        User: {device.username || "station"}
                      </small>
                    </td>
                    <td>
                      <code style={{ fontSize: "0.75rem", color: "#38bdf8" }}>
                        {device.deviceId || device.device_id || "N/A"}
                      </code>
                    </td>
                    <td>
                      <code>{device.ip || device.ip_address || "—"}</code>
                    </td>
                    <td>
                      <span style={{ fontSize: "0.8rem", color: "#cbd5e1" }}>
                        {device.connection_type === "HTTP" || device.connectionType === "HTTP"
                          ? "🌐 Web Station"
                          : `📡 UDP ${device.port || "41235"}`}
                      </span>
                    </td>
                    <td>
                      <span className={`device-status ${isOnline ? "online" : "offline"}`}>
                        <span className="status-dot"></span>
                        {device.status}
                      </span>
                    </td>
                    <td style={{ fontSize: "0.8rem" }}>
                      {device.lastSeen || device.last_seen
                        ? new Date(device.lastSeen || device.last_seen).toLocaleTimeString()
                        : "N/A"}
                    </td>
                    {onDeleteDevice && (
                      <td>
                        <button
                          type="button"
                          onClick={() => onDeleteDevice(device.id || device.deviceId)}
                          style={{
                            background: "none",
                            border: "1px solid rgba(239, 68, 68, 0.3)",
                            color: "#f87171",
                            padding: "2px 8px",
                            borderRadius: "4px",
                            fontSize: "0.75rem",
                            cursor: "pointer"
                          }}
                          title="Remove device from list"
                        >
                          Remove
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default DeviceList;
