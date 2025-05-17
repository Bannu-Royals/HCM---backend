import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

// Define course and branch mappings
export const COURSES = {
  BTECH: 'B.Tech',
  DIPLOMA: 'Diploma',
  PHARMACY: 'Pharmacy',
  DEGREE: 'Degree'
};

export const BRANCHES = {
  BTECH: ['CSE', 'ECE', 'EEE', 'MECH', 'CIVIL'],
  DIPLOMA: ['CSE', 'ECE', 'EEE', 'MECH', 'CIVIL'],
  PHARMACY: ['B.Pharmacy'],
  DEGREE: ['B.Sc', 'B.Com', 'BBA']
};

// Map course label (e.g., 'B.Tech') to its key (e.g., 'BTECH')
const COURSE_LABEL_TO_KEY = {
  'B.Tech': 'BTECH',
  'Diploma': 'DIPLOMA',
  'Pharmacy': 'PHARMACY',
  'Degree': 'DEGREE'
};

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  rollNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true,
    validate: {
      validator: function(v) {
        // Alphanumeric validation for roll number
        return /^[A-Z0-9]+$/.test(v);
      },
      message: props => `${props.value} is not a valid roll number! Must be uppercase alphanumeric.`
    }
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['admin', 'student'],
    default: 'student'
  },
  course: {
    type: String,
    enum: Object.values(COURSES),
    required: function() { return this.role === 'student'; }
  },
  year: {
    type: Number,
    required: function() { return this.role === 'student'; },
    validate: {
      validator: function(v) {
        if (this.role !== 'student') return true;
        // Validate year based on course
        const courseKey = COURSE_LABEL_TO_KEY[this.course];
        switch(courseKey) {
          case 'BTECH':
            return v >= 1 && v <= 4;
          case 'DIPLOMA':
            return v >= 1 && v <= 3;
          case 'PHARMACY':
            return v >= 1 && v <= 4;
          case 'DEGREE':
            return v >= 1 && v <= 3;
          default:
            return false;
        }
      },
      message: props => `${props.value} is not a valid year for the selected course!`
    }
  },
  branch: {
    type: String,
    required: function() { return this.role === 'student'; },
    validate: {
      validator: function(v) {
        if (this.role !== 'student') return true;
        // Convert course label (e.g., 'B.Tech') to key (e.g., 'BTECH') using COURSE_LABEL_TO_KEY
        const courseKey = COURSE_LABEL_TO_KEY[this.course];
        const validBranches = BRANCHES[courseKey] || [];
        return validBranches.includes(v);
      },
      message: props => `${props.value} is not a valid branch for the selected course!`
    }
  },
  roomNumber: {
    type: String,
    required: function() { return this.role === 'student'; },
    validate: {
      validator: function(v) {
        if (this.role !== 'student') return true;
        const roomNum = parseInt(v);
        return !isNaN(roomNum) && roomNum >= 30 && roomNum <= 40;
      },
      message: props => `${props.value} is not a valid room number! Must be between 30 and 40.`
    }
  },
  studentPhone: {
    type: String,
    required: function() { return this.role === 'student'; },
    validate: {
      validator: function(v) {
        return /^[0-9]{10}$/.test(v);
      },
      message: props => `${props.value} is not a valid phone number!`
    }
  },
  parentPhone: {
    type: String,
    required: function() { return this.role === 'student'; },
    validate: {
      validator: function(v) {
        return /^[0-9]{10}$/.test(v);
      },
      message: props => `${props.value} is not a valid phone number!`
    }
  },
  isPasswordChanged: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Method to generate random password using crypto
userSchema.statics.generateRandomPassword = function() {
  const length = 10;
  const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let password = "";
  const randomBytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    password += charset.charAt(randomBytes[i] % charset.length);
  }
  return password;
};

// Create indexes
userSchema.index({ rollNumber: 1 });
userSchema.index({ role: 1 });
userSchema.index({ course: 1, branch: 1 });
userSchema.index({ roomNumber: 1 });

const User = mongoose.model('User', userSchema);

export default User; 