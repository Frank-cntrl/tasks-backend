const db = require("./db");
const User = require("./user");
const TodoList = require("./todolist");
const Task = require("./task");
const SpotifyToken = require("./spotifyToken");
const Post = require("./post");
const Like = require("./like");
const Comment = require("./comment");
const Message = require("./message");

// ========== TodoList Associations ==========
// A User has many TodoLists
User.hasMany(TodoList, { foreignKey: "userId", onDelete: "CASCADE" });
TodoList.belongsTo(User, { foreignKey: "userId" });

// A TodoList has many Tasks
TodoList.hasMany(Task, { foreignKey: "todolistId", onDelete: "CASCADE" });
Task.belongsTo(TodoList, { foreignKey: "todolistId" });

// A User has many Tasks (through TodoLists)
User.hasMany(Task, { foreignKey: "userId", onDelete: "CASCADE" });
Task.belongsTo(User, { foreignKey: "userId" });

// ========== Spotify Token Associations ==========
// A User has one SpotifyToken
User.hasOne(SpotifyToken, { foreignKey: "userId", onDelete: "CASCADE" });
SpotifyToken.belongsTo(User, { foreignKey: "userId" });

// ========== Post Associations ==========
// A User has many Posts
User.hasMany(Post, { foreignKey: "userId", onDelete: "CASCADE" });
Post.belongsTo(User, { foreignKey: "userId" });

// ========== Like Associations ==========
// A User has many Likes
User.hasMany(Like, { foreignKey: "userId", onDelete: "CASCADE" });
Like.belongsTo(User, { foreignKey: "userId" });

// A Post has many Likes
Post.hasMany(Like, { foreignKey: "postId", onDelete: "CASCADE" });
Like.belongsTo(Post, { foreignKey: "postId" });

// ========== Comment Associations ==========
// A User has many Comments
User.hasMany(Comment, { foreignKey: "userId", onDelete: "CASCADE" });
Comment.belongsTo(User, { foreignKey: "userId" });

// A Post has many Comments
Post.hasMany(Comment, { foreignKey: "postId", onDelete: "CASCADE" });
Comment.belongsTo(Post, { foreignKey: "postId" });

// ========== Message Associations ==========
// A User sends many Messages
User.hasMany(Message, { as: "sentMessages", foreignKey: "senderId", onDelete: "CASCADE" });
Message.belongsTo(User, { as: "sender", foreignKey: "senderId" });

// A User receives many Messages
User.hasMany(Message, { as: "receivedMessages", foreignKey: "receiverId", onDelete: "CASCADE" });
Message.belongsTo(User, { as: "receiver", foreignKey: "receiverId" });

module.exports = {
  db,
  User,
  TodoList,
  Task,
  SpotifyToken,
  Post,
  Like,
  Comment,
  Message,
};
