import express from 'express';
import { authenticateStudent, adminAuth } from '../middleware/authMiddleware.js';
import {
  createComplaint,
  listMyComplaints,
  giveFeedback,
  getComplaintTimeline,
  listAllComplaints,
  updateComplaintStatus,
  adminGetTimeline,
  getComplaintDetails
} from '../controllers/complaintController.js';

const router = express.Router();

// Student routes
router.post('/', authenticateStudent, createComplaint);
router.get('/my', authenticateStudent, listMyComplaints);
router.get('/:id', authenticateStudent, getComplaintDetails);
router.post('/:id/feedback', authenticateStudent, giveFeedback);
router.get('/:id/timeline', authenticateStudent, getComplaintTimeline);

// Admin routes
router.get('/admin/all', adminAuth, listAllComplaints);
router.put('/admin/:id/status', adminAuth, updateComplaintStatus);
router.get('/admin/:id/timeline', adminAuth, adminGetTimeline);

export default router; 