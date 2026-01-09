const { describe, it, expect, beforeAll, afterAll, jest } = require("@jest/globals");

// Mock fetch globally
global.fetch = jest.fn();

// Mock the database models
jest.mock("../database", () => ({
  SpotifyToken: {
    findOne: jest.fn(),
    upsert: jest.fn(),
    destroy: jest.fn(),
  },
  User: {
    findByPk: jest.fn(),
  },
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
const spotifyRouter = require("../api/spotify");
const { SpotifyToken } = require("../database");

// Setup test app
const app = express();
app.use(express.json());
app.use("/api/spotify", spotifyRouter);

describe("Spotify API Routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("GET /api/spotify/status", () => {
    it("should return connected: true when user has Spotify token", async () => {
      SpotifyToken.findOne.mockResolvedValue({ id: 1, accessToken: "test" });

      const response = await request(app).get("/api/spotify/status");

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ connected: true });
      expect(SpotifyToken.findOne).toHaveBeenCalledWith({ where: { userId: 1 } });
    });

    it("should return connected: false when user has no Spotify token", async () => {
      SpotifyToken.findOne.mockResolvedValue(null);

      const response = await request(app).get("/api/spotify/status");

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ connected: false });
    });
  });

  describe("GET /api/spotify/auth", () => {
    it("should redirect to Spotify authorization URL", async () => {
      process.env.SPOTIFY_CLIENT_ID = "test_client_id";
      
      const response = await request(app).get("/api/spotify/auth");

      expect(response.status).toBe(302);
      expect(response.headers.location).toContain("accounts.spotify.com/authorize");
      expect(response.headers.location).toContain("client_id=test_client_id");
    });
  });

  describe("GET /api/spotify/currently-playing/:userId", () => {
    it("should return 404 when user is not connected to Spotify", async () => {
      SpotifyToken.findOne.mockResolvedValue(null);

      const response = await request(app).get("/api/spotify/currently-playing/1");

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: "User not connected to Spotify" });
    });

    it("should return currently playing track when user is connected", async () => {
      const mockToken = {
        accessToken: "valid_token",
        expiresAt: new Date(Date.now() + 3600000),
        save: jest.fn(),
      };
      SpotifyToken.findOne.mockResolvedValue(mockToken);

      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ item: { name: "Test Song" } }),
      });

      const response = await request(app).get("/api/spotify/currently-playing/1");

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("item");
    });

    it("should return null item when nothing is playing", async () => {
      const mockToken = {
        accessToken: "valid_token",
        expiresAt: new Date(Date.now() + 3600000),
        save: jest.fn(),
      };
      SpotifyToken.findOne.mockResolvedValue(mockToken);

      global.fetch.mockResolvedValue({
        ok: true,
        status: 204,
      });

      const response = await request(app).get("/api/spotify/currently-playing/1");

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ item: null });
    });
  });

  describe("GET /api/spotify/search", () => {
    it("should return 400 when query is missing", async () => {
      const response = await request(app).get("/api/spotify/search");

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: "Query parameter 'q' is required" });
    });

    it("should return search results when query is provided", async () => {
      const mockToken = {
        accessToken: "valid_token",
        expiresAt: new Date(Date.now() + 3600000),
        save: jest.fn(),
      };
      SpotifyToken.findOne.mockResolvedValue(mockToken);

      const mockResults = {
        tracks: {
          items: [{ id: "1", name: "Test Track" }],
        },
      };

      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResults),
      });

      const response = await request(app)
        .get("/api/spotify/search")
        .query({ q: "test song" });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockResults);
    });
  });

  describe("DELETE /api/spotify/disconnect", () => {
    it("should disconnect Spotify and return success", async () => {
      SpotifyToken.destroy.mockResolvedValue(1);

      const response = await request(app).delete("/api/spotify/disconnect");

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ message: "Spotify disconnected" });
      expect(SpotifyToken.destroy).toHaveBeenCalledWith({ where: { userId: 1 } });
    });
  });
});
