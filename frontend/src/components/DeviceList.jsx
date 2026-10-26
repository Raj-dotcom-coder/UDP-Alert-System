import React from "react";

function DeviceList({ devices = [], onRefresh, isRefreshing = false }) {

  return (
    <div className="card device-list">

      <div className="card-header device-list-header">
        <div>
          <h2>Connected Devices</h2>
          <p>Devices currently registered with the alert server.</p>
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
          <div className="no-device-icon">
            📡
          </div>

          <h3>No Devices Connected</h3>

          <p>
            Waiting for devices to register...
          </p>
        </div>

      ) : (

        <div className="table-container">

          <table>

            <thead>
              <tr>
                <th>Device</th>
                <th>IP Address</th>
                <th>Connection</th>
                <th>Status</th>
                <th>Last Seen</th>
              </tr>
            </thead>

            <tbody>

              {devices.map((device) => (

                <tr key={device.id}>

                  <td>
                    <div className="device-name">
                      {device.name}
                    </div>
                  </td>

                  <td>
                    <code>
                      {device.ip}
                    </code>
                  </td>

                  <td>{device.connection_type === "HTTP" ? "Browser session" : `UDP ${device.port || "—"}`}</td>

                  <td>

                    <span
                      className={
                        device.status === "ONLINE"
                          ? "device-status online"
                          : "device-status offline"
                      }
                    >

                      <span className="status-dot"></span>

                      {device.status}

                    </span>

                  </td>

                  <td>
                    {device.lastSeen || "N/A"}
                  </td>

                </tr>

              ))}

            </tbody>

          </table>

        </div>

      )}

    </div>
  );
}

export default DeviceList;