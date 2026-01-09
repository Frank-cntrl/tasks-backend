const express = require("express");
const router = express.Router();
const { authenticateJWT } = require("../auth");
const cloudinary = require("cloudinary").v2;

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Folder structure for different features
const FOLDERS = {
  messages: "frella/messages",
  documents: "frella/documents",
  moodboard: "frella/moodboard",
  collage: "frella/collage",
  profile: "frella/profiles",
};

// Upload image via base64 or URL
router.post("/image", authenticateJWT, async (req, res) => {
  try {
    const { image, folder = "messages" } = req.body;

    if (!image) {
      return res.status(400).json({ error: "Image data is required" });
    }

    const folderPath = FOLDERS[folder] || FOLDERS.messages;

    const result = await cloudinary.uploader.upload(image, {
      folder: folderPath,
      resource_type: "image",
      transformation: [
        { quality: "auto:good" },
        { fetch_format: "auto" },
      ],
    });

    res.json({
      url: result.secure_url,
      publicId: result.public_id,
      width: result.width,
      height: result.height,
    });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ error: "Failed to upload image" });
  }
});

// Upload multiple images
router.post("/images", authenticateJWT, async (req, res) => {
  try {
    const { images, folder = "messages" } = req.body;

    if (!images || !Array.isArray(images)) {
      return res.status(400).json({ error: "Images array is required" });
    }

    const folderPath = FOLDERS[folder] || FOLDERS.messages;

    const uploadPromises = images.map((image) =>
      cloudinary.uploader.upload(image, {
        folder: folderPath,
        resource_type: "image",
        transformation: [
          { quality: "auto:good" },
          { fetch_format: "auto" },
        ],
      })
    );

    const results = await Promise.all(uploadPromises);

    res.json(
      results.map((result) => ({
        url: result.secure_url,
        publicId: result.public_id,
        width: result.width,
        height: result.height,
      }))
    );
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ error: "Failed to upload images" });
  }
});

// Delete image
router.delete("/image/:publicId", authenticateJWT, async (req, res) => {
  try {
    const { publicId } = req.params;

    // Decode the publicId (it may contain slashes encoded as %2F)
    const decodedId = decodeURIComponent(publicId);

    await cloudinary.uploader.destroy(decodedId);

    res.json({ message: "Image deleted successfully" });
  } catch (error) {
    console.error("Delete error:", error);
    res.status(500).json({ error: "Failed to delete image" });
  }
});

// Get signed upload URL (for direct browser uploads)
router.get("/signature", authenticateJWT, async (req, res) => {
  try {
    const { folder = "messages" } = req.query;
    const folderPath = FOLDERS[folder] || FOLDERS.messages;

    const timestamp = Math.round(new Date().getTime() / 1000);

    const signature = cloudinary.utils.api_sign_request(
      {
        timestamp,
        folder: folderPath,
      },
      process.env.CLOUDINARY_API_SECRET
    );

    res.json({
      signature,
      timestamp,
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      apiKey: process.env.CLOUDINARY_API_KEY,
      folder: folderPath,
    });
  } catch (error) {
    console.error("Signature error:", error);
    res.status(500).json({ error: "Failed to generate signature" });
  }
});

module.exports = router;
