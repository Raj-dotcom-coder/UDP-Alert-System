const express = require("express");
const router = express.Router();
const db = require("../db");
const { getDevices } = require("../udpServer");
const { requireAuth, requireRole } = require("../middleware/auth");

router.use(requireAuth);

function toDevice(device) {
  const { _id, ...fields } = device;
  return {
    ...fields,
    id: _id.toString(),
    deviceId: fields.device_id,
    ip: fields.ip_address,
    port: fields.udp_port,
    lastSeen: fields.last_seen,
    connectionType: fields.connection_type
  };
}

// Background cleanup: mark HTTP devices OFFLINE if no heartbeat in 30 seconds
setInterval(async () => {
  try {
    const cutoff = new Date(Date.now() - 30_000);
    const devicesCollection = await db.devices;
    await devicesCollection.updateMany(
      { connection_type: "HTTP", status: "ONLINE", last_seen: { $lt: cutoff } },
      { $set: { status: "OFFLINE" } }
    );
  } catch (err) {
    // suppress background cleanup errors
  }
}, 15_000);

router.post("/connect", requireRole("admin", "client"), async (req, res) => {
  try {
    const rawDeviceId = req.body?.deviceId?.trim();
    const deviceId = rawDeviceId || `web-${req.user.id}`;
    const deviceName = req.body?.deviceName?.trim() || `${req.user.username} device`;
    const lastSeen = new Date();
    const clientIp = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.ip || req.socket?.remoteAddress || "127.0.0.1";

    const deviceData = {
      device_id: deviceId,
      user_id: req.user.id,
      username: req.user.username,
      name: deviceName,
      ip_address: clientIp,
      udp_port: null,
      connection_type: "HTTP",
      status: "ONLINE",
      last_seen: lastSeen
    };

    const devices = await db.devices;
    await devices.updateOne(
      { device_id: deviceId },
      { $set: deviceData, $setOnInsert: { created_at: lastSeen } },
      { upsert: true }
    );

    res.json({
      success: true,
      message: `Device "${deviceName}" connected to alert network.`,
      device: {
        deviceId,
        name: deviceName,
        ip: clientIp,
        connectionType: "HTTP",
        status: "ONLINE",
        lastSeen: lastSeen.toISOString()
      }
    });
  } catch (error) {
    console.error("Client connect error:", error.message);
    res.status(500).json({ success: false, message: "Failed to connect client device." });
  }
});

router.post("/heartbeat", requireRole("admin", "client"), async (req, res) => {
  try {
    const rawDeviceId = req.body?.deviceId?.trim();
    const deviceId = rawDeviceId || `web-${req.user.id}`;
    const deviceName = req.body?.deviceName?.trim() || `${req.user.username} device`;
    const clientIp = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.ip || req.socket?.remoteAddress || "127.0.0.1";
    const lastSeen = new Date();

    const devices = await db.devices;
    const result = await devices.updateOne(
      { device_id: deviceId },
      {
        $set: {
          status: "ONLINE",
          last_seen: lastSeen,
          ip_address: clientIp,
          name: deviceName
        }
      }
    );

    // If device was not registered yet (e.g. server restarted), register it automatically
    if (!result.matchedCount) {
      await devices.updateOne(
        { device_id: deviceId },
        {
          $set: {
            device_id: deviceId,
            user_id: req.user.id,
            username: req.user.username,
            name: deviceName,
            ip_address: clientIp,
            udp_port: null,
            connection_type: "HTTP",
            status: "ONLINE",
            last_seen: lastSeen
          },
          $setOnInsert: { created_at: lastSeen }
        },
        { upsert: true }
      );
    }

    res.json({ success: true, status: "ONLINE", lastSeen: lastSeen.toISOString() });
  } catch (error) {
    console.error("Client heartbeat error:", error.message);
    res.status(500).json({ success: false, message: "Failed to update client heartbeat." });
  }
});

router.post("/disconnect", requireRole("admin", "client"), async (req, res) => {
  try {
    const rawDeviceId = req.body?.deviceId?.trim();
    const deviceId = rawDeviceId || `web-${req.user.id}`;
    const devices = await db.devices;
    await devices.updateOne(
      { device_id: deviceId },
      { $set: { status: "OFFLINE", last_seen: new Date() } }
    );
    res.json({ success: true, status: "OFFLINE" });
  } catch (error) {
    console.error("Client disconnect error:", error.message);
    res.status(500).json({ success: false, message: "Failed to disconnect client device." });
  }
});

router.get("/", async (req, res) => {
  try {
    const devices = await db.devices;
    const records = await devices.find().sort({ status: -1, last_seen: -1 }).toArray();
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
    const query = objectId ? { $or: [{ _id: objectId }, { device_id: req.params.id }] } : { device_id: req.params.id };
    const device = await devices.findOne(query);
    if (!device) return res.status(404).json({ success: false, message: "Device not found." });
    res.json({ success: true, device: toDevice(device) });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to retrieve device." });
  }
});

router.delete("/:id", requireRole("admin", "client"), async (req, res) => {
  try {
    const objectId = db.toObjectId(req.params.id);
    const devices = await db.devices;
    const query = objectId ? { $or: [{ _id: objectId }, { device_id: req.params.id }] } : { device_id: req.params.id };
    const result = await devices.deleteOne(query);
    if (!result.deletedCount) return res.status(404).json({ success: false, message: "Device not found." });
    res.json({ success: true, message: "Device removed successfully." });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to delete device." });
  }
});

module.exports = router;
