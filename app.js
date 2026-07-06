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

app.use(session({
    secret: 'student_cms_secret_key',
    resave: false,
    saveUninitialized: false
}));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ==========================================
// 2. SERVERLESS MONGODB CONNECTION CACHING
// ==========================================
const MONGODB_URI = process.env.MONGODB_URI;

let cachedConnection = global.mongoose;
if (!cachedConnection) {
    cachedConnection = global.mongoose = { conn: null, promise: null };
}

async function connectDB() {
    if (cachedConnection.conn) {
        return cachedConnection.conn;
    }

    if (!cachedConnection.promise) {
        const opts = {
            bufferCommands: false, // Prevents Mongoose from hanging for 10s if connection drops
        };

        cachedConnection.promise = mongoose.connect(MONGODB_URI, opts).then((mongooseInstance) => {
            console.log('Successfully connected to MongoDB Atlas.');
            return mongooseInstance;
        });
    }

    try {
        cachedConnection.conn = await cachedConnection.promise;
    } catch (e) {
        cachedConnection.promise = null;
        console.error('Database connection failed:', e);
        throw e;
    }

    return cachedConnection.conn;
}

// Global Middleware to guarantee DB connectivity per route request
app.use(async (req, res, next) => {
    try {
        await connectDB();
        next();
    } catch (err) {
        // Renders the database connection error safely onto your login screen instead of crashing Vercel
        return res.render('login', { 
            error: `Database Connection Error: ${err.message}. Please verify your MONGODB_URI configuration password and ensure Atlas Network Access allows IP 0.0.0.0/0.` 
        });
    }
});

// ==========================================
// 3. DATABASE SCHEMAS & MODELS
// ==========================================
const UserSchema = new mongoose.Schema({
    name: String,
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['admin', 'student', 'staff'], required: true },
    course: String,
    address: String
});
const User = mongoose.models.User || mongoose.model('User', UserSchema);

const CourseSchema = new mongoose.Schema({ name: String });
const Course = mongoose.models.Course || mongoose.model('Course', CourseSchema);

const SubjectSchema = new mongoose.Schema({ name: String, course: String });
const Subject = mongoose.models.Subject || mongoose.model('Subject', SubjectSchema);

const AttendanceSchema = new mongoose.Schema({
    studentId: mongoose.Schema.Types.ObjectId,
    studentName: String,
    course: String,
    subject: String,
    date: String,
    status: String
});
const Attendance = mongoose.models.Attendance || mongoose.model('Attendance', AttendanceSchema);

const ExamSchema = new mongoose.Schema({
    studentId: mongoose.Schema.Types.ObjectId,
    studentName: String,
    course: String,
    subject: String,
    score: Number
});
const Exam = mongoose.models.Exam || mongoose.model('Exam', ExamSchema);

const LeaveSchema = new mongoose.Schema({
    staffName: String,
    date: String,
    reason: String,
    status: { type: String, default: 'Pending' }
});
const Leave = mongoose.models.Leave || mongoose.model('Leave', LeaveSchema);

const NoticeSchema = new mongoose.Schema({ message: String, target: String, date: String });
const Notice = mongoose.models.Notice || mongoose.model('Notice', NoticeSchema);

// ==========================================
// 4. ROUTING & SYSTEM LOGIC
// ==========================================

// Seed admin user helper function
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
            console.log('Default Admin seeded successfully.');
        }
    } catch (e) { 
        console.error("Seeding warning:", e.message); 
    }
}

// App routing maps
app.get('/', (req, res) => {
    res.redirect('/login');
});

app.get('/login', async (req, res) => {
    await seedAdmin(); // Ensures admin exists when login view loads
    res.render('login', { error: null });
});

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
        res.render('login', { error: `Authentication Error: ${err.message}` });
    }
});

// Fallback Dashboard Mocks (Renders message safely on login screen for validation)
app.get('/admin/dashboard', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') return res.redirect('/login');
    res.render('login', { error: "Successfully authenticated! Admin Dashboard path reached." });
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

// ==========================================
// 5. VERCEL SERVERLESS EXPORT
// ==========================================
module.exports = app;
