const dgram = require("dgram");
const db = require("./db");

const UDP_PORT = Number(process.env.UDP_PORT || 41234);
const socket = dgram.createSocket("udp4");
const devices = new Map();
let offlineCheck;
let udpStarted = false;

function sendPacket(payload, port, address) {
  return new Promise((resolve, reject) => {
    const message = Buffer.from(JSON.stringify(payload));
    socket.send(message, port, address, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

async function registerDevice(message, remote) {
  const device = {
    deviceId: message.deviceId,
    name: message.deviceName || message.deviceId,
    ipAddress: remote.address,
    port: Number(message.port),
    lastSeen: new Date()
  };

  if (!device.deviceId || !device.port) return;

  devices.set(device.deviceId, device);
  const devicesCollection = await db.devices;
  await devicesCollection.updateOne(
    { device_id: device.deviceId },
    {
      $set: {
        name: device.name,
        ip_address: device.ipAddress,
        udp_port: device.port,
        status: "ONLINE",
        last_seen: device.lastSeen
      },
      $setOnInsert: { created_at: device.lastSeen }
    },
    { upsert: true }
  );

  await sendPacket({
    type: "REGISTER_ACK",
    deviceId: device.deviceId,
    deviceName: device.name,
    message: `Welcome, ${device.name}. Your device is connected and ready to receive alerts.`
  }, device.port, device.ipAddress);
}

async function handleHeartbeat(message, remote) {
  const device = devices.get(message.deviceId);
  if (!device) return registerDevice(message, remote);

  device.lastSeen = new Date();
  device.ipAddress = remote.address;
  const devicesCollection = await db.devices;
  await devicesCollection.updateOne(
    { device_id: device.deviceId },
    { $set: { ip_address: device.ipAddress, status: "ONLINE", last_seen: device.lastSeen } }
  );
}

async function handleAcknowledgement(message) {
  if (!message.alertId || !message.deviceId) return;

  const alertId = db.toObjectId(message.alertId);
  if (!alertId) return;

  const alertLogs = await db.alertLogs;
  await alertLogs.insertOne({ alert_id: alertId, device_id: message.deviceId, action: "ACK", timestamp: new Date() });

  const alerts = await db.alerts;
  await alerts.updateOne({ _id: alertId }, { $set: { status: "ACKNOWLEDGED" } });
}

function handleMessage(buffer, remote) {
  let message;
  try {
    message = JSON.parse(buffer.toString());
  } catch (error) {
    console.error("Invalid UDP packet:", error.message);
    return;
  }

  const operation = message.type === "REGISTER"
    ? registerDevice(message, remote)
    : message.type === "HEARTBEAT"
      ? handleHeartbeat(message, remote)
      : message.type === "ACK"
        ? handleAcknowledgement(message)
        : Promise.resolve();

  operation.catch((error) => console.error("UDP database error:", error.message));
}

function startUDPServer() {
  if (udpStarted) return;
  udpStarted = true;

  socket.on("message", handleMessage);
  socket.bind(UDP_PORT, "0.0.0.0", () => {
    console.log(`UDP server listening on port ${UDP_PORT}`);
  });

  offlineCheck = setInterval(async () => {
    const cutoff = new Date(Date.now() - 60_000);
    const devicesCollection = await db.devices;
    await devicesCollection.updateMany(
      { last_seen: { $lt: cutoff }, status: "ONLINE" },
      { $set: { status: "OFFLINE" } }
    );
    for (const [deviceId, device] of devices) {
      if (device.lastSeen < cutoff) devices.delete(deviceId);
    }
  }, 30_000);
}

function stopUDPServer() {
  if (offlineCheck) clearInterval(offlineCheck);
  if (udpStarted) socket.close();
  udpStarted = false;
}

async function sendUDPAlert(alertData) {
  const targets = [...devices.values()];
  const results = await Promise.allSettled(
    targets.map((device) => sendPacket(alertData, device.port, device.ipAddress))
  );
  const sent = results.filter((result) => result.status === "fulfilled").length;
  return { success: sent > 0, sent, attempted: targets.length };
}

function getDevices() {
  return [...devices.values()].map((device) => ({
    deviceId: device.deviceId,
    name: device.name,
    ip: device.ipAddress,
    port: device.port,
    status: "ONLINE",
    lastSeen: device.lastSeen
  }));
}

module.exports = { sendUDPAlert, getDevices, startUDPServer, stopUDPServer };
