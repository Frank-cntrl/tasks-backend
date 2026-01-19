const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const { Message, User } = require("./database");

let io;

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

// Debug logging
const DEBUG = true;
const log = (...args) => DEBUG && console.log("[Socket]", ...args);

const connectedUsers = new Map();

// Curated list of drawable nouns for Guess My Thing game
const DRAWABLE_NOUNS = [
  // Animals
  'cat', 'dog', 'elephant', 'giraffe', 'lion', 'tiger', 'bear', 'rabbit', 'mouse', 'fish',
  'bird', 'snake', 'frog', 'turtle', 'monkey', 'penguin', 'dolphin', 'whale', 'shark', 'octopus',
  'butterfly', 'bee', 'spider', 'ant', 'horse', 'cow', 'pig', 'sheep', 'chicken', 'duck',
  // Objects
  'house', 'car', 'tree', 'flower', 'book', 'chair', 'table', 'lamp', 'phone', 'computer',
  'clock', 'door', 'window', 'bed', 'couch', 'television', 'mirror', 'umbrella', 'bag', 'shoe',
  'hat', 'glasses', 'watch', 'key', 'bottle', 'cup', 'plate', 'fork', 'spoon', 'knife',
  // Food
  'apple', 'banana', 'orange', 'pizza', 'hamburger', 'hotdog', 'cake', 'cookie', 'donut',
  'bread', 'cheese', 'egg', 'carrot', 'broccoli', 'corn', 'grape', 'strawberry', 'watermelon', 'pineapple',
  // Nature
  'sun', 'moon', 'star', 'cloud', 'rain', 'rainbow', 'mountain', 'beach', 'ocean', 'river',
  'forest', 'desert', 'volcano', 'island', 'waterfall', 'lightning', 'snowflake', 'tornado', 'fire', 'leaf',
  // Transportation
  'airplane', 'helicopter', 'boat', 'ship', 'train', 'bus', 'bicycle', 'motorcycle', 'rocket', 'submarine',
  // Buildings & Places
  'castle', 'church', 'hospital', 'school', 'library', 'restaurant', 'hotel', 'bridge', 'lighthouse', 'tent',
  // Sports & Activities
  'ball', 'guitar', 'piano', 'drum', 'camera', 'paintbrush', 'scissors', 'hammer', 'ladder', 'balloon',
  // People & Body
  'baby', 'robot', 'ghost', 'pirate', 'ninja', 'wizard', 'princess', 'king', 'clown', 'angel',
  // Misc
  'heart', 'diamond', 'crown', 'sword', 'shield', 'arrow', 'candle', 'present', 'treasure', 'flag'
];

// Shared game state for Guess My Thing
const guessMyThingState = {
  phase: 'waiting',
  players: {},
  words: {},
  drawings: {},
  playersReady: {}, // Track which players clicked "Done Early"
  timer: null,
  guesses: {},
  timeLeft: 0
}

const initSocketServer = (server) => {
  try {
    log("Initializing socket server...");
    
    io = new Server(server, {
      cors: {
        origin: function (origin, callback) {
          const allowedOrigins = [
            "http://localhost:3000",
            "https://tasks-xi-wine.vercel.app",
            FRONTEND_URL
          ].filter(Boolean);
          
          // Allow requests with no origin (like mobile apps)
          if (!origin) return callback(null, true);
          
          if (allowedOrigins.includes(origin)) {
            callback(null, true);
          } else {
            callback(new Error("Not allowed by CORS"));
          }
        },
        credentials: true,
        methods: ["GET", "POST"],
      },
    });

    io.use((socket, next) => {
      const token = socket.handshake.auth.token;
      
      if (!token) {
        return next(new Error("Authentication error: No token"));
      }

      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        socket.userId = decoded.id;
        socket.username = decoded.username;
        next();
      } catch (err) {
        next(new Error("Authentication error: Invalid token"));
      }
    });

    io.on("connection", (socket) => {
      log("✅ User connected:", socket.username, "userId:", socket.userId, "socketId:", socket.id);
      connectedUsers.set(socket.userId, socket.id);
      io.emit("user_online", { userId: socket.userId, username: socket.username });

      socket.on("join_chat", () => {
        socket.join("frella_chat");
      });

      socket.on("send_message", async (data) => {
        try {
          const { content, imageUrl, receiverId } = data;

          if (!content && !imageUrl) {
            socket.emit("error", { message: "Message content or image is required" });
            return;
          }

          const message = await Message.create({
            content,
            imageUrl,
            senderId: socket.userId,
            receiverId,
          });

          const fullMessage = await Message.findByPk(message.id, {
            include: [
              { model: User, as: "sender", attributes: ["id", "username"] },
              { model: User, as: "receiver", attributes: ["id", "username"] },
            ],
          });

          io.to("frella_chat").emit("new_message", fullMessage);

        } catch (error) {
          console.error("Error sending message:", error);
          socket.emit("error", { message: "Failed to send message" });
        }
      });

      socket.on("typing", () => {
        socket.to("frella_chat").emit("user_typing", { 
          userId: socket.userId, 
          username: socket.username 
        });
      });

      socket.on("stop_typing", () => {
        socket.to("frella_chat").emit("user_stop_typing", { 
          userId: socket.userId 
        });
      });

      socket.on("mark_read", async (messageIds) => {
        try {
          await Message.update(
            { read: true },
            { where: { id: messageIds, receiverId: socket.userId } }
          );
          io.to("frella_chat").emit("messages_read", { 
            messageIds, 
            readBy: socket.userId 
          });
        } catch (error) {
          console.error("Error marking messages as read:", error);
        }
      });

      // ========== Board Collaboration Events ==========
      socket.on("join_board", (data) => {
        const { boardId } = data;
        log("📋 join_board request from", socket.username, "boardId:", boardId);
        
        if (!boardId) {
          socket.emit("error", { message: "Board ID is required" });
          return;
        }
        
        const roomName = `board_${boardId}`;
        socket.join(roomName);
        socket.currentBoardId = boardId;
        
        // Log room info
        const roomSockets = io.sockets.adapter.rooms.get(roomName);
        log("📋 Room", roomName, "now has", roomSockets ? roomSockets.size : 0, "sockets");
        
        // Notify others in the room that this user joined
        socket.to(roomName).emit("board_user_joined", {
          userId: socket.userId,
          username: socket.username,
          socketId: socket.id,
        });
        log("📋 Notified room of new user:", socket.username);
        
        // Send current users in room back to joiner
        const usersInRoom = [];
        if (roomSockets) {
          roomSockets.forEach((socketId) => {
            const s = io.sockets.sockets.get(socketId);
            if (s && s.userId !== socket.userId) {
              usersInRoom.push({
                userId: s.userId,
                username: s.username,
              });
            }
          });
        }
        
        log("📋 Sending existing users to", socket.username, ":", usersInRoom);
        socket.emit("board_users", { users: usersInRoom });
      });

      socket.on("leave_board", (data) => {
        const { boardId } = data;
        log("📋 leave_board from", socket.username, "boardId:", boardId);
        if (boardId) {
          socket.leave(`board_${boardId}`);
          socket.to(`board_${boardId}`).emit("board_user_left", {
            userId: socket.userId,
            socketId: socket.id,
          });
          socket.currentBoardId = null;
        }
      });

      // Broadcast drawing changes to room (throttled on client)
      socket.on("board_changes", (data) => {
        const { boardId, changes } = data;
        
        log("🎨 board_changes received from", socket.username, "userId:", socket.userId);
        log("🎨 boardId:", boardId);
        log("🎨 changes count:", changes ? changes.length : 0);
        
        if (!boardId || !changes) {
          log("🎨 ⚠️ Missing boardId or changes, ignoring");
          return;
        }
        
        // Log change details
        if (changes.length > 0) {
          changes.forEach((change, i) => {
            log(`🎨 Change ${i}:`, {
              added: change.added ? Object.keys(change.added).length : 0,
              updated: change.updated ? Object.keys(change.updated).length : 0,
              removed: change.removed ? Object.keys(change.removed).length : 0,
            });
          });
        }
        
        // Check room membership
        const roomName = `board_${boardId}`;
        const roomSockets = io.sockets.adapter.rooms.get(roomName);
        log("🎨 Room", roomName, "has", roomSockets ? roomSockets.size : 0, "sockets");
        
        if (roomSockets) {
          roomSockets.forEach((socketId) => {
            const s = io.sockets.sockets.get(socketId);
            if (s) {
              log("🎨 Socket in room:", s.username, "userId:", s.userId, "socketId:", socketId);
            }
          });
        }
        
        // Broadcast to everyone in the room except sender
        log("🎨 Broadcasting to room", roomName, "(excluding sender)");
        socket.to(roomName).emit("board_changes", {
          userId: socket.userId,
          username: socket.username,
          socketId: socket.id, // Include socket ID for echo prevention
          changes,
        });
        log("🎨 ✅ Broadcast complete");
      });

      // Presence: cursor position
      socket.on("board_cursor", (data) => {
        const { boardId, x, y } = data;
        if (!boardId) return;
        
        socket.to(`board_${boardId}`).emit("board_cursor", {
          userId: socket.userId,
          username: socket.username,
          socketId: socket.id,
          x,
          y,
        });
      });

      // Request snapshot from other connected users (fallback)
      socket.on("request_board_snapshot", (data) => {
        const { boardId } = data;
        if (!boardId) return;
        
        socket.to(`board_${boardId}`).emit("snapshot_requested", {
          requesterId: socket.userId,
        });
      });

      // Provide snapshot to requester
      socket.on("provide_board_snapshot", (data) => {
        const { boardId, snapshot, requesterId } = data;
        if (!boardId || !snapshot || !requesterId) return;
        
        // Send snapshot directly to requester
        const requesterSocketId = connectedUsers.get(requesterId);
        if (requesterSocketId) {
          io.to(requesterSocketId).emit("board_snapshot_received", {
            snapshot,
            providerId: socket.userId,
          });
        }
      });

      // ========== Guess My Thing Game ==========
      
      // Timer and phase management functions (moved outside event handlers)
      const startGameTimer = () => {
        if (guessMyThingState.timer) clearInterval(guessMyThingState.timer)
        
        guessMyThingState.timer = setInterval(() => {
          guessMyThingState.timeLeft--
          
          io.to("guessmything").emit('timer-update', { timeLeft: guessMyThingState.timeLeft })
          
          if (guessMyThingState.timeLeft <= 0) {
            clearInterval(guessMyThingState.timer)
            nextPhase()
          }
        }, 1000)
      }

      const nextPhase = () => {
        // Reset players ready state
        guessMyThingState.playersReady = {}
        
        switch (guessMyThingState.phase) {
          case 'thinking':
            guessMyThingState.phase = 'drawing'
            guessMyThingState.timeLeft = 60
            guessMyThingState.drawings = {} // Reset drawings
            log("🎮 Phase changed to: DRAWING")
            break
          case 'drawing':
            guessMyThingState.phase = 'guessing'
            guessMyThingState.timeLeft = 60
            guessMyThingState.guesses = {} // Reset guesses
            log("🎮 Phase changed to: GUESSING")
            
            // Send each player their opponent's drawing
            const playerIds = Object.keys(guessMyThingState.players)
            playerIds.forEach(playerId => {
              const opponentId = playerIds.find(id => id !== playerId)
              const opponentDrawing = guessMyThingState.drawings[opponentId]
              const playerSocket = io.sockets.sockets.get(guessMyThingState.players[playerId].socketId)
              
              if (playerSocket && opponentDrawing) {
                log("🎮 Sending opponent drawing to player:", playerId)
                playerSocket.emit('opponent-drawing', opponentDrawing)
              } else {
                log("🎮 No drawing found for opponent:", opponentId)
              }
            })
            break
          case 'guessing':
            guessMyThingState.phase = 'result'
            guessMyThingState.timeLeft = 5
            log("🎮 Phase changed to: RESULT")
            break
          case 'result':
            guessMyThingState.phase = 'waiting'
            guessMyThingState.words = {}
            guessMyThingState.drawings = {}
            guessMyThingState.guesses = {}
            log("🎮 Phase changed to: WAITING")
            return
        }
        
        // Reset ready states for next phase
        guessMyThingState.playersReady = {}
        
        io.to("guessmything").emit('phase-changed', {
          phase: guessMyThingState.phase,
          timeLeft: guessMyThingState.timeLeft
        })
        
        if (guessMyThingState.phase !== 'result') {
          startGameTimer()
        }
      }

      socket.on("join_guessmything", () => {
        log("🎮 User joined Guess My Thing:", socket.username)
        guessMyThingState.players[socket.userId] = {
          id: socket.userId,
          username: socket.username,
          socketId: socket.id,
          score: 0
        }
        
        socket.join("guessmything")
        
        // Notify about connections
        const playerCount = Object.keys(guessMyThingState.players).length
        log("🎮 Players in game:", playerCount)
        
        // Emit connection status to all players in the game
        io.to("guessmything").emit("player-joined", {
          playerCount,
          canStart: playerCount === 2,
          players: Object.values(guessMyThingState.players).map(p => ({
            id: p.id,
            username: p.username
          }))
        })
        
        // Legacy opponent-connected event for backward compatibility
        if (playerCount === 2) {
          io.to("guessmything").emit("opponent-connected")
        }
      })

      socket.on("start-game", (data) => {
        log("🎮 Game start requested by:", socket.username)
        
        if (Object.keys(guessMyThingState.players).length !== 2) {
          socket.emit("error", { message: "Need 2 players to start" })
          return
        }

        // Generate words for both players using curated drawable nouns
        const playerIds = Object.keys(guessMyThingState.players)
        
        // Pick two different random nouns
        const word1Index = Math.floor(Math.random() * DRAWABLE_NOUNS.length)
        let word2Index = Math.floor(Math.random() * DRAWABLE_NOUNS.length)
        // Ensure different words for each player
        while (word2Index === word1Index) {
          word2Index = Math.floor(Math.random() * DRAWABLE_NOUNS.length)
        }
        
        guessMyThingState.words[playerIds[0]] = DRAWABLE_NOUNS[word1Index]
        guessMyThingState.words[playerIds[1]] = DRAWABLE_NOUNS[word2Index]
        
        log("🎮 Generated drawable nouns:", guessMyThingState.words)
        
        // Start thinking phase
        guessMyThingState.phase = 'thinking'
        guessMyThingState.timeLeft = 10
        
        // Send words to respective players
        playerIds.forEach(playerId => {
          const playerSocket = io.sockets.sockets.get(guessMyThingState.players[playerId].socketId)
          if (playerSocket) {
            log("🎮 Sending game-started to player:", playerId, "with word:", guessMyThingState.words[playerId])
            playerSocket.emit('game-started', {
              word: guessMyThingState.words[playerId],
              phase: guessMyThingState.phase,
              timeLeft: guessMyThingState.timeLeft
            })
          } else {
            log("🎮 ERROR: Could not find socket for player:", playerId)
          }
        })
        
        startGameTimer()
        log("🎮 Timer started for thinking phase")
      })

      socket.on("finish-phase-early", () => {
        log("🎮 Player finished early:", socket.username)
        
        // Track this player as ready
        guessMyThingState.playersReady[socket.userId] = true
        
        // Notify all players about who is ready
        io.to("guessmything").emit('player-ready', {
          playerId: socket.userId,
          readyCount: Object.keys(guessMyThingState.playersReady).length,
          totalPlayers: Object.keys(guessMyThingState.players).length
        })
        
        // Check if all players are ready
        const playerCount = Object.keys(guessMyThingState.players).length
        const readyCount = Object.keys(guessMyThingState.playersReady).length
        
        log("🎮 Ready:", readyCount, "/", playerCount)
        
        if (readyCount >= playerCount && playerCount >= 2) {
          log("🎮 All players ready, advancing phase")
          if (guessMyThingState.timer) clearInterval(guessMyThingState.timer)
          guessMyThingState.playersReady = {} // Reset for next phase
          nextPhase()
        }
      })

      socket.on("drawing-update", (drawingData) => {
        if (guessMyThingState.phase !== 'drawing') return
        
        guessMyThingState.drawings[socket.userId] = drawingData
        
        // Send drawing to opponent
        socket.to("guessmything").emit('drawing-updated', drawingData)
      })

      socket.on("submit-guess", (data) => {
        const { guess } = data
        if (guessMyThingState.phase !== 'guessing') return
        
        log("🎮 Guess submitted:", guess, "by:", socket.username, "(ID:", socket.userId, ")")
        log("🎮 All words in game:", JSON.stringify(guessMyThingState.words))
        log("🎮 All players in game:", JSON.stringify(Object.keys(guessMyThingState.players)))
        
        // Find opponent's word - the word the OPPONENT was drawing
        // The guesser should guess what they SEE (opponent's drawing = opponent's word)
        const playerIds = Object.keys(guessMyThingState.players)
        const opponentId = playerIds.find(id => id !== socket.userId)
        const targetWord = guessMyThingState.words[opponentId]
        
        log("🎮 Guesser ID:", socket.userId, "Opponent ID:", opponentId)
        log("🎮 Target word (what opponent drew):", targetWord)
        
        if (!targetWord) {
          log("🎮 No target word found for opponent:", opponentId)
          return
        }
        
        // Normalize both strings for comparison
        const normalizeWord = (word) => {
          return word
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9]/g, '') // Remove special chars
            .replace(/s$/, '') // Remove trailing 's' for plural handling
        }
        
        const normalizedGuess = normalizeWord(guess)
        const normalizedTarget = normalizeWord(targetWord)
        
        // Check for exact match or close match (handles plurals, minor typos)
        const correct = normalizedGuess === normalizedTarget || 
                       normalizedGuess === normalizedTarget + 's' ||
                       normalizedGuess + 's' === normalizedTarget
        
        log("🎮 Comparing:", normalizedGuess, "vs", normalizedTarget, "Result:", correct)
        
        if (correct) {
          // Winner!
          guessMyThingState.players[socket.userId].score++
          io.to("guessmything").emit('guess-result', {
            correct: true,
            guess,
            winner: socket.userId,
            word: targetWord
          })
          
          if (guessMyThingState.timer) clearInterval(guessMyThingState.timer)
          setTimeout(() => nextPhase(), 3000) // Show result for 3 seconds
        } else {
          // Wrong guess
          socket.emit('guess-result', {
            correct: false,
            guess,
            winner: null,
            hint: `Not quite! (${guess})`
          })
        }
      })

      // Play Again system - wait for both players
      socket.on("ready-to-play-again", () => {
        log("🎮 Player ready to play again:", socket.username)
        
        guessMyThingState.playersReady[socket.userId] = true
        
        // Notify all players about who is ready
        const readyCount = Object.keys(guessMyThingState.playersReady).length
        const playerCount = Object.keys(guessMyThingState.players).length
        
        io.to("guessmything").emit('player-ready-rematch', {
          playerId: socket.userId,
          readyCount,
          totalPlayers: playerCount
        })
        
        log("🎮 Ready for rematch:", readyCount, "/", playerCount)
        
        // If both players are ready, start a new game automatically
        if (readyCount >= playerCount && playerCount >= 2) {
          log("🎮 Both players ready, starting new game")
          guessMyThingState.playersReady = {} // Reset ready states
          
          // Generate words for both players
          const playerIds = Object.keys(guessMyThingState.players)
          
          const word1Index = Math.floor(Math.random() * DRAWABLE_NOUNS.length)
          let word2Index = Math.floor(Math.random() * DRAWABLE_NOUNS.length)
          while (word2Index === word1Index) {
            word2Index = Math.floor(Math.random() * DRAWABLE_NOUNS.length)
          }
          
          guessMyThingState.words[playerIds[0]] = DRAWABLE_NOUNS[word1Index]
          guessMyThingState.words[playerIds[1]] = DRAWABLE_NOUNS[word2Index]
          guessMyThingState.drawings = {} // Reset drawings
          guessMyThingState.guesses = {} // Reset guesses
          
          // Start thinking phase
          guessMyThingState.phase = 'thinking'
          guessMyThingState.timeLeft = 10
          
          // Send words to respective players
          playerIds.forEach(playerId => {
            const playerSocket = io.sockets.sockets.get(guessMyThingState.players[playerId].socketId)
            if (playerSocket) {
              playerSocket.emit('game-started', {
                word: guessMyThingState.words[playerId],
                phase: guessMyThingState.phase,
                timeLeft: guessMyThingState.timeLeft
              })
            }
          })
          
          startGameTimer()
        }
      })

      socket.on("leave_guessmything", () => {
        log("🎮 User leaving Guess My Thing:", socket.username)
        delete guessMyThingState.players[socket.userId]
        socket.leave("guessmything")
        
        const remainingCount = Object.keys(guessMyThingState.players).length
        log("🎮 Players remaining:", remainingCount)
        
        // Reset game if someone leaves
        if (remainingCount < 2) {
          guessMyThingState.phase = 'waiting'
          guessMyThingState.words = {}
          guessMyThingState.drawings = {}
          guessMyThingState.guesses = {}
          if (guessMyThingState.timer) clearInterval(guessMyThingState.timer)
        }
        
        // Notify remaining players
        io.to("guessmything").emit("player-left", {
          playerCount: remainingCount,
          canStart: remainingCount === 2
        })
        
        // Legacy event for backward compatibility
        socket.to("guessmything").emit("opponent-disconnected")
      })

      socket.on("disconnect", (reason) => {
        log("❌ User disconnected:", socket.username, "socketId:", socket.id, "reason:", reason);
        connectedUsers.delete(socket.userId);
        io.emit("user_offline", { userId: socket.userId });
        
        // Clean up Guess My Thing game state
        if (guessMyThingState.players[socket.userId]) {
          delete guessMyThingState.players[socket.userId];
          
          // Reset game if someone leaves
          if (Object.keys(guessMyThingState.players).length < 2) {
            guessMyThingState.phase = 'waiting';
            guessMyThingState.words = {};
            guessMyThingState.drawings = {};
            guessMyThingState.guesses = {};
            if (guessMyThingState.timer) clearInterval(guessMyThingState.timer);
          }
          
          io.to("guessmything").emit("opponent-disconnected");
        }
        
        // Notify board room if user was in one
        if (socket.currentBoardId) {
          socket.to(`board_${socket.currentBoardId}`).emit("board_user_left", {
            userId: socket.userId,
            socketId: socket.id,
          });
        }
      });
    });
    
    log("✅ Socket server initialized");

  } catch (error) {
    console.error("Error initializing socket server:", error);
  }
};

const getIO = () => io;

module.exports = initSocketServer;
module.exports.getIO = getIO;
