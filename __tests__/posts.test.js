const { describe, it, expect, beforeEach, jest } = require("@jest/globals");

// Mock the database models
jest.mock("../database", () => ({
  Post: {
    findAll: jest.fn(),
    findByPk: jest.fn(),
    create: jest.fn(),
  },
  Like: {
    findOne: jest.fn(),
    create: jest.fn(),
  },
  Comment: {
    findAll: jest.fn(),
    findByPk: jest.fn(),
    create: jest.fn(),
  },
  User: {},
}));

// Mock authenticateJWT middleware
jest.mock("../auth", () => ({
  authenticateJWT: (req, res, next) => {
    req.user = { id: 1, username: "TestUser" };
    next();
  },
}));

const express = require("express");
const request = require("supertest");
const postsRouter = require("../api/posts");
const { Post, Like, Comment } = require("../database");

// Setup test app
const app = express();
app.use(express.json());
app.use("/api/posts", postsRouter);

describe("Posts API Routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("GET /api/posts", () => {
    it("should return all posts", async () => {
      const mockPosts = [
        { id: 1, content: "Test post", userId: 1 },
        { id: 2, content: "Another post", userId: 2 },
      ];
      Post.findAll.mockResolvedValue(mockPosts);

      const response = await request(app).get("/api/posts");

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockPosts);
      expect(Post.findAll).toHaveBeenCalled();
    });
  });

  describe("POST /api/posts", () => {
    it("should create a new post with content", async () => {
      const mockPost = { id: 1, content: "New post", userId: 1 };
      Post.create.mockResolvedValue(mockPost);
      Post.findByPk.mockResolvedValue(mockPost);

      const response = await request(app)
        .post("/api/posts")
        .send({ content: "New post" });

      expect(response.status).toBe(201);
      expect(Post.create).toHaveBeenCalledWith(
        expect.objectContaining({
          content: "New post",
          userId: 1,
        })
      );
    });

    it("should create a post with Spotify track", async () => {
      const mockPost = { 
        id: 1, 
        content: "Check this song", 
        spotifyTrackId: "abc123",
        spotifyType: "track",
        userId: 1 
      };
      Post.create.mockResolvedValue(mockPost);
      Post.findByPk.mockResolvedValue(mockPost);

      const response = await request(app)
        .post("/api/posts")
        .send({ 
          content: "Check this song",
          spotifyTrackId: "abc123",
          spotifyType: "track"
        });

      expect(response.status).toBe(201);
      expect(Post.create).toHaveBeenCalledWith(
        expect.objectContaining({
          spotifyTrackId: "abc123",
          spotifyType: "track",
        })
      );
    });

    it("should return 400 if neither content nor track is provided", async () => {
      const response = await request(app)
        .post("/api/posts")
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: "Content or Spotify track is required" });
    });
  });

  describe("DELETE /api/posts/:id", () => {
    it("should delete own post", async () => {
      const mockPost = { 
        id: 1, 
        userId: 1, 
        destroy: jest.fn().mockResolvedValue(true) 
      };
      Post.findByPk.mockResolvedValue(mockPost);

      const response = await request(app).delete("/api/posts/1");

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ message: "Post deleted" });
      expect(mockPost.destroy).toHaveBeenCalled();
    });

    it("should return 404 if post not found", async () => {
      Post.findByPk.mockResolvedValue(null);

      const response = await request(app).delete("/api/posts/999");

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: "Post not found" });
    });

    it("should return 403 if trying to delete another user's post", async () => {
      const mockPost = { id: 1, userId: 2 }; // Different user
      Post.findByPk.mockResolvedValue(mockPost);

      const response = await request(app).delete("/api/posts/1");

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ error: "Not authorized to delete this post" });
    });
  });

  describe("POST /api/posts/:id/like", () => {
    it("should like a post", async () => {
      Post.findByPk.mockResolvedValue({ id: 1 });
      Like.findOne.mockResolvedValue(null);
      Like.create.mockResolvedValue({ id: 1, postId: 1, userId: 1 });

      const response = await request(app).post("/api/posts/1/like");

      expect(response.status).toBe(201);
      expect(Like.create).toHaveBeenCalledWith({ postId: 1, userId: 1 });
    });

    it("should return 400 if already liked", async () => {
      Post.findByPk.mockResolvedValue({ id: 1 });
      Like.findOne.mockResolvedValue({ id: 1 }); // Already liked

      const response = await request(app).post("/api/posts/1/like");

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: "Already liked" });
    });

    it("should return 404 if post not found", async () => {
      Post.findByPk.mockResolvedValue(null);

      const response = await request(app).post("/api/posts/999/like");

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: "Post not found" });
    });
  });

  describe("DELETE /api/posts/:id/like", () => {
    it("should unlike a post", async () => {
      const mockLike = { destroy: jest.fn().mockResolvedValue(true) };
      Like.findOne.mockResolvedValue(mockLike);

      const response = await request(app).delete("/api/posts/1/like");

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ message: "Unliked" });
      expect(mockLike.destroy).toHaveBeenCalled();
    });

    it("should return 404 if like not found", async () => {
      Like.findOne.mockResolvedValue(null);

      const response = await request(app).delete("/api/posts/1/like");

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: "Like not found" });
    });
  });

  describe("POST /api/posts/:id/comments", () => {
    it("should add a comment to a post", async () => {
      Post.findByPk.mockResolvedValue({ id: 1 });
      const mockComment = { id: 1, content: "Nice!", postId: 1, userId: 1 };
      Comment.create.mockResolvedValue(mockComment);
      Comment.findByPk.mockResolvedValue(mockComment);

      const response = await request(app)
        .post("/api/posts/1/comments")
        .send({ content: "Nice!" });

      expect(response.status).toBe(201);
      expect(Comment.create).toHaveBeenCalledWith({
        content: "Nice!",
        postId: 1,
        userId: 1,
      });
    });

    it("should return 400 if content is empty", async () => {
      Post.findByPk.mockResolvedValue({ id: 1 });

      const response = await request(app)
        .post("/api/posts/1/comments")
        .send({ content: "" });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: "Comment content is required" });
    });

    it("should return 404 if post not found", async () => {
      Post.findByPk.mockResolvedValue(null);

      const response = await request(app)
        .post("/api/posts/999/comments")
        .send({ content: "Comment" });

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: "Post not found" });
    });
  });

  describe("DELETE /api/posts/:postId/comments/:commentId", () => {
    it("should delete own comment", async () => {
      const mockComment = { 
        id: 1, 
        userId: 1, 
        destroy: jest.fn().mockResolvedValue(true) 
      };
      Comment.findByPk.mockResolvedValue(mockComment);

      const response = await request(app).delete("/api/posts/1/comments/1");

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ message: "Comment deleted" });
      expect(mockComment.destroy).toHaveBeenCalled();
    });

    it("should return 403 if trying to delete another user's comment", async () => {
      const mockComment = { id: 1, userId: 2 }; // Different user
      Comment.findByPk.mockResolvedValue(mockComment);

      const response = await request(app).delete("/api/posts/1/comments/1");

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ error: "Not authorized to delete this comment" });
    });
  });
});
