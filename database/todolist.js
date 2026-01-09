const { DataTypes } = require("sequelize");
const db = require("./db");

const TodoList = db.define("todolist", {
  title: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      len: [1, 100],
    },
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  isCompleted: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  isShared: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
});

module.exports = TodoList;
