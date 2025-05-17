import Announcement from '../models/Announcement.js';
import Notification from '../models/Notification.js';
import User from '../models/User.js';

// Admin: create announcement
export const createAnnouncement = async (req, res) => {
  try {
    const { title, description } = req.body;
    const announcement = await Announcement.create({
      title,
      description,
      createdBy: req.user._id
    });
    // Notify all students
    const students = await User.find({ role: 'student' });
    for (const student of students) {
      await Notification.createNotification({
        recipient: student._id,
        type: 'announcement',
        title: 'New Announcement',
        message: title,
        relatedTo: announcement._id,
        onModel: 'Announcement'
      });
    }
    res.json({ success: true, data: announcement });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error creating announcement', error: error.message });
  }
};

// List all announcements (active)
export const listAnnouncements = async (req, res) => {
  try {
    const announcements = await Announcement.find({ isActive: true }).sort({ createdAt: -1 });
    res.json({ success: true, data: announcements });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching announcements', error: error.message });
  }
};

// List all announcements (admin, active and inactive)
export const listAllAnnouncements = async (req, res) => {
  try {
    const announcements = await Announcement.find().sort({ createdAt: -1 });
    res.json({ success: true, data: announcements });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching announcements', error: error.message });
  }
};

// Admin: delete announcement
export const deleteAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;
    const announcement = await Announcement.findByIdAndUpdate(id, { isActive: false }, { new: true });
    if (!announcement) return res.status(404).json({ success: false, message: 'Announcement not found' });
    res.json({ success: true, message: 'Announcement deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error deleting announcement', error: error.message });
  }
}; 