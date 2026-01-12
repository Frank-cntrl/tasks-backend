const express = require("express");
const router = express.Router();
const { Board } = require("../database");
const { authenticateJWT } = require("../auth");

// Apply authentication to all board routes
router.use(authenticateJWT);

/**
 * GET /api/boards/:boardId/snapshot
 * Get the latest snapshot for a board
 */
router.get("/:boardId/snapshot", async (req, res) => {
  try {
    const { boardId } = req.params;

    let board = await Board.findOne({ where: { boardId } });

    // If board doesn't exist, create it with empty snapshot
    if (!board) {
      board = await Board.create({
        boardId,
        snapshot: null,
        lastModifiedBy: req.user.id,
      });
    }

    res.json({
      boardId: board.boardId,
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

    // Find or create board
    let board = await Board.findOne({ where: { boardId } });

    if (board) {
      // Update existing board
      board.snapshot = snapshot;
      board.lastModifiedBy = req.user.id;
      await board.save();
    } else {
      // Create new board
      board = await Board.create({
        boardId,
        snapshot,
        lastModifiedBy: req.user.id,
      });
    }

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
