const db = require("./db");
const User = require("./user");
const TodoList = require("./todolist");
const Task = require("./task");

// Define associations
// A User has many TodoLists
User.hasMany(TodoList, { foreignKey: "userId", onDelete: "CASCADE" });
TodoList.belongsTo(User, { foreignKey: "userId" });

// A TodoList has many Tasks
TodoList.hasMany(Task, { foreignKey: "todolistId", onDelete: "CASCADE" });
Task.belongsTo(TodoList, { foreignKey: "todolistId" });

// A User has many Tasks (through TodoLists)
User.hasMany(Task, { foreignKey: "userId", onDelete: "CASCADE" });
Task.belongsTo(User, { foreignKey: "userId" });

module.exports = {
  db,
  User,
  TodoList,
  Task,
};
