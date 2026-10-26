import React, { useState } from "react";

function AlertForm({ onSend }) {

  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [priority, setPriority] = useState("HIGH");

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!title.trim() || !message.trim()) {
      alert("Please enter both title and message.");
      return;
    }

    const alertData = {
      title,
      message,
      priority,
      timestamp: new Date().toISOString()
    };

    /*
      This function will eventually send the
      data to your Node.js backend.

      React
         ↓
      Express API
         ↓
      Node.js dgram
         ↓
      UDP Device
    */

    if (onSend) {
      onSend(alertData);
    }

    // Clear form
    setTitle("");
    setMessage("");
    setPriority("HIGH");
  };

  return (
    <div className="card alert-form">

      <div className="card-header">
        <h2>Send emergency alert</h2>
        <p>Send an alert to devices on the local network.</p>
      </div>

      <form onSubmit={handleSubmit}>

        {/* Alert Title */}
        <div className="form-group">
          <label htmlFor="alert-title">
            Alert Title
          </label>

          <input
            id="alert-title"
            type="text"
            placeholder="Example: Fire Detected"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        {/* Message */}
        <div className="form-group">
          <label htmlFor="alert-message">
            Alert Message
          </label>

          <textarea
            id="alert-message"
            rows="5"
            placeholder="Enter the emergency message..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
        </div>

        {/* Priority */}
        <div className="form-group">
          <label htmlFor="priority">
            Priority
          </label>

          <select
            id="priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
          >
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
        </div>

        {/* Send Button */}
        <button
          type="submit"
          className="send-alert-button"
        >
          Send UDP alert
        </button>

      </form>

    </div>
  );
}

export default AlertForm;