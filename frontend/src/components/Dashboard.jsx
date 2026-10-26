import React from "react";

function Dashboard({ title = "UDP Alert System", description = "Communicating through local network without Internet", className = "", children }) {
  return (
    <div className={`dashboard ${className}`}>

      {/* Header */}
      <header className="dashboard-header">
        <div>
          <h2>⚡ UDP ALERT SYSTEM</h2>
          <p>Offline Real-Time Communication</p>
        </div>

        <div className="network-status">
          <span className="status-dot"></span>
          LOCAL NETWORK
        </div>
      </header>

      {/* Main Content */}
      <main className="dashboard-content">

        <div className="dashboard-title">
          <h1>{title}</h1>
          <p>{description}</p>
        </div>

        {children}

      </main>

      {/* Footer */}
      <footer className="dashboard-footer">
        UDP Emergency Alert System © 2026
      </footer>

    </div>
  );
}

export default Dashboard;