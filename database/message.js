const { DataTypes } = require("sequelize");
const db = require("./db");

const Message = db.define("message", {
  content: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  imageUrl: {
    type: DataTypes.STRING(500),
    allowNull: true,
  },
  read: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  // senderId and receiverId will be added through associations
});

module.exports = Message;
