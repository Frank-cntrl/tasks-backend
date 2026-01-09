const express = require("express");
const router = express.Router();
const testDbRouter = require("./test-db");
const todolistsRouter = require("./todolists");
const tasksRouter = require("./tasks");

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

module.exports = router;
