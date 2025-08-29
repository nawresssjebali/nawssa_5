const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bodyParser = require("body-parser");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcryptjs");
const nodemailer = require("nodemailer");
const crypto = require("crypto"); // For generating secure tokens
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const moment = require('moment-timezone');
const { Server } = require('socket.io');

const http = require('http');
const app = express();

const serverTime = moment().tz('Africa/Tunis').format();
console.log('Server time (Tunisia):', serverTime);

const server = http.createServer(app);
fs.writeFileSync(path.join(__dirname, "ECGS/test.txt"), "Hello World");




// 🔧 Define CORS options
const corsOptions = {
  origin: "http://localhost:4200",
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization", "senderId", "receiverId"],
};
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

// ✅ Fix: autoriser un body JSON plus grand
app.use(express.json({ limit: '50mb' }));
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));


// ✅ Socket.IO setup
const io = new Server(server, {
  cors: {
    origin: "http://localhost:4200",
    methods: ["GET", "POST"],
  },
});


// Ensure the 'uploads' directory exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  console.log("Uploads folder created.");
}
// Serve uploaded images statically
app.use('/uploads', express.static(uploadDir));

// Connect to MongoDB
mongoose.connect("mongodb://localhost:27017/mydatabase", {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log("MongoDB connected"))
  .catch(err => console.error("MongoDB connection error:", err));

// Define Storage for File Uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir); // Set uploads directory as the destination
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname)); // Unique file name
  }
});
console.log("🟢 Adding routes...");
const upload = multer({ storage });
const RecentActivitySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false }, // user who performed action (if known)
  relatedId: { type: mongoose.Schema.Types.ObjectId, required: false },           // related document id (e.g., case id, ECG id)
  collectionName: { type: String, required: false },                             // collection where activity happened (e.g., 'broadcastcases')
  action: { type: String, required: false },                                     // what happened? e.g., 'case_sent', 'ecg_uploaded'
  description: { type: String, required: false },                               // human-readable description
  timestamp: { type: Date, default: Date.now },
  metadata: { type: Object, required: false }                                   // any extra info you want to store
});
const RecentActivity = mongoose.model("RecentActivity", RecentActivitySchema );
// Define User Schema
const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
  address: String,
  mobile: String,
  specialty: String,
  practiceLocation: String,
  photo: String, // Store the file path
  resetPasswordToken: String, // Token for password reset
  resetPasswordExpires: Date, // Expiration date for reset token
  rating: { type: Number, default: null },
  isSuspended: {
    type: Boolean,
    default: false,
  },
   role: {
    type: String,
    enum: ['generalist', 'cardiologist', 'admin'],
 
  },


  // ✅ 2FA Support
  twoFactorEnabled: { type: Boolean, default: false },          // Is 2FA fully enabled
  twoFactorTempSecret: { type: String, default: null },         // Temporary secret before user verifies it
  twoFactorSecret: { type: String, default: null },
  createdAt: { type: Date, default: Date.now }          // Final confirmed secret
});
app.use('/drafts', express.static(path.join(__dirname, 'drafts')));

// Create User Model
const User = mongoose.model("users", userSchema);
app.get('/users/:id', async (req, res) => {
  try {
    const userId = req.params.id;

    // Find user by ID and exclude sensitive fields like password, 2FA secrets
    const user = await User.findById(userId).select('-password -twoFactorTempSecret -twoFactorSecret -resetPasswordToken -resetPasswordExpires');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// API Route to Save User Data (with File Upload)
app.post("/users", upload.single("photo"), async (req, res) => {
  try {
    console.log("Received user data:", req.body); // Log received user data
    const { name, email, password, address, mobile, specialty, practiceLocation } = req.body;
    const photo = req.file ? `/uploads/${req.file.filename}` : null;

    // Hash the password before saving
    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      name,
      email,
      password: hashedPassword, // Store hashed password
      address,
      mobile,
      specialty,
      practiceLocation,
      photo
    });

    await newUser.save();
    console.log("User saved successfully:", newUser);
    res.status(201).json({ message: "User saved successfully!", user: newUser });
  } catch (err) {
    console.error("Error saving user:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});
const LoginHistorySchema = new mongoose.Schema({
  userId: { type: String, required: false },  // optional if user unknown (e.g., user not found)
  email: { type: String, required: true },
  ip: { type: String, required: false },
  timestamp: { type: Date, default: Date.now },
  userAgent: { type: String, required: false },
  success: { type: Boolean, required: true },
  failureReason: { type: String, required: false },  // only for failed attempts
  location: { type: String, required: false } ,
       // new optional field for location info
});
const SessionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  sessionId: { type: String, required: true, unique: true },
  ip: String,
  userAgent: String,
  location: String,
  createdAt: { type: Date, default: Date.now },
  revoked: { type: Boolean, default: false },
  revokedReason: String
});
const LoginHistory = mongoose.model('LoginHistory', LoginHistorySchema);
const Session = mongoose.model('Session', SessionSchema);
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const ip = (req.headers['x-forwarded-for'] || '').split(',').shift() || req.socket.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';

    console.log("Login attempt with email:", email, "IP:", ip);

    // Get location from IP
    let location = 'Unknown';
    try {
      const response = await fetch(`http://ip-api.com/json/${ip}`);
      const locationData = await response.json();
      if (locationData.status === 'success') {
        location = `${locationData.city || ''}, ${locationData.regionName || ''}, ${locationData.country || ''}`.trim().replace(/^,|,$/g, '');
      }
    } catch (e) {
      console.warn('Could not fetch location for IP', ip);
    }

    const user = await User.findOne({ email });

    if (!user) {
      console.log("User not found");
      await LoginHistory.create({
        email,
        ip,
        userAgent,
        location,
        success: false,
        failureReason: "User not found",
        timestamp: new Date()
      });
      return res.status(404).json({ message: "User not found" });
    }

    if (user.isSuspended) {
      console.log("Login attempt blocked: user is suspended");
      await LoginHistory.create({
        userId: user._id.toString(),
        email,
        ip,
        userAgent,
        location,
        success: false,
        failureReason: "User suspended",
        timestamp: new Date()
      });
      return res.status(403).json({ message: "Your account has been suspended." });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      console.log("Invalid password");
      await LoginHistory.create({
        userId: user._id.toString(),
        email,
        ip,
        userAgent,
        location,
        success: false,
        failureReason: "Invalid password",
         timestamp: new Date()
      });
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Save successful login (before 2FA step)
    await LoginHistory.create({
      userId: user._id.toString(),
      email,
      ip,
      userAgent,
      location,
      success: true,
      timestamp: new Date()
    
    });

    if (user.twoFactorEnabled) {
      console.log("2FA is enabled. Prompting for token.");
      return res.status(200).json({
        twoFactorRequired: true,
        userId: user._id.toString()
      });
    }
    const crypto = require("crypto");
const sessionId = crypto.randomUUID();

await Session.create({
  userId: user._id,
  sessionId,
  ip,
  userAgent,
  location
});
    console.log("Login successful - no 2FA required");
    res.status(200).json({
      message: "Login successful",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        address: user.address,
        mobile: user.mobile,
        specialty: user.specialty,
        practiceLocation: user.practiceLocation,
        photo: user.photo,
        isSuspended: user.isSuspended
      }
    });

  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: err.message });
  }
});
async function checkSession(req, res, next) {
  const sessionId = req.headers["x-session-id"] || req.cookies.sessionId;

  if (!sessionId) {
    return res.status(401).json({ error: "Session missing" });
  }

  const session = await Session.findOne({ sessionId });

  if (!session || session.revoked) {
    return res.status(403).json({ error: "Session revoked or invalid" });
  }

  // Optionally, attach user info to req for downstream handlers
  req.userId = session.userId;
  next();
}
app.post("/admin/force-logout/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;

    console.log(`🔔 Received force logout request for userId: ${userId} with reason: ${reason}`);

    // Convert string userId to ObjectId if needed
    const objectUserId = new mongoose.Types.ObjectId(userId);
    console.log(`Converted userId to ObjectId: ${objectUserId}`);

    // Check existing sessions for this user before update
    const existingSessions = await Session.find({ userId: objectUserId, revoked: false });
    console.log(`Found ${existingSessions.length} active sessions before update.`);

    // Mark all sessions revoked
    const updateResult = await Session.updateMany(
      { userId: objectUserId, revoked: false },
      { $set: { revoked: true, revokedReason: reason } }
    );
    console.log('Update result:', updateResult);

    // Emit the force-logout event to the user's room
    io.to(userId).emit('force-logout', { reason });
    console.log(`🛑 Force logout event sent to user ${userId} with reason:`, reason);

    res.json({ message: "User logged out from all devices" });
  } catch (err) {
    console.error("Force logout error:", err);
    res.status(500).json({ error: err.message });
  }
});

// API Route to Send Password Reset Link (Email)
app.post("/send-email", async (req, res) => {
  const { email } = req.body;
  console.log("Received request to send email for:", email); // Log the email request

  try {
    const user = await User.findOne({ email });
    if (!user) {
      console.log("User not found for email:", email);
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Generate a reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 3600000; // Token expires in 1 hour
    await user.save();

    // Create the reset URL
    const resetUrl = `http://localhost:4200/reset-password/${resetToken}`;

    // Set up email transporter using nodemailer
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: 'nawressjebalinounou@gmail.com', // Use your email
        pass: 'nspb qesr oral zttl', // Use App Password or OAuth2
      }
    });

    const mailOptions = {
      from: 'nawressjebalinounou@gmail.com',
      to: email,
      subject: 'Password Reset Request',
      text: `Hello ${user.name},\n\nYou requested a password reset. Please click the link below to reset your password:\n\n${resetUrl}\n\nThe link will expire in 1 hour.\n\nRegards,\nYour Team`
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent: ' + info.response);

    return res.status(200).json({ success: true, message: 'Password reset link sent successfully!' });
  } catch (err) {
    console.error("Error sending email:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// API Route to Reset Password
app.post("/reset-password", async (req, res) => {
  const { token, password } = req.body;
  console.log("Received password reset request for token:", token);

  try {
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid or expired token' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    user.password = hashedPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    // Log recent activity
    await RecentActivity.create({
      userId: user._id,
      collectionName: 'users',
      action: 'password_reset',
      description: 'password_reset',
      timestamp: new Date()
    });

    console.log("Password reset successful for user:", user.email);
    res.status(200).json({ success: true, message: 'Password has been reset successfully!' });
  } catch (err) {
    console.error("Error resetting password:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.use(express.json());



app.post('/log-error', (req, res) => {
  const { message } = req.body;

  const logFilePath = path.join(__dirname, 'src', 'app', 'reset-password', 'error.txt');
  const logDir = path.dirname(logFilePath);

  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  const logMessage = `${new Date().toISOString()} - ${message}\n`;

  fs.appendFile(logFilePath, logMessage, (err) => {
    if (err) {
      console.error('❌ Error writing to log file:', err);
      return res.status(500).send('Error logging message');
    }
    res.status(200).send('✅ Error logged successfully');
  });
});
// API Route to get the doctor's photo
app.get("/api/me/photo", async (req, res) => {
  try {
    const userId = req.user.id;  // Get the user ID from the session or JWT token
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    console(user.photo);
    const photoPath = user.photo;
    if (!photoPath) {
      return res.status(404).json({ success: false, message: "Photo not found" });
    }

    // Serve the photo from the 'uploads' folder
    res.sendFile(path.join(__dirname, photoPath));  // Ensure photoPath is correct
  } catch (err) {
    console.error("Error fetching photo:", err);
    res.status(500).json({ success: false, message: "Error fetching photo" });
  }
});

// Import RecentActivity model at the top of your file (adjust the path)


app.put("/users/:id", upload.single("photo"), async (req, res) => {
  try {
    const userId = req.params.id;

    // Extract updates from req.body
    const updates = { ...req.body };

    // If password is present, hash it
    if (updates.password) {
      updates.password = await bcrypt.hash(updates.password, 10);
    }

    // If a new photo is uploaded, update the photo path
    if (req.file) {
      updates.photo = `/uploads/${req.file.filename}`;
    }

    // Remove empty fields (optional)
    Object.keys(updates).forEach((key) => {
      if (updates[key] === "" || updates[key] === undefined || updates[key] === null) {
        delete updates[key];
      }
    });

    // Perform the update in MongoDB
    const updatedUser = await User.findByIdAndUpdate(userId, updates, {
      new: true,
    });

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    // Log the recent activity
    await RecentActivity.create({
      userId: userId,
      activityType: 'profile_update',
      description:'profile_update',
      timestamp: new Date()
    });

    res.status(200).json({ message: "User updated successfully", user: updatedUser });
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({ message: "Failed to update user", error: error.message });
  }
});


app.delete("/users/:id", async (req, res) => {
  try {
    const userId = req.params.id;
    const user = await User.findByIdAndDelete(userId);
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    console.log("User deleted successfully:", user);
    res.status(200).json({ message: "User deleted successfully" });
  } catch (err) {
    console.error("Error deleting user:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});
// API Route to Get All Doctors Specializing in Cardiology
// Fetch cardiology doctors
app.get("/api/cardiology-doctors", async (req, res) => {
  console.log("Received request to fetch cardiology doctors.");

  try {
    const cardiologyDoctors = await User.find({ specialty: /cardiologie/i });

    if (cardiologyDoctors.length === 0) {
      console.log("No cardiology doctors found.");
      return res.status(404).json({ message: "No cardiology doctors found." });
    }

    console.log(`Found ${cardiologyDoctors.length} cardiology doctors.`);
    res.status(200).json(cardiologyDoctors);
  } catch (err) {
    console.error("Error fetching cardiology doctors:", err);
    res.status(500).json({ message: "Error fetching cardiology doctors." });
  }
});
// Define ECG Schema
const ecgSchema = new mongoose.Schema({
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'users', required: true },
  receiverId: { type: mongoose.Schema.Types.ObjectId, ref: 'users', required: true },
  filePath: { type: String, required: true },
  emergencyLevel: { type: String, enum: ['normal', 'urgent', 'critical'], required: true },
  
  uploadDate: { type: Date, default: Date.now },
  sendDate: { type: Date, default: Date.now }, // ✅ NEW
  deadline: { type: Date },                    // ✅ NEW: used for 24h check
   

   resubmitted: { type: Boolean, default: false },
  responseDate: { type: Date, default: Date.now },
  answered: { type: String, default: "no" },
  answer: { type: String, default: "" },

  generalistDecision: { type: String, enum: ['Approved', 'Disapproved'], default: null }
});


const ECG = mongoose.model("ecgs", ecgSchema);




const ecgUploadDir = path.join(__dirname, "ECGS"); // Works regardless of OS and space in name


if (!fs.existsSync(ecgUploadDir)) {
  fs.mkdirSync(ecgUploadDir, { recursive: true });
  console.log("✅ ECGS folder created at:", ecgUploadDir);
}

const ecgStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, ecgUploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = 'ecg-' + Date.now() + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});

const ecgUpload = multer({ storage: ecgStorage });
app.get('/api/ecgs_pfe/:id', async (req, res) => {
  const { id } = req.params;
  console.log(`[GET] /api/ecgs_pfe/${id} - Received request`);

  try {
    let ecg = await ECG.findById(id);
    console.log(`Searching individual ECG collection for id: ${id}`);

    if (ecg) {
      console.log('Found ECG in individual ECG collection:', ecg);
      return res.send({
        ...ecg.toObject(),
        normalizedScope: 'individual',
      });
    }

    console.log('Not found in individual ECG collection, searching broadcast ECG collection');

    ecg = await BroadcastECG.findById(id);
    if (ecg) {
      console.log('Found ECG in broadcast ECG collection:', ecg);
      return res.send({
        ...ecg.toObject(),
        normalizedScope: 'group',
      });
    }

    console.log('ECG not found in either collection');
    res.status(404).send('ECG not found');
  } catch (error) {
    console.error('Error fetching ECG:', error);
    res.status(500).send('Server error');
  }
});



app.post("/upload-ecg", ecgUpload.single("file"), async (req, res) => {
  try {
    const file = req.file;
    const senderId = req.headers["senderid"];
    const receiverId = req.headers["receiverid"];
    const emergencyLevel = req.body.emergencyLevel;

    // Validation
    if (!file) {
      return res.status(400).json({ error: "No file uploaded." });
    }

    if (!senderId || !receiverId || !emergencyLevel) {
      return res.status(400).json({ error: "Missing senderId, receiverId, or emergencyLevel." });
    }

    // Set timestamps
    const now = new Date();
    const deadline = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours later

    // Save to MongoDB
    const ecg = await ECG.create({
      senderId,
      receiverId,
      filePath: file.path,
      emergencyLevel,
      sendDate: now,
      deadline: deadline,
    });

    // Log recent activity for the sender
    await RecentActivity.create({
      userId: senderId,

      description:  'ecg_upload',
      timestamp: now,
    });

    // Respond with success
    res.status(200).json({
      message: "ECG uploaded successfully!",
      filename: file.filename,
      path: file.path,
      senderId,
      receiverId,
      emergencyLevel,
      sendDate: now,
      deadline: deadline,
    });

  } catch (error) {
    console.error("❌ ECG Upload Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
 // Add this at the top of your file if not present

app.put('/api/doctors/:id/rate', async (req, res) => {
  const doctorId = req.params.id;
  const { rating, raterId } = req.body;

  try {
    const doctor = await User.findById(doctorId);
    if (!doctor) {
      return res.status(404).send('Doctor not found');
    }

    if (!doctor.ratingSum) doctor.ratingSum = 0;
    if (!doctor.ratingCount) doctor.ratingCount = 0;

    doctor.ratingSum += rating;
    doctor.ratingCount += 1;

    doctor.rating = doctor.ratingSum / doctor.ratingCount;

    await doctor.save();

    if (raterId && mongoose.Types.ObjectId.isValid(raterId)) {
      await RecentActivity.create({
        userId: raterId,
        activityType: 'doctor_rated',
        description:'doctor_rated',
        timestamp: new Date(),
      });
    }

    res.status(200).json({ message: 'Rating updated successfully', rating: doctor.rating });
  } catch (err) {
    console.error('❌ Server error during rating update:', err);
    res.status(500).send('Error updating rating');
  }
});


// Define the Report Schema
const reportSchema = new mongoose.Schema({
  username: { type: String, required: true },
  reportedDoctor: { type: String, required: true },
  reason: { type: String, required: true },
  time: { type: Date, default: Date.now },
  treated: { type: Boolean, default: false },  // default to false
  response: { type: String, default: '' }      // default to empty string
});

// Create the Report Model
const Report = mongoose.model("reports", reportSchema);
// API Route to report a doctor
app.post("/api/doctors/:id/report", async (req, res) => {
  const { reason, username } = req.body; // Get reason and username from body
  const reportedDoctor = req.params.id;

  // Validate inputs
  if (!reason || !username) {
    return res.status(400).json({ message: "Reason and username are required" });
  }

  try {
    // Optional: Validate that the reported doctor exists
    const doctorExists = await User.findById(reportedDoctor);
    if (!doctorExists) {
      return res.status(404).json({ message: "Reported doctor not found" });
    }

    // Create the report document
    const newReport = new Report({
      username,
      reportedDoctor,
      reason,
      time: new Date(),
      treated: false,      // Add a treated flag to track status if your schema supports it
      response: null       // To hold admin response later
    });

    await newReport.save();

    // Optionally: Log this action as recent activity
    await RecentActivity.create({
      userId: username.id,  // or use actual user ID if you have it
      activityType: "report_submitted",
      description: "report_submitted",
      timestamp: new Date(),
    });

    res.status(201).json({ message: "Report saved successfully" });
  } catch (err) {
    console.error("Error saving report:", err);
    res.status(500).json({ message: "Error saving the report" });
  }
});

app.post('/api/reports/:id/respond', async (req, res) => {
  const reportId = req.params.id;
  const { response } = req.body;

  if (!response || response.trim() === '') {
    return res.status(400).json({ message: 'Response text is required.' });
  }

  try {
    const report = await Report.findById(reportId);
    if (!report) {
      return res.status(404).json({ message: 'Report not found.' });
    }

    report.response = response.trim();
    report.treated = true;
    report.responseDate = new Date(); // Optional: track when response was made

    await report.save();

    // Optional: Log recent activity for admin responding
    

    res.status(200).json({ message: 'Response saved successfully.', report });
  } catch (error) {
    console.error('Error updating report response:', error);
    res.status(500).json({ message: 'Server error while saving response.' });
  }
});

// Event Schema
const eventSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  doctorId: { type: String, required: true },
  title: { type: String, required: true },
  date: { type: Date, required: true },
  roomId: { type: String, required: true },
  cancelled: { type: String, default: 'no' } // 🔥 Add this line
});



const Event = mongoose.model("events", eventSchema);
const { v4: uuidv4 } = require('uuid');

app.post('/events', async (req, res) => {
  try {
    const { userId, doctorId, title, date } = req.body;

    if (!userId || !doctorId || !title || !date) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Parse date safely and adjust by subtracting 1 hour (timezone fix or requirement)
    const parsedDate = new Date(date);
    if (isNaN(parsedDate)) {
      return res.status(400).json({ error: 'Invalid date format' });
    }
    const adjustedDate = new Date(parsedDate.getTime() - 60 * 60 * 1000);

    const roomId = uuidv4();

    const newEvent = new Event({
      userId,
      doctorId,
      title,
      date: adjustedDate,
      roomId,
    });

    await newEvent.save();
    await RecentActivity.create({
      userId: userId, // or admin ID if you have it
      activityType: 'event_created',
      description: `event_created`,
      timestamp: new Date(),
    });
    console.log('✅ Event saved:', newEvent);

    res.status(201).json({ message: 'Event saved successfully', event: newEvent });

  } catch (err) {
    console.error('❌ Error saving event:', err);
    res.status(500).json({ error: 'Failed to save event' });
  }
});

// Route to create/save a calendar event
app.get('/events', async (req, res) => {
  const { userId } = req.query;

  if (!userId) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  try {
    const events = await Event.find({
      $or: [
        { userId },
        { doctorId: userId }
      ]
    });

    console.log('Fetched events from the database:', events);

    res.status(200).json(events);
  } catch (err) {
    console.error('Error fetching events:', err);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});
app.delete('/events/:id', async (req, res) => {
  const userId = req.query.userId;  // get userId from query string

  try {
    const deletedEvent = await Event.findByIdAndDelete(req.params.id);

    if (!deletedEvent) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Log deletion in RecentActivity, use userId from request if valid, else fallback to event owner
    const logUserId = userId && mongoose.Types.ObjectId.isValid(userId) ? userId : deletedEvent.userId;

    await RecentActivity.create({
      userId: logUserId,
      activityType: 'event_deleted',
      description: 'event_deleted',
      details: {
        eventId: deletedEvent._id,
        title: deletedEvent.title,
        date: deletedEvent.date
      },
      timestamp: new Date()
    });

    res.json({ message: 'Event deleted successfully' });
  } catch (err) {
    console.error('Error deleting event:', err);
    res.status(500).json({ error: 'Failed to delete event' });
  }
});





app.put('/events/:id/cancel', async (req, res) => {
  try {
    const eventId = req.params.id;
    const userId = req.query.userId; // or req.headers['x-user-id']

    const updatedEvent = await Event.findByIdAndUpdate(
      eventId,
      { cancelled: 'yes' },
      { new: true }
    );

    if (!updatedEvent) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Use userId from request if valid, else fallback to event owner
    const logUserId = userId && mongoose.Types.ObjectId.isValid(userId) ? userId : updatedEvent.userId;

    await RecentActivity.create({
      userId: logUserId,
      activityType: 'event_cancelled',
      description: 'event_cancelled',
      details: {
        eventId,
        title: updatedEvent.title,
        date: updatedEvent.date
      },
      timestamp: new Date()
    });

    console.log(`✅ Event ${eventId} cancelled.`);
    res.json({ message: 'Event cancelled', event: updatedEvent });

  } catch (err) {
    console.error('❌ Error cancelling event:', err);
    res.status(500).json({ error: 'Failed to cancel event' });
  }
});




const cron = require("node-cron");
// ✅ New Schema (no receiverId)
const broadcastECGSchema = new mongoose.Schema({
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'users', required: true },
  filePath: { type: String, required: true },
  emergencyLevel: {
    type: String,
    enum: ['normal', 'urgent', 'critical'],
    required: true
  },
  choices: {
    type: [String],
    default: []
  },
  uploadDate: { type: Date, default: Date.now },

  
  deadline: { 
    type: Date, 
    default: () => new Date(Date.now() + 1 * 24 * 60 * 60 * 1000) 
  },

  // Extension flag, false by default
  extended: { 
    type: Boolean, 
    default: false 
  },

  responseDate: { type: Date, default: Date.now },
  answered: { type: String, default: "no" },
  resubmitted: { type: Boolean, default: false },
  answer: {
  type: [String],  // Array of strings
  default: []
},
  generalistDecision: { 
    type: String, 
    enum: ['Approved', 'Disapproved'], 
    default: null,
    set: v => v === '' ? null : v  
  },

  votes: [
    {
      cardiologistId: { type: mongoose.Schema.Types.ObjectId, ref: 'users', required: true },
      choice: { type: String, required: true },
      voteDate: { type: Date, default: Date.now }
    }
  ]
});

// ✅ New model and MongoDB collection name
const BroadcastECG = mongoose.model("broadcastEcgUploads", broadcastECGSchema);

// ✅ Optional: new folder for separation

const broadcastECGUploadDir = path.join(__dirname, "Broadcast_ECGS");

if (!fs.existsSync(broadcastECGUploadDir)) {
  fs.mkdirSync(broadcastECGUploadDir, { recursive: true });
  console.log("✅ Broadcast ECG folder created at:", broadcastECGUploadDir);
}

const broadcastECGStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, broadcastECGUploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = 'broadcast-ecg-' + Date.now() + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});

const broadcastUpload = multer({ storage: broadcastECGStorage });
app.use('/Broadcast_ECGS', express.static(path.join(__dirname, 'Broadcast_ECGS')));

// ✅ NEW endpoint: /upload-broadcast-ecg
// ✅ Updated endpoint: /upload-ecg-to-all-doctors
app.post("/upload-ecg-to-all-doctors", broadcastUpload.single("file"), async (req, res) => {
  try {
    const file = req.file;
    const senderId = req.headers["senderid"];
    const emergencyLevel = req.body.emergencyLevel;
    const choices = req.body.choices ? JSON.parse(req.body.choices) : [];

    if (!file) {
      return res.status(400).json({ error: "No file uploaded." });
    }

    if (!senderId || !emergencyLevel) {
      return res.status(400).json({ error: "Missing senderId or emergencyLevel." });
    }

    // Save only the relative file path or filename (not absolute Windows path)
    // Assuming your uploads folder is something like './Broadcast_ECGS'
    const fileName = path.basename(file.path);

    // Save file info in BroadcastECG collection
    const broadcastECG = await BroadcastECG.create({
      senderId,
      filePath: fileName,
      emergencyLevel,
      choices
    });

    // Log this action in RecentActivity collection
    await RecentActivity.create({
      userId: senderId,
      activityType: "broadcast_ecg_upload",
      description: "broadcast_ecg_upload",
      details: {
        fileName,
        emergencyLevel,
        choices
      },
      timestamp: new Date()
    });

    res.status(200).json({
      message: "Broadcast ECG uploaded successfully.",
      data: broadcastECG
    });

  } catch (error) {
    console.error("❌ Broadcast ECG Upload Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});


const DraftSchema = new mongoose.Schema({
  filename: String,
  senderId: mongoose.Schema.Types.ObjectId,
  path: String,
  createdAt: { type: Date, default: Date.now }
});

const Draft = mongoose.model('Draft', DraftSchema);

// Multer storage config
const draftStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'drafts/'); // Ensure this folder exists
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, req.body.senderId + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// Initialize multer with the new storage configuration
const draftUpload = multer({ storage: draftStorage });

// Your route to handle ECG draft upload
// POST route to save the draft
app.post('/modify-ecg-draft', draftUpload.single('file'), async (req, res) => {
  try {
    const senderId = req.body.senderId;
    const file = req.file;

    if (!file || !senderId) {
      return res.status(400).json({ message: 'Fichier ou senderId manquant.' });
    }

    // Generate consistent filename
    const timestamp = Date.now();
    const filename = file.originalname
      ? `${senderId}-${timestamp}-${file.originalname}`
      : `${senderId}-${timestamp}-default.jpg`;

    // Compute new path
    const newPath = path.join(file.destination, filename);

    // Rename the uploaded file to the new filename
    fs.renameSync(file.path, newPath);

    // Save draft info to database
    const draft = new Draft({
      filename,
      senderId,
      path: newPath
    });

    await draft.save();

    // Validate senderId before logging activity
    const validUserId = mongoose.Types.ObjectId.isValid(senderId) ? senderId : null;

    if (validUserId) {
      await RecentActivity.create({
        userId: validUserId,
        activityType: 'draft_modified',
        description: 'draft_modified',
        details: {
          draftId: draft._id,
          filename,
          path: newPath
        },
        timestamp: new Date()
      });
    }

    res.status(200).json({ message: 'Brouillon sauvegardé avec succès.', draft });
  } catch (error) {
    console.error('Erreur upload draft:', error);
    res.status(500).json({ message: 'Erreur serveur.' });
  }
});

app.get('/drafts/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname, 'drafts', filename); // Ensure path is correct

  // Check if the file exists
  if (fs.existsSync(filePath)) {
    // Set headers to prompt download
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.sendFile(filePath);
  } else {
    res.status(404).send('File not found');
  }
});
app.delete('/drafts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.query.userId || req.headers['x-user-id']; // get userId from client

    console.log("🔍 Received DELETE request for draft ID:", id);

    if (!id) {
      console.warn("⚠️ Missing draft ID");
      return res.status(400).json({ error: 'ID du brouillon manquant' });
    }

    const draft = await Draft.findByIdAndDelete(id);
    if (!draft) {
      console.warn("⚠️ Draft not found in DB");
      return res.status(404).json({ error: 'Brouillon non trouvé' });
    }

    // Validate userId (optional)
    const validUserId = userId && mongoose.Types.ObjectId.isValid(userId) ? userId : draft.senderId;

    // Log deletion in RecentActivity with the user who did it
    await RecentActivity.create({
      userId: validUserId,
      activityType: 'draft_deleted',
      description:'draft_deleted',
      details: {
        draftId: draft._id,
        filename: draft.filename,
        path: draft.path
      },
      timestamp: new Date()
    });

    console.log("✅ Draft deleted successfully");
    res.status(200).json({ message: 'Brouillon supprimé avec succès' });
  } catch (err) {
    console.error("🔥 Server error while deleting draft:", err);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});



// Get user drafts with download links
app.get('/user-drafts/:senderId', async (req, res) => {
  const senderId = req.params.senderId;

  if (!senderId) {
    return res.status(400).json({ message: 'ID utilisateur manquant.' });
  }

  try {
    const drafts = await Draft.find({ senderId });

    if (!Array.isArray(drafts) || drafts.length === 0) {
      console.log(`Aucun brouillon trouvé pour l'utilisateur : ${senderId}`);
    }

    const response = drafts.map(d => {
      const safeFilename = d.filename || 'invalide.jpg';

      // Construct the URL to access the draft file for downloading
      const safeUrl = `http://localhost:5000/drafts/${safeFilename.replace(/\\/g, '/')}`;

      return {
        _id: d._id,  // Add _id here
        filename: safeFilename,
        createdAt: d.createdAt,
        url: safeUrl
      };
    });

    console.log('Sending drafts response:', JSON.stringify(response, null, 2));
    res.status(200).json(response); // ✅ This is the only response sent
  } catch (err) {
    console.error('Erreur récupération des brouillons :', err);
    res.status(500).json({ message: 'Erreur serveur.' });
  }
});
const ecgStorage_1 = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, 'ECGWITHCASE'));  // Save files in ECGWITHCASE folder
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname); // Unique filename with timestamp
  }
});

const ecgUpload_1 = multer({ storage: ecgStorage_1 });

const caseSchema = new mongoose.Schema({
  senderId: String,
  receiverId: String,
  patientId: String,
  patientAge: Number,
  patientSex: String,
  consultationMotive: String,
  symptoms: String,
  medicalHistory: String,
  allergies: String,
  currentMedications: String,
  bloodPressure: String,
  heartRate: String,
  temperature: String,
  oxygenSaturation: String,
  selectedECGFile: String,
  resubmitted: { type: Boolean, default: false },
  responseDate: {
    type: Date,
    default: Date.now
  },
  answered: {
    type: String,
    default: "no" // other values: "expired", "resubmitted"
  },
  answer: {
    type: String,
    default: ""
  },
  generalistDecision: { type: String, enum: ['Approved', 'Disapproved'], default: null },
  responseFileName: {
    type: String,
    default: ""
  },


  // ✅ NEW FIELD
  deadline: {
    type: Date,
    default: () => new Date(Date.now() + 24 * 60 * 60 * 1000) // 24h from now
  }

}, { timestamps: true });


const Case = mongoose.model('Case', caseSchema);

app.post('/cases', ecgUpload_1.single('selectedECGFile'), async (req, res) => {
  try {
    const {
      senderId,
      receiverId,
      patientId,
      patientAge,
      patientSex,
      consultationMotive,
      symptoms,
      medicalHistory,
      allergies,
      currentMedications,
      bloodPressure,
      heartRate,
      temperature,
      oxygenSaturation,
      emergencyLevel
    } = req.body;

    const selectedECGFile = req.file ? req.file.filename : null;

    const newCase = new Case({
      senderId,
      receiverId,
      patientId,
      patientAge,
      patientSex,
      consultationMotive,
      symptoms,
      medicalHistory,
      allergies,
      currentMedications,
      bloodPressure,
      heartRate,
      temperature,
      oxygenSaturation,
      emergencyLevel,
      selectedECGFile,
    });

    await newCase.save();

    // Log the activity
    await RecentActivity.create({
      userId: senderId,
      activityType: 'case_created',
      description:'case_created',
      details: {
        caseId: newCase._id,
        patientId,
        emergencyLevel,
        selectedECGFile,
      },
      timestamp: new Date()
    });

    res.status(201).json({ message: 'Case and ECG file saved successfully.', case: newCase });
  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({ error: 'Failed to save case' });
  }
});

app.get('/api/cases/responded', async (req, res) => {
  try {
    // Fetch cases that have been answered
    const respondedCases = await Case.find({ answered: "yes" });

    res.status(200).json(respondedCases);
  } catch (error) {
    console.error('❌ Error fetching responded cases:', error);
    res.status(500).json({ error: 'Failed to fetch responded cases' });
  }
});
app.get('/api/ecgs', async (req, res) => {

  try {
    // Fetch cases that have been answered
    const respondedCases = await ECG .find({ answered: "yes" });

    res.status(200).json(respondedCases);
  } catch (error) {
    console.error('❌ Error fetching responded cases:', error);
    res.status(500).json({ error: 'Failed to fetch responded cases' });
  }
});
const ecgDirectory = path.join(__dirname, 'ECGS');
console.log("ECG directory path:", ecgDirectory);

// List files inside ECGS folder on startup
fs.readdir(ecgDirectory, (err, files) => {
  if (err) {
    console.error("❌ Error reading ECGS folder:", err);
  } else {
    console.log("📂 ECGS folder files:", files);
  }
});

// Static route
app.use('/ecg-files', express.static(ecgDirectory));

console.log("ECG directory path:", ecgDirectory);

// List files inside ECGS folder on startup
fs.readdir(ecgDirectory, (err, files) => {
  if (err) {
    console.error("❌ Error reading ECGS folder:", err);
  } else {
    console.log("📂 ECGS folder files:", files);
  }
});


const broadcastECGDirectory = path.join(__dirname, 'Broadcast_ECGS');
app.use('/broadcast-ecg-files', express.static(broadcastECGDirectory));

// Log folders
console.log("📂 ECG directory path:", ecgDirectory);
fs.readdir(ecgDirectory, (err, files) => {
  if (err) {
    console.error("❌ Error reading ECGS folder:", err);
  } else {
    console.log("📂 ECGS folder files:", files);
  }
});

console.log("📂 Broadcast ECG directory path:", broadcastECGDirectory);
fs.readdir(broadcastECGDirectory, (err, files) => {
  if (err) {
    console.error("❌ Error reading broadcast_ECGS folder:", err);
  } else {
    console.log("📂 Broadcast ECGS folder files:", files);
  }
});


app.get('/api/ecgs/all', async (req, res) => {
  try {
    // Fetch cases that have been answered
    const respondedCases = await BroadcastECG.find({ answered: "yes" });

    res.status(200).json(respondedCases);
  } catch (error) {
    console.error('❌ Error fetching responded cases:', error);
    res.status(500).json({ error: 'Failed to fetch responded cases' });
  }
});
const uploadDir_3 = path.join(__dirname, 'broadcastcase');

if (!fs.existsSync(uploadDir_3)) {
  fs.mkdirSync(uploadDir_3, { recursive: true });
}

const broadcastEcgStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'broadcastcase'); // different folder
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const ecgUploadBroadcast = multer({ storage: broadcastEcgStorage });

const broadcastCaseSchema = new mongoose.Schema({
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'users', required: true },

  // Patient Info
  patientId: String,
  patientAge: Number,
  patientSex: String,
  consultationMotive: String,
  symptoms: String,
  medicalHistory: String,
  allergies: String,
  currentMedications: String,
  bloodPressure: String,
  heartRate: String,
  temperature: String,
  oxygenSaturation: String,
  broadcastECGFile: String, // optional ECG file reference
  resubmitted: { type: Boolean, default: false },

  // Choices for diagnosis
  diagnosesChoices: {
    type: [String],
    default: []
  },

  // Votes
  votes: [
    {
      specialistId: { type: mongoose.Schema.Types.ObjectId, ref: 'users', required: true },
      choice: { type: String, required: true },
      voteDate: { type: Date, default: Date.now }
    }
  ],

  // Timing
  uploadDate: { type: Date, default: Date.now },
  deadline: {
    type: Date,
    default: () => new Date(Date.now() + 1 * 24 * 60 * 60 * 1000) // 3 days
  },
  extended: {
    type: Boolean,
    default: false
  },
  extendedDate: {
    type: Date,
    default: null
  },

  // Answer and decision
  responseDate: { type: Date, default: Date.now },
  answered: {
    type: String,
    enum: ['no', 'yes', 'expired'],
    default: 'no'
  },
  answer: {
    type: [String],
    default: []
  },
  generalistDecision: {
    type: String,
    enum: ['Approved', 'Disapproved'],
    default: null,
    set: v => v === '' ? null : v
  }

}, { timestamps: true });

// ✅ New model for broadcasted cases


const BroadcastCase = mongoose.model('BroadcastCase', broadcastCaseSchema);
app.use('/broadcastcase', express.static(path.join(__dirname, 'broadcastcase')));
app.post('/cases/broadcast', ecgUploadBroadcast.single('broadcastECGFile'), async (req, res) => {
  try {
    console.log('Request body:', req.body);
    console.log('Uploaded file:', req.file);

    const {
      senderId,
      patientId,
      patientAge,
      patientSex,
      consultationMotive,
      symptoms,
      medicalHistory,
      allergies,
      currentMedications,
      bloodPressure,
      heartRate,
      temperature,
      oxygenSaturation,
      emergencyLevel
    } = req.body;

    // Parse diagnosesChoices JSON string from form data, fallback to empty array
    let diagnosesChoices = [];
    if (req.body.diagnosesChoices) {
      try {
        diagnosesChoices = JSON.parse(req.body.diagnosesChoices);
      } catch (err) {
        console.warn('Invalid diagnosesChoices JSON:', err);
      }
    }

    const broadcastECGFile = req.file ? req.file.filename : null;

    const newBroadcastCase = new BroadcastCase({
      senderId,
      patientId,
      patientAge,
      patientSex,
      consultationMotive,
      symptoms,
      medicalHistory,
      allergies,
      currentMedications,
      bloodPressure,
      heartRate,
      temperature,
      oxygenSaturation,
      emergencyLevel,
      broadcastECGFile,
      diagnosesChoices
    });

    console.log('Saving newBroadcastCase:', newBroadcastCase);

    await newBroadcastCase.save();

    // Log recent activity
    await RecentActivity.create({
      userId: senderId,
      activityType: 'broadcast_case_created',
      description: 'broadcast_case_created',
      details: {
        broadcastCaseId: newBroadcastCase._id,
        patientId,
        emergencyLevel,
        diagnosesChoices
      },
      timestamp: new Date()
    });

    res.status(201).json({ message: 'Broadcast case and ECG file saved successfully.' });
  } catch (error) {
    console.error('❌ Broadcast error:', error);
    res.status(500).json({ error: 'Failed to save broadcast case' });
  }
});

app.get('/api/cases/respondedallcases', async (req, res) => {
  console.log('[GET] /api/cases/respondedallcases - Fetching responded cases');

  try {
    // Fetch cases that have been answered
    const respondedCases = await BroadcastCase.find({ answered: "yes" });
    console.log(`Found ${respondedCases.length} responded cases`);

    res.status(200).json(respondedCases);
  } catch (error) {
    console.error('❌ Error fetching responded cases:', error);
    res.status(500).json({ error: 'Failed to fetch responded cases' });
  }
});

app.get('/api/reports', async (req, res) => {
  const userId = req.query.userId;
  try {
    const reports = await Report.find({ "username": new RegExp(userId) }); 
    // Assuming username field contains the JSON string with user id; 
    // or better if you store the generalist's userId separately in the report
    res.status(200).json(reports);
  } catch (err) {
    console.error('Error fetching reports:', err);
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});
const securityReportSchema = new mongoose.Schema({
  userId: { type: String, required: false },
  name: { type: String },
  email: { type: String, required: true },
  description: { type: String, required: true },
  steps: { type: String },
  status: { type: String, enum: ['pending', 'valid', 'invalid'], default: 'pending' },
  severity: { type: String },
  actions: {
    changePassword: { type: Boolean },
    enable2FA: { type: Boolean },
   
  },
  createdAt: { type: Date, default: Date.now },
});

// Création du modèle
const SecurityReport = mongoose.model('SecurityReport', securityReportSchema);
app.post('/api/security-reports/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  console.log(`Update status request for report ID: ${id} with status: ${status}`);

  if (!['pending', 'valid', 'invalid'].includes(status)) {
    console.log('Invalid status provided:', status);
    return res.status(400).json({ message: 'Invalid status' });
  }

  try {
    const report = await SecurityReport.findById(id);
    if (!report) {
      console.log('Report not found for id:', id);
      return res.status(404).json({ message: 'Report not found' });
    }

    report.status = status;
    await report.save();

    console.log('Report status updated successfully:', report);
    res.json({ message: 'Report status updated', status: report.status });
  } catch (error) {
    console.error('Error updating report status:', error);
    res.status(500).json({ message: 'Server error', error });
  }
});

app.post('/api/users/:userId/send-security-notification', async (req, res) => {
  const { userId } = req.params;
  const { subject, message } = req.body;

  if (!subject || !message) {
    return res.status(400).json({ error: 'Subject and message are required' });
  }

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const mailOptions = {
      from: 'nawressjebalinounou@gmail.com',
      to: user.email,
      subject,
      text: message,
    };

    await transporter.sendMail(mailOptions);
    console.log(`📨 Notification email sent to ${user.email}`);

    res.json({ message: 'Notification email sent' });
  } catch (err) {
    console.error('❌ Error sending notification email:', err);
    res.status(500).json({ error: 'Failed to send email' });
  }
});

// Route POST
app.post('/api/security-report', async (req, res) => {
  try {
    const reportData = req.body;
    const newReport = new SecurityReport(reportData);
    await newReport.save();

    // Log recent activity
    

    res.status(201).json({ message: 'Security report submitted successfully.' });
  } catch (error) {
    console.error('Error saving report:', error);
    res.status(500).json({ message: 'Failed to submit report.' });
  }
});

app.get('/api/security-reports', async (req, res) => {
  try {
    const reports = await SecurityReport.find().sort({ createdAt: -1 }).exec();
    res.status(200).json(reports);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error fetching security reports' });
  }
});

app.get('/api/cases_pfe/:id', async (req, res) => {
  const { id } = req.params;

  try {
    let caseData = await Case.findById(id);
    let normalizedScope = 'individual';

    if (!caseData) {
      caseData = await BroadcastCase.findById(id);
      normalizedScope = 'group';
    }

    if (!caseData) {
      return res.status(404).send('Case not found');
    }

    res.send({ case: caseData, normalizedScope });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

app.post('/api/change-password', async (req, res) => {
  const { userId, currentPassword, newPassword } = req.body;

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Incorrect current password.' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();

    // Log activity
    await RecentActivity.create({
      userId:userId,
      activityType: 'password_changed',
      description:'password_changed',
      details: { message: 'User changed password successfully.' },
      timestamp: new Date()
    });

    return res.json({ success: true, message: 'Password changed successfully.' });
  } catch (error) {
    console.error('Error changing password:', error);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

app.use(express.json());


app.post('/api/2fa/generate-secret', async (req, res) => {
  console.log('Request headers:', req.headers);
  console.log('Request body:', req.body);

  const { userId } = req.body;
  if (!userId) {
    return res.status(400).json({ message: 'Missing userId' });
  }

  try {
    const user = await User.findById(userId);
    if (!user) {
      console.log(`User not found for id: ${userId}`);
      return res.status(404).json({ message: 'User not found' });
    }

    console.log(`User found: ${user.email}`);

    // ✅ Check if 2FA is already set up
    if (user.twoFactorSecret) {
      console.log('2FA already set up for this user.');
      return res.status(400).json({ message: '2FA is already set up for this user' });
    }

    // ✅ Only generate if not already set
    const secret = speakeasy.generateSecret({
      name: `MedConnect (${user.email})`
    });

    user.twoFactorTempSecret = secret.base32;
    await user.save();
    await RecentActivity.create({
      userId:userId,
      activityType: '2fa_secret_generated',
      description: '2FA secret generated',
      details: { message: 'User generated a new 2FA secret.' },
      timestamp: new Date()
    });

    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

    res.json({ qrCodeUrl, secret: secret.base32 });
  } catch (error) {
    console.error('Error generating 2FA secret:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});
app.post('/api/2fa/disable', async (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ message: 'Missing userId' });
  }

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.twoFactorSecret = undefined;
    user.twoFactorTempSecret = undefined;
    user.twoFactorEnabled = false; // 🔁 Set flag to false
    await user.save();
     await RecentActivity.create({
      userId:userId,
      activityType: '2fa_disabled',
      description: '2FA disabled',
      details: { message: 'User disabled two-factor authentication.' },
      timestamp: new Date()
    });

    res.json({ message: '2FA has been disabled successfully.' });
  } catch (error) {
    console.error('Error disabling 2FA:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});
app.post('/api/2fa/status', async (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ message: 'Missing userId' });
  }

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
      await RecentActivity.create({
      userId:userId,
      activityType: '2fa_status_checked',
      description: '2FA status checked',
      details: { message: 'User checked 2FA status.' },
      timestamp: new Date()
    });

    // Send whether 2FA is enabled (you already store it as a boolean)
    return res.json({ enabled: user.twoFactorEnabled === true });
  } catch (error) {
    console.error('Error checking 2FA status:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});


app.get('/api/2fa/test', (req, res) => {
  res.json({ message: '2FA API is reachable' });
});
app.post('/api/2fa/verify-token', async (req, res) => {
  const { userId, token } = req.body;

  console.log('Incoming request: POST /api/2fa/verify-token');
  console.log('Request body:', { userId, token });

  if (!userId || !token) {
    console.warn('❌ Missing required fields');
    return res.status(400).json({ message: 'Missing required fields' });
  }

  try {
    // Fetch the user from DB
    const user = await User.findById(userId);

    if (!user) {
      console.warn(`❌ No user found with ID: ${userId}`);
      return res.status(404).json({ message: 'User not found' });
    }

    if (!user.twoFactorTempSecret) {
      console.warn('❌ No temporary 2FA secret found for user');
      return res.status(400).json({ message: 'No temporary 2FA secret found for user' });
    }

    const secret = user.twoFactorTempSecret;

    console.log('Verifying TOTP with:');
    console.log('Secret:', secret);
    console.log('Token (user input):', token);

    // Generate token on server for current time to compare
    const generatedToken = speakeasy.totp({
      secret,
      encoding: 'base32'
    });
    console.log('Generated token (server):', generatedToken);

    // Log current server time
    const serverTime = new Date().toISOString();
    console.log('Server time:', serverTime);

    // Verify token using speakeasy
    const isVerified = speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: 1
    });

    console.log('✅ TOTP verification result:', isVerified);

    if (!isVerified) {
      console.warn('❌ Token is invalid');
      return res.json({ valid: false });
    }

    // Update user to enable 2FA and save secret permanently
    user.twoFactorSecret = secret;
    user.twoFactorTempSecret = null;
    user.twoFactorEnabled = true;

    await user.save();

    console.log(`✅ 2FA enabled for user ${user.email || user._id}`);

    return res.json({ valid: true });
  } catch (err) {
    console.error('❌ Error verifying 2FA token:', err);
    return res.status(500).json({ message: 'Server error during 2FA verification' });
  }
});


app.post('/api/2fa/verify-login-token', async (req, res) => {
  const { userId, token } = req.body;

  console.log('Incoming request: POST /api/2fa/verify-login-token', { userId, token });

  if (!userId || !token) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  try {
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
      return res.status(400).json({ message: '2FA is not enabled for this user' });
    }

    // Verify token against confirmed 2FA secret (not temp secret)
    const isVerified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token,
      window: 1
    });

    if (!isVerified) {
      return res.status(401).json({ message: 'Invalid 2FA token' });
    }

    console.log('2FA token valid, login successful');
    await RecentActivity.create({
      userId: user._id,
      activityType: '2fa_login_success',
      description:'2fa_login_success',
      details: {
        email: user.email,
      },
      timestamp: new Date(),
    });
    return res.status(200).json({
      message: '2FA verification successful',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        address: user.address,
        mobile: user.mobile,
        specialty: user.specialty,
        practiceLocation: user.practiceLocation,
        photo: user.photo,
      }
    });
  } catch (err) {
    console.error('Error verifying 2FA token:', err);
    return res.status(500).json({ message: 'Server error during 2FA verification' });
  }
});

const messageSchema = new mongoose.Schema({
  senderId: { type: String, required: true },
  receiverId: { type: String, required: true },

  // For text messages
  content: {
    type: String,
    required: function () {
      return this.type === 'text'; // only required for text
    },
  },

  // Optional file attachment
  file: {
    url: String,
    name: String,
    size: Number,
  },

  // Call-related fields
  type: {
  type: String,
  enum: ['text','voice' ,'file', 'voice_call', 'video_call'],
  default: 'text',
},

callStatus: {
  type: String,
  enum: ['missed', 'made', 'answered', 'rejected'],  // ✅ added 'rejected'
},

  startTime: Date,   // when call was accepted
  endTime: Date,     // when call ended
  duration: Number,  // duration in seconds // seconds

  timestamp: { type: Date, default: Date.now },

  // For messages only
  status: { type: String, enum: ['sent', 'delivered', 'read'], default: 'sent' },
});


const Message = mongoose.model('Message', messageSchema);
module.exports = Message;
const chatStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'chat_uploads/');  // new folder dedicated for chat uploads
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});
// Delete a message by ID
// DELETE message by ID
app.delete('/api/messages/:id', async (req, res) => {
  const messageId = req.params.id;  // <-- correct, use req.params.id

  try {
    const deletedMessage = await Message.findByIdAndDelete(messageId);

    if (!deletedMessage) {
      return res.status(404).json({ error: 'Message not found' });
    }
    await RecentActivity.create({
  userId: deletedMessage.senderId,
  activityType: 'message_deleted',
  description:'message_deleted',
  details: {
    messageId: deletedMessage._id.toString(),
    senderId: deletedMessage.senderId,
    receiverId: deletedMessage.receiverId,
    content: deletedMessage.content,
    fileName: deletedMessage.file?.name || null,
  },
  timestamp: new Date(),
});

    console.log(`🗑️ Deleted message ${messageId}`);
    res.json({ message: 'Message deleted successfully', deletedMessage });
  } catch (error) {
    console.error('❌ Error deleting message:', error.message);
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

// UPDATE message content and/or edited status by ID
app.put('/api/messages/:id', async (req, res) => {
  const messageId = req.params.id;
  const { content, edited } = req.body;

  if (typeof content === 'undefined' && typeof edited === 'undefined') {
    return res.status(400).json({ error: 'Nothing to update' });
  }

  // Build update object only with defined fields
  const update = {};
  if (typeof content !== 'undefined') update.content = content;
  if (typeof edited !== 'undefined') update.edited = edited;

  try {
    // 1️⃣ Fetch the message first to get senderId
    const existingMessage = await Message.findById(messageId);
    if (!existingMessage) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // 2️⃣ Update the message
    const updatedMessage = await Message.findByIdAndUpdate(
      messageId,
      update,
      { new: true, runValidators: true }
    );

    // 3️⃣ Log activity for senderId
    try {
      await RecentActivity.create({
        userId: existingMessage.senderId, // fetched from DB
        activityType: 'message_edited',
        description:'message_edited',
        details: {
          messageId,
          updatedFields: Object.keys(update),
        },
        timestamp: new Date(),
      });
      console.log('✅ RecentActivity saved for senderId:', existingMessage.senderId);
    } catch (activityErr) {
      console.error('❌ Failed to save RecentActivity:', activityErr);
    }

    console.log(`✏️ Updated message ${messageId}:`, updatedMessage);
    res.json({ message: 'Message updated successfully', updatedMessage });
  } catch (error) {
    console.error('❌ Error updating message:', error.message);
    res.status(500).json({ error: 'Failed to update message' });
  }
});


const chatUpload = multer({ storage: chatStorage });

// Serve chat_uploads folder statically
app.use('/chat_uploads', express.static('chat_uploads'));

// New route for chat uploads using chatUpload middleware
app.post('/chat-upload', chatUpload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const fileUrl = `${req.protocol}://${req.get('host')}/chat_uploads/${req.file.filename}`;

  res.json({
    url: fileUrl,
    name: req.file.originalname,
    size: req.file.size,
  });
});



// =============== SOCKET.IO SETUP ==================
const users = new Map();

io.on('connection', (socket) => {
  const userId = socket.handshake.query.userId;
  console.log('🟢 New socket connection attempt');

  if (userId) {
    // Add user to map
    users.set(userId, socket.id);

    // Join a room named after the userId
    socket.join(userId);
    console.log(`✅ User ${userId} connected and joined room: ${userId}`);
    // 🕑 Chat History Request
    socket.on('getChatHistory', async ({ userId, otherUserId }) => {
      console.log(`📥 getChatHistory requested by ${userId} for chat with ${otherUserId}`);

      try {
        const messages = await Message.find({
          $or: [
            { senderId: userId, receiverId: otherUserId },
            { senderId: otherUserId, receiverId: userId },
          ],
        }).sort({ timestamp: 1 });

        console.log(`📤 Sending chatHistory (${messages.length} messages) to ${userId}`);
        messages.forEach((msg, idx) => {
          if (msg.file) {
            console.log(`   🗂 Message #${idx + 1} has file:`, msg.file);
          }
        });

        socket.emit('chatHistory', messages);
      } catch (error) {
        console.error('❌ Error fetching chat history:', error.message);
        socket.emit('error', 'Failed to fetch chat history');
      }
    });

    // Mark messages as read
    socket.on('markAsRead', async ({ doctorId, userId }) => {
      console.log(`📖 markAsRead from user ${userId} for doctor ${doctorId}`);
      try {
        const result = await Message.updateMany(
          { senderId: doctorId, receiverId: userId, status: { $ne: 'read' } },
          { $set: { status: 'read' } }
        );
        console.log(`✅ Marked ${result.modifiedCount} messages as read`);

        // Notify the doctor that messages were read
        io.to(doctorId).emit('messagesRead', { by: userId });
      } catch (error) {
        console.error('❌ Error marking messages as read:', error.message);
      }
    });

    // 📨 Message Send
   socket.on('sendMessage', async (messageData) => {
  console.log('📩 sendMessage received:', messageData);
  if (messageData.file) {
    console.log('📎 Message contains file:', messageData.file);
  } else {
    console.log('✉️ Message has no file attached');
  }

  try {
    const savedMessage = await Message.create(messageData);
    console.log('✅ Message saved:', savedMessage);
    if (savedMessage.file) {
      console.log('📎 Saved message has file:', savedMessage.file);
    }

    // Emit to receiver
    io.to(messageData.receiverId).emit('receiveMessage', savedMessage);
    console.log(`📤 Sent message to receiver room: ${messageData.receiverId}`);

    // Confirm to sender
    socket.emit('receiveMessage', savedMessage);
    console.log(`📤 Sent confirmation back to sender: ${userId}`);

    // Add recent activity tracking
    await RecentActivity.create({
      userId: messageData.senderId,
      description: 'message_sent',
      details: {
        messageId: savedMessage._id,
        receiverId: messageData.receiverId,
        hasFile: !!messageData.file,
        contentPreview: savedMessage.content ? savedMessage.content.slice(0, 50) : null,
      },
      timestamp: new Date()
    });
    console.log(`📝 Recent activity logged for message sent by user ${messageData.senderId}`);

  } catch (error) {
    console.error('❌ Error saving message:', error.message);
    socket.emit('error', 'Failed to save message');
  }
});


    socket.on('typing', ({ senderId, receiverId }) => {
      console.log(`🟡 Typing event: senderId=${senderId}, receiverId=${receiverId}`);
      io.to(receiverId).emit('typing', { senderId });
    });

    socket.on('stopTyping', ({ senderId, receiverId }) => {
      console.log(`⚪ Stop typing event: senderId=${senderId}, receiverId=${receiverId}`);
      io.to(receiverId).emit('stopTyping', { senderId });
    });

    socket.on('join', (userId) => {
      socket.join(userId);
      console.log(`✅ User joined room: ${userId}`);
    });

    socket.on('disconnect', () => {
      console.log(`🔌 User ${userId} disconnected`);
    });

    // Handle a call initiation
   socket.on('callUser', async ({ targetSocketId, offer, callerName, callerUserId, callType }) => {
  console.log(`📞 callUser from ${socket.id} to ${targetSocketId}, type: ${callType}`);
  console.log('👉 callerName received in backend:', callerName);
  console.log('👉 callerUserId received in backend:', callerUserId);

  // Forward everything to the target
  io.to(targetSocketId).emit('callMade', {
    offer,
    socketId: socket.id,
    callerName,
    callerUserId,  // ✅ include user ID
    callType       // ✅ now receiver knows if it's video or voice
  });



  try {
    const senderId = socket.handshake.query.userId || null;
    if (senderId) {
      await RecentActivity.create({
        userId: senderId,
        description: 'call_initiated',
        details: {
          targetSocketId,
          callerName,
          callType,  // ✅ log call type too
        },
        timestamp: new Date(),
      });
      console.log(`📝 Recent activity logged for call initiated by user ${senderId}`);
    } else {
      console.warn('⚠️ Cannot log recent activity: senderId not found on socket');
    }
  } catch (error) {
    console.error('❌ Error logging recent activity for callUser:', error);
  }
});


    // Handle answer to a call
  // Handle answer to a call
socket.on('makeAnswer', ({ targetSocketId, answer, callType }) => {
  console.log(`✅ makeAnswer from ${socket.id} to ${targetSocketId}, type: ${callType}`);

  // Emit the answer back to the caller (this is enough)
  io.to(targetSocketId).emit('answerMade', {
    answer,
    socketId: socket.id,  // callee's socket id
    callType,             // ✅ include callType so caller knows if it's voice or video
  });

  console.log(`📞 Sent answerMade to ${targetSocketId} with type: ${callType}`);
});



    // Handle ICE candidates
    socket.on('iceCandidate', ({ targetSocketId, candidate }) => {
      console.log(`🔹 iceCandidate from ${socket.id} to ${targetSocketId}`);

      io.to(targetSocketId).emit('iceCandidate', {
        candidate,
        socketId: socket.id,
      });
    });

    // Optional: Handle call rejection
 socket.on('rejectCall', ({ targetSocketId, targetUserId }) => {
  let recipientSocketId = targetSocketId;

  if (!recipientSocketId && targetUserId && users.has(targetUserId)) {
    recipientSocketId = users.get(targetUserId);
  }

  if (recipientSocketId) {
    io.to(recipientSocketId).emit('callRejected', { socketId: socket.id });
    console.log(`❌ Call rejected by ${socket.id}, notifying ${recipientSocketId}`);
  } else {
    console.warn(`⚠️ Cannot reject call: recipientSocketId not found.`);
  }
});


socket.on('hangUp', async ({ targetSocketId, callType }) => {
  try {
    const targetUserId = io.sockets.sockets.get(targetSocketId)?.userId;

    const callMessage = await Message.findOne({
      $or: [
        { senderId: socket.userId, receiverId: targetUserId, type: { $in: ['voice_call', 'video_call'] }, callStatus: 'answered' },
        { senderId: targetUserId, receiverId: socket.userId, type: { $in: ['voice_call', 'video_call'] }, callStatus: 'answered' }
      ]
    }).sort({ startTime: -1 });

    if (callMessage) {
      const endTime = Date.now();
      // ✅ Keep as 'answered', not 'ended'
      callMessage.callStatus = 'answered';
      callMessage.endTime = endTime;
      callMessage.duration = Math.floor((endTime - callMessage.startTime.getTime()) / 1000);
      await callMessage.save();
      console.log('✅ Call record updated successfully:', callMessage);

      // 🔹 Emit updated call message to both users
      io.to(targetSocketId).emit('receiveMessage', callMessage);
      socket.emit('receiveMessage', callMessage);
    } else {
      console.log('❌ Call record not found');
    }

    // Emit callEnded for UI cleanup (timers, ringtone)
    io.to(targetSocketId).emit('callEnded', { socketId: socket.id, callType });
    socket.emit('callEnded', { socketId: targetSocketId, callType });

  } catch (err) {
    console.error('❌ Error handling hangUp:', err);
  }
});




    // Example cancelCall
    socket.on('cancelCall', ({ targetSocketId, callType }) => {
      console.log(`🚫 Call canceled by ${socket.id}, notifying ${targetSocketId}`);
      io.to(targetSocketId).emit('callCanceled', { targetSocketId: socket.id, callType });
    });

    socket.on('disconnect', () => {
      console.log(`🔌 User ${userId} disconnected`);
    });

  } else {
    console.log('⚠️ Socket connected without userId');
  }
});



app.post('/api/generalist-decision', async (req, res) => {
  const { id, decision } = req.body;

  if (!id || !decision) {
    return res.status(400).json({ message: 'Missing id or decision' });
  }

  try {
    const result = await ECG.findByIdAndUpdate(
      id,
      { generalistDecision: decision },
      { new: true }
    );

    if (!result) {
      return res.status(404).json({ message: 'ECG not found' });
    }

    // Log recent activity
    await RecentActivity.create({
      userId: result.senderId || null, // or whichever user is responsible here
      activityType: 'generalist_decision_updated_Ecg',
      description: 'generalist_decision_updated_Ecg',
      details: {
        ecgId: result._id,
        decision: decision
      },
      timestamp: new Date()
    });

    res.status(200).json({ message: 'Decision updated successfully', data: result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/generalist-decision_1', async (req, res) => {
  const { id, decision } = req.body;

  if (!id || !decision) {
    return res.status(400).json({ message: 'Missing id or decision' });
  }

  try {
    // Fetch senderId separately before update for logging
    const broadcastCaseForUser = await BroadcastCase.findById(id).select('senderId');
    if (!broadcastCaseForUser) {
      return res.status(404).json({ message: 'Case not found' });
    }

    // Update generalistDecision and get updated document
    const result = await BroadcastCase.findByIdAndUpdate(
      id,
      { generalistDecision: decision },
      { new: true }
    );

    // Log recent activity with senderId from pre-fetch
    await RecentActivity.create({
      userId: broadcastCaseForUser.senderId || null,
      activityType: 'generalist_decision_updated_broadcast_Case',
      description: 'generalist_decision_updated_broadcast_Case',
      details: {
        broadcastCaseId: id,
        decision: decision
      },
      timestamp: new Date()
    });

    res.status(200).json({ message: 'Decision updated successfully', data: result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/generalist-decision_2', async (req, res) => {
  const { id, decision } = req.body;

  console.log('[POST] /api/generalist-decision_2 - Request received:', { id, decision });

  if (!id || !decision) {
    console.log('Missing id or decision in request body');
    return res.status(400).json({ message: 'Missing id or decision' });
  }

  try {
    // Fetch senderId first
    console.log(`Fetching senderId for BroadcastECG id: ${id}`);
    const ecgForUser = await BroadcastECG.findById(id).select('senderId');
    if (!ecgForUser) {
      console.log(`BroadcastECG with id ${id} not found`);
      return res.status(404).json({ message: 'ECG not found' });
    }
    console.log('Found senderId:', ecgForUser.senderId);

    // Update decision
    console.log(`Updating generalistDecision for BroadcastECG id: ${id}`);
    const result = await BroadcastECG.findByIdAndUpdate(
      id,
      { generalistDecision: decision },
      { new: true }
    );
    console.log('Update result:', result);

    // Log recent activity with fetched senderId
    console.log('Logging recent activity');
    const activity = await RecentActivity.create({
  userId: ecgForUser.senderId || null,
  activityType: 'generalist_decision_updated_broadcast_ecg',
  description: 'generalist_decision_updated_broadcast_ecg',
  details: {
    broadcastECGId: id,
    decision: decision
  },
  timestamp: new Date()
});

console.log('✅ RecentActivity saved for generalist decision update:', activity);

    console.log('Created RecentActivity:', activity);
    console.log('✅ RecentActivity saved for generalist decision update');
    console.log('Recent activity logged successfully');

    res.status(200).json({ message: 'Decision updated successfully', data: result });
  } catch (err) {
    console.error('Error in /api/generalist-decision_2:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/generalist-decision_3', async (req, res) => {
  const { id, decision } = req.body;

  if (!id || !decision) {
    return res.status(400).json({ message: 'Missing id or decision' });
  }

  try {
    // Fetch senderId first
    const caseForUser = await Case.findById(id).select('senderId');
    if (!caseForUser) {
      return res.status(404).json({ message: 'Case not found' });
    }

    // Update decision
    const result = await Case.findByIdAndUpdate(
      id,
      { generalistDecision: decision },
      { new: true }
    );

    // Log recent activity with fetched senderId
    await RecentActivity.create({
      userId: caseForUser.senderId || null,
      activityType: 'generalist_decision_updated_case',
      description: 'generalist_decision_updated_case',
      details: {
        caseId: id,
        decision: decision,
      },
      timestamp: new Date(),
    });

    res.status(200).json({ message: 'Decision updated successfully', data: result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});


const faqSchema = new mongoose.Schema({
  question: { type: String, required: true },
  answer: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
  status: {
    type: String,
    enum: ['pending', 'answered', 'archived'],
    default: 'pending',
  },
});



const Faq = mongoose.model('Faq',faqSchema);
module.exports = Faq;
app.post('/api/faqs', async (req, res) => {
  const { question } = req.body;

  console.log('Received new FAQ submission:', question); // Log incoming data

  if (!question || question.trim() === '') {
    console.log('Validation failed: Question is missing or empty.');
    return res.status(400).json({ message: 'Question is required' });
  }

  try {
    const newFaq = new Faq({ question });
    const savedFaq = await newFaq.save();

    console.log('FAQ saved successfully:', savedFaq); // Log saved FAQ

    res.status(201).json({ message: 'FAQ submitted successfully', data: savedFaq });
  } catch (err) {
    console.error('Error saving FAQ:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/faqs', async (req, res) => {
  try {
    // Find FAQs where 'answer' exists and is not empty
    const faqs = await Faq.find({ answer: { $exists: true, $ne: "" } }).sort({ _id: -1 });
    res.status(200).json(faqs);
  } catch (err) {
    console.error('Error fetching FAQs:', err);
    res.status(500).json({ message: 'Server error' });
  }
});
app.get('/api/faqs_5', async (req, res) => {
  try {
    // Find FAQs where 'answer' exists and is not empty
    const faqs = await Faq.find();
    res.status(200).json(faqs);
  } catch (err) {
    console.error('Error fetching FAQs:', err);
    res.status(500).json({ message: 'Server error' });
  }
});
app.get('/api/ecgs_naw', async (req, res) => {
  const { senderId, receiverId } = req.query;
  console.log('Received query params:', senderId, receiverId);

  // Check if both senderId and receiverId are provided
  if (!senderId || !receiverId) {
    return res.status(400).json({ message: 'Sender ID and Receiver ID are required.' });
  }

  try {
    // Use Mongoose to find the ECGs matching senderId and receiverId
    const ecgs = await ECG.find({ senderId, receiverId });

    console.log('ECG query result:', ecgs);
    res.json(ecgs);  // Return the ECGs as a JSON response
  } catch (err) {
    console.error('Error fetching ECGs:', err);
    res.status(500).send('Error fetching ECGs');
  }
});
app.use('/ecg-files', express.static(path.join(__dirname, 'ECGS')));

app.get("/api/generalist-doctors", async (req, res) => {
  console.log("Received request to fetch generalist doctors.");

  try {
    const generalistDoctors = await User.find({ specialty: /generaliste/i });

    if (generalistDoctors.length === 0) {
      console.log("No generalist doctors found.");
      return res.status(404).json({ message: "No generalist doctors found." });
    }

    console.log(`Found ${generalistDoctors.length} generalist doctors.`);
    res.status(200).json(generalistDoctors);
  } catch (err) {
    console.error("Error fetching generalist doctors:", err);
    res.status(500).json({ message: "Error fetching generalist doctors." });
  }
});


app.post('/api/ecgs/respond', async (req, res) => {
  const { ecgId, answer } = req.body;

  if (!ecgId || !answer) {
    return res.status(400).json({ message: 'ECG ID and answer are required.' });
  }

  try {
    // Update the ECG with the response
    const ecg = await ECG.findByIdAndUpdate(
      ecgId,
      { answer, answered: 'yes', responseDate: new Date() },
      { new: true }
    );

    if (!ecg) {
      return res.status(404).json({ message: 'ECG not found.' });
    }

    // Log recent activity
    await RecentActivity.create({
      userId: ecg.senderId || null, // assuming senderId is on ECG doc
      activityType: 'ecg_responded',
      description:'ecg_responded',
      details: {
        ecgId: ecg._id,
        answer,
      },
      timestamp: new Date(),
    });

    res.status(200).json({ message: 'Response submitted successfully.', ecg });
  } catch (error) {
    console.error('Error submitting response:', error);
    res.status(500).json({ message: 'Error submitting response.' });
  }
});

app.get('/api/cases_naw', async (req, res) => {
  const { senderId, receiverId } = req.query;
  console.log('Received query params for cases:', senderId, receiverId);

  if (!senderId || !receiverId) {
    return res.status(400).json({ message: 'Sender ID and Receiver ID are required.' });
  }

  try {
    // Find cases where senderId and receiverId match query
    const cases = await Case.find({ senderId, receiverId });
    console.log('Cases query result:', cases);

    res.json(cases);
  } catch (err) {
    console.error('Error fetching cases:', err);
    res.status(500).send('Error fetching cases');
  }
});
app.use('/ecg-files_1', express.static(path.join(__dirname, 'ECGWITHCASE')));
const uploadDir_5 = path.join(__dirname, 'respond_file');

// Create folder if it doesn't exist (optional but recommended)
if (!fs.existsSync(uploadDir_5)) {
  fs.mkdirSync(uploadDir_5, { recursive: true });
}

const responseStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir_5);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const randomNum = Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `respond_file-${timestamp}-${randomNum}${ext}`);
  }
});


const responseUploader = multer({ storage: responseStorage });
app.post('/submit-response', responseUploader.single('responseFile'), async (req, res) => {
  try {
    const { caseId, diagnosis } = req.body;

    if (!caseId || !diagnosis) {
      return res.status(400).json({ message: 'Case ID and diagnosis are required.' });
    }

    // Prepare the update object
    const updateData = {
      answer: diagnosis,
      answered: 'yes',
      responseDate: new Date()
    };

    // If a file was uploaded, add its filename to the update object
    if (req.file) {
      updateData.responseFileName = req.file.filename;
    }

    // Update the case document
    const updatedCase = await Case.findByIdAndUpdate(caseId, updateData, { new: true });

    if (!updatedCase) {
      return res.status(404).json({ message: 'Case not found.' });
    }

    // Log recent activity
    await RecentActivity.create({
      userId: updatedCase.senderId || null, // adjust if you track who submits response
      activityType: 'case_responded',
      description: 'case_responded',
      details: {
        caseId: updatedCase._id,
        diagnosis,
        responseFileName: updateData.responseFileName || null,
      },
      timestamp: new Date(),
    });

    res.status(200).json({ message: 'Response submitted successfully.', updatedCase });
  } catch (error) {
    console.error('Error submitting response:', error);
    res.status(500).json({ message: 'Error submitting response.' });
  }
});

app.use('/respond_file', express.static(path.join(__dirname, 'respond_file')));
app.get('/api/broadcast-ecgs', async (req, res) => {
  try {
    // Fetch all ECG documents from MongoDB
    // You can also add `.populate('senderId votes.cardiologistId')` if you want full user info
    const ecgs = await BroadcastECG.find();

    res.status(200).json(ecgs);
  } catch (error) {
    console.error('Error fetching ECGs:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

app.post('/api/broadcast-ecgs/vote', async (req, res) => {
  const { ecgId, cardiologistId, choice } = req.body;

  if (!ecgId || !cardiologistId || !choice) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }

  try {
    const ecg = await BroadcastECG.findById(ecgId);
    if (!ecg) return res.status(404).json({ error: 'ECG not found.' });

    const now = new Date();

    // 1. Check deadline
    if (now > ecg.deadline) {
      // If expired and not extended, auto-extend
      if (!ecg.extended) {
        ecg.deadline = new Date(ecg.deadline.getTime() + 1 * 24 * 60 * 60 * 1000);
        ecg.extended = true;
        await ecg.save();
        return res.status(200).json({ message: 'Voting deadline extended by 1 days.' });
      } else {
        // If already extended, voting is closed
        ecg.status = 'expired';
        await ecg.save();
        return res.status(403).json({ error: 'Voting period has expired.' });
      }
    }

    // 2. Validate choice
    if (!ecg.choices.includes(choice)) {
      return res.status(400).json({ error: 'Invalid choice.' });
    }

    // 3. Prevent duplicate votes
    const alreadyVoted = ecg.votes.find(v => v.cardiologistId.toString() === cardiologistId);
    if (alreadyVoted) {
      return res.status(400).json({ error: 'User has already voted.' });
    }

    // 4. Save vote
    ecg.votes.push({ cardiologistId, choice });
    await ecg.save();
     await RecentActivity.create({
      userId: cardiologistId,
      action: 'cast vote',
      description:'cast vote',
      targetId: ecgId,
      details: { choice }
    });
    return res.status(200).json({ message: 'Vote recorded successfully.' });

  } catch (error) {
    console.error('Error processing vote:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});
async function checkAndExpireECGs() {
  try {
    const now = new Date();

    // 1. Extend deadline for ECGs past deadline, not extended, unanswered
    const toExtend = await BroadcastECG.find({
      deadline: { $lt: now },
      extended: false,
      answered: "no"
    });

    for (const ecg of toExtend) {
      ecg.deadline = new Date(ecg.deadline.getTime() + 1 * 24 * 60 * 60 * 1000);
      ecg.extended = true;
      await ecg.save();
      console.log(`Extended ECG ${ecg._id} deadline by 1 days.`);
    }

    // 2. For ECGs past extended deadline, decide on answer or expire
    const toExpireOrAnswer = await BroadcastECG.find({
      deadline: { $lt: now },
      extended: true,
      answered: "no"
    });

    for (const ecg of toExpireOrAnswer) {
      if (ecg.votes.length > 0) {
        // Count votes per choice
        const voteCounts = ecg.votes.reduce((counts, vote) => {
          counts[vote.choice] = (counts[vote.choice] || 0) + 1;
          return counts;
        }, {});

        // Find max votes
        const maxVotes = Math.max(...Object.values(voteCounts));

        // Get all choices with max votes (handle ties)
        const winningChoices = Object.entries(voteCounts)
          .filter(([_, count]) => count === maxVotes)
          .map(([choice]) => choice);

        // Update ECG with the results
        ecg.answered = "yes";
        ecg.extended = false; // reset extended flag
        ecg.answer = winningChoices; // save as array
        await ecg.save();

        console.log(`Answered ECG ${ecg._id} with choices [${winningChoices.join(', ')}] after extended deadline.`);
      } else {
        // No votes at all, mark as expired
        ecg.answered = "expired";
        ecg.extended = false;
        ecg.answer = [];
        await ecg.save();

        // Notify the generalist that their ECG expired without votes
        await notifyGeneralistOnExpiry(ecg);

        console.log(`Expired ECG ${ecg._id} after extended deadline (no votes).`);
      }
    }

    console.log('ECG deadline check complete.');
  } catch (err) {
    console.error('Error in checking ECG deadlines:', err);
  }
}


cron.schedule('0 0 * * *', async () => {
  console.log('Running daily ECG deadline check...');
  try {
    await checkAndExpireECGs();
  } catch (error) {
    console.error('Error in scheduled ECG deadline check:', error);
  }
});
app.get('/test-check-ecgs', async (req, res) => {
  try {
    await checkAndExpireECGs();
    res.send('ECG check ran successfully! Check your server logs for details.');
  } catch (error) {
    console.error(error);
    res.status(500).send('Error running ECG check');
  }
});
const notificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  read: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  type: { type: String, enum: ['ecg', 'case'], required: true }, // 👈 important
  refId: { type: mongoose.Schema.Types.ObjectId, required: true } ,
 
});


const Notification = mongoose.model('Notification', notificationSchema);
module.exports = Notification;
async function notifyGeneralistOnCaseExpiry(caseItem) {
  try {
    await Notification.create({
      userId: caseItem.senderId,
      title: 'Case Voting Expired',
      message: `Your case with ID ${caseItem._id} expired without enough votes. Please consider resubmitting.`,
      read: false,
      type: 'case',        // lowercase preferred for consistency
      refId: caseItem._id  // 👈 Add this
    });
  } catch (error) {
    console.error('Failed to notify generalist (case):', error);
  }
}



async function notifyGeneralistOnExpiry(ecg) {
  try {
    await Notification.create({
      userId: ecg.senderId,
      title: 'ECG Voting Expired',
      message: `Your ECG with ID ${ecg._id} expired without enough votes. Please consider resubmitting.`,
      read: false,
      type: 'ecg',        // lowercase preferred
      refId: ecg._id      // 👈 Add this
    });
  } catch (error) {
    console.error('Failed to notify generalist:', error);
  }
}


app.get('/api/notifications', async (req, res) => {
  const userId = req.query.userId;

  if (!userId) {
    return res.status(400).json({ error: 'Missing userId in query' });
  }

  let objectId;
  try {
    objectId = new mongoose.Types.ObjectId(userId);
  } catch (e) {
    return res.status(400).json({ error: 'Invalid userId format' });
  }

  try {
    const notifications = await Notification.find({ userId: objectId, read: false }).sort({ createdAt: -1 });
    res.json(notifications);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// ✅ Mark notification as read
app.post('/api/notifications/:id/read', async (req, res) => {
  const notificationId = req.params.id;

  try {
    await Notification.findByIdAndUpdate(notificationId, { read: true });
    res.json({ message: 'Notification marked as read' });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ error: 'Failed to update notification' });
  }
});

// ✅ Resubmit ECG
app.post('/api/ecgs/:ecgId/resubmit', async (req, res) => {
  const ecgId = req.params.ecgId;

  try {
    const ecg = await BroadcastECG.findById(ecgId);
    console.log('[POST] Resubmit ECG:', ecgId);

    if (!ecg) return res.status(404).send('ECG not found');

    ecg.answered = "no";
    ecg.extended = false;
    ecg.resubmitted = true; 
    ecg.deadline = new Date(Date.now() + 1 * 24 * 60 * 60 * 1000);
    await ecg.save();

    const userId = ecg.senderId;  // assign here

    await RecentActivity.create({
      userId: userId,  // explicitly assigned
      action: 'resubmitted ECG',
      description: 'resubmitted ECG',
      targetId: ecgId,
      details: { newDeadline: ecg.deadline },
      timestamp: new Date()
    });

    res.json({ message: 'ECG resubmitted successfully', ecg });
  } catch (error) {
    console.error('Error resubmitting ECG:', error);
    res.status(500).send('Error resubmitting ECG');
  }
});


// ✅ Resubmit Case (NEW)
app.post('/api/cases/:caseId/resubmit', async (req, res) => {
  const caseId = req.params.caseId;

  try {
    const caseItem = await BroadcastCase.findById(caseId);
    console.log('[POST] Resubmit Case:', caseId);

    if (!caseItem) return res.status(404).send('Case not found');

    caseItem.answered = "no";
     ecg.resubmitted = true; 
    caseItem.extended = false;
    caseItem.deadline = new Date(Date.now() + 1 * 24 * 60 * 60 * 1000); // 1 day from now
    await caseItem.save();

    const userId = caseItem.senderId; // assign userId here

    await RecentActivity.create({
      userId: userId,  // explicitly assign userId
      action: 'resubmitted Case',
      description: 'resubmitted Case',
      targetId: caseId,
      details: { newDeadline: caseItem.deadline },
      timestamp: new Date()
    });

    res.json({ message: 'Case resubmitted successfully', case: caseItem });
  } catch (error) {
    console.error('Error resubmitting Case:', error);
    res.status(500).send('Error resubmitting Case');
  }
});


async function checkAndExpireCases() {
  try {
    const now = new Date();

    // 1. Extend deadline for cases past deadline, not extended, unanswered
    const toExtend = await BroadcastCase.find({
      deadline: { $lt: now },
      extended: false,
      answered: "no"
    });

    for (const c of toExtend) {
      c.deadline = new Date(c.deadline.getTime() + 1 * 24 * 60 * 60 * 1000); // add 3 days
      c.extended = true;
      await c.save();
      console.log(`Extended Case ${c._id} deadline by 1 day.`);
    }

    // 2. For cases past extended deadline, decide on answer or expire
    const toExpireOrAnswer = await BroadcastCase.find({
      deadline: { $lt: now },
      extended: true,
      answered: "no"
    });

    for (const c of toExpireOrAnswer) {
      if (c.votes.length > 0) {
        const voteCounts = c.votes.reduce((counts, vote) => {
          counts[vote.choice] = (counts[vote.choice] || 0) + 1;
          return counts;
        }, {});

        const maxVotes = Math.max(...Object.values(voteCounts));
        const winningChoices = Object.entries(voteCounts)
          .filter(([_, count]) => count === maxVotes)
          .map(([choice]) => choice);

        c.answered = "yes";
        c.extended = false;
        c.answer = winningChoices;
        await c.save();

        console.log(`Answered Case ${c._id} with choices [${winningChoices.join(', ')}] after extended deadline.`);
      } else {
        c.answered = "expired";
        c.extended = false;
        c.answer = [];
        await c.save();

        // Optional: notify case creator about expiration
        await notifyGeneralistOnCaseExpiry?.(c);

        console.log(`Expired Case ${c._id} after extended deadline (no votes).`);
      }
    }

    console.log('Case deadline check complete.');
  } catch (err) {
    console.error('Error in checking case deadlines:', err);
  }
}
cron.schedule('5 0 * * *', async () => {
  console.log('Running daily Case deadline check...');
  try {
    await checkAndExpireCases();
  } catch (error) {
    console.error('Error in scheduled Case deadline check:', error);
  }
});
app.get('', async (req, res) => {
  try {
    await checkAndExpireCases();
    res.send('Case check ran successfully! Check your server logs for details.');
  } catch (error) {
    console.error(error);
    res.status(500).send('Error running Case check');
  }
});

app.get('/api/broadcast-cases_naw', async (req, res) => {
  try {
    const cases = await BroadcastCase.find().sort({ uploadDate: -1 });
    res.json(cases);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch cases', error });
  }
});

app.post('/api/broadcast-cases/:id/vote', async (req, res) => {
  const caseId = req.params.id;
  const { specialistId, choice } = req.body;

  console.log('Received vote submission:', { caseId, specialistId, choice });
  console.log('Request body:', req.body);

  if (!specialistId) {
    console.log('Error: specialistId is missing or null!');
    return res.status(400).json({ message: 'specialistId is required' });
  }

  try {
    const broadcastCase = await BroadcastCase.findById(caseId);
    if (!broadcastCase) {
      console.log(`Case not found for ID: ${caseId}`);
      return res.status(404).json({ message: 'Case not found' });
    }

    console.log('Found case:', broadcastCase);
    console.log('Current votes:', broadcastCase.votes);

    const existingVote = broadcastCase.votes.find(v => v.specialistId.toString() === specialistId);
    if (existingVote) {
      console.log(`Specialist ${specialistId} has already voted on case ${caseId}`);
      return res.status(400).json({ message: 'You have already voted on this case' });
    }

    console.log(`Adding vote { specialistId: ${specialistId}, choice: ${choice} } to case ${caseId}`);

    broadcastCase.votes.push({ specialistId: new mongoose.Types.ObjectId(specialistId), choice });
    await broadcastCase.save();
      await RecentActivity.create({
      userId: specialistId,
      action: 'voted on broadcast case',
      description:'voted on broadcast case',
      targetId: caseId,
      details: { choice }
    });
    console.log('Vote saved successfully, returning updated case');
    res.json(broadcastCase);
  } catch (error) {
    console.error('Error while submitting vote:', error);
    res.status(500).json({ message: 'Failed to submit vote', error: error.message || error });
  }
});

app.put('/api/broadcast-cases/:id', async (req, res) => {
  const caseId = req.params.id;
  const { choice, ...updates } = req.body; // choice is for RecentActivity log

  try {
    // First, find the case to ensure it exists and get specialistId
    const existingCase = await BroadcastCase.findById(caseId);
    if (!existingCase) {
      return res.status(404).json({ message: 'Case not found' });
    }

    const specialistId = existingCase.senderId;

    // Update the broadcast case
    const broadcastCase = await BroadcastCase.findByIdAndUpdate(caseId, updates, { new: true });

    // Create a recent activity log
    await RecentActivity.create({
      userId: specialistId,
      action: 'voted on broadcast case',
      description: 'voted on broadcast case',
      targetId: caseId,
      details: { choice }
    });

    // Return updated case
    res.json(broadcastCase);

  } catch (error) {
    console.error('Error updating broadcast case:', error);
    res.status(500).json({ message: 'Failed to update case', error });
  }
});

const faq_1Schema = new mongoose.Schema({
  question: { type: String, required: true },
  answer: { type: String, default: '' },
  status: {
    type: String,
    enum: ['pending', 'answered', 'archived'],
    default: 'pending',
  },
  createdAt: { type: Date, default: Date.now }
});


const Faq_1 = mongoose.model('Faq_1',faq_1Schema);
module.exports = Faq_1;
app.post('/api/faqs_2', async (req, res) => {
  const { question } = req.body;

  console.log('Received new FAQ submission:', question); // Log incoming data

  if (!question || question.trim() === '') {
    console.log('Validation failed: Question is missing or empty.');
    return res.status(400).json({ message: 'Question is required' });
  }

  try {
    const newFaq = new Faq_1({ question });
    const savedFaq = await newFaq.save();

    console.log('FAQ saved successfully:', savedFaq); // Log saved FAQ

    res.status(201).json({ message: 'FAQ submitted successfully', data: savedFaq });
  } catch (err) {
    console.error('Error saving FAQ:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/faqs_2', async (req, res) => {
  try {
    // Find FAQs where 'answer' exists and is not empty
    const faqs = await Faq_1.find({ answer: { $exists: true, $ne: "" } }).sort({ _id: -1 });
    res.status(200).json(faqs);
  } catch (err) {
    console.error('Error fetching FAQs:', err);
    res.status(500).json({ message: 'Server error' });
  }
});
app.get('/api/faqs_3', async (req, res) => {
  try {
    // Find FAQs where 'answer' exists and is not empty
    const faqs = await Faq_1.find();
    res.status(200).json(faqs);
  } catch (err) {
    console.error('Error fetching FAQs:', err);
    res.status(500).json({ message: 'Server error' });
  }
});
app.put('/api/faqs/:id', async (req, res) => {
  const faqId = req.params.id;
  const updateData = {
    answer: req.body.answer,
    status: req.body.status,
  };

  try {
    // Try to find and update in the first collection
    let updatedFaq = await Faq.findByIdAndUpdate(faqId, updateData, { new: true });

    if (!updatedFaq) {
      // If not found, try the second collection
      updatedFaq = await Faq_1.findByIdAndUpdate(faqId, updateData, { new: true });
    }

    if (!updatedFaq) {
      return res.status(404).json({ message: 'FAQ not found in either collection' });
    }

    res.status(200).json(updatedFaq);
  } catch (error) {
    console.error('Error updating FAQ:', error);
    res.status(500).json({ message: 'Server error' });
  }
});
app.delete('/api/faqs/:id', async (req, res) => {
  const faqId = req.params.id;

  try {
    // Try deleting from the first FAQ collection (generalist)
    let deleted = await Faq.findByIdAndDelete(faqId);

    if (!deleted) {
      // If not found, try deleting from the second FAQ collection (cardiologist)
      deleted = await Faq_1.findByIdAndDelete(faqId);
    }

    if (deleted) {
      res.status(200).json({ message: 'FAQ deleted successfully' });
    } else {
      res.status(404).json({ message: 'FAQ not found' });
    }
  } catch (err) {
    console.error('Error deleting FAQ:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

const chatbotMessageSchema = new mongoose.Schema({
  senderId: { type: String, required: true },
  receiverId: { type: String, required: true },
  content: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  status: { type: String, enum: ['sent', 'delivered', 'read'], default: 'sent' }
});

const ChatbotMessage = mongoose.model('ChatbotMessage', chatbotMessageSchema);

const MAX_CONTENT_LENGTH = 15 * 1024 * 1024; // 15 Mo max MongoDB

app.post('/api/saveChat_nawress', async (req, res) => {
  console.log('📥 Requête reçue /api/saveChat_nawress avec body:');

  const { senderId, receiverId, content, timestamp, status } = req.body;

  // Vérification des champs requis
  if (!senderId || !receiverId || !content) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Calcul de la taille du contenu
  const contentLength = Buffer.byteLength(content, 'utf8');
  console.log(`📏 Taille du content : ${contentLength} octets`);

  // Vérifie si trop volumineux pour MongoDB
  if (contentLength > MAX_CONTENT_LENGTH) {
    console.warn('⚠️ Message trop volumineux, non enregistré');
    return res.status(413).json({ error: 'Message too large to store in MongoDB' });
  }

  try {
    const message = new ChatbotMessage({
      senderId,
      receiverId,
      content,
      timestamp: timestamp ? new Date(timestamp) : new Date(),
      status: status || 'sent',
    });

    await message.save();
    await RecentActivity.create({
  userId: senderId,
  action: 'Send message to chatbot',
  description:'Send message to chatbot',
  targetId: message._id,
  details: {
    receiverId,
    contentLength,
    timestamp: message.timestamp,
  }
});

    console.log('✅ Message sauvegardé avec succès');
    res.status(201).json({ message: 'Chatbot message saved' });
  } catch (error) {
    console.error('❌ Error saving chatbot message:', error.message);
    if (error.stack) console.error(error.stack);
    res.status(500).json({ error: 'Failed to save chatbot message' });
  }
});
app.get('/api/getChat_nawress/:userId', async (req, res) => {
  const { userId } = req.params;

  try {
    // Fetch all messages where user is sender or receiver
    const messages = await ChatbotMessage.find({
      $or: [
        { senderId: userId },
        { receiverId: userId }
      ]
    }).sort({ timestamp: 1 }); // Sort messages by timestamp

    // Create a greeting message with options
    let greetingMessage = {
      senderId: 'medical_bot', // bot is the sender
      receiverId: userId,
      content: `👋 Hello! I hope you're doing great today!<br><br>How can I assist you?<br>`,
      status: 'sent',
      timestamp: new Date().toISOString(), // Current timestamp for greeting
      options: [
        { label: 'Ask a Question', value: 'question' },
       
        { label: 'Exit', value: 'exit' }
      ]
    };

    // Append greeting to messages or send only greeting if no messages
    if (messages.length > 0) {
      messages.push(greetingMessage); // Append greeting at the end
    } else {
      messages.push(greetingMessage);
    }

    // Send the response
    res.json(messages);
  } catch (err) {
    console.error('Error fetching chat history:', err);
    res.status(500).json({ error: 'Failed to fetch chat history' });
  }
});
// Pseudo-code (Node.js)
async function runReminderCheck() {
  const now = new Date();
  const events = await Event.find({ cancelled: "no" });

  events.forEach(event => {
    if (!event.date || !event.userId) return; // ✅ Guard clause

    const diffMs = event.date.getTime() - now.getTime();
    const diffMin = diffMs / 60000; // Convert to minutes

    if (diffMin > 59.5 && diffMin < 60.5) {
      io.to(event.userId).emit("reminder_1h", {
        userId: event.userId,
        date: event.date,
        roomId: event.roomId
      });
      console.log(`📢 Sent 1h reminder to ${event.userId} for event at ${event.date}`);
    } else if (diffMin > 9.5 && diffMin < 10.5) {
      io.to(event.userId).emit("reminder_10m", {
        userId: event.userId,
        date: event.date,
        roomId: event.roomId
      });
      console.log(`⏰ Sent 10m reminder to ${event.userId} for event at ${event.date}`);
    } else if (diffMin < -1 && diffMin > -10) {
      console.log(`✅ Event ended recently for ${event.userId}, time: ${event.date}`);
    }
  });
}

// ✅ Call it
runReminderCheck();
app.get('/test-reminder', async (req, res) => {
  try {
    console.log('📥 /test-reminder route hit');
    await runReminderCheck(); // ✅ make sure this function exists
    res.send('✅ Reminder check triggered');
  } catch (err) {
    console.error('❌ Error in /test-reminder:', err);
    res.status(500).send('Internal server error');
  }
});



async function checkAndExpireIndividualECGs() {
  const now = new Date();

  try {
    const expiredECGs = await ECG.find({
      deadline: { $lt: now },
      answered: "no"
    });

    for (const ecg of expiredECGs) {
      ecg.answered = "expired";
      await ecg.save();
       const doctor = await User.findById(ecg.receiverId);
      const doctorName = doctor?.name || 'the doctor';
      // 🔔 Notify the generalist
      await Notification.create({
        userId: ecg.senderId,
        title: 'ECG to Individual Expired',
        message: `Your ecg sent to Dr. ${doctorName} has expired after 24 hours without response.`,
        read: false,
        type: 'ecg',
        refId: ecg._id
      });

      console.log(`📭 Expired ECG ${ecg._id} and notified sender ${ecg.senderId}`);
    }

    console.log('✅ Individual ECG check complete.');
  } catch (err) {
    console.error('❌ Error in checkAndExpireIndividualECGs:', err);
  }
}

cron.schedule('0 * * * *', async () => { // every hour
  console.log('⏰ Running individual ECG expiration check...');
  await checkAndExpireIndividualECGs();
});
app.get('/test-expire-individual-ecgs', async (req, res) => {
  try {
    await checkAndExpireIndividualECGs();
    res.send('✅ ECG individual expiration check completed.');
  } catch (err) {
    console.error(err);
    res.status(500).send('❌ Error during ECG expiration check');
  }
});
app.use((req, res, next) => {
  console.log(`Incoming request: ${req.method} ${req.url}`);
  next();
});
// For ECGs sent to a single doctor
app.post('/api/individual-ecgs/:refId/resubmit', async (req, res) => {
  const ecgId = req.params.refId;

  try {
    const ecg = await ECG.findById(ecgId); // Use the individual ECG model
    if (!ecg) return res.status(404).send('ECG not found');

    if (ecg.answered !== 'expired') {
      return res.status(400).send('ECG is not expired, cannot resubmit');
    }
    ecg.resubmitted="true",
    ecg.answered = "no";
    ecg.responseDate = new Date();
    ecg.deadline = new Date(Date.now() + 24 * 60 * 60 * 1000); // Add 24 hours
    await ecg.save();

    const userid = ecg.senderId;  // assign senderId to userid

    await RecentActivity.create({
      userId: userid,
      action: 'resubmitted individual ECG',
      description: 'resubmitted individual ECG',
      targetId: ecgId,
      details: { newDeadline: ecg.deadline },
      timestamp: new Date()
    });

    res.json({ message: 'Individual ECG resubmitted successfully', ecg });
  } catch (error) {
    console.error('❌ Error resubmitting individual ECG:', error);
    res.status(500).send('Error resubmitting ECG');
  }
});

async function checkAndExpireIndividualCases() {
  const now = new Date();

  try {
    const expiredCases = await Case.find({
      deadline: { $lt: now },
      answered: 'no'
    });

    for (const medicalCase of expiredCases) {
      medicalCase.answered = 'expired';
      await medicalCase.save();
     


      // 🧑‍⚕️ Fetch the doctor's name using receiverId
      const doctor = await User.findById(medicalCase.receiverId);
      const doctorName = doctor?.name || 'the doctor';

      // 🔔 Notify the generalist with doctor's name
      await Notification.create({
        userId: medicalCase.senderId,
        title: 'Case to Individual Expired',
        message: `Your case sent to Dr. ${doctorName} has expired after 24 hours without response.`,
        read: false,
        type: 'case',
        scope: 'individual',
        refId: medicalCase._id
      });

      console.log(`📭 Expired individual case ${medicalCase._id} and notified sender ${medicalCase.senderId}`);
    }

    console.log('✅ Individual case expiration check complete.');
  } catch (err) {
    console.error('❌ Error in checkAndExpireIndividualCases:', err);
  }
}
cron.schedule('0 * * * *', async () => {
  console.log('⏰ Running individual case expiration check...');
  await checkAndExpireIndividualCases();
});
app.get('/test-check-individual-cases', async (req, res) => {
  try {
    await checkAndExpireIndividualCases();
    res.send('Individual cases expiration check ran successfully! Check server logs for details.');
  } catch (error) {
    console.error('Error running individual cases expiration check:', error);
    res.status(500).send('Error running individual cases expiration check');
  }
});

app.post('/api/individual-cases/:id/resubmit', async (req, res) => {
  try {
    const caseId = req.params.id;

    const existingCase = await Case.findById(caseId);
    if (!existingCase) {
      return res.status(404).json({ error: 'Case not found' });
    }

    if (existingCase.answered !== 'expired') {
      return res.status(400).json({ error: 'Only expired cases can be resubmitted' });
    }

    // Update the case
    existingCase.answered = 'no';
    ecg.resubmitted = true; 
    existingCase.deadline = new Date(Date.now() + 24 * 60 * 60 * 1000); // +1 day
    existingCase.responseDate = new Date();
    await existingCase.save();

    const userId = existingCase.senderId;  // assign senderId to userId

    await RecentActivity.create({
      userId: userId,  // <-- userId assigned to userId
      action: 'Resubmitted individual case',
      description: 'Resubmitted individual case',
      details: { caseId },
      timestamp: new Date(),
    });

    res.status(200).json({
      message: 'Case resubmitted successfully',
      updatedCaseId: existingCase._id
    });
  } catch (error) {
    console.error('❌ Error resubmitting individual case:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'nawressjebalinounou@gmail.com',
    pass: 'nspb qesr oral zttl',
  }
});

async function checkUpcomingEventsAndNotify(minutesBefore) {
  const now = new Date();
  const lowerBound = new Date(now.getTime() + minutesBefore * 60 * 1000 - 2 * 60 * 1000);
  const upperBound = new Date(now.getTime() + minutesBefore * 60 * 1000 + 2 * 60 * 1000);

  try {
    const events = await Event.find({
      date: { $gte: lowerBound, $lte: upperBound },
      cancelled: 'no'
    });

    for (const event of events) {
      const [user, doctor] = await Promise.all([
        User.findById(event.userId),
        User.findById(event.doctorId)
      ]);

      if (!user || !doctor) {
        console.warn(`⚠️ Skipping event ${event._id} due to missing user or doctor`);
        continue;
      }

      const subject = `⏰ Reminder: "${event.title}" in ${minutesBefore} minutes`;

      const text = `
Hello Dr. ${user.name} and Dr. ${doctor.name},

This is a reminder from Medconnect that the event "${event.title}" will begin at ${event.date.toLocaleString()}.

Room ID: ${event.roomId}

Please be ready.

Best regards,
The Medconnect Team
      `.trim();

      const mailOptions = {
        from: 'nawressjebalinounou@gmail.com',
        to: [user.email, doctor.email],
        subject,
        text
      };

      await transporter.sendMail(mailOptions);
      console.log(`📨 Reminder sent to ${user.email} (Dr.${user.name}) and ${doctor.email} (Dr. ${doctor.name}) for event ${event._id}`);
    }
  } catch (err) {
    console.error('❌ Error in event reminder job:', err);
  }
}

// Schedule cron jobs inside server.js

// Every 10 minutes: reminder for events in 10 minutes
cron.schedule('*/10 * * * *', () => {
  console.log('⏰ Running 10-minute event reminder check...');
  checkUpcomingEventsAndNotify(10);
});

// Every hour: reminder for events in 1 hour
cron.schedule('0,30 * * * *', () => {
  console.log('⏰ Running 30-minute interval event reminder check...');
  checkUpcomingEventsAndNotify(60); // check events 1 hour ahead
});

app.get('/test-reminder/:minutes', async (req, res) => {
  const minutes = parseInt(req.params.minutes);
  if (![10, 60].includes(minutes)) {
    return res.status(400).send('Only 10 or 60 minutes allowed');
  }

  try {
    await checkUpcomingEventsAndNotify(minutes);
    res.send(`Reminder check for events in ${minutes} minutes completed. Check server logs and email inbox.`);
  } catch (error) {
    console.error('Error during test reminder:', error);
    res.status(500).send('Error occurred while testing reminders.');
  }
});
async function getTimeUntilNextEvent() {
  const now = new Date();

  try {
    const nextEvent = await Event.findOne({
      date: { $gt: now },
      cancelled: 'no'
    }).sort({ date: 1 });

    if (!nextEvent) {
      console.log('📭 No upcoming events found.');
      return null;
    }

    const timeDiffMs = nextEvent.date - now;
    const minutes = Math.floor(timeDiffMs / (1000 * 60));
    const seconds = Math.floor((timeDiffMs % (1000 * 60)) / 1000);

    console.log(`🕒 Next event in ${minutes} minutes and ${seconds} seconds`);
    console.log(`📅 Event: "${nextEvent.title}" at ${nextEvent.date.toLocaleString()}`);

    return {
      minutes,
      seconds,
      event: nextEvent
    };
  } catch (err) {
    console.error('❌ Error fetching next event:', err);
    return null;
  }
}
app.get('/upcoming-events', async (req, res) => {
  const now = new Date();

  try {
    // Find all upcoming, not cancelled events sorted by date
    const events = await Event.find({
      date: { $gt: now },
      cancelled: 'no'
    }).sort({ date: 1 });

    if (!events.length) {
      return res.send('📭 No upcoming events found.');
    }

    // Calculate time remaining for each event
    const eventsWithCountdown = events.map(event => {
      const timeDiffMs = event.date - now;
      const minutes = Math.floor(timeDiffMs / (1000 * 60));
      const seconds = Math.floor((timeDiffMs % (1000 * 60)) / 1000);

      return {
        title: event.title,
        scheduledAt: event.date.toLocaleString(),
        minutes,
        seconds
      };
    });

    // Log each event's countdown to console
    eventsWithCountdown.forEach(e =>
      console.log(`🕒 Event "${e.title}" in ${e.minutes} minutes and ${e.seconds} seconds, scheduled for ${e.scheduledAt}`)
    );

    // Send list to client as formatted string or JSON
    const responseText = eventsWithCountdown
      .map(e => `Event "${e.title}" is in ${e.minutes} minutes and ${e.seconds} seconds, scheduled for ${e.scheduledAt}`)
      .join('\n');

    res.send(responseText);

  } catch (err) {
    console.error('❌ Error fetching upcoming events:', err);
    res.status(500).send('Error fetching upcoming events');
  }
});

app.get('/next-event', async (req, res) => {
  const result = await getTimeUntilNextEvent();

  if (!result) {
    return res.send('No upcoming events found.');
  }

  const { minutes, seconds, event } = result;
  res.send(`Next event "${event.title}" is in ${minutes} minutes and ${seconds} seconds, scheduled for ${event.date.toLocaleString()}.`);
});
async function getTimeSinceLastEvent() {
  const now = new Date();

  try {
    const lastEvent = await Event.findOne({
      date: { $lt: now },
      cancelled: 'no'
    }).sort({ date: -1 }); // Sort descending to get the latest past event

    if (!lastEvent) {
      console.log('📭 No past events found.');
      return null;
    }

    const timeDiffMs = now - lastEvent.date; // now minus event date
    const minutes = Math.floor(timeDiffMs / (1000 * 60));
    const seconds = Math.floor((timeDiffMs % (1000 * 60)) / 1000);

    console.log(`🕒 Last event was ${minutes} minutes and ${seconds} seconds ago`);
    console.log(`📅 Event: "${lastEvent.title}" at ${lastEvent.date.toLocaleString()}`);

    return {
      minutes,
      seconds,
      event: lastEvent
    };
  } catch (err) {
    console.error('❌ Error fetching last event:', err);
    return null;
  }
}

app.get('/last-event', async (req, res) => {
  const result = await getTimeSinceLastEvent();

  if (!result) {
    return res.send('No past events found.');
  }

  const { minutes, seconds, event } = result;
  res.send(`Last event "${event.title}" was ${minutes} minutes and ${seconds} seconds ago, scheduled for ${event.date.toLocaleString()}.`);
});
app.get('/api/users_crazy', async (req, res) => {
  try {
    const users = await User.find({ specialty: { $in: ['generaliste', 'cardiologie'] } });
    res.json(users);
  } catch (err) {
    console.error('Failed to fetch users:', err);
    res.status(500).json({ message: 'Server error' });
  }
});



app.put('/users/:id/suspend', async (req, res) => {
  console.log('PUT /users/:id/suspend called with id:', req.params.id, 'and body:', req.body);

  const { id } = req.params;
  const { isSuspended } = req.body;

  try {
    const user = await User.findByIdAndUpdate(id, { isSuspended }, { new: true });
    if (!user) return res.status(404).send({ message: 'User not found' });
    res.send(user);
  } catch (err) {
    res.status(500).send({ message: 'Server error', error: err });
  }
});


app.get('/api/users/:userId/details', async (req, res) => {
  try {
    const { userId } = req.params;
    console.log(`Received request for userId: ${userId}`);

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      console.log('Invalid userId format detected');
      return res.status(400).json({ error: 'Invalid userId format' });
    }
    console.log('userId format is valid');

    const userObjectId = new mongoose.Types.ObjectId(userId);

    console.log('Fetching recent activities and login history in parallel...');
    const [recentActivities, loginHistory] = await Promise.all([
      RecentActivity.find({ userId: userObjectId }).sort({ timestamp: -1 }),
      LoginHistory.find({ userId }).sort({ timestamp: -1 }) // assuming string type userId
    ]);
    console.log(`Found ${recentActivities.length} recent activities`);
    console.log(`Found ${loginHistory.length} login history records`);

   res.json({
  userId,
  recentActivity: recentActivities, // rename here
  loginHistory
});

  } catch (err) {
    console.error('Error fetching user activity:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});
app.get("/api/users_summary", async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();

    const rolesCount = await User.aggregate([
      {
        $project: {
          role: {
            $switch: {
              branches: [
                { case: { $eq: ["$role", "admin"] }, then: "admin" },
                { 
                  case: { $eq: [ { $toLower: { $ifNull: ["$specialty", ""] } }, "cardiologie" ] }, 
                  then: "cardiologist" 
                }
              ],
              default: "generalist"
            }
          }
        }
      },
      {
        $group: { _id: "$role", count: { $sum: 1 } }
      }
    ]);

    res.json({
      total_users: totalUsers,
      roles_count: rolesCount.map(r => ({ role: r._id, count: r.count }))
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching users summary");
  }
});
app.get("/api/users_activity", async (req, res) => {
  try {
    const now = new Date();

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const startOfWeek = new Date();
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const totalUsers = await User.countDocuments();

    const dailyActive = await LoginHistory.distinct("userId", { success: true, timestamp: { $gte: startOfDay } });
    const weeklyActive = await LoginHistory.distinct("userId", { success: true, timestamp: { $gte: startOfWeek } });
    const monthlyActive = await LoginHistory.distinct("userId", { success: true, timestamp: { $gte: startOfMonth } });

   const result = {
  total_users: totalUsers,
  daily_active: dailyActive.length,
  daily_inactive: totalUsers - dailyActive.length,
  weekly_active: weeklyActive.length,
  weekly_inactive: totalUsers - weeklyActive.length,
  monthly_active: monthlyActive.length,
  monthly_inactive: totalUsers - monthlyActive.length
};

res.json(result);

  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching users activity");
  }
});


app.get("/registrations/monthly", async (req, res) => {
  try {
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const endOfMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);

    const result = await User.aggregate([
      {
        $match: {
          createdAt: { $gte: startOfMonth, $lte: endOfMonth }
        }
      },
      {
        $group: {
          _id: {
            day: { $dayOfMonth: "$createdAt" },
            specialty: "$specialty"  // use the correct DB field
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { "_id.day": 1 } }
    ]);

    // Flatten and map specialties to roles
    const flattened = result.map(r => {
      let role;
      if (r._id.specialty === "cardiologie") role = "Cardiologist";
      else if (r._id.specialty === "generaliste") role = "Generalist";
      else role = r._id.specialty || "Unknown";

      return {
        day: r._id.day,
        role,
        count: r.count
      };
    });

    res.json(flattened);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.get("/accounts/status/total", async (req, res) => {
  try {
    // Aggregate users by isSuspended
    const result = await User.aggregate([
      {
        $group: {
          _id: "$isSuspended",
          count: { $sum: 1 }
        }
      }
    ]);

    // Map _id to readable status
    const totals = { Active: 0, Suspended: 0 };
    result.forEach(r => {
      if (r._id) {
        totals.Suspended = r.count;
      } else {
        totals.Active = r.count;
      }
    });

    res.json(totals);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});
app.get("/api/login_activity_nawress", async (req, res) => {
  try {
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const endOfMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);

    const result = await LoginHistory.aggregate([
      {
        $match: {
          timestamp: { $gte: startOfMonth, $lte: endOfMonth }
        }
      },
      {
        $group: {
          _id: {
            day: { $dayOfMonth: "$timestamp" },
            success: "$success"
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { "_id.day": 1 } }
    ]);

    // Flatten and map success boolean to status string
    const flattened = result.map(r => ({
      day: r._id.day,
      status: r._id.success ? "Success" : "Failure",
      count: r.count
    }));

    res.json(flattened);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});
app.get("/api/total_cases", async (req, res) => {
  try {
    const caseCount = await Case.countDocuments({});
    const broadcastCaseCount = await BroadcastCase.countDocuments({});
    const totalCases = caseCount + broadcastCaseCount;
    res.json({ totalCases });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.get("/api/total_ecgs", async (req, res) => {
  try {
    const ecgCount = await ECG.countDocuments({});
    const broadcastEcgCount = await BroadcastECG.countDocuments({});
    const totalECGs = ecgCount + broadcastEcgCount;
    res.json({ totalECGs });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.get("/api/submissions_breakdown", async (req, res) => {
  try {
    const caseCount = await Case.countDocuments({});
    const broadcastCaseCount = await BroadcastCase.countDocuments({});
    const ecgCount = await ECG.countDocuments({});
    const broadcastEcgCount = await BroadcastECG.countDocuments({});

    res.json({
      cases: {
        individual: caseCount,
        broadcast: broadcastCaseCount
      },
      ecgs: {
        individual: ecgCount,
        broadcast: broadcastEcgCount
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.get("/api/submissions/indiv-ecg", async (req, res) => {
  try {
    const answered = await ECG.countDocuments({ answered: 'yes' });
    const expired = await ECG.countDocuments({  answered: 'expired' });

    res.json({ answered, expired });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.get("/api/submissions/broadcast-ecg", async (req, res) => {
  try {
    const answered = await BroadcastECG.countDocuments({ answered: 'yes' });
    const expired = await BroadcastECG.countDocuments({ answered: 'expired' });

    res.json({ answered, expired });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.get("/api/submissions/indiv-case", async (req, res) => {
  try {
    const answered = await Case.countDocuments({  answered: 'yes' });
    const expired = await Case.countDocuments({  answered: 'expired' });

    res.json({ answered, expired });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.get("/api/submissions/broadcast-case", async (req, res) => {
  try {
    const answered = await BroadcastCase.countDocuments({ answered: 'yes' });
    const expired = await BroadcastCase.countDocuments({ answered: 'expired' });

    res.json({ answered, expired });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.get('/api/resubmissions/indiv-ecg/count', async (req, res) => {
  try {
    const count = await ECG.countDocuments({ 
     
      resubmitted: true 
    });

    res.json({ count });
  } catch (error) {
    console.error('Error counting individual resubmitted ECGs:', error);
    res.status(500).json({ error: error.message });
  }
});
app.get('/api/resubmissions/broadcast-ecg/count', async (req, res) => {
  try {
    const count = await BroadcastECG.countDocuments({ 
      resubmitted: true 
    });

    res.json({ count });
  } catch (error) {
    console.error('Error counting broadcast resubmitted ECGs:', error);
    res.status(500).json({ error: error.message });
  }
});
// Individual Case Resubmissions Count
app.get('/api/resubmissions/indiv-case/count', async (req, res) => {
  try {
    const count = await Case.countDocuments({ 
      
      resubmitted: true 
    });

    res.json({ count });
  } catch (error) {
    console.error('Error counting individual resubmitted cases:', error);
    res.status(500).json({ error: error.message });
  }
});

// Broadcast Case Resubmissions Count
app.get('/api/resubmissions/broadcast-case/count', async (req, res) => {
  try {
    const count = await BroadcastCase.countDocuments({ 
      resubmitted: true 
    });

    res.json({ count });
  } catch (error) {
    console.error('Error counting broadcast resubmitted cases:', error);
    res.status(500).json({ error: error.message });
  }
});
app.get("/api/average-ecg-response-time", async (req, res) => {
  try {
    const result = await ECG.aggregate([
      {
        $match: {
          answered: "yes", // only include ECGs that were actually answered
          sendDate: { $exists: true },
          responseDate: { $exists: true }
        }
      },
      {
        $project: {
          responseTimeMinutes: {
            $divide: [
              { $subtract: ["$responseDate", "$sendDate"] },
              1000 * 60 // convert ms to minutes
            ]
          }
        }
      },
      {
        $group: {
          _id: null,
          avgResponseTimeMinutes: { $avg: "$responseTimeMinutes" }
        }
      }
    ]);

    const avgMinutes = result[0]?.avgResponseTimeMinutes || 0;
    const hours = Math.floor(avgMinutes / 60);
    const minutes = Math.round(avgMinutes % 60);

    res.json({
      avgResponseTimeMinutes: avgMinutes,
      formatted: `${hours}h ${minutes}m`
    });
  } catch (error) {
    console.error("Error calculating average ECG response time:", error);
    res.status(500).json({ error: error.message });
  }
});
app.get("/api/average-case-response-time", async (req, res) => {
  try {
    const result = await Case.aggregate([
      {
        $match: {
          answered: "yes", // only include answered cases
          responseDate: { $exists: true }
        }
      },
      {
        $project: {
          responseTimeMinutes: {
            $divide: [
              { $subtract: ["$responseDate", "$createdAt"] }, // difference in ms
              1000 * 60 // convert ms → minutes
            ]
          }
        }
      },
      {
        $group: {
          _id: null,
          avgResponseTimeMinutes: { $avg: "$responseTimeMinutes" }
        }
      }
    ]);

    const avgMinutes = result[0]?.avgResponseTimeMinutes || 0;
    const hours = Math.floor(avgMinutes / 60);
    const minutes = Math.round(avgMinutes % 60);

    res.json({
      avgResponseTimeMinutes: avgMinutes,
      formatted: `${hours}h ${minutes}m`
    });

  } catch (error) {
    console.error("Error calculating average case response time:", error);
    res.status(500).json({ error: error.message });
  }
});
const aiUsageSchema = new mongoose.Schema({
  aiCount: { type: Number, default: 0 }
});

// Create the model
const AIUsageStats = mongoose.model("AIUsageStats", aiUsageSchema);
app.post("/api/ai-usage/increment", async (req, res) => {
  try {
    const stat = await AIUsageStats.findOneAndUpdate(
      {},                // assume only one document tracking usage
      { $inc: { aiCount: 1 } },
      { upsert: true, new: true }
    );
    res.json({ count: stat.aiCount });
  } catch (err) {
    console.error("Error incrementing AI usage:", err);
    res.status(500).json({ error: err.message });
  }
});
app.get("/api/ai-usage/count", async (req, res) => {
  try {
    const stat = await AIUsageStats.findOne({});
    res.json({ count: stat?.aiCount || 0 });
  } catch (err) {
    console.error("Error fetching AI usage count:", err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/messages/daily', async (req, res) => {
  try {
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const today = new Date();

    const result = await ChatbotMessage.aggregate([
      {
        $match: {
          senderId: { $ne: "medical_bot" },
          timestamp: { $gte: startOfMonth, $lte: today }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { "_id": 1 }
      }
    ]);

    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});
app.get('/decisions/by-type', async (req, res) => {
  try {
    const collections = [
      { name: 'ECG', model: ECG },
      { name: 'BroadcastECG', model: BroadcastECG },
      { name: 'BroadcastCase', model: BroadcastCase },
      { name: 'Case', model: Case}
    ];

    const data = {};

    for (const col of collections) {
      const result = await col.model.aggregate([
        { $group: { _id: "$generalistDecision", count: { $sum: 1 } } }
      ]);

      // Map null to NoOpinion
      const counts = { Approved: 0, Disapproved: 0, NoOpinion: 0 };
      result.forEach(r => {
        if (r._id === 'Approved') counts.Approved = r.count;
        else if (r._id === 'Disapproved') counts.Disapproved = r.count;
        else counts.NoOpinion = r.count; // null
      });

      data[col.name] = counts;
    }

    res.json(data);

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});
// ✅ Add Call Record
app.post('/api/chat/addCall', async (req, res) => {
  try {
    const { senderId, receiverId, type, callStatus, duration } = req.body;

    // Validate call type
    if (!['voice_call', 'video_call'].includes(type)) {
      return res.status(400).json({ error: 'Invalid call type' });
    }

    const callRecord = new Message({
      senderId,
      receiverId,
      type,        // 'voice_call' | 'video_call'
      callStatus,  // 'made' | 'received' | 'missed'
      duration,    // optional, in seconds
      timestamp: new Date(),
    });

    await callRecord.save();

    res.status(200).json(callRecord);
  } catch (err) {
    console.error('❌ Failed to save call record:', err);
    res.status(500).json({ error: 'Failed to save call record' });
  }
});
function getSocketByUserId(userId) {
  return users.get(userId) || null;
}
app.put('/api/chat/updateCall', async (req, res) => {
  try {
    const { senderId, receiverId, callStatus, startTime, endTime, duration } = req.body;

    console.log('🔹 Received updateCall request:', req.body);

    // Find latest call between sender and receiver
    let callRecord = await Message.findOne({
      senderId,
      receiverId,
      type: { $in: ['voice_call', 'video_call'] },
    }).sort({ timestamp: -1 });

    if (!callRecord) {
      console.log('🔄 Trying reversed sender/receiver...');
      callRecord = await Message.findOne({
        senderId: receiverId,
        receiverId: senderId,
        type: { $in: ['voice_call', 'video_call'] },
      }).sort({ timestamp: -1 });
    }

    if (!callRecord) return res.status(404).json({ error: 'Call record not found' });

    // Update fields
    if (callStatus) callRecord.callStatus = callStatus;
    if (startTime) callRecord.startTime = new Date(startTime);
    if (endTime) callRecord.endTime = new Date(endTime);
    if (duration != null) callRecord.duration = duration;

    await callRecord.save();
    console.log('✅ Call record updated successfully:', callRecord);

    // 🔹 Emit updated call message to both users
    const senderSocketId = getSocketByUserId(senderId);
const receiverSocketId = getSocketByUserId(receiverId);

if (senderSocketId) io.to(senderSocketId).emit('receiveMessage', callRecord);
if (receiverSocketId) io.to(receiverSocketId).emit('receiveMessage', callRecord);


    res.status(200).json(callRecord);
  } catch (err) {
    console.error('❌ Failed to update call record:', err);
    res.status(500).json({ error: 'Failed to update call record' });
  }
});


app.use((req, res, next) => {
  console.log('Unhandled request to:', req.originalUrl);
  res.status(404).send('Not found'); // Optional: send 404 response
});

const PORT = 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});