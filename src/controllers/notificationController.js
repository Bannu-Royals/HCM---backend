import Notification from '../models/Notification.js';
import { createError } from '../utils/error.js';

// Get user's notifications
export const getNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ recipient: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({
      success: true,
      data: notifications
    });
  } catch (err) {
    console.error('Error fetching notifications:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notifications'
    });
  }
};

// Create a notification
export const createNotification = async (data) => {
  try {
    const notification = new Notification(data);
    await notification.save();
    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
    return null;
  }
};

// Get unread notifications for a user
export const getUnreadNotifications = async (req, res, next) => {
  try {
    const notifications = await Notification.find({
      recipient: req.user._id,
      isRead: false
    })
    .sort({ createdAt: -1 })
    .populate('sender', 'name')
    .limit(50);

    res.json({
      success: true,
      data: notifications
    });
  } catch (error) {
    next(error);
  }
};

// Mark notification as read and delete it
export const markAsRead = async (req, res, next) => {
  try {
    const { notificationId } = req.params;

    const notification = await Notification.findOne({
      _id: notificationId,
      recipient: req.user._id
    });

    if (!notification) {
      throw createError(404, 'Notification not found');
    }

    await notification.deleteOne();

    res.json({
      success: true,
      message: 'Notification marked as read and deleted'
    });
  } catch (error) {
    next(error);
  }
};

// Mark all notifications as read
export const markAllAsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { recipient: req.user._id, isRead: false },
      { isRead: true }
    );

    res.json({
      success: true,
      message: 'All notifications marked as read'
    });
  } catch (err) {
    console.error('Error marking all notifications as read:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to mark all notifications as read'
    });
  }
};

// Delete notification
export const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const notification = await Notification.findOneAndDelete({
      _id: id,
      recipient: req.user._id
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    res.json({
      success: true,
      message: 'Notification deleted successfully'
    });
  } catch (err) {
    console.error('Error deleting notification:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to delete notification'
    });
  }
};

// Get unread notification count
export const getUnreadCount = async (req, res, next) => {
  try {
    const count = await Notification.countDocuments({
      recipient: req.user._id,
      isRead: false
    });

    res.json({
      success: true,
      count
    });
  } catch (error) {
    next(error);
  }
}; 