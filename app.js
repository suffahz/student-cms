const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const session = require('express-session');

const app = express();

// ==========================================
// 1. MIDDLEWARE & CONFIGURATION
// ==========================================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Express Session Setup for User Portals
app.use(session({
    secret: 'student_cms_secret_key',
    resave: false,
    saveUninitialized: false
}));

// EJS Template Engine Configuration
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ==========================================
// 2. MONGODB ATLAS CONNECTION
// ==========================================
const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
    console.error("CRITICAL ERROR: MONGODB_URI environment variable is missing in Vercel settings!");
}

mongoose.connect(MONGODB_URI)
    .then(() => console.log('Successfully connected to MongoDB Atlas.'))
    .catch(err => console.error('MongoDB connection error:', err));

// ==========================================
// 3. DATABASE SCHEMAS & MODELS (As per tutorial)
// ==========================================
const UserSchema = new mongoose.Schema({
    name: String,
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['admin', 'student', 'staff'], required: true },
    course: String,
    address: String
});
const User = mongoose.model('User', UserSchema);

const CourseSchema = new mongoose.Schema({ name: String });
const Course = mongoose.model('Course', CourseSchema);

const SubjectSchema = new mongoose.Schema({ name: String, course: String });
const Subject = mongoose.model('Subject', SubjectSchema);

const AttendanceSchema = new mongoose.Schema({
    studentId: mongoose.Schema.Types.ObjectId,
    studentName: String,
    course: String,
    subject: String,
    date: String,
    status: String
});
const Attendance = mongoose.model('Attendance', AttendanceSchema);

const ExamSchema = new mongoose.Schema({
    studentId: mongoose.Schema.Types.ObjectId,
    studentName: String,
    course: String,
    subject: String,
    score: Number
});
const Exam = mongoose.model('Exam', ExamSchema);

const LeaveSchema = new mongoose.Schema({
    staffName: String,
    date: String,
    reason: String,
    status: { type: String, default: 'Pending' }
});
const Leave = mongoose.model('Leave', LeaveSchema);

const NoticeSchema = new mongoose.Schema({ message: String, target: String, date: String });
const Notice = mongoose.model('Notice', NoticeSchema);

// ==========================================
// 4. ROUTING LOGIC
// ==========================================

// Seed admin user on startup if database is empty
async function seedAdmin() {
    try {
        const adminExists = await User.findOne({ email: 'admin@gmail.com' });
        if (!adminExists) {
            await User.create({
                name: 'System Admin',
                email: 'admin@gmail.com',
                password: '123456',
                role: 'admin'
            });
            console.log('Default Admin seeded successfully (admin@gmail.com / 123456)');
        }
    } catch (e) { console.log("Seeding error:", e); }
}
seedAdmin();

// Root path redirect to fix Vercel 404
app.get('/', (req, res) => {
    res.redirect('/login');
});

// Render login page
app.get('/login', (req, res) => {
    res.render('login', { error: null });
});

// Handle authentication login post
app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ email, password });
        if (user) {
            req.session.user = user;
            if (user.role === 'admin') return res.redirect('/admin/dashboard');
            if (user.role === 'student') return res.redirect('/student/dashboard');
            if (user.role === 'staff') return res.redirect('/staff/dashboard');
        }
        res.render('login', { error: 'Invalid Email or Password' });
    } catch (err) {
        res.status(500).send("Internal Server Error during Authentication");
    }
});

// Admin Dashboard & management operations mock responses to match generated files
app.get('/admin/dashboard', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') return res.redirect('/login');
    const counts = {
        courses: await Course.countDocuments(),
        subjects: await Subject.countDocuments(),
        students: await User.countDocuments({ role: 'student' }),
        staff: await User.countDocuments({ role: 'staff' })
    };
    // If your original app.ejs renders 'admin_dashboard', change this name accordingly
    res.render('login', { error: `Logged in as Admin. Stats: Courses(${counts.courses}) Students(${counts.students})` });
});

// Logout Route
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

// ==========================================
// 5. VERCEL SERVERLESS EXPORT
// ==========================================
app.use((req, res) => {
    res.status(404).send("404: Route option not found on this Student CMS build.");
});

// Crucial step: Export the app module so Vercel executes serverlessly
module.exports = app;
