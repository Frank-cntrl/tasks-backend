const express = require("express");
const router = express.Router();
const { Message, User } = require("../database");
const { authenticateJWT } = require("../auth");
const { Op } = require("sequelize");

// Get all messages (between any users in the app)
router.get("/", authenticateJWT, async (req, res) => {
  try {
    const messages = await Message.findAll({
      include: [
        { model: User, as: "sender", attributes: ["id", "username"] },
        { model: User, as: "receiver", attributes: ["id", "username"] },
      ],
      order: [["createdAt", "ASC"]],
      limit: 100, // Limit to last 100 messages
    });
    res.json(messages);
  } catch (error) {
    console.error("Get messages error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get messages between current user and another user
router.get("/with/:userId", authenticateJWT, async (req, res) => {
  try {
    const otherUserId = parseInt(req.params.userId);
    
    const messages = await Message.findAll({
      where: {
        [Op.or]: [
          { senderId: req.user.id, receiverId: otherUserId },
          { senderId: otherUserId, receiverId: req.user.id },
        ],
      },
      include: [
        { model: User, as: "sender", attributes: ["id", "username"] },
        { model: User, as: "receiver", attributes: ["id", "username"] },
      ],
      order: [["createdAt", "ASC"]],
    });
    
    res.json(messages);
  } catch (error) {
    console.error("Get messages error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get unread message count
router.get("/unread", authenticateJWT, async (req, res) => {
  try {
    const count = await Message.count({
      where: {
        receiverId: req.user.id,
        read: false,
      },
    });
    res.json({ count });
  } catch (error) {
    console.error("Get unread count error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Mark messages as read
router.put("/read", authenticateJWT, async (req, res) => {
  try {
    const { messageIds } = req.body;
    
    await Message.update(
      { read: true },
      { 
        where: { 
          id: messageIds,
          receiverId: req.user.id 
        } 
      }
    );
    
    res.json({ message: "Messages marked as read" });
  } catch (error) {
    console.error("Mark read error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Delete a message (only sender can delete)
router.delete("/:id", authenticateJWT, async (req, res) => {
  try {
    const message = await Message.findByPk(req.params.id);
    
    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }
    
    if (message.senderId !== req.user.id) {
      return res.status(403).json({ error: "Not authorized to delete this message" });
    }
    
    await message.destroy();
    res.json({ message: "Message deleted" });
  } catch (error) {
    console.error("Delete message error:", error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
