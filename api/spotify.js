const express = require("express");
const router = express.Router();
const { SpotifyToken, User } = require("../database");
const { authenticateJWT } = require("../auth");

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const SPOTIFY_REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI || "http://localhost:8080/api/spotify/callback";
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

// Scopes needed for the app
const SCOPES = [
  "user-read-currently-playing",
  "user-read-recently-played",
  "user-read-playback-state",
].join(" ");

// Check if user has Spotify connected
router.get("/status", authenticateJWT, async (req, res) => {
  try {
    const token = await SpotifyToken.findOne({ where: { userId: req.user.id } });
    res.json({ connected: !!token });
  } catch (error) {
    console.error("Status check error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Redirect to Spotify OAuth
router.get("/auth", authenticateJWT, (req, res) => {
  const state = Buffer.from(JSON.stringify({ userId: req.user.id })).toString("base64");
  
  const authUrl = new URL("https://accounts.spotify.com/authorize");
  authUrl.searchParams.append("client_id", SPOTIFY_CLIENT_ID);
  authUrl.searchParams.append("response_type", "code");
  authUrl.searchParams.append("redirect_uri", SPOTIFY_REDIRECT_URI);
  authUrl.searchParams.append("scope", SCOPES);
  authUrl.searchParams.append("state", state);
  
  res.redirect(authUrl.toString());
});

// Handle OAuth callback
router.get("/callback", async (req, res) => {
  const { code, state, error } = req.query;

  if (error) {
    console.error("Spotify OAuth error:", error);
    return res.redirect(`${FRONTEND_URL}?spotify_error=${error}`);
  }

  if (!code || !state) {
    return res.redirect(`${FRONTEND_URL}?spotify_error=missing_params`);
  }

  try {
    // Decode state to get userId
    const { userId } = JSON.parse(Buffer.from(state, "base64").toString());

    // Exchange code for tokens
    const tokenResponse = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString("base64")}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: SPOTIFY_REDIRECT_URI,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error("Token exchange error:", tokenData);
      return res.redirect(`${FRONTEND_URL}?spotify_error=token_exchange_failed`);
    }

    // Calculate expiration time
    const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000);

    // Store or update tokens
    await SpotifyToken.upsert({
      userId,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresAt,
      scope: tokenData.scope,
    });

    res.redirect(`${FRONTEND_URL}?spotify_connected=true`);
  } catch (error) {
    console.error("Callback error:", error);
    res.redirect(`${FRONTEND_URL}?spotify_error=callback_failed`);
  }
});

// Helper function to refresh token if expired
async function getValidToken(userId) {
  const tokenRecord = await SpotifyToken.findOne({ where: { userId } });
  
  if (!tokenRecord) {
    return null;
  }

  // Check if token is expired (with 5 min buffer)
  if (new Date(tokenRecord.expiresAt) <= new Date(Date.now() + 5 * 60 * 1000)) {
    // Refresh the token
    const refreshResponse = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString("base64")}`,
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: tokenRecord.refreshToken,
      }),
    });

    const refreshData = await refreshResponse.json();

    if (!refreshResponse.ok) {
      console.error("Token refresh error:", refreshData);
      return null;
    }

    // Update stored token
    tokenRecord.accessToken = refreshData.access_token;
    tokenRecord.expiresAt = new Date(Date.now() + refreshData.expires_in * 1000);
    if (refreshData.refresh_token) {
      tokenRecord.refreshToken = refreshData.refresh_token;
    }
    await tokenRecord.save();
  }

  return tokenRecord.accessToken;
}

// Get currently playing track for a user
router.get("/currently-playing/:userId", authenticateJWT, async (req, res) => {
  try {
    const accessToken = await getValidToken(req.params.userId);
    
    if (!accessToken) {
      return res.status(404).json({ error: "User not connected to Spotify" });
    }

    const response = await fetch("https://api.spotify.com/v1/me/player/currently-playing", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (response.status === 204) {
      return res.json({ item: null }); // Nothing playing
    }

    if (!response.ok) {
      return res.status(response.status).json({ error: "Spotify API error" });
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("Currently playing error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get recently played tracks for a user
router.get("/recently-played/:userId", authenticateJWT, async (req, res) => {
  try {
    const accessToken = await getValidToken(req.params.userId);
    
    if (!accessToken) {
      return res.status(404).json({ error: "User not connected to Spotify" });
    }

    const response = await fetch("https://api.spotify.com/v1/me/player/recently-played?limit=10", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: "Spotify API error" });
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("Recently played error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Search tracks
router.get("/search", authenticateJWT, async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q) {
      return res.status(400).json({ error: "Query parameter 'q' is required" });
    }

    const accessToken = await getValidToken(req.user.id);
    
    if (!accessToken) {
      return res.status(404).json({ error: "User not connected to Spotify" });
    }

    const response = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(q)}&type=track&limit=10`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!response.ok) {
      return res.status(response.status).json({ error: "Spotify API error" });
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("Search error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Disconnect Spotify
router.delete("/disconnect", authenticateJWT, async (req, res) => {
  try {
    await SpotifyToken.destroy({ where: { userId: req.user.id } });
    res.json({ message: "Spotify disconnected" });
  } catch (error) {
    console.error("Disconnect error:", error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
