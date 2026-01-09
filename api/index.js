const express = require("express");
const router = express.Router();
const testDbRouter = require("./test-db");
const todolistsRouter = require("./todolists");
const tasksRouter = require("./tasks");
const { User, TodoList, Task } = require("../database");

// Debug logging middleware
router.use((req, res, next) => {
  console.log(`\n📍 API Request: ${req.method} ${req.originalUrl}`);
  if (req.body && Object.keys(req.body).length > 0) {
    console.log('📦 Body:', JSON.stringify(req.body, null, 2));
  }
  next();
});

// Debug endpoint - check database status
router.get("/debug", async (req, res) => {
  try {
    const users = await User.findAll({ attributes: ['id', 'username', 'pin'] });
    const todolists = await TodoList.findAll();
    const tasks = await Task.findAll();
    res.json({
      users: users.map(u => ({ id: u.id, username: u.username, hasPin: !!u.pin })),
      todolistCount: todolists.length,
      taskCount: tasks.length,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// One-time seed endpoint - REMOVE AFTER USE
router.get("/seed", async (req, res) => {
  try {
    // Check if users already exist
    const existingUsers = await User.findAll();
    if (existingUsers.length > 0) {
      return res.status(400).json({ 
        error: "Database already seeded", 
        users: existingUsers.map(u => u.username) 
      });
    }

    // Create users
    const users = await User.bulkCreate([
      { username: "Frank", pin: "1739" },
      { username: "Ella", pin: "2525" },
    ]);

    // Create TodoLists
    const todoLists = await TodoList.bulkCreate([
      {
        title: "Frank's Personal Tasks",
        description: "My personal to-do items",
        userId: users[0].id,
        isShared: false,
      },
      {
        title: "Ella's Personal Tasks",
        description: "My personal to-do items",
        userId: users[1].id,
        isShared: false,
      },
      {
        title: "Household Chores",
        description: "Shared household tasks",
        userId: users[0].id,
        isShared: true,
      },
      {
        title: "Grocery Shopping",
        description: "Things we need to buy",
        userId: users[1].id,
        isShared: true,
      },
    ]);

    // Create Tasks
    const tasks = await Task.bulkCreate([
      {
        title: "Finish project report",
        description: "Complete the quarterly report",
        todolistId: todoLists[0].id,
        userId: users[0].id,
        priority: "high",
      },
      {
        title: "Call dentist",
        description: "Schedule annual checkup",
        todolistId: todoLists[1].id,
        userId: users[1].id,
        priority: "medium",
      },
      {
        title: "Clean kitchen",
        description: "Deep clean counters and appliances",
        todolistId: todoLists[2].id,
        userId: users[0].id,
        priority: "medium",
      },
      {
        title: "Buy milk",
        description: "Get 2% milk",
        todolistId: todoLists[3].id,
        userId: users[1].id,
        priority: "high",
      },
    ]);

    res.json({
      success: true,
      message: "Database seeded successfully!",
      data: {
        users: users.length,
        todolists: todoLists.length,
        tasks: tasks.length,
      },
    });
  } catch (error) {
    console.error("Seed error:", error);
    res.status(500).json({ error: error.message });
  }
});

router.use("/test-db", testDbRouter);
router.use("/todolists", todolistsRouter);
router.use("/tasks", tasksRouter);

module.exports = router;
