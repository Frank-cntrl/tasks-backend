const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const { Message, User } = require("./database");

let io;

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

const connectedUsers = new Map();

const initSocketServer = (server) => {
  try {
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
            console.log("Socket.io CORS blocked:", origin);
            callback(new Error("Not allowed by CORS"));
          }
        },
        credentials: true,
        methods: ["GET", "POST"],
      },
    });

    io.use((socket, next) => {
      const token = socket.handshake.auth.token;
      console.log("\n🔐 Socket auth attempt");
      console.log("   - Token present:", !!token);
      console.log("   - Transport:", socket.handshake.query.transport || 'unknown');
      console.log("   - Origin:", socket.handshake.headers.origin);
      
      if (!token) {
        console.log("   ❌ Auth failed: No token");
        return next(new Error("Authentication error: No token"));
      }

      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        socket.userId = decoded.id;
        socket.username = decoded.username;
        console.log("   ✅ Auth success for user:", decoded.username);
        next();
      } catch (err) {
        console.log("   ❌ Auth failed: Invalid token -", err.message);
        next(new Error("Authentication error: Invalid token"));
      }
    });

    io.on("connection", (socket) => {
      console.log("User " + socket.username + " connected to sockets");
      
      connectedUsers.set(socket.userId, socket.id);
      io.emit("user_online", { userId: socket.userId, username: socket.username });

      socket.on("join_chat", () => {
        socket.join("frella_chat");
        console.log(socket.username + " joined frella_chat room");
      });

      socket.on("send_message", async (data) => {
        console.log("Received send_message from", socket.username, ":", data);
        try {
          const { content, imageUrl, receiverId } = data;

          if (!content && !imageUrl) {
            console.log("Message rejected: no content or image");
            socket.emit("error", { message: "Message content or image is required" });
            return;
          }

          console.log("Creating message in database...");
          const message = await Message.create({
            content,
            imageUrl,
            senderId: socket.userId,
            receiverId,
          });
          console.log("Message created with ID:", message.id);

          const fullMessage = await Message.findByPk(message.id, {
            include: [
              { model: User, as: "sender", attributes: ["id", "username"] },
              { model: User, as: "receiver", attributes: ["id", "username"] },
            ],
          });

          console.log("Broadcasting message to frella_chat room");
          io.to("frella_chat").emit("new_message", fullMessage);

        } catch (error) {
          console.error("Error sending message:", error);
          socket.emit("error", { message: "Failed to send message: " + error.message });
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

      socket.on("disconnect", () => {
        console.log("User " + socket.username + " disconnected from sockets");
        connectedUsers.delete(socket.userId);
        io.emit("user_offline", { userId: socket.userId });
      });
    });

  } catch (error) {
    console.error("Error initializing socket server:");
    console.error(error);
  }
};

const getIO = () => io;

module.exports = initSocketServer;
module.exports.getIO = getIO;
