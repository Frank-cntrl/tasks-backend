const { DataTypes } = require("sequelize");
const db = require("./db");

const Like = db.define("like", {
  // userId and postId will be added as foreign keys through associations
});

module.exports = Like;
