require("dotenv").config();

const express = require("express");
const http = require("http");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");

const connectDB = require("./src/config/db");
const { initSocket } = require("./src/socket/socketHandler");

// Routes
const authRoutes = require("./src/routes/auth");
const userRoutes = require("./src/routes/user");
const discoverRoutes = require("./src/routes/discover");
const matchRoutes = require("./src/routes/matches");
const chatRoutes = require("./src/routes/chat");
const tripRoutes = require("./src/routes/trips");
const notificationRoutes = require("./src/routes/notification");

const app = express();
const server = http.createServer(app);

// Connect MongoDB
connectDB();

// Initialize socket
initSocket(server);

// ── Global Request Logger (ABSOLUTE TOP) ──────────────────────
app.use((req, res, next) => {
  const logPrefix = `[${new Date().toISOString()}] ${req.method} ${req.url}`;
  
  if (req.method === 'OPTIONS') {
    console.log(`${logPrefix} - Preflight Headers:`, req.headers);
  } else {
    console.log(`${logPrefix} - Size: ${req.headers['content-length'] || 0} bytes`);
  }
  
  if (req.headers['content-type']?.includes('multipart/form-data')) {
    console.log('[DEBUG] MULTIPART Headers:', req.headers);
  }
  next();
});

// Security (Temporarily disabled for debugging)
// app.use(helmet());

app.use(
  cors({
    // Reflect origin to allow credentials (e.g. cookies/headers) from any device
    origin: true,
    credentials: true,
  })
);

// ── Test Routes (after CORS) ──────────────────────────────────
app.get("/api/test", (req, res) => {
  res.json({ 
    message: "API IS REACHABLE (GET)", 
    time: new Date().toISOString(),
    env: process.env.NODE_ENV
  });
});

app.post("/api/test-upload", (req, res) => {
  res.json({ message: "API IS REACHABLE (POST)", body: req.body });
});

// Rate limit

// Body parsing
// (Move logger before everything else)

// Rate limit
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === "development" ? 10000 : 100,
});

app.use("/api/", limiter);

// Body parsing
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Logging
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

// Health route
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    app: "TravelHolic API",
  });
});

// Routes
app.use("/api/auth", authRoutes);
app.post("/api/update-location", require("./src/middleware/auth").protect, require("./src/controllers/userController").updateLocation);
app.get("/api/nearby-users", require("./src/middleware/auth").protect, require("./src/controllers/discoverController").getDiscoverProfiles);
app.use("/api/user", userRoutes);
app.use("/api/discover", discoverRoutes);
app.use("/api/matches", matchRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/trips", tripRoutes);
app.use("/api/notifications", notificationRoutes);

// 404
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('❌ [SERVER ERROR]', err);
  if (err.name === 'MulterError') {
    console.error('📦 [MULTER ERROR DETAILS]:', JSON.stringify(err, null, 2));
    return res.status(400).json({ error: `Upload error: ${err.message}` });
  }
  res.status(500).json({ error: err.message || "Server error" });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 TravelHolic Server running on port ${PORT}`);
  console.log(`📡 Environment: ${process.env.NODE_ENV}`);
});