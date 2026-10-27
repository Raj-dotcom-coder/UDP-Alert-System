const express = require("express");
const cors = require("cors");
const authRoutes = require("./routes/auth");
const alertRoutes = require("./routes/alerts");
const deviceRoutes = require("./routes/devices");
const { connectDatabase, closeDatabase, users, devices, alerts, alertLogs } = require("./db");

async function runTest() {
  console.log("=== STARTING MULTI-DEVICE CLIENT INTERFACE TEST ===");

  await connectDatabase();

  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use("/api/auth", authRoutes);
  app.use("/api/alerts", alertRoutes);
  app.use("/api/devices", deviceRoutes);

  const server = app.listen(5099, "127.0.0.1");
  const baseUrl = "http://127.0.0.1:5099/api";

  try {
    // 1. Log in as client
    console.log("\n1. Logging in with shared client credentials (client / Client@123)...");
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "client", password: "Client@123", role: "client" })
    });
    const loginData = await loginRes.json();
    if (!loginData.success || !loginData.token) throw new Error("Client login failed: " + JSON.stringify(loginData));
    const token = loginData.token;
    console.log("✓ Logged in successfully. Token acquired.");

    // 2. Connect Device 1 (Security Mobile)
    console.log("\n2. Connecting Device 1 (ID: DEV-PHONE-01, Name: Security Mobile)...");
    const dev1Connect = await fetch(`${baseUrl}/devices/connect`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ deviceId: "DEV-PHONE-01", deviceName: "Security Mobile" })
    });
    const dev1Data = await dev1Connect.json();
    console.log("✓ Device 1 connected:", dev1Data.device?.name, "(Status:", dev1Data.device?.status, ")");

    // 3. Connect Device 2 (Reception PC) using the SAME client token
    console.log("\n3. Connecting Device 2 (ID: DEV-LAPTOP-02, Name: Reception PC) with same credentials...");
    const dev2Connect = await fetch(`${baseUrl}/devices/connect`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ deviceId: "DEV-LAPTOP-02", deviceName: "Reception PC" })
    });
    const dev2Data = await dev2Connect.json();
    console.log("✓ Device 2 connected:", dev2Data.device?.name, "(Status:", dev2Data.device?.status, ")");

    // 4. Verify both devices are registered and ONLINE
    console.log("\n4. Verifying device registry...");
    const devListRes = await fetch(`${baseUrl}/devices`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const devListData = await devListRes.json();
    const onlineDevs = devListData.devices.filter(d => d.status === "ONLINE");
    console.log(`✓ Total registered devices: ${devListData.devices.length}, Online devices: ${onlineDevs.length}`);
    const dev1Found = devListData.devices.find(d => d.deviceId === "DEV-PHONE-01");
    const dev2Found = devListData.devices.find(d => d.deviceId === "DEV-LAPTOP-02");
    if (!dev1Found || !dev2Found) throw new Error("Both devices should be independently present in the registry!");
    console.log(`✓ Confirmed distinct devices: "${dev1Found.name}" and "${dev2Found.name}"`);

    // 5. Admin logs in and creates an alert
    console.log("\n5. Admin creates an alert...");
    const adminLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "admin", password: "Admin@123", role: "admin" })
    });
    const adminLoginData = await adminLoginRes.json();
    const adminToken = adminLoginData.token;

    const createAlertRes = await fetch(`${baseUrl}/alerts`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ title: "Evacuation Drill", message: "Please evacuate via Staircase B", priority: "HIGH" })
    });
    const createAlertData = await createAlertRes.json();
    const alertId = createAlertData.alert.id;
    console.log("✓ Alert broadcast created. ID:", alertId, "Status:", createAlertData.alert.status);

    // 6. Device 1 fetches alerts and acknowledges
    console.log("\n6. Device 1 acknowledging alert...");
    const dev1AckRes = await fetch(`${baseUrl}/alerts/${alertId}/ack`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ deviceId: "DEV-PHONE-01", deviceName: "Security Mobile" })
    });
    const dev1AckData = await dev1AckRes.json();
    console.log("✓ Device 1 ACK result:", dev1AckData.message, "(Alert status:", dev1AckData.status, ")");

    // 7. Device 2 fetches alerts - verify it still sees the active alert and can acknowledge it!
    console.log("\n7. Device 2 checking alerts...");
    const dev2AlertsRes = await fetch(`${baseUrl}/alerts`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const dev2AlertsData = await dev2AlertsRes.json();
    const alertForDev2 = dev2AlertsData.alerts.find(a => a.id === alertId);
    console.log("✓ Alert available to Device 2:", !!alertForDev2);
    console.log("  Acknowledged by Device 1?", alertForDev2.acknowledgedDeviceIds.includes("DEV-PHONE-01"));
    console.log("  Acknowledged by Device 2?", alertForDev2.acknowledgedDeviceIds.includes("DEV-LAPTOP-02"));

    if (alertForDev2.acknowledgedDeviceIds.includes("DEV-LAPTOP-02")) {
      throw new Error("Device 2 should NOT be marked as acknowledged yet!");
    }

    // Device 2 acknowledges
    console.log("\n8. Device 2 acknowledging alert...");
    const dev2AckRes = await fetch(`${baseUrl}/alerts/${alertId}/ack`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ deviceId: "DEV-LAPTOP-02", deviceName: "Reception PC" })
    });
    const dev2AckData = await dev2AckRes.json();
    console.log("✓ Device 2 ACK result:", dev2AckData.message, "(Alert status:", dev2AckData.status, ")");

    // 9. Admin checks alert status and sees both devices acknowledged
    console.log("\n9. Admin verifying alert acknowledgements across all devices...");
    const adminAlertsRes = await fetch(`${baseUrl}/alerts`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const adminAlertsData = await adminAlertsRes.json();
    const finalAlert = adminAlertsData.alerts.find(a => a.id === alertId);
    console.log(`✓ Total ACKs recorded: ${finalAlert.totalAcks}`);
    console.log("  Acknowledging devices:", finalAlert.acknowledgements.map(a => `${a.deviceName} (${a.deviceId})`).join(", "));

    if (finalAlert.totalAcks !== 2) {
      throw new Error(`Expected 2 ACKs, got ${finalAlert.totalAcks}`);
    }

    console.log("\n=== ALL MULTI-DEVICE CLIENT TESTS PASSED SUCCESSFULLY! ===");
  } finally {
    server.close();
    await closeDatabase();
    process.exit(0);
  }
}

runTest().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
