const express = require("express");
const router = express.Router();
const db = require("../db");
const { sendUDPAlert } = require("../udpServer");
const { requireAuth, requireRole } = require("../middleware/auth");

router.use(requireAuth);

function toAlert(alert, acks = []) {
  const { _id, ...fields } = alert;
  const alertId = _id.toString();
  const alertAcks = acks.filter((item) => item.alert_id?.toString() === alertId);
  return {
    ...fields,
    id: alertId,
    createdAt: fields.created_at,
    acknowledgedDeviceIds: alertAcks.map((item) => item.device_id),
    acknowledgements: alertAcks.map((item) => ({
      deviceId: item.device_id,
      deviceName: item.device_name || item.device_id,
      username: item.username,
      timestamp: item.timestamp
    })),
    totalAcks: alertAcks.length
  };
}

router.post("/", requireRole("admin", "client"), async (req, res) => {
  try {
    const { title, message, priority = "HIGH" } = req.body;
    if (!title || !message || title.length > 255 || message.length > 10_000) {
      return res.status(400).json({ success: false, message: "Title and message are required and must be within the allowed length." });
    }
    if (!["HIGH", "MEDIUM", "LOW"].includes(priority)) {
      return res.status(400).json({ success: false, message: "Invalid priority." });
    }

    const alerts = await db.alerts;
    const createdAt = new Date();
    const result = await alerts.insertOne({
      title,
      message,
      priority,
      sender_id: req.user.id,
      sender_username: req.user.username,
      status: "SENT",
      created_at: createdAt
    });

    const alertId = result.insertedId.toString();
    const alertData = {
      type: "ALERT",
      alertId,
      title,
      message,
      priority,
      timestamp: createdAt.toISOString()
    };

    // Broadcast over UDP socket to any native IoT / laptop UDP clients
    const udpResult = await sendUDPAlert(alertData);

    const devices = await db.devices;
    const connectedBrowserClients = await devices.countDocuments({
      status: "ONLINE",
      connection_type: "HTTP"
    });

    res.status(201).json({
      success: true,
      message: `Alert broadcast successfully (${connectedBrowserClients} browser client(s), ${udpResult.sent || 0} UDP device(s) online).`,
      alert: {
        id: alertId,
        title,
        message,
        priority,
        status: "SENT",
        createdAt: createdAt.toISOString(),
        acknowledgedDeviceIds: [],
        acknowledgements: [],
        totalAcks: 0
      },
      stats: {
        browserClients: connectedBrowserClients,
        udpAttempted: udpResult.attempted || 0,
        udpSent: udpResult.sent || 0
      }
    });
  } catch (error) {
    console.error("Create alert error:", error.message);
    res.status(500).json({ success: false, message: "Failed to create alert.", error: error.message });
  }
});

router.get("/", async (req, res) => {
  try {
    const alerts = await db.alerts;
    const alertLogs = await db.alertLogs;

    const [records, acks] = await Promise.all([
      alerts.find().sort({ created_at: -1 }).toArray(),
      alertLogs.find({ action: "ACK" }).toArray()
    ]);

    const serialized = records.map((record) => toAlert(record, acks));
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

    const alertLogs = await db.alertLogs;
    const acks = await alertLogs.find({ alert_id: objectId, action: "ACK" }).toArray();

    res.json({ success: true, alert: toAlert(alert, acks) });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to retrieve alert." });
  }
});

router.post("/:id/ack", requireRole("admin", "client"), async (req, res) => {
  try {
    const { deviceId, deviceName } = req.body;
    if (!deviceId) return res.status(400).json({ success: false, message: "deviceId is required." });
    const objectId = db.toObjectId(req.params.id);
    if (!objectId) return res.status(404).json({ success: false, message: "Alert not found." });

    const alerts = await db.alerts;
    const alert = await alerts.findOne({ _id: objectId });
    if (!alert) {
      return res.status(404).json({ success: false, message: "Alert not found." });
    }

    const alertLogs = await db.alertLogs;
    // Record ACK log for this specific device
    await alertLogs.updateOne(
      { alert_id: objectId, device_id: deviceId },
      {
        $set: {
          alert_id: objectId,
          device_id: deviceId,
          device_name: deviceName || deviceId,
          username: req.user.username,
          action: "ACK",
          timestamp: new Date()
        }
      },
      { upsert: true }
    );

    // Check count of acknowledgements vs online devices
    const devices = await db.devices;
    const onlineDevices = await devices.find({ status: "ONLINE" }).toArray();
    const ackLogs = await alertLogs.find({ alert_id: objectId, action: "ACK" }).toArray();
    const ackedDeviceIds = new Set(ackLogs.map((l) => l.device_id));

    const allAcked = onlineDevices.length > 0 && onlineDevices.every((d) => ackedDeviceIds.has(d.device_id));
    const newStatus = allAcked ? "ACKNOWLEDGED" : "PARTIALLY_ACKNOWLEDGED";
    await alerts.updateOne({ _id: objectId }, { $set: { status: newStatus } });

    res.json({
      success: true,
      message: `Alert acknowledged by device "${deviceName || deviceId}".`,
      alertId: req.params.id,
      deviceId,
      status: newStatus,
      totalAcks: ackLogs.length
    });
  } catch (error) {
    console.error("ACK error:", error.message);
    res.status(500).json({ success: false, message: "Failed to acknowledge alert." });
  }
});

// Admin/Client resolve/dismiss alert
router.post("/:id/resolve", requireRole("admin", "client"), async (req, res) => {
  try {
    const objectId = db.toObjectId(req.params.id);
    const alerts = await db.alerts;
    const result = await alerts.updateOne({ _id: objectId }, { $set: { status: "RESOLVED" } });
    if (!result.matchedCount) return res.status(404).json({ success: false, message: "Alert not found." });
    res.json({ success: true, message: "Alert marked as RESOLVED across all devices." });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to resolve alert." });
  }
});

router.delete("/:id", requireRole("admin", "client"), async (req, res) => {
  try {
    const objectId = db.toObjectId(req.params.id);
    const alerts = await db.alerts;
    const result = objectId ? await alerts.deleteOne({ _id: objectId }) : { deletedCount: 0 };
    if (!result.deletedCount) return res.status(404).json({ success: false, message: "Alert not found." });

    // Also remove logs
    const alertLogs = await db.alertLogs;
    await alertLogs.deleteMany({ alert_id: objectId });

    res.json({ success: true, message: "Alert deleted successfully." });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to delete alert." });
  }
});

module.exports = router;
