import React from "react";

function Notification({ alert, onAcknowledge, isConnected = false, transportLabel = "UDP", isAcknowledging = false }) {
  if (!alert) {
    return (
      <div className="card waiting-notification">
        <div className="waiting-icon" aria-hidden="true">◉</div>
        <h2>Waiting for Alert</h2>
        <p>{isConnected ? "Connected and checking for new alerts." : "Connect this client to receive alerts."}</p>
        <div className="listening-status">
          <span className={`status-dot${isConnected ? "" : " status-dot-offline"}`}></span>
          {isConnected ? `Connected via ${transportLabel}` : "Client is offline"}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`notification-card ${alert.priority?.toLowerCase()}`}
    >

      {/* Alert Icon */}
      <div className="notification-icon">
        🚨
      </div>

      {/* Alert Content */}
      <div className="notification-content">

        <div className="notification-priority">

          {alert.priority || "HIGH"} PRIORITY

        </div>

        <h1>
          {alert.title}
        </h1>

        <p className="notification-message">
          {alert.message}
        </p>

        <div className="notification-info">

          <span>
            🕐{" "}
            {alert.receivedAt
              ? new Date(alert.receivedAt).toLocaleTimeString()
              : new Date().toLocaleTimeString()}
          </span>

          <span>
            {transportLabel}
          </span>

        </div>

        {/* Acknowledge */}
        <button
          className="acknowledge-button"
          disabled={isAcknowledging}
          onClick={() => onAcknowledge && onAcknowledge(alert)}
        >
          {isAcknowledging ? "SENDING ACKNOWLEDGEMENT" : "ACKNOWLEDGE ALERT"}
        </button>

      </div>

    </div>
  );
}

export default Notification;