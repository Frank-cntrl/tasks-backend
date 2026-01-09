const express = require("express");
const router = express.Router();
const { Post, Like, Comment, User } = require("../database");
const { authenticateJWT } = require("../auth");

// Get all posts (feed)
router.get("/", authenticateJWT, async (req, res) => {
  try {
    const posts = await Post.findAll({
      include: [
        { model: User, attributes: ["id", "username"] },
        { model: Like, attributes: ["id", "userId"] },
        { model: Comment, attributes: ["id"] },
      ],
      order: [["createdAt", "DESC"]],
    });
    res.json(posts);
  } catch (error) {
    console.error("Get posts error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get single post
router.get("/:id", authenticateJWT, async (req, res) => {
  try {
    const post = await Post.findByPk(req.params.id, {
      include: [
        { model: User, attributes: ["id", "username"] },
        { model: Like, attributes: ["id", "userId"] },
        { model: Comment, include: [{ model: User, attributes: ["id", "username"] }] },
      ],
    });

    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    res.json(post);
  } catch (error) {
    console.error("Get post error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Create a post
router.post("/", authenticateJWT, async (req, res) => {
  try {
    const { content, spotifyTrackId, spotifyType } = req.body;

    if (!content && !spotifyTrackId) {
      return res.status(400).json({ error: "Content or Spotify track is required" });
    }

    const post = await Post.create({
      content,
      spotifyTrackId,
      spotifyType: spotifyType || "track",
      userId: req.user.id,
    });

    // Fetch the created post with associations
    const createdPost = await Post.findByPk(post.id, {
      include: [
        { model: User, attributes: ["id", "username"] },
        { model: Like, attributes: ["id", "userId"] },
        { model: Comment, attributes: ["id"] },
      ],
    });

    res.status(201).json(createdPost);
  } catch (error) {
    console.error("Create post error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Update a post
router.put("/:id", authenticateJWT, async (req, res) => {
  try {
    const post = await Post.findByPk(req.params.id);

    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    if (post.userId !== req.user.id) {
      return res.status(403).json({ error: "Not authorized to update this post" });
    }

    const { content } = req.body;
    post.content = content;
    await post.save();

    res.json(post);
  } catch (error) {
    console.error("Update post error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Delete a post
router.delete("/:id", authenticateJWT, async (req, res) => {
  try {
    const post = await Post.findByPk(req.params.id);

    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    if (post.userId !== req.user.id) {
      return res.status(403).json({ error: "Not authorized to delete this post" });
    }

    await post.destroy();
    res.json({ message: "Post deleted" });
  } catch (error) {
    console.error("Delete post error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ========== Likes ==========

// Like a post
router.post("/:id/like", authenticateJWT, async (req, res) => {
  try {
    const post = await Post.findByPk(req.params.id);

    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    // Check if already liked
    const existingLike = await Like.findOne({
      where: { postId: post.id, userId: req.user.id },
    });

    if (existingLike) {
      return res.status(400).json({ error: "Already liked" });
    }

    const like = await Like.create({
      postId: post.id,
      userId: req.user.id,
    });

    res.status(201).json(like);
  } catch (error) {
    console.error("Like post error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Unlike a post
router.delete("/:id/like", authenticateJWT, async (req, res) => {
  try {
    const like = await Like.findOne({
      where: { postId: req.params.id, userId: req.user.id },
    });

    if (!like) {
      return res.status(404).json({ error: "Like not found" });
    }

    await like.destroy();
    res.json({ message: "Unliked" });
  } catch (error) {
    console.error("Unlike post error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ========== Comments ==========

// Get comments for a post
router.get("/:id/comments", authenticateJWT, async (req, res) => {
  try {
    const comments = await Comment.findAll({
      where: { postId: req.params.id },
      include: [{ model: User, attributes: ["id", "username"] }],
      order: [["createdAt", "ASC"]],
    });
    res.json(comments);
  } catch (error) {
    console.error("Get comments error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Add a comment
router.post("/:id/comments", authenticateJWT, async (req, res) => {
  try {
    const post = await Post.findByPk(req.params.id);

    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    const { content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: "Comment content is required" });
    }

    const comment = await Comment.create({
      content: content.trim(),
      postId: post.id,
      userId: req.user.id,
    });

    // Fetch with user info
    const createdComment = await Comment.findByPk(comment.id, {
      include: [{ model: User, attributes: ["id", "username"] }],
    });

    res.status(201).json(createdComment);
  } catch (error) {
    console.error("Add comment error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Delete a comment
router.delete("/:postId/comments/:commentId", authenticateJWT, async (req, res) => {
  try {
    const comment = await Comment.findByPk(req.params.commentId);

    if (!comment) {
      return res.status(404).json({ error: "Comment not found" });
    }

    if (comment.userId !== req.user.id) {
      return res.status(403).json({ error: "Not authorized to delete this comment" });
    }

    await comment.destroy();
    res.json({ message: "Comment deleted" });
  } catch (error) {
    console.error("Delete comment error:", error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
