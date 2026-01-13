const db = require("./db");
const { User, TodoList, Task, Board } = require("./index");

const seed = async () => {
  try {
    db.logging = false;
    await db.sync({ force: true }); // Drop and recreate tables

    // Create users
    const users = await User.bulkCreate([
      { username: "Frank", pin: "1739" },
      { username: "Ella", pin: "2525" },
    ]);

    console.log(`👤 Created ${users.length} users`);

    // Create TodoLists
    const todoLists = await TodoList.bulkCreate([
      {
        title: "Frank's Personal Tasks",
        description: "My personal to-do items",
        userId: users[0].id,
        isShared: false,
      },
      {
        title: "Ella's Personal Tasks",
        description: "My personal to-do items",
        userId: users[1].id,
        isShared: false,
      },
      {
        title: "Household Chores",
        description: "Shared household tasks",
        userId: users[0].id,
        isShared: true,
      },
      {
        title: "Grocery Shopping",
        description: "Things we need to buy",
        userId: users[1].id,
        isShared: true,
      },
    ]);

    console.log(`📋 Created ${todoLists.length} todo lists`);

    // Create Tasks
    const tasks = await Task.bulkCreate([
      {
        title: "Finish project report",
        description: "Complete the quarterly report",
        todolistId: todoLists[0].id,
        userId: users[0].id,
        priority: "high",
        dueDate: new Date("2026-01-15"),
      },
      {
        title: "Call dentist",
        description: "Schedule annual checkup",
        todolistId: todoLists[1].id,
        userId: users[1].id,
        priority: "medium",
      },
      {
        title: "Clean kitchen",
        description: "Deep clean counters and appliances",
        todolistId: todoLists[2].id,
        userId: users[0].id,
        priority: "medium",
      },
      {
        title: "Vacuum living room",
        description: "Vacuum and dust furniture",
        todolistId: todoLists[2].id,
        userId: users[1].id,
        priority: "low",
        isCompleted: true,
      },
      {
        title: "Buy milk",
        description: "Get 2% milk",
        todolistId: todoLists[3].id,
        userId: users[1].id,
        priority: "high",
        dueDate: new Date("2026-01-09"),
      },
      {
        title: "Get bread and eggs",
        description: "Whole wheat bread and a dozen eggs",
        todolistId: todoLists[3].id,
        userId: users[0].id,
        priority: "medium",
      },
    ]);

    console.log(`✅ Created ${tasks.length} tasks`);

    // Create sample boards
    const boards = await Board.bulkCreate([
      {
        boardId: "sample-board-1",
        name: "Frank's Drawing Board",
        createdBy: users[0].id,
        lastModifiedBy: users[0].id,
      },
      {
        boardId: "sample-board-2", 
        name: "Shared Brainstorm",
        createdBy: users[1].id,
        lastModifiedBy: users[1].id,
      },
    ]);

    console.log(`🎨 Created ${boards.length} boards`);

    console.log("🌱 Seeded the database");
  } catch (error) {
    console.error("Error seeding database:", error);
    if (error.message.includes("does not exist")) {
      console.log("\n🤔🤔🤔 Have you created your database??? 🤔🤔🤔");
    }
  }
  db.close();
};

seed();
