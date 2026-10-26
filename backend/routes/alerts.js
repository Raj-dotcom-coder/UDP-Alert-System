const express = require("express");
const router = express.Router();
const db = require("../db");
const { sendUDPAlert } = require("../udpServer");
const { requireAuth, requireRole } = require("../middleware/auth");

router.use(requireAuth);

function toAlert(alert) {
  const { _id, ...fields } = alert;
  return { ...fields, id: _id.toString() };
}

router.post("/", requireRole("admin"), async (req, res) => {
  try {
    const { title, message, priority = "HIGH" } = req.body;
    if (!title || !message || title.length > 255 || message.length > 10_000) {
      return res.status(400).json({ success: false, message: "Title and message are required and must be within the allowed length." });
    }
    if (!["HIGH", "MEDIUM", "LOW"].includes(priority)) return res.status(400).json({ success: false, message: "Invalid priority." });

    const alerts = await db.alerts;
    const createdAt = new Date();
    const result = await alerts.insertOne({ title, message, priority, sender_id: req.user.id, status: "SENDING", created_at: createdAt });
    const alertId = result.insertedId.toString();
    const alertData = { type: "ALERT", alertId, title, message, priority, timestamp: createdAt.toISOString() };
    const udpResult = await sendUDPAlert(alertData);
    const devices = await db.devices;
    const connectedBrowserClients = await devices.countDocuments({ status: "ONLINE", connection_type: "HTTP" });
    const delivered = udpResult.success || connectedBrowserClients > 0;
    const status = delivered ? "SENT" : "FAILED";
    await alerts.updateOne({ _id: result.insertedId }, { $set: { status } });

    res.status(201).json({
      success: delivered,
      message: delivered ? "Alert sent successfully." : "No devices received the alert.",
      alert: { id: alertId, title, message, priority, status, timestamp: alertData.timestamp },
      udp: { ...udpResult, browserClients: connectedBrowserClients }
    });
  } catch (error) {
    console.error("Create alert error:", error.message);
    res.status(500).json({ success: false, message: "Failed to create alert.", error: error.message });
  }
});

router.get("/", async (req, res) => {
  try {
    const alerts = await db.alerts;
    const records = await alerts.find().sort({ created_at: -1 }).toArray();
    const serialized = records.map(toAlert).map((alert) => ({ ...alert, createdAt: alert.created_at }));
    res.json({ success: true, count: serialized.length, alerts: serialized });
  } catch (error) {
    console.error("Fetch alerts error:", error.message);
    res.status(500).json({ success: false, message: "Failed to fetch alerts." });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const objectId = db.toObjectId(req.params.id);
    const alerts = await db.alerts;
    const alert = objectId ? await alerts.findOne({ _id: objectId }) : null;
    if (!alert) return res.status(404).json({ success: false, message: "Alert not found." });
    res.json({ success: true, alert: toAlert(alert) });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to retrieve alert." });
  }
});

router.post("/:id/ack", requireRole("client"), async (req, res) => {
  try {
    const { deviceId } = req.body;
    if (!deviceId) return res.status(400).json({ success: false, message: "deviceId is required." });
    const objectId = db.toObjectId(req.params.id);
    if (!objectId) return res.status(404).json({ success: false, message: "Alert not found." });

    const alerts = await db.alerts;
    if (!(await alerts.findOne({ _id: objectId }, { projection: { _id: 1 } }))) {
      return res.status(404).json({ success: false, message: "Alert not found." });
    }
    const alertLogs = await db.alertLogs;
    await alertLogs.insertOne({ alert_id: objectId, device_id: deviceId, action: "ACK", timestamp: new Date() });
    await alerts.updateOne({ _id: objectId }, { $set: { status: "ACKNOWLEDGED" } });
    res.json({ success: true, message: "Alert acknowledged.", alertId: req.params.id, deviceId, status: "ACKNOWLEDGED" });
  } catch (error) {
    console.error("ACK error:", error.message);
    res.status(500).json({ success: false, message: "Failed to acknowledge alert." });
  }
});

router.delete("/:id", requireRole("admin"), async (req, res) => {
  try {
    const objectId = db.toObjectId(req.params.id);
    const alerts = await db.alerts;
    const result = objectId ? await alerts.deleteOne({ _id: objectId }) : { deletedCount: 0 };
    if (!result.deletedCount) return res.status(404).json({ success: false, message: "Alert not found." });
    res.json({ success: true, message: "Alert deleted successfully." });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to delete alert." });
  }
});

module.exports = router;