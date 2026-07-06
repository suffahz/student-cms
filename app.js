// ==========================================
// 2. SERVERLESS-SAFE MONGODB CONNECTION
// ==========================================
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
    console.error("CRITICAL ERROR: MONGODB_URI environment variable is missing in Vercel settings!");
}

// Global caching object to persist the connection across Vercel function invocations
let cachedConnection = global.mongoose;

if (!cachedConnection) {
    cachedConnection = global.mongoose = { conn: null, promise: null };
}

async function connectDB() {
    // If a connection already exists, reuse it instantly
    if (cachedConnection.conn) {
        return cachedConnection.conn;
    }

    // If no connection attempt is in progress, start a new one
    if (!cachedConnection.promise) {
        const opts = {
            bufferCommands: false, // CRITICAL: Tells Mongoose to fail fast instead of hanging/buffering for 10 seconds
        };

        cachedConnection.promise = mongoose.connect(MONGODB_URI, opts).then((mongooseInstance) => {
            console.log('Successfully established fresh connection to MongoDB Atlas.');
            return mongooseInstance;
        });
    }

    try {
        cachedConnection.conn = await cachedConnection.promise;
    } catch (e) {
        cachedConnection.promise = null; // Clear broken promise if connection fails
        console.error('Database connection execution dropped:', e);
        throw e;
    }

    return cachedConnection.conn;
}

// Middleware that ensures the database is connected before processing any incoming route request
app.use(async (req, res, next) => {
    try {
        await connectDB();
        next();
    } catch (err) {
        res.status(500).json({ 
            error: "Database Connection Failure", 
            details: err.message,
            tip: "Ensure MongoDB Atlas Network Access is set to 0.0.0.0/0 and your Vercel MONGODB_URI password is correct."
        });
    }
});
