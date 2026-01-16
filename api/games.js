const express = require("express");
const router = express.Router();
const { Game, User } = require("../database");
const { authenticateJWT } = require("../auth");
const { Op } = require("sequelize");

// Get active game for a game type (or null if none exists)
router.get("/:gameType/active", authenticateJWT, async (req, res) => {
  try {
    const { gameType } = req.params;
    
    const game = await Game.findOne({
      where: {
        gameType,
        isActive: true,
        [Op.or]: [
          { player1Id: req.user.id },
          { player2Id: req.user.id },
        ],
      },
      include: [
        { model: User, as: "player1", attributes: ["id", "username"] },
        { model: User, as: "player2", attributes: ["id", "username"] },
      ],
    });

    res.send({ game });
  } catch (error) {
    console.error("Error fetching active game:", error);
    res.status(500).send({ error: "Failed to fetch active game" });
  }
});

// Create a new game
router.post("/", authenticateJWT, async (req, res) => {
  try {
    const { gameType, player2Id } = req.body;

    if (!gameType || !player2Id) {
      return res.status(400).send({ error: "gameType and player2Id are required" });
    }

    // Check if there's already an active game of this type between these players
    const existingGame = await Game.findOne({
      where: {
        gameType,
        isActive: true,
        [Op.or]: [
          { player1Id: req.user.id, player2Id },
          { player1Id: player2Id, player2Id: req.user.id },
        ],
      },
    });

    if (existingGame) {
      return res.status(400).send({ error: "An active game already exists between these players" });
    }

    // Initialize game state based on game type
    let initialState = {};
    if (gameType === "tictactoe") {
      initialState = {
        board: [null, null, null, null, null, null, null, null, null],
        moves: 0,
      };
    }

    const game = await Game.create({
      gameType,
      state: initialState,
      currentTurn: req.user.id, // Creator goes first
      player1Id: req.user.id,
      player2Id,
      isActive: true,
    });

    // Fetch with player info
    const gameWithPlayers = await Game.findByPk(game.id, {
      include: [
        { model: User, as: "player1", attributes: ["id", "username"] },
        { model: User, as: "player2", attributes: ["id", "username"] },
      ],
    });

    res.status(201).send(gameWithPlayers);
  } catch (error) {
    console.error("Error creating game:", error);
    res.status(500).send({ error: "Failed to create game" });
  }
});

// Make a move
router.put("/:id/move", authenticateJWT, async (req, res) => {
  try {
    const { id } = req.params;
    const { position } = req.body;

    const game = await Game.findByPk(id, {
      include: [
        { model: User, as: "player1", attributes: ["id", "username"] },
        { model: User, as: "player2", attributes: ["id", "username"] },
      ],
    });

    if (!game) {
      return res.status(404).send({ error: "Game not found" });
    }

    if (!game.isActive) {
      return res.status(400).send({ error: "Game is already finished" });
    }

    // Check if it's the user's turn
    if (game.currentTurn !== req.user.id) {
      return res.status(400).send({ error: "It's not your turn" });
    }

    // Validate the move based on game type
    if (game.gameType === "tictactoe") {
      const { board } = game.state;
      
      if (position < 0 || position > 8) {
        return res.status(400).send({ error: "Invalid position" });
      }

      if (board[position] !== null) {
        return res.status(400).send({ error: "Position already taken" });
      }

      // Make the move
      const playerSymbol = game.player1Id === req.user.id ? "X" : "O";
      const newBoard = [...board];
      newBoard[position] = playerSymbol;

      // Check for winner
      const winPatterns = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
        [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
        [0, 4, 8], [2, 4, 6], // diagonals
      ];

      let winner = null;
      for (const pattern of winPatterns) {
        const [a, b, c] = pattern;
        if (newBoard[a] && newBoard[a] === newBoard[b] && newBoard[a] === newBoard[c]) {
          winner = req.user.id;
          break;
        }
      }

      // Check for draw
      const isDraw = !winner && newBoard.every(cell => cell !== null);

      // Update game state
      game.state = {
        board: newBoard,
        moves: game.state.moves + 1,
      };

      if (winner) {
        game.winner = winner;
        game.isActive = false;
      } else if (isDraw) {
        game.winner = 0; // 0 represents a draw
        game.isActive = false;
      } else {
        // Switch turns
        game.currentTurn = game.player1Id === req.user.id ? game.player2Id : game.player1Id;
      }

      await game.save();

      // If game is finished, delete it after sending response
      if (!game.isActive) {
        // Send the final state first
        const response = game.toJSON();
        
        // Schedule deletion after a short delay to ensure clients get the result
        setTimeout(async () => {
          try {
            await Game.destroy({ where: { id: game.id } });
            console.log(`Game ${game.id} deleted after completion`);
          } catch (err) {
            console.error("Error deleting completed game:", err);
          }
        }, 5000); // Delete after 5 seconds

        return res.send(response);
      }
    }

    res.send(game);
  } catch (error) {
    console.error("Error making move:", error);
    res.status(500).send({ error: "Failed to make move" });
  }
});

// Start a new game (reset after one ends)
router.post("/:gameType/new", authenticateJWT, async (req, res) => {
  try {
    const { gameType } = req.params;
    const { lastWinner } = req.body;

    // Get the other player (for 2-player games, we need to know who to play with)
    // In this app, we assume 2 users, so find the other user
    const otherUser = await User.findOne({
      where: { id: { [Op.ne]: req.user.id } },
    });

    if (!otherUser) {
      return res.status(400).send({ error: "No other player found" });
    }

    // Delete any existing active games of this type first
    await Game.destroy({
      where: {
        gameType,
        isActive: true,
      },
    });

    // Determine who goes first (loser of last game, or if draw/new, alternate)
    let firstPlayer = req.user.id;
    if (lastWinner && lastWinner !== 0) {
      // Loser goes first
      firstPlayer = lastWinner === req.user.id ? otherUser.id : req.user.id;
    }

    // Initialize game state
    let initialState = {};
    if (gameType === "tictactoe") {
      initialState = {
        board: [null, null, null, null, null, null, null, null, null],
        moves: 0,
      };
    }

    const game = await Game.create({
      gameType,
      state: initialState,
      currentTurn: firstPlayer,
      player1Id: req.user.id,
      player2Id: otherUser.id,
      isActive: true,
    });

    // Fetch with player info
    const gameWithPlayers = await Game.findByPk(game.id, {
      include: [
        { model: User, as: "player1", attributes: ["id", "username"] },
        { model: User, as: "player2", attributes: ["id", "username"] },
      ],
    });

    res.status(201).send(gameWithPlayers);
  } catch (error) {
    console.error("Error creating new game:", error);
    res.status(500).send({ error: "Failed to create new game" });
  }
});

// Get game by ID
router.get("/:id", authenticateJWT, async (req, res) => {
  try {
    const game = await Game.findByPk(req.params.id, {
      include: [
        { model: User, as: "player1", attributes: ["id", "username"] },
        { model: User, as: "player2", attributes: ["id", "username"] },
      ],
    });

    if (!game) {
      return res.status(404).send({ error: "Game not found" });
    }

    res.send(game);
  } catch (error) {
    console.error("Error fetching game:", error);
    res.status(500).send({ error: "Failed to fetch game" });
  }
});

module.exports = router;
