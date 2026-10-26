const express = require("express");
const router = express.Router();
const db = require("../db");
const { getDevices } = require("../udpServer");
const { requireAuth, requireRole } = require("../middleware/auth");

router.use(requireAuth);

function toDevice(device) {
  const { _id, ...fields } = device;
  return { ...fields, id: _id.toString(), ip: fields.ip_address, port: fields.udp_port, lastSeen: fields.last_seen };
}

router.post("/connect", requireRole("client"), async (req, res) => {
  try {
    const deviceId = `web-${req.user.id}`;
    const lastSeen = new Date();
    const device = {
      device_id: deviceId,
      user_id: req.user.id,
      name: `${req.user.username} browser`,
      ip_address: req.ip,
      udp_port: null,
      connection_type: "HTTP",
      status: "ONLINE",
      last_seen: lastSeen
    };
    const devices = await db.devices;
    await devices.updateOne(
      { device_id: deviceId },
      { $set: device, $setOnInsert: { created_at: lastSeen } },
      { upsert: true }
    );
    res.json({
      success: true,
      message: `Welcome, ${device.name}. Your device is connected and ready to receive alerts.`,
      device: { deviceId, name: device.name, ip: device.ip_address, connectionType: device.connection_type, status: device.status, lastSeen }
    });
  } catch (error) {
    console.error("Client connect error:", error.message);
    res.status(500).json({ success: false, message: "Failed to connect client dashboard." });
  }
});

router.post("/heartbeat", requireRole("client"), async (req, res) => {
  try {
    const devices = await db.devices;
    const result = await devices.updateOne(
      { device_id: `web-${req.user.id}`, connection_type: "HTTP" },
      { $set: { status: "ONLINE", last_seen: new Date(), ip_address: req.ip } }
    );
    if (!result.matchedCount) return res.status(409).json({ success: false, message: "Connect this client before sending heartbeats." });
    res.json({ success: true, status: "ONLINE" });
  } catch (error) {
    console.error("Client heartbeat error:", error.message);
    res.status(500).json({ success: false, message: "Failed to update client connection." });
  }
});

router.post("/disconnect", requireRole("client"), async (req, res) => {
  try {
    const devices = await db.devices;
    await devices.updateOne(
      { device_id: `web-${req.user.id}`, connection_type: "HTTP" },
      { $set: { status: "OFFLINE", last_seen: new Date() } }
    );
    res.json({ success: true, status: "OFFLINE" });
  } catch (error) {
    console.error("Client disconnect error:", error.message);
    res.status(500).json({ success: false, message: "Failed to disconnect client dashboard." });
  }
});

router.get("/", async (req, res) => {
  try {
    const devices = await db.devices;
    const records = await devices.find().sort({ last_seen: -1 }).toArray();
    res.json({ success: true, count: records.length, devices: records.map(toDevice) });
  } catch (error) {
    console.error("Device fetch error:", error.message);
    res.status(500).json({ success: false, message: "Failed to fetch devices." });
  }
});

router.get("/online", (req, res) => {
  const devices = getDevices();
  res.json({ success: true, count: devices.length, devices });
});

router.get("/:id", async (req, res) => {
  try {
    const objectId = db.toObjectId(req.params.id);
    const devices = await db.devices;
    const device = objectId ? await devices.findOne({ _id: objectId }) : null;
    if (!device) return res.status(404).json({ success: false, message: "Device not found." });
    res.json({ success: true, device: toDevice(device) });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to retrieve device." });
  }
});

router.delete("/:id", requireRole("admin"), async (req, res) => {
  try {
    const objectId = db.toObjectId(req.params.id);
    const devices = await db.devices;
    const result = objectId ? await devices.deleteOne({ _id: objectId }) : { deletedCount: 0 };
    if (!result.deletedCount) return res.status(404).json({ success: false, message: "Device not found." });
    res.json({ success: true, message: "Device removed successfully." });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to delete device." });
  }
});

module.exports = router;