import Complaint from '../models/Complaint.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import Member from '../models/Member.js';
import mongoose from 'mongoose';
import { createError } from '../utils/error.js';
import { createNotification } from './notificationController.js';

// Student: create complaint
export const createComplaint = async (req, res, next) => {
  try {
    const { category, subCategory, description } = req.body;
    const studentId = req.user._id;

    console.log('Creating complaint:', {
      studentId,
      category,
      subCategory,
      descriptionLength: description?.length
    });

    // Validate category and subcategory
    if (!category) {
      return res.status(400).json({
        success: false,
        message: 'Category is required'
      });
    }

    if (category === 'Maintenance' && !subCategory) {
      return res.status(400).json({
        success: false,
        message: 'Sub-category is required for Maintenance complaints'
      });
    }

    if (!description || !description.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Description is required'
      });
    }

    // Validate student exists
    const student = await User.findById(studentId);
    if (!student) {
      console.error('Student not found:', studentId);
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    const complaint = await Complaint.create({
      student: studentId,
      category,
      subCategory,
      description: description.trim()
    });

    // Populate student details for response
    await complaint.populate('student', 'name rollNumber');

    // Get all admin users
    const admins = await User.find({ role: 'admin' });
    
    // Create notifications for all admins
    await Promise.all(admins.map(admin => 
      createNotification({
        type: 'complaint',
        recipient: admin._id,
        sender: req.user._id,
        message: `New complaint received: ${complaint.description}`,
        relatedId: complaint._id,
        onModel: 'Complaint'
      })
    ));

    res.status(201).json({
      success: true,
      data: complaint
    });
  } catch (err) {
    console.error('Error creating complaint:', err);
    if (err.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: err.message,
        errors: Object.values(err.errors).map(e => e.message)
      });
    }
    res.status(500).json({
      success: false,
      message: 'Failed to create complaint',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// Student: list own complaints
export const listMyComplaints = async (req, res) => {
  try {
    console.log('Fetching complaints for student:', req.user._id);
    
    const complaints = await Complaint.find({ student: req.user._id })
      .populate('student', 'name rollNumber')
      .populate({
        path: 'assignedTo',
        select: 'name category phone email',
        model: 'Member'
      })
      .sort({ createdAt: -1 })
      .lean();

    console.log('Found complaints:', complaints.length);
    console.log('Sample complaint:', complaints[0] ? {
      id: complaints[0]._id,
      hasAssignedTo: !!complaints[0].assignedTo,
      assignedToDetails: complaints[0].assignedTo
    } : 'No complaints found');

    res.json({
      success: true,
      data: {
        complaints
      }
    });
  } catch (error) {
    console.error('Error fetching complaints:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching complaints',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Student: feedback on resolved complaint
export const giveFeedback = async (req, res) => {
  try {
    const { id } = req.params;
    const { isSatisfied, comment } = req.body;
    const complaint = await Complaint.findOne({ _id: id, student: req.user._id });
    if (!complaint) return res.status(404).json({ message: 'Complaint not found' });

    console.log(`Status of complaint ${id} BEFORE calling addFeedback: ${complaint.currentStatus}`);

    await complaint.addFeedback(isSatisfied, comment);
    // Notify admin(s) if not satisfied
    if (!isSatisfied) {
      const admins = await User.find({ role: 'admin' });
      for (const admin of admins) {
        await Notification.createNotification({
          recipient: admin._id,
          type: 'complaint_status',
          title: 'Complaint Reopened',
          message: `Complaint by ${req.user.name} was reopened`,
          relatedTo: complaint._id,
          onModel: 'Complaint'
        });
      }
    }
    res.json({ success: true, data: complaint });
  } catch (error) {
    console.error('Detailed error in giveFeedback:', error);
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    if (error.stack) {
      console.error('Error stack:', error.stack);
    }
    res.status(500).json({ 
        success: false, 
        message: 'Error giving feedback', 
        error: { name: error.name, message: error.message } 
    });
  }
};

// Student: get complaint timeline
export const getComplaintTimeline = async (req, res) => {
  try {
    const { id } = req.params;
    const complaint = await Complaint.findOne({ _id: id, student: req.user._id })
      .populate({
        path: 'assignedTo',
        select: 'name category phone email',
        model: 'Member'
      })
      .populate('student', 'name rollNumber');

    if (!complaint) {
      return res.status(404).json({ 
        success: false,
        message: 'Complaint not found' 
      });
    }

    // Get timeline from status history with populated assigned members
    const timeline = await Promise.all(complaint.statusHistory.map(async entry => {
      // For each entry, populate the assignedTo member if it exists
      let assignedMember = null;
      if (entry.assignedTo) {
        assignedMember = await Member.findById(entry.assignedTo)
          .select('name category phone email')
          .lean();
      }
      
      return {
        status: entry.status,
        note: entry.note,
        timestamp: entry.timestamp,
        assignedTo: assignedMember,
        updatedBy: entry.updatedBy ? await User.findById(entry.updatedBy).select('name role').lean() : null
      };
    }));

    // Add initial entry if no history
    if (timeline.length === 0) {
      timeline.push({
        status: complaint.currentStatus,
        note: 'Complaint created',
        timestamp: complaint.createdAt,
        assignedTo: complaint.assignedTo,
        updatedBy: null
      });
    }

    // Sort timeline by timestamp (oldest first)
    timeline.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    res.json({
      success: true,
      data: {
        timeline,
        currentAssignedTo: complaint.assignedTo,
        student: complaint.student
      }
    });
  } catch (error) {
    console.error('Error fetching timeline:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching timeline' 
    });
  }
};

// Admin: list all complaints
export const listAllComplaints = async (req, res) => {
  try {
    const complaints = await Complaint.find()
      .populate('student', 'name rollNumber phone')
      .populate('assignedTo', 'name phoneNumber category')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: complaints
    });
  } catch (err) {
    console.error('Error fetching complaints:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch complaints'
    });
  }
};

// Admin: update complaint status
export const updateComplaintStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, note, memberId } = req.body;

    console.log('Updating complaint status:', {
      id,
      status,
      note,
      memberId
    });

    // Validate ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      console.log('Invalid complaint ID format:', id);
      return res.status(400).json({
        success: false,
        message: 'Invalid complaint ID format'
      });
    }

    const complaint = await Complaint.findById(id);
    console.log('Found complaint:', complaint ? 'yes' : 'no');

    if (!complaint) {
      console.log('Complaint not found with ID:', id);
      return res.status(404).json({
        success: false,
        message: 'Complaint not found'
      });
    }

    if (complaint.isLockedForUpdates) {
      return res.status(403).json({ 
        success: false,
        message: 'This complaint has been closed after student satisfaction and can no longer be updated.'
      });
    }

    // Validate status
    const validStatuses = ['Received', 'In Progress', 'Resolved', 'Closed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    // Validate assigned member if provided
    if (memberId) {
      if (!mongoose.Types.ObjectId.isValid(memberId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid member ID format'
        });
      }

      const member = await Member.findById(memberId);
      if (!member || !member.isActive) {
        return res.status(400).json({
          success: false,
          message: 'Invalid or inactive member'
        });
      }

      // Validate member category matches complaint category/subcategory
      const validCategory = member.category === complaint.category || 
                          (complaint.category === 'Maintenance' && member.category === complaint.subCategory);
      
      if (!validCategory) {
        return res.status(400).json({
          success: false,
          message: 'Assigned member must belong to the same category/subcategory'
        });
      }

      complaint.assignedTo = memberId;
    }

    // Update status
    const oldStatus = complaint.currentStatus;
    complaint.currentStatus = status;
    
    // Add to status history
    complaint.statusHistory.push({
      status,
      note: note || '',
      assignedTo: complaint.assignedTo,
      timestamp: new Date()
    });

    // Handle reopening and feedback clearing
    if (status === 'Resolved') {
      complaint.feedback = null;
      complaint.isReopened = false;
    } else if (status === 'Received' && oldStatus === 'Resolved') { //This case might be when admin reopens directly
      complaint.isReopened = true;
    }

    // Save the changes
    await complaint.save();
    console.log('Complaint updated successfully');

    // Populate the response
    await complaint.populate([
      { path: 'student', select: 'name rollNumber' },
      { path: 'assignedTo', select: 'name phoneNumber category' }
    ]);

    // Create notification for student
    await createNotification({
      type: 'complaint',
      recipient: complaint.student,
      sender: req.user._id,
      message: `Your complaint "${complaint.description}" has been ${status}`,
      relatedId: complaint._id,
      onModel: 'Complaint'
    });

    res.json({
      success: true,
      data: complaint
    });
  } catch (err) {
    console.error('Error updating complaint status:', err);
    if (err.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: err.message
      });
    }
    res.status(500).json({
      success: false,
      message: 'Failed to update complaint status'
    });
  }
};

// Admin: get complaint timeline
export const adminGetTimeline = async (req, res) => {
  try {
    const { id } = req.params;
    console.log('Fetching timeline for complaint ID:', id);

    // Validate ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      console.log('Invalid complaint ID format:', id);
      return res.status(400).json({
        success: false,
        message: 'Invalid complaint ID format'
      });
    }

    const complaint = await Complaint.findById(id)
      .populate('assignedTo', 'name category'); // Populate assignedTo for current assignment
    console.log('Found complaint:', complaint ? 'yes' : 'no');

    if (!complaint) {
      console.log('Complaint not found with ID:', id);
      return res.status(404).json({
        success: false,
        message: 'Complaint not found'
      });
    }

    // Get timeline from status history
    const timeline = await Promise.all(complaint.statusHistory.map(async entry => {
      // For each entry, populate the assignedTo member if it exists
      let assignedMember = null;
      if (entry.assignedTo) {
        assignedMember = await Member.findById(entry.assignedTo)
          .select('name category')
          .lean();
      }
      
      return {
        status: entry.status,
        note: entry.note,
        timestamp: entry.timestamp,
        assignedTo: assignedMember
      };
    }));

    console.log('Timeline entries:', timeline.length);

    // Add initial entry if no history
    if (timeline.length === 0) {
      console.log('No timeline entries, adding initial entry');
      timeline.push({
        status: complaint.currentStatus,
        note: 'Complaint created',
        timestamp: complaint.createdAt,
        assignedTo: complaint.assignedTo // This will already be populated from the initial find
      });
    }

    res.json({
      success: true,
      data: timeline
    });
  } catch (err) {
    console.error('Error fetching complaint timeline:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch complaint timeline'
    });
  }
};

// Get student's complaints
export const getStudentComplaints = async (req, res) => {
  try {
    const complaints = await Complaint.find({ student: req.user.id })
      .populate('assignedTo', 'name phoneNumber category')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: complaints
    });
  } catch (err) {
    console.error('Error fetching student complaints:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch complaints'
    });
  }
};

// Submit feedback
export const submitFeedback = async (req, res) => {
  try {
    const { id } = req.params;
    const { isSatisfied, comment } = req.body;

    const complaint = await Complaint.findById(id);
    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: 'Complaint not found'
      });
    }

    // Check if complaint belongs to student
    if (complaint.student.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to submit feedback for this complaint'
      });
    }

    // Check if complaint is resolved
    if (complaint.currentStatus !== 'Resolved') {
      return res.status(400).json({
        success: false,
        message: 'Feedback can only be submitted for resolved complaints'
      });
    }

    // Check if feedback already exists
    if (complaint.feedback) {
      return res.status(400).json({
        success: false,
        message: 'Feedback already submitted for this complaint'
      });
    }

    complaint.feedback = {
      isSatisfied,
      comment,
      timestamp: new Date()
    };

    await complaint.save();

    res.json({
      success: true,
      data: complaint
    });
  } catch (err) {
    console.error('Error submitting feedback:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to submit feedback'
    });
  }
};

// Get complaint details
export const getComplaintDetails = async (req, res) => {
  try {
    const { id } = req.params;
    console.log('Fetching complaint details for ID:', id);

    if (!mongoose.Types.ObjectId.isValid(id)) {
      console.log('Invalid complaint ID format:', id);
      return res.status(400).json({
        success: false,
        message: 'Invalid complaint ID format'
      });
    }

    const complaint = await Complaint.findById(id)
      .populate('student', 'name rollNumber')
      .populate({
        path: 'assignedTo',
        select: 'name category phone email',
        model: 'Member'
      })
      .lean();

    if (!complaint) {
      console.log('Complaint not found with ID:', id);
      return res.status(404).json({
        success: false,
        message: 'Complaint not found'
      });
    }

    // Check if the complaint belongs to the student
    if (complaint.student._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this complaint'
      });
    }

    res.json({
      success: true,
      data: complaint
    });
  } catch (err) {
    console.error('Error fetching complaint details:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch complaint details'
    });
  }
}; 