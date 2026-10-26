const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const alertRoutes = require('./routes/alerts');
const deviceRoutes = require('./routes/devices');
const { connectDatabase, closeDatabase } = require('./db');
const { startUDPServer, stopUDPServer } = require('./udpServer');

const app = express();
const corsOrigins = process.env.CORS_ORIGIN
	?.split(',')
	.map((origin) => origin.trim())
	.filter(Boolean);
app.use(cors(corsOrigins?.length ? { origin: corsOrigins } : {}));
app.use(express.json({ limit: '32kb' }));
const udpEnabled = process.env.DISABLE_UDP_SERVER !== 'true';

app.get('/', (req, res) => {
	res.json({
		success: true,
		message: 'UDP Alert System Backend is running.',
		services: {
			http: 'Running',
			udp: udpEnabled ? 'Running' : 'Disabled by deployment configuration',
			database: 'MongoDB'
		},
		udpPort: Number(process.env.UDP_PORT || 41234)
	});
});

app.use('/api/auth', authRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/devices', deviceRoutes);

app.use((req, res) => {
	res.status(404).json({ success: false, message: 'API endpoint not found.' });
});

const HTTP_PORT = Number(process.env.PORT || process.env.HTTP_PORT || 5000);
connectDatabase()
	.then(() => {
		if (udpEnabled) startUDPServer();
		app.listen(HTTP_PORT, '0.0.0.0', () => {
			console.log(`HTTP API Server running on port ${HTTP_PORT}`);
		});
	})
	.catch((error) => {
		console.error(`MongoDB startup failed: ${error.message}`);
		process.exitCode = 1;
	});

async function shutdown(signal) {
	console.log(`${signal} received. Shutting down.`);
	stopUDPServer();
	await closeDatabase();
	process.exit(0);
}

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));
