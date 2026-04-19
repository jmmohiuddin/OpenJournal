import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import {
  createEntry,
  getEntries,
  getEntry,
  updateEntry,
  deleteEntry,
  getInsights,
  createEntryFromImage,
  exportUserData
} from '../controllers/entryController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Multer config — memory storage, 5MB limit, images only (used for OCR / V2)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

import os from 'os';

// Multer config — disk storage (used for direct attachment / V1)
const isVercel = process.env.VERCEL || process.env.VERCEL_ENV;
const storageDir = isVercel 
  ? path.join(os.tmpdir(), 'openjournal-uploads')
  : path.join(process.cwd(), 'public/uploads');

try {
  if (!fs.existsSync(storageDir)) fs.mkdirSync(storageDir, { recursive: true });
} catch (err) {
  console.error('Failed to create upload directory:', err.message);
}

const diskStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, storageDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  }
});
const diskUpload = multer({
  storage: diskStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit for attachments
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'), false);
  }
});

// All routes are protected
router.use(protect);

// Insights route (must be before /:id)
router.get('/insights', getInsights);

// Data export
router.get('/export', exportUserData);

// Image upload (OCR → entry) [V2]
router.post('/image', upload.single('image'), createEntryFromImage);

// Direct Image upload (attachment → URL) [V1]
router.post('/upload-image', diskUpload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No file uploaded' });
  }
  // Standardize the URL mapping to the express static path we added in app.js
  const fileUrl = `${process.env.SERVER_URL || 'http://localhost:5001'}/uploads/${req.file.filename}`;
  res.json({ success: true, url: fileUrl });
});

// CRUD routes
router.route('/')
  .get(getEntries)
  .post(createEntry);

router.route('/:id')
  .get(getEntry)
  .put(updateEntry)
  .delete(deleteEntry);

export default router;
