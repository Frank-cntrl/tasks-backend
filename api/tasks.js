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

    const { Op } = require("sequelize");
    
    // Verify that the todolist belongs to the user OR is shared
    const todolist = await TodoList.findOne({
      where: {
        id: todolistId,
        [Op.or]: [
          { userId: req.user.id }, // User's own list
          { isShared: true }, // Shared list
        ],
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

    const { Op } = require("sequelize");
    
    // Find the task and include its todolist to check if it's shared
    const task = await Task.findOne({
      where: {
        id: req.params.id,
      },
      include: [{
        model: TodoList,
        as: "todolist",
        attributes: ["id", "userId", "isShared"],
      }],
    });

    if (!task) {
      return res.status(404).send({ error: "Task not found" });
    }

    // Check if user can modify this task (owns it or it's in a shared list)
    const canModify = task.userId === req.user.id || task.todolist?.isShared;
    if (!canModify) {
      return res.status(403).send({ error: "Not authorized to modify this task" });
    }

    // If todolistId is being updated, verify the new todolist belongs to user or is shared
    if (todolistId !== undefined && todolistId !== task.todolistId) {
      const newTodolist = await TodoList.findOne({
        where: {
          id: todolistId,
          [Op.or]: [
            { userId: req.user.id },
            { isShared: true },
          ],
        },
      });

      if (!newTodolist) {
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
    // Find the task and include its todolist to check if it's shared
    const task = await Task.findOne({
      where: {
        id: req.params.id,
      },
      include: [{
        model: TodoList,
        as: "todolist",
        attributes: ["id", "userId", "isShared"],
      }],
    });

    if (!task) {
      return res.status(404).send({ error: "Task not found" });
    }

    // Check if user can delete this task (owns it or it's in a shared list)
    const canDelete = task.userId === req.user.id || task.todolist?.isShared;
    if (!canDelete) {
      return res.status(403).send({ error: "Not authorized to delete this task" });
    }

    await task.destroy();

    res.send({ message: "Task deleted successfully" });
  } catch (error) {
    console.error("Error deleting task:", error);
    res.status(500).send({ error: "Failed to delete task" });
  }
});

module.exports = router;
