const { DataTypes } = require("sequelize");
const db = require("./db");

const Board = db.define("board", {
  boardId: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  snapshot: {
    type: DataTypes.JSON, // Store tldraw snapshot as JSON
    allowNull: true,
  },
  lastModifiedBy: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
});

module.exports = Board;
