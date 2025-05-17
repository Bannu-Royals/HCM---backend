import express from 'express';
import multer from 'multer';
import { adminAuth } from '../middleware/authMiddleware.js';
import {
  uploadStudents,
  addStudent,
  listStudents,
  editStudent,
  deleteStudent
} from '../controllers/studentController.js';

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

// Upload students via Excel
router.post('/upload', adminAuth, upload.single('file'), uploadStudents);
// Manual add
router.post('/add', adminAuth, addStudent);
// List all
router.get('/', adminAuth, listStudents);
// Edit
router.put('/:id', adminAuth, editStudent);
// Delete
router.delete('/:id', adminAuth, deleteStudent);

export default router; 