const { DataTypes } = require("sequelize");
const db = require("./db");

const Board = db.define("board", {
  boardId: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: "Untitled Board",
  },
  snapshot: {
    type: DataTypes.JSON, // Store tldraw snapshot as JSON
    allowNull: true,
  },
  createdBy: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  lastModifiedBy: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
});

module.exports = Board;
