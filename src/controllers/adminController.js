import User, { COURSES, BRANCHES } from '../models/User.js';
import TempStudent from '../models/TempStudent.js';
import { createError } from '../utils/error.js';
import xlsx from 'xlsx';

// Add a new student
export const addStudent = async (req, res, next) => {
  try {
    const {
      name,
      rollNumber,
      course,
      year,
      branch,
      roomNumber,
      studentPhone,
      parentPhone
    } = req.body;

    // Check if student already exists
    const existingStudent = await User.findOne({ rollNumber });
    if (existingStudent) {
      throw createError(400, 'Student with this roll number already exists');
    }

    // Generate random password
    const generatedPassword = User.generateRandomPassword();

    // Create new student
    const student = new User({
      name,
      rollNumber: rollNumber.toUpperCase(),
      password: generatedPassword,
      role: 'student',
      course,
      year,
      branch,
      roomNumber,
      studentPhone,
      parentPhone,
      isPasswordChanged: false
    });

    await student.save();

    // Return student data with generated password
    res.status(201).json({
      success: true,
      data: {
        student: {
          id: student._id,
          name: student.name,
          rollNumber: student.rollNumber,
          course: student.course,
          year: student.year,
          branch: student.branch,
          roomNumber: student.roomNumber,
          studentPhone: student.studentPhone,
          parentPhone: student.parentPhone
        },
        generatedPassword // Only sent once during creation
      }
    });
  } catch (error) {
    next(error);
  }
};

// Bulk add new students
export const bulkAddStudents = async (req, res, next) => {
  if (!req.file) {
    return next(createError(400, 'No Excel file uploaded.'));
  }

  const results = {
    successCount: 0,
    failureCount: 0,
    addedStudents: [],
    errors: [],
  };

  try {
    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = xlsx.utils.sheet_to_json(worksheet);

    if (!jsonData || jsonData.length === 0) {
        return next(createError(400, 'Excel file is empty or data could not be read.'));
    }

    for (let i = 0; i < jsonData.length; i++) {
      const row = jsonData[i];
      const rowIndex = i + 2; // For user-friendly error reporting (1-based index + header row)

      const {
        Name,
        RollNumber,
        Course,
        Branch,
        Year,
        RoomNumber,
        StudentPhone,
        ParentPhone,
      } = row;

      // Basic validation
      if (!Name || !RollNumber || !Course || !Branch || !Year || !RoomNumber || !StudentPhone || !ParentPhone) {
        results.failureCount++;
        results.errors.push({ row: rowIndex, error: 'Missing one or more required fields.', details: row });
        continue;
      }
      
      const rollNumberUpper = RollNumber.toString().toUpperCase().trim();

      try {
        const existingStudent = await User.findOne({ rollNumber: rollNumberUpper });
        if (existingStudent) {
          results.failureCount++;
          results.errors.push({ row: rowIndex, error: `Student with roll number ${rollNumberUpper} already exists.`, details: row });
          continue;
        }
        
        const existingTempStudent = await TempStudent.findOne({ rollNumber: rollNumberUpper });
        if (existingTempStudent) {
            results.failureCount++;
            results.errors.push({ row: rowIndex, error: `Student with roll number ${rollNumberUpper} already exists in temporary records.`, details: row });
            continue;
        }

        const generatedPassword = User.generateRandomPassword();

        const newStudent = new User({
          name: Name.toString().trim(),
          rollNumber: rollNumberUpper,
          password: generatedPassword, // Hashing will occur in pre-save hook
          role: 'student',
          course: Course.toString().trim(),
          year: parseInt(Year, 10),
          branch: Branch.toString().trim(),
          roomNumber: RoomNumber.toString().trim(),
          studentPhone: StudentPhone.toString().trim(),
          parentPhone: ParentPhone.toString().trim(),
          isPasswordChanged: false,
        });

        const savedStudent = await newStudent.save();

        const tempStudent = new TempStudent({
          name: savedStudent.name,
          rollNumber: savedStudent.rollNumber,
          studentPhone: savedStudent.studentPhone,
          generatedPassword: generatedPassword, // Plain text password
          isFirstLogin: true,
          mainStudentId: savedStudent._id,
        });
        await tempStudent.save();

        results.successCount++;
        results.addedStudents.push({
          name: savedStudent.name,
          rollNumber: savedStudent.rollNumber,
          generatedPassword: generatedPassword, // For admin to see
        });

      } catch (validationError) {
        results.failureCount++;
        // Attempt to provide a more specific error message from Mongoose validation
        let specificError = validationError.message;
        if (validationError.errors) {
            const firstErrorKey = Object.keys(validationError.errors)[0];
            if (firstErrorKey) {
                specificError = validationError.errors[firstErrorKey].message;
            }
        }
        results.errors.push({ row: rowIndex, error: `Validation Error: ${specificError}`, details: row });
      }
    }

    res.status(200).json({
      success: true,
      message: 'Bulk student upload process completed.',
      data: results,
    });

  } catch (error) {
    console.error('Bulk upload error:', error);
    next(createError(500, error.message || 'Error processing Excel file.'));
  }
};

// Get all students with pagination and filters
export const getStudents = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, course, branch, roomNumber, search } = req.query;
    const query = { role: 'student' };

    // Add filters if provided
    if (course) query.course = course;
    if (branch) query.branch = branch;
    if (roomNumber) query.roomNumber = roomNumber;

    // Add search functionality if search term is provided
    if (search) {
      const searchRegex = new RegExp(search, 'i'); // 'i' for case-insensitive
      query.$or = [
        { name: searchRegex },
        { rollNumber: searchRegex }
      ];
    }

    const students = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const count = await User.countDocuments(query);

    res.json({
      success: true,
      data: {
        students,
        totalPages: Math.ceil(count / limit),
        currentPage: page,
        totalStudents: count
      }
    });
  } catch (error) {
    next(error);
  }
};

// Get student by ID
export const getStudentById = async (req, res, next) => {
  try {
    const student = await User.findOne({ _id: req.params.id, role: 'student' })
      .select('-password');
    
    if (!student) {
      throw createError(404, 'Student not found');
    }

    res.json({
      success: true,
      data: student
    });
  } catch (error) {
    next(error);
  }
};

// Update student
export const updateStudent = async (req, res, next) => {
  try {
    const { name, course, branch, roomNumber, studentPhone, parentPhone } = req.body;
    
    const student = await User.findOne({ _id: req.params.id, role: 'student' });
    if (!student) {
      throw createError(404, 'Student not found');
    }

    // Update fields
    if (name) student.name = name;
    if (course) student.course = course;
    if (branch) student.branch = branch;
    if (roomNumber) student.roomNumber = roomNumber;
    if (studentPhone) student.studentPhone = studentPhone;
    if (parentPhone) student.parentPhone = parentPhone;

    await student.save();

    res.json({
      success: true,
      data: {
        student: {
          id: student._id,
          name: student.name,
          rollNumber: student.rollNumber,
          course: student.course,
          branch: student.branch,
          roomNumber: student.roomNumber,
          studentPhone: student.studentPhone,
          parentPhone: student.parentPhone
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// Delete student
export const deleteStudent = async (req, res, next) => {
  try {
    const student = await User.findOneAndDelete({ _id: req.params.id, role: 'student' });
    
    if (!student) {
      throw createError(404, 'Student not found');
    }

    // Also delete the corresponding TempStudent record
    await TempStudent.deleteOne({ mainStudentId: student._id });

    res.json({
      success: true,
      message: 'Student deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// Get branches by course
export const getBranchesByCourse = async (req, res, next) => {
  try {
    const { course } = req.params;
    
    if (!COURSES[course.toUpperCase()]) {
      throw createError(400, 'Invalid course');
    }

    const branches = BRANCHES[course.toUpperCase()];
    
    res.json({
      success: true,
      data: branches
    });
  } catch (error) {
    next(error);
  }
};

// Get temporary students summary for admin dashboard
export const getTempStudentsSummary = async (req, res, next) => {
  try {
    // Get all students who haven't changed their password
    const studentsWithTempRecords = await User.find({ 
      role: 'student',
      isPasswordChanged: false 
    }).select('_id');

    // Get temp student records only for students who haven't changed their password
    const tempStudents = await TempStudent.find({
      mainStudentId: { $in: studentsWithTempRecords.map(s => s._id) }
    })
    .select('name rollNumber studentPhone generatedPassword createdAt')
    .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: tempStudents,
    });
  } catch (error) {
    console.error('Error fetching temporary students summary:', error);
    next(createError(500, 'Failed to fetch temporary student summary.'));
  }
};

// Get total student count for admin dashboard
export const getStudentsCount = async (req, res, next) => {
  try {
    const totalStudents = await User.countDocuments({ role: 'student' });
    res.status(200).json({
      success: true,
      data: {
        count: totalStudents,
      },
    });
  } catch (error) {
    console.error('Error fetching total student count:', error);
    next(createError(500, 'Failed to fetch total student count.'));
  }
}; 