const { DataTypes } = require("sequelize");
const db = require("./db");

const SpotifyToken = db.define("spotifytoken", {
  accessToken: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  refreshToken: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  scope: {
    type: DataTypes.STRING,
    allowNull: true,
  },
});

module.exports = SpotifyToken;
