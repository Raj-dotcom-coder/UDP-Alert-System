require("dotenv").config();

const { MongoClient, ObjectId } = require("mongodb");
const { MongoMemoryServer } = require("mongodb-memory-server");
const bcrypt = require("bcryptjs");

const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017";
const mongoDatabase = process.env.MONGODB_DB || "udp_alert_system";
const mongoMemoryVersion = process.env.MONGOMS_VERSION || "7.0.14";
let client = new MongoClient(mongoUri);
let databasePromise;
let memoryServer;

async function startMemoryDatabase() {
  if (memoryServer) return memoryServer;

  memoryServer = await MongoMemoryServer.create({
    binary: { version: mongoMemoryVersion },
    instance: { dbName: mongoDatabase }
  });

  client = new MongoClient(memoryServer.getUri());
  console.log("Falling back to an in-memory MongoDB instance.");
  return memoryServer;
}

async function getDatabase() {
  if (!databasePromise) {
    databasePromise = (async () => {
      try {
        await client.connect();
        console.log("MongoDB database connected successfully.");
        return client.db(mongoDatabase);
      } catch (error) {
        console.warn("Primary MongoDB connection failed. Trying in-memory fallback...");
        await startMemoryDatabase();
        await client.connect();
        console.log("MongoDB database connected successfully using in-memory fallback.");
        return client.db(mongoDatabase);
      }
    })();
  }

  return databasePromise;
}

function getCollection(name) {
  return getDatabase().then((database) => database.collection(name));
}

function toObjectId(id) {
  return ObjectId.isValid(id) ? new ObjectId(id) : null;
}

async function ensureAdminUser() {
  const production = process.env.NODE_ENV === "production";
  if (production && (!process.env.ADMIN_USERNAME || !process.env.ADMIN_PASSWORD)) {
    throw new Error("Production requires ADMIN_USERNAME and ADMIN_PASSWORD.");
  }

  const username = process.env.ADMIN_USERNAME || "admin";
  const password = process.env.ADMIN_PASSWORD || "Admin@123";
  const users = await getCollection("users");
  const existingUser = await users.findOne({ username }, { projection: { _id: 1 } });

  if (existingUser) return;

  const passwordHash = await bcrypt.hash(password, 12);
  await users.insertOne({
    username,
    password: passwordHash,
    role: "admin",
    created_at: new Date()
  });
  console.log(`Built-in admin user created: ${username}`);
}

async function connectDatabase() {
  const database = await getDatabase();
  await Promise.all([
    database.collection("users").createIndex({ username: 1 }, { unique: true }),
    database.collection("devices").createIndex({ device_id: 1 }, { unique: true }),
    database.collection("alerts").createIndex({ created_at: -1 }),
    database.collection("alert_logs").createIndex({ alert_id: 1 })
  ]);
  await ensureAdminUser();
}

async function closeDatabase() {
  if (databasePromise && client) {
    await client.close();
  }

  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = undefined;
  }

  databasePromise = undefined;
  client = new MongoClient(mongoUri);
}

module.exports = {
  users: getCollection("users"),
  devices: getCollection("devices"),
  alerts: getCollection("alerts"),
  alertLogs: getCollection("alert_logs"),
  connectDatabase,
  closeDatabase,
  toObjectId
};