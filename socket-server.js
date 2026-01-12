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

      socket.on("disconnect", (reason) => {
        log("❌ User disconnected:", socket.username, "socketId:", socket.id, "reason:", reason);
        connectedUsers.delete(socket.userId);
        io.emit("user_offline", { userId: socket.userId });
        
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
