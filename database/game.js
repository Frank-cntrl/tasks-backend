const { DataTypes } = require("sequelize");
const db = require("./db");

const Game = db.define("game", {
  gameType: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      isIn: [["tictactoe", "checkers", "chess", "backgammon"]],
    },
  },
  state: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: {},
  },
  currentTurn: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: "User ID of whose turn it is",
  },
  player1Id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  player2Id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  winner: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: "User ID of winner, null if ongoing, 0 if draw",
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
});

module.exports = Game;
