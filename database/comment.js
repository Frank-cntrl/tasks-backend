const { DataTypes } = require("sequelize");
const db = require("./db");

const Comment = db.define("comment", {
  content: {
    type: DataTypes.TEXT,
    allowNull: false,
    validate: {
      len: [1, 1000],
    },
  },
});

module.exports = Comment;
