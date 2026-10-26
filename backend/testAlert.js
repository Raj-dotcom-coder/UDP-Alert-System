const dgram = require('dgram');

const targetIp = process.env.TARGET_IP || '127.0.0.1';
const targetPort = Number(process.env.TARGET_PORT || 41234);
const deviceId = process.env.DEVICE_ID || 'LAPTOP-DEVICE-01';
const deviceName = process.env.DEVICE_NAME || 'Laptop Device';

const socket = dgram.createSocket('udp4');
const payload = {
  type: 'ALERT',
  alertId: `test-${Date.now()}`,
  title: 'UDP Test Alert',
  message: `This is a test alert sent to ${targetIp}:${targetPort}.`,
  priority: 'HIGH',
  senderId: 'system',
  timestamp: new Date().toISOString()
};

socket.on('error', (error) => {
  console.error('Test alert socket error:', error.message);
  socket.close();
  process.exit(1);
});

socket.send(Buffer.from(JSON.stringify(payload)), targetPort, targetIp, (error) => {
  if (error) {
    console.error('Failed to send test alert:', error.message);
    socket.close();
    process.exit(1);
  }

  console.log(`Test alert sent to ${targetIp}:${targetPort}`);
  console.log(JSON.stringify({ deviceId, deviceName, payload }, null, 2));
  socket.close();
});
