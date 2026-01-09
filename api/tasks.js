const express = require("express");
const router = express.Router();
const { Task, TodoList } = require("../database");
const { authenticateJWT } = require("../auth");

// Get all Tasks for the authenticated user
router.get("/", authenticateJWT, async (req, res) => {
  try {
    const tasks = await Task.findAll({
      where: { userId: req.user.id },
      include: [
        {
          model: TodoList,
          as: "todolist",
          attributes: ["id", "title"],
        },
      ],
      order: [["createdAt", "DESC"]],
    });
    res.send(tasks);
  } catch (error) {
    console.error("Error fetching tasks:", error);
    res.status(500).send({ error: "Failed to fetch tasks" });
  }
});

// Get a specific Task by ID
router.get("/:id", authenticateJWT, async (req, res) => {
  try {
    const task = await Task.findOne({
      where: {
        id: req.params.id,
        userId: req.user.id, // Ensure user owns this task
      },
      include: [
        {
          model: TodoList,
          as: "todolist",
          attributes: ["id", "title"],
        },
      ],
    });

    if (!task) {
      return res.status(404).send({ error: "Task not found" });
    }

    res.send(task);
  } catch (error) {
    console.error("Error fetching task:", error);
    res.status(500).send({ error: "Failed to fetch task" });
  }
});

// Create a new Task
router.post("/", authenticateJWT, async (req, res) => {
  try {
    const { title, description, todolistId, dueDate, priority } = req.body;

    if (!title) {
      return res.status(400).send({ error: "Title is required" });
    }

    if (!todolistId) {
      return res.status(400).send({ error: "TodoList ID is required" });
    }

    // Verify that the todolist belongs to the user
    const todolist = await TodoList.findOne({
      where: {
        id: todolistId,
        userId: req.user.id,
      },
    });

    if (!todolist) {
      return res.status(404).send({ error: "TodoList not found" });
    }

    const task = await Task.create({
      title,
      description,
      todolistId,
      userId: req.user.id,
      dueDate,
      priority: priority || "medium",
    });

    res.status(201).send(task);
  } catch (error) {
    console.error("Error creating task:", error);
    res.status(500).send({ error: "Failed to create task" });
  }
});

// Update a Task
router.put("/:id", authenticateJWT, async (req, res) => {
  try {
    const { title, description, isCompleted, dueDate, priority, todolistId } =
      req.body;

    const task = await Task.findOne({
      where: {
        id: req.params.id,
        userId: req.user.id,
      },
    });

    if (!task) {
      return res.status(404).send({ error: "Task not found" });
    }

    // If todolistId is being updated, verify the new todolist belongs to user
    if (todolistId !== undefined && todolistId !== task.todolistId) {
      const todolist = await TodoList.findOne({
        where: {
          id: todolistId,
          userId: req.user.id,
        },
      });

      if (!todolist) {
        return res.status(404).send({ error: "TodoList not found" });
      }
    }

    // Update fields if provided
    if (title !== undefined) task.title = title;
    if (description !== undefined) task.description = description;
    if (isCompleted !== undefined) task.isCompleted = isCompleted;
    if (dueDate !== undefined) task.dueDate = dueDate;
    if (priority !== undefined) task.priority = priority;
    if (todolistId !== undefined) task.todolistId = todolistId;

    await task.save();

    res.send(task);
  } catch (error) {
    console.error("Error updating task:", error);
    res.status(500).send({ error: "Failed to update task" });
  }
});

// Delete a Task
router.delete("/:id", authenticateJWT, async (req, res) => {
  try {
    const task = await Task.findOne({
      where: {
        id: req.params.id,
        userId: req.user.id,
      },
    });

    if (!task) {
      return res.status(404).send({ error: "Task not found" });
    }

    await task.destroy();

    res.send({ message: "Task deleted successfully" });
  } catch (error) {
    console.error("Error deleting task:", error);
    res.status(500).send({ error: "Failed to delete task" });
  }
});

module.exports = router;
