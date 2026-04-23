require("dotenv").config();

const express = require("express");
const http = require("http");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const path = require("path");

const connectDB = require("./src/config/db");
const { initSocket } = require("./src/socket/socketHandler");
const { initNotificationWorker } = require("./src/utils/queueService");

// Routes
const authRoutes = require("./src/routes/auth");
const userRoutes = require("./src/routes/user");
const discoverRoutes = require("./src/routes/discover");
const matchRoutes = require("./src/routes/matches");
const chatRoutes = require("./src/routes/chat");
const tripRoutes = require("./src/routes/trips");
const notificationRoutes = require("./src/routes/notification");
const aiRoutes = require("./src/routes/ai");
const waitlistRoutes = require("./src/routes/waitlist");
const placeRoutes = require("./src/routes/places");
const itineraryRoutes = require("./src/routes/itinerary");
const feedRoutes = require("./src/routes/feedRoutes");
const storyRoutes = require("./src/routes/storyRoutes");
const commentRoutes = require("./src/routes/commentRoutes");
const imageRoutes = require("./src/routes/imageRoutes");
const checklistRoutes = require("./src/routes/checklistRoutes");
const adminRoutes = require("./src/routes/adminRoutes");


const app = express();
const server = http.createServer(app);

// Connect MongoDB
connectDB();

// Initialize Socket.io
initSocket(server);

// Initialize Background Worker
initNotificationWorker();

// --- Rate Limiting Configuration ---
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: { error: "Too many requests, please try again later." }
});

const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20, // 20 attempts per hour
  message: { error: "Too many login/register attempts. Please try again after an hour." }
});

const chatLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 40, // 40 messages per minute
  message: { error: "You are sending messages too fast. Slow down!" }
});

const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Route not found' }  // Generic — hides admin existence
});

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

// ── Main Home Route ──────────────────────────────────────────
app.get("/", (req, res) => {
  res.json({ 
    message: "EkalGo Backend API is LIVE 🚀",
    status: "Active",
    time: new Date().toISOString()
  });
});

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

// Body parsing
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// ── Feature Routes (Discovery & Itinerary) ────────────────────
console.log('🛣️  Registering Discovery & Itinerary routes...');
app.use("/api/places", placeRoutes);
app.use("/api/itinerary", itineraryRoutes);
console.log('✅ Discovery & Itinerary routes READY');

// Logging
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

// Health route
app.get("/health", async (req, res) => {
  const health = {
    status: "OK",
    app: "EkalGo API",
    time: new Date().toISOString(),
    redis: 'unknown'
  };

  try {
     const { getRedisStatus } = require('./src/utils/queueService');
     health.redis = getRedisStatus();
  } catch (e) {
     health.redis = 'error';
  }

  const statusCode = (health.redis === 'connected' || health.redis === 'disabled' || health.redis === 'not_initialized') ? 200 : 207;
  res.status(statusCode).json(health);
});

// ── UNIVERSAL DEEP LINKING (AASA / ASSETLINKS) ────────────────
app.use('/.well-known', express.static(path.join(__dirname, 'public/.well-known')));

// ── STATIC FRONTEND SERVING ───────────────────────────────────
// This handles the Web App build
const webBuildPath = path.join(__dirname, '../frontend/web-build');
app.use(express.static(webBuildPath));

// Other Routes
app.use("/api/auth", authLimiter, authRoutes);
app.post("/api/update-location", require("./src/middleware/auth").protect, require("./src/controllers/userController").updateLocation);
app.get("/api/nearby-users", require("./src/middleware/auth").protect, require("./src/controllers/discoverController").getDiscoverProfiles);
app.use("/api/user", apiLimiter, userRoutes);
app.use("/api/discover", apiLimiter, discoverRoutes);
app.use("/api/matches", apiLimiter, matchRoutes);
app.use("/api/chat", chatLimiter, chatRoutes);
app.use("/api/trips", apiLimiter, tripRoutes);
app.use("/api/notifications", apiLimiter, notificationRoutes);
app.use("/api/ai", apiLimiter, aiRoutes);
app.use("/api/waitlist", waitlistRoutes);
app.use("/api/feed", apiLimiter, feedRoutes);
app.use("/api/stories", apiLimiter, storyRoutes);
app.use("/api/comments", chatLimiter, commentRoutes);
app.use("/api/images", apiLimiter, imageRoutes);
app.use("/api/checklists", checklistRoutes);
app.use("/api/admin", adminLimiter, adminRoutes);


// 🛡️ CATCH-ALL ROUTE (MUST BE LAST)
// Redirects any non-API web request to index.html for SPA support
app.get('*', (req, res) => {
  if (req.url.startsWith('/api')) {
    return res.status(404).json({ error: "API Route not found" });
  }
  res.sendFile(path.join(webBuildPath, 'index.html'), (err) => {
    if (err) {
      // Fallback if frontend is not built
      res.status(200).send(`
        <!DOCTYPE html>
        <html>
          <head><title>EkalGo | AI Travel Architect</title></head>
          <body style="background:#000; color:#fff; display:flex; align-items:center; justify-content:center; height:100vh; font-family:sans-serif;">
            <div style="text-align:center;">
              <h1>EkalGo ✨🌍</h1>
              <p>Redirecting to mobile experience...</p>
              <a href="https://ekalgo.com/download" style="color:#00B4B4; text-decoration:none; font-weight:bold;">Download the App Now</a>
            </div>
          </body>
        </html>
      `);
    }
  });
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
  console.log(`🚀 EkalGo Server running on port ${PORT}`);
  console.log(`📡 Environment: ${process.env.NODE_ENV}`);
});