import express from 'express';
import { adminAuth, authenticateStudent } from '../middleware/authMiddleware.js';
import {
  createAnnouncement,
  listAnnouncements,
  deleteAnnouncement,
  listAllAnnouncements
} from '../controllers/announcementController.js';

const router = express.Router();

// Admin: create
router.post('/', adminAuth, createAnnouncement);
// Admin: delete
router.delete('/:id', adminAuth, deleteAnnouncement);
// List (all users)
router.get('/', authenticateStudent, listAnnouncements);
// Admin: get all announcements (active and inactive)
router.get('/admin/all', adminAuth, listAllAnnouncements);

export default router; 