const express = require("express");
const router = express.Router();
const testDbRouter = require("./test-db");
const todolistsRouter = require("./todolists");
const tasksRouter = require("./tasks");
const spotifyRouter = require("./spotify");
const postsRouter = require("./posts");
const messagesRouter = require("./messages");
const uploadRouter = require("./upload");
const boardsRouter = require("./boards");

// Debug logging middleware
router.use((req, res, next) => {
  console.log(`\n📍 API Request: ${req.method} ${req.originalUrl}`);
  if (req.body && Object.keys(req.body).length > 0) {
    console.log('📦 Body:', JSON.stringify(req.body, null, 2));
  }
  next();
});

router.use("/test-db", testDbRouter);
router.use("/todolists", todolistsRouter);
router.use("/tasks", tasksRouter);
router.use("/spotify", spotifyRouter);
router.use("/posts", postsRouter);
router.use("/messages", messagesRouter);
router.use("/upload", uploadRouter);
router.use("/boards", boardsRouter);

module.exports = router;
