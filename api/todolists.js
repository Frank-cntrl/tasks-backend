const express = require("express");
const router = express.Router();
const { TodoList, Task } = require("../database");
const { authenticateJWT } = require("../auth");

// Get all TodoLists for the authenticated user (both private and shared)
router.get("/", authenticateJWT, async (req, res) => {
  try {
    const { Op } = require("sequelize");
    const todolists = await TodoList.findAll({
      where: {
        [Op.or]: [
          { userId: req.user.id }, // User's own lists
          { isShared: true }, // Shared lists
        ],
      },
      include: [
        {
          model: Task,
          as: "tasks",
          separate: true, // Fetch tasks in separate query for consistent ordering
          order: [["createdAt", "ASC"]], // Order tasks by creation date
        },
      ],
      order: [["createdAt", "DESC"]],
    });
    res.send(todolists);
  } catch (error) {
    console.error("Error fetching todolists:", error);
    res.status(500).send({ error: "Failed to fetch todolists" });
  }
});

// Get a specific TodoList by ID
router.get("/:id", authenticateJWT, async (req, res) => {
  try {
    const todolist = await TodoList.findOne({
      where: {
        id: req.params.id,
        userId: req.user.id, // Ensure user owns this todolist
      },
      include: [
        {
          model: Task,
          as: "tasks",
        },
      ],
    });

    if (!todolist) {
      return res.status(404).send({ error: "TodoList not found" });
    }

    res.send(todolist);
  } catch (error) {
    console.error("Error fetching todolist:", error);
    res.status(500).send({ error: "Failed to fetch todolist" });
  }
});

// Create a new TodoList
router.post("/", authenticateJWT, async (req, res) => {
  try {
    const { title, description, isShared } = req.body;

    if (!title) {
      return res.status(400).send({ error: "Title is required" });
    }

    const todolist = await TodoList.create({
      title,
      description,
      isShared: isShared || false,
      userId: req.user.id,
    });

    res.status(201).send(todolist);
  } catch (error) {
    console.error("Error creating todolist:", error);
    res.status(500).send({ error: "Failed to create todolist" });
  }
});

// Update a TodoList
router.put("/:id", authenticateJWT, async (req, res) => {
  try {
    const { title, description, isCompleted } = req.body;

    const todolist = await TodoList.findOne({
      where: {
        id: req.params.id,
        userId: req.user.id,
      },
    });

    if (!todolist) {
      return res.status(404).send({ error: "TodoList not found" });
    }

    // Update fields if provided
    if (title !== undefined) todolist.title = title;
    if (description !== undefined) todolist.description = description;
    if (isCompleted !== undefined) todolist.isCompleted = isCompleted;

    await todolist.save();

    res.send(todolist);
  } catch (error) {
    console.error("Error updating todolist:", error);
    res.status(500).send({ error: "Failed to update todolist" });
  }
});

// Delete a TodoList
router.delete("/:id", authenticateJWT, async (req, res) => {
  try {
    const todolist = await TodoList.findOne({
      where: {
        id: req.params.id,
        userId: req.user.id,
      },
    });

    if (!todolist) {
      return res.status(404).send({ error: "TodoList not found" });
    }

    await todolist.destroy();

    res.send({ message: "TodoList deleted successfully" });
  } catch (error) {
    console.error("Error deleting todolist:", error);
    res.status(500).send({ error: "Failed to delete todolist" });
  }
});

module.exports = router;
