require("dotenv").config();
const express = require("express");
const morgan = require("morgan");
const path = require("path");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const app = express();
const apiRouter = require("./api");
const { router: authRouter } = require("./auth");
const { db } = require("./database");
const cors = require("cors");
const initSocketServer = require("./socket-server");
const PORT = process.env.PORT || 8080;

// Allow multiple frontend origins
const allowedOrigins = [
  "http://localhost:3000",
  "https://tasks-xi-wine.vercel.app",
  process.env.FRONTEND_URL
].filter(Boolean);

// body parser middleware - increase limit for base64 images
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);
      
      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        console.log('⚠️  CORS blocked origin:', origin);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  })
);

// cookie parser middleware
app.use(cookieParser());

app.use(morgan("dev")); // logging middleware
app.use(express.static(path.join(__dirname, "public"))); // serve static files from public folder
app.use("/api", apiRouter); // mount api router
app.use("/auth", authRouter); // mount auth router

// error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.sendStatus(500);
});

const runApp = async () => {
  try {
    // Import all models to ensure they're registered before sync
    const { User, TodoList, Task, Board, SpotifyToken, Post, Like, Comment, Message } = require("./database");
    
    await db.sync({ alter: true }); // Use alter to update tables without dropping data
    console.log("✅ Connected to the database");
    
    // Log all defined models to verify Board is included
    console.log("📋 Defined models:", Object.keys(db.models));
    
    const server = app.listen(PORT, () => {
      console.log(`🚀 Server is running on port ${PORT}`);
    });

    initSocketServer(server);
    console.log("🧦 Socket server initialized");
  } catch (err) {
    console.error("❌ Unable to connect to the database:", err);
  }
};

runApp();

module.exports = app;
