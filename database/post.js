const { DataTypes } = require("sequelize");
const db = require("./db");

const Post = db.define("post", {
  content: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  spotifyTrackId: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  spotifyType: {
    type: DataTypes.ENUM("track", "album", "playlist"),
    defaultValue: "track",
  },
});

module.exports = Post;
