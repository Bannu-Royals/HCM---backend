import memberRoutes from './routes/memberRoutes.js';

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin/members', memberRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/notifications', notificationRoutes); 