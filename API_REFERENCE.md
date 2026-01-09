# API Reference - Todo Application

## Database Schema

### Users
- `id` - Primary key
- `username` - Unique username
- `email` - Email address (optional)
- `passwordHash` - Hashed password
- `auth0Id` - Auth0 ID (optional)

### TodoLists
- `id` - Primary key
- `title` - Title of the todo list (required)
- `description` - Description (optional)
- `isCompleted` - Boolean flag (default: false)
- `userId` - Foreign key to Users
- `createdAt` - Timestamp
- `updatedAt` - Timestamp

### Tasks
- `id` - Primary key
- `title` - Title of the task (required)
- `description` - Description (optional)
- `isCompleted` - Boolean flag (default: false)
- `dueDate` - Due date (optional)
- `priority` - Enum: 'low', 'medium', 'high' (default: 'medium')
- `todolistId` - Foreign key to TodoLists
- `userId` - Foreign key to Users
- `createdAt` - Timestamp
- `updatedAt` - Timestamp

## Relationships
- A User has many TodoLists
- A TodoList belongs to a User
- A TodoList has many Tasks
- A Task belongs to a TodoList
- A Task belongs to a User

## API Endpoints

All endpoints except authentication routes require JWT authentication via cookie.

### Authentication
- `POST /auth/signup` - Create a new user
- `POST /auth/login` - Login with username/password
- `POST /auth/auth0` - Login with Auth0
- `POST /auth/logout` - Logout
- `GET /auth/me` - Get current user

### TodoLists

#### Get all TodoLists
```
GET /api/todolists
```
Returns all TodoLists for the authenticated user, including associated tasks.

#### Get a specific TodoList
```
GET /api/todolists/:id
```
Returns a specific TodoList with its tasks.

#### Create a TodoList
```
POST /api/todolists
Content-Type: application/json

{
  "title": "My Todo List",
  "description": "Optional description"
}
```

#### Update a TodoList
```
PUT /api/todolists/:id
Content-Type: application/json

{
  "title": "Updated Title",
  "description": "Updated description",
  "isCompleted": true
}
```

#### Delete a TodoList
```
DELETE /api/todolists/:id
```
Deletes the TodoList and all associated tasks (cascade delete).

### Tasks

#### Get all Tasks
```
GET /api/tasks
```
Returns all Tasks for the authenticated user, including the parent TodoList.

#### Get a specific Task
```
GET /api/tasks/:id
```
Returns a specific Task with its parent TodoList.

#### Create a Task
```
POST /api/tasks
Content-Type: application/json

{
  "title": "My Task",
  "description": "Optional description",
  "todolistId": 1,
  "dueDate": "2026-02-01",
  "priority": "high"
}
```

#### Update a Task
```
PUT /api/tasks/:id
Content-Type: application/json

{
  "title": "Updated Title",
  "description": "Updated description",
  "isCompleted": true,
  "dueDate": "2026-02-15",
  "priority": "medium",
  "todolistId": 2
}
```

#### Delete a Task
```
DELETE /api/tasks/:id
```

## Setup Instructions

### 1. Database Setup
Make sure you have PostgreSQL installed and create a database:
```bash
createdb frella
```

### 2. Install Dependencies
```bash
cd Capstone-2-Backend
npm install
```

### 3. Environment Variables
Create a `.env` file in the backend directory:
```
DATABASE_URL=postgres://localhost:5432/frella
JWT_SECRET=your-secret-key
FRONTEND_URL=http://localhost:3000
NODE_ENV=development
```

### 4. Seed the Database
```bash
node database/seed.js
```

This will create:
- 3 test users
- 4 sample TodoLists
- 6 sample Tasks

### 5. Start the Server
```bash
npm start
```

The server will run on `http://localhost:8080`

## Testing

You can test the endpoints using:
- Postman
- cURL
- Your frontend application

Example using cURL:
```bash
# Login
curl -X POST http://localhost:8080/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' \
  -c cookies.txt

# Get TodoLists
curl -X GET http://localhost:8080/api/todolists \
  -b cookies.txt

# Create a TodoList
curl -X POST http://localhost:8080/api/todolists \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"title":"New List","description":"Test list"}'
```

## Security Features

- JWT-based authentication
- Password hashing with bcrypt
- User ownership verification on all resources
- HTTP-only cookies for token storage
- CORS configuration
