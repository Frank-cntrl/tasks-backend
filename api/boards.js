const express = require("express");
const router = express.Router();
const { Board, User } = require("../database");
const { authenticateJWT } = require("../auth");
const { v4: uuidv4 } = require("uuid");

// Apply authentication to all board routes
router.use(authenticateJWT);

/**
 * GET /api/boards
 * List all boards
 */
router.get("/", async (req, res) => {
  try {
    const boards = await Board.findAll({
      attributes: ["id", "boardId", "name", "createdBy", "lastModifiedBy", "createdAt", "updatedAt"],
      order: [["updatedAt", "DESC"]],
    });

    res.json(boards);
  } catch (error) {
    console.error("Error fetching boards:", error);
    res.status(500).json({ error: "Failed to fetch boards" });
  }
});

/**
 * POST /api/boards
 * Create a new board
 */
router.post("/", async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Board name is required" });
    }

    const boardId = uuidv4();
    const board = await Board.create({
      boardId,
      name: name.trim(),
      snapshot: null,
      createdBy: req.user.id,
      lastModifiedBy: req.user.id,
    });

    res.status(201).json({
      id: board.id,
      boardId: board.boardId,
      name: board.name,
      createdBy: board.createdBy,
      createdAt: board.createdAt,
    });
  } catch (error) {
    console.error("Error creating board:", error);
    res.status(500).json({ error: "Failed to create board" });
  }
});

/**
 * DELETE /api/boards/:boardId
 * Delete a board
 */
router.delete("/:boardId", async (req, res) => {
  try {
    const { boardId } = req.params;

    const board = await Board.findOne({ where: { boardId } });

    if (!board) {
      return res.status(404).json({ error: "Board not found" });
    }

    await board.destroy();

    res.json({ message: "Board deleted successfully" });
  } catch (error) {
    console.error("Error deleting board:", error);
    res.status(500).json({ error: "Failed to delete board" });
  }
});

/**
 * PUT /api/boards/:boardId
 * Update board name
 */
router.put("/:boardId", async (req, res) => {
  try {
    const { boardId } = req.params;
    const { name } = req.body;

    const board = await Board.findOne({ where: { boardId } });

    if (!board) {
      return res.status(404).json({ error: "Board not found" });
    }

    if (name && name.trim()) {
      board.name = name.trim();
    }

    await board.save();

    res.json({
      id: board.id,
      boardId: board.boardId,
      name: board.name,
      updatedAt: board.updatedAt,
    });
  } catch (error) {
    console.error("Error updating board:", error);
    res.status(500).json({ error: "Failed to update board" });
  }
});

/**
 * GET /api/boards/:boardId/snapshot
 * Get the latest snapshot for a board
 */
router.get("/:boardId/snapshot", async (req, res) => {
  try {
    const { boardId } = req.params;

    const board = await Board.findOne({ where: { boardId } });

    if (!board) {
      return res.status(404).json({ error: "Board not found" });
    }

    res.json({
      boardId: board.boardId,
      name: board.name,
      snapshot: board.snapshot,
      lastModifiedBy: board.lastModifiedBy,
      updatedAt: board.updatedAt,
    });
  } catch (error) {
    console.error("Error fetching board snapshot:", error);
    res.status(500).json({ error: "Failed to fetch board snapshot" });
  }
});

/**
 * POST /api/boards/:boardId/snapshot
 * Save a new snapshot for a board
 */
router.post("/:boardId/snapshot", async (req, res) => {
  try {
    const { boardId } = req.params;
    const { snapshot } = req.body;

    if (!snapshot) {
      return res.status(400).json({ error: "Snapshot is required" });
    }

    const board = await Board.findOne({ where: { boardId } });

    if (!board) {
      return res.status(404).json({ error: "Board not found" });
    }

    board.snapshot = snapshot;
    board.lastModifiedBy = req.user.id;
    await board.save();

    res.json({
      message: "Board snapshot saved",
      boardId: board.boardId,
      updatedAt: board.updatedAt,
    });
  } catch (error) {
    console.error("Error saving board snapshot:", error);
    res.status(500).json({ error: "Failed to save board snapshot" });
  }
});

module.exports = router;
