const path = require('path');
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const axios = require('axios');
const cloudinary = require('cloudinary').v2;
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
// Load project-root .env. This keeps /backend source limited to this one file.
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = express();
const PORT = Number(process.env.PORT || 5000);
const MAX_PROMPT_LENGTH = 800;

app.use(express.json({ limit: '1mb' }));
app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN ? process.env.CLIENT_ORIGIN.split(',') : '*',
    credentials: true
  })
);

function requireEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function getFirebaseCredential() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    const json = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf8');
    return cert(JSON.parse(json));
  }

  const projectId = requireEnv('FIREBASE_PROJECT_ID');
  const clientEmail = requireEnv('FIREBASE_CLIENT_EMAIL');
  const privateKey = requireEnv('FIREBASE_PRIVATE_KEY').replace(/\\n/g, '\n');

  return cert({
    projectId,
    clientEmail,
    privateKey
});
}

function initializeFirebaseAdmin() {
 const { getApps } = require('firebase-admin/app');

if (getApps().length) {
  return;
}
  // Firebase Admin setup:
  // 1. Firebase Console > Project settings > Service accounts.
  // 2. Generate a private key JSON file.
  // 3. Prefer FIREBASE_SERVICE_ACCOUNT_BASE64 in production secret storage.
  // 4. The backend verifies Firebase ID tokens sent by the Expo app.
  console.log("🚀 Initializing Firebase Admin...");
  initializeApp({
  credential: getFirebaseCredential()
  
});
console.log("✅ Firebase Admin initialized");
}
function configureCloudinary() {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true
  });
  console.log("✅ Cloudinary configured");
}

// MongoDB schemas live here by request, so the backend has no separate model files.
const userSchema = new mongoose.Schema(
  {
    firebaseUid: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    googleId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true
    },
    profileImage: {
      type: String,
      default: ''
    }
  },
  { timestamps: true }
);

const generatedImageSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    prompt: {
      type: String,
      required: true,
      trim: true,
      maxlength: MAX_PROMPT_LENGTH
    },
    imageUrl: {
      type: String,
      required: true
    },
    cloudinaryPublicId: {
      type: String,
      required: true
    },
    provider: {
      type: String,
      default: 'huggingface'
    },
    model: {
      type: String,
      required: true
    }
  },
  { timestamps: true }
);

const User = mongoose.model('User', userSchema);
const GeneratedImage = mongoose.model('GeneratedImage', generatedImageSchema);

function sendError(res, statusCode, message, details) {
  return res.status(statusCode).json({
    success: false,
    message,
    ...(details ? { details } : {})
  });
}

function getBearerToken(req) {
  const header = req.headers.authorization || '';

  if (!header.startsWith('Bearer ')) {
    return null;
  }

  return header.slice('Bearer '.length).trim();
}

async function upsertUserFromDecodedToken(decodedToken) {
  const firebaseIdentity = decodedToken.firebase?.identities || {};
  const googleId = firebaseIdentity['google.com']?.[0] || decodedToken.uid;
  const email = decodedToken.email;

  if (!email) {
    throw new Error('Google account did not provide an email address.');
  }

  const user = await User.findOneAndUpdate(
    { firebaseUid: decodedToken.uid },
    {
      $set: {
        firebaseUid: decodedToken.uid,
        googleId,
        name: decodedToken.name || email.split('@')[0],
        email,
        profileImage: decodedToken.picture || ''
      }
    },
    {
      returnDocument: 'after',
      upsert: true,
      setDefaultsOnInsert: true
    }
  );

  return user;
}

async function authenticateFirebaseUser(req, res, next) {
  try {
    const token = getBearerToken(req);

    if (!token) {
      return sendError(res, 401, 'Missing Authorization bearer token.');
    }
const decodedToken = await getAuth().verifyIdToken(token);
    const user = await upsertUserFromDecodedToken(decodedToken);

    req.firebaseUser = decodedToken;
    req.user = user;

    return next();
  } catch (error) {
    return sendError(res, 401, 'Invalid or expired Firebase token.', error.message);
  }
}

function validatePrompt(prompt) {
  if (typeof prompt !== 'string') {
    return 'Prompt must be a string.';
  }

  const cleanPrompt = prompt.trim();

  if (!cleanPrompt) {
    return 'Prompt is required.';
  }

  if (cleanPrompt.length > MAX_PROMPT_LENGTH) {
    return `Prompt must be ${MAX_PROMPT_LENGTH} characters or fewer.`;
  }

  return null;
}
async function generateImageWithPollinations(prompt) {
  // Free, open-source models (e.g., 'flux' or 'turbo')
  const model = 'flux'; 
  
  // Pollinations handles inputs directly via a clean URL query string
  const encodedPrompt = encodeURIComponent(prompt);
  const endpoint = `https://image.pollinations.ai/p/${encodedPrompt}?width=1024&height=1024&model=${model}&seed=${Math.floor(Math.random() * 100000)}`;

  try {
    const response = await axios.get(endpoint, {
      responseType: 'arraybuffer',
      timeout: 60000 
    });

    const contentType = response.headers['content-type'] || 'image/jpeg';

    if (!contentType.startsWith('image/')) {
      throw new Error('Endpoint returned an unexpected non-image string response.');
    }

    return {
      imageBuffer: Buffer.from(response.data),
      contentType,
      model: `pollinations-${model}`
    };
  } catch (error) {
    throw new Error(`Free image generation failed: ${error.message}`);
  }
}
async function uploadImageBufferToCloudinary(imageBuffer, contentType, prompt) {
  const base64Image = imageBuffer.toString('base64');
  const dataUri = `data:${contentType};base64,${base64Image}`;

  const result = await cloudinary.uploader.upload(dataUri, {
    folder: process.env.CLOUDINARY_FOLDER || 'ai-image-generator',
    resource_type: 'image',
    overwrite: false,
    context: {
      prompt: prompt.slice(0, 250)
    }
  });

  return {
    imageUrl: result.secure_url,
    publicId: result.public_id
  };
}

app.get('/health', async (req, res) => {
  const databaseState = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';

  return res.json({
    success: true,
    service: 'ai-image-generator-api',
    database: databaseState,
    timestamp: new Date().toISOString()
  });
});

app.post('/api/auth/google', authenticateFirebaseUser, async (req, res) => {
  return res.status(200).json({
    success: true,
    user: req.user
  });
});
app.post('/api/images/generate', authenticateFirebaseUser, async (req, res) => {
  try {
    const validationError = validatePrompt(req.body.prompt);
    console.log("🖼️ Image generation request received");

    if (validationError) {
      return sendError(res, 400, validationError);
    }

    const prompt = req.body.prompt.trim();
    console.log("✍️ Prompt:", prompt);

    console.log("🤖 Calling Free Generation API...");

    const generated = await generateImageWithPollinations(prompt);

    console.log("✅ Image generated from model:", generated.model);
    console.log("☁️ Uploading to Cloudinary...");

    // 2. Upload generated bytes to Cloudinary
    const uploaded = await uploadImageBufferToCloudinary(generated.imageBuffer, generated.contentType, prompt);

    console.log("✅ Uploaded:", uploaded.imageUrl);
    console.log("💾 Saving to MongoDB...");

    // 3. Store the Cloudinary URL against the MongoDB user
    const image = await GeneratedImage.create({
      userId: req.user._id,
      prompt,
      imageUrl: uploaded.imageUrl,
      cloudinaryPublicId: uploaded.publicId,
      provider: 'pollinations', // Updated provider name
      model: generated.model
    });

    console.log("🎉 Image saved successfully:", image._id);
    return res.status(201).json({
      success: true,
      image
    });
  } catch (error) {
    console.error('Gemini generation error:', error);
    return sendError(res, 502, 'Unable to generate image.', error.message);
  }
});


app.get('/api/images/history', authenticateFirebaseUser, async (req, res) => {
  try {
    const images = await GeneratedImage.find({ userId: req.user._id })
      .sort({ createdAt: 1 })
      .limit(50)
      .lean();

    return res.json({
      success: true,
      images
    });
  } catch (error) {
    return sendError(res, 500, 'Unable to load image history.', error.message);
  }
});

app.use((req, res) => {
  return sendError(res, 404, 'Route not found.');
});

app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  return sendError(res, 500, 'Unexpected server error.', error.message);
});

async function startServer() {
  try {
    initializeFirebaseAdmin();
    configureCloudinary();
    console.log("🚀 Connecting MongoDB...");
    mongoose.set('strictQuery', true);
    await mongoose.connect(requireEnv('MONGODB_URI'));
    console.log("✅ MongoDB Connected");
  if (process.env.NODE_ENV !== 'production') {
    if (!process.env.VERCEL){
      app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
      });
    }
    // Export it so Vercel can consume itdule.exports = app; // Export it so Vercel can consume it
    } 
  }
  catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
}
app.get('/api/test/system', async (req, res) => {
  try {
    const mongoStatus = mongoose.connection.readyState === 1;

    res.json({
      success: true,
      message: 'System check completed',
      checks: {
        mongoDB: mongoStatus ? 'OK' : 'FAILED',
        firebase: !!getAuth(),
        cloudinary: !!process.env.CLOUDINARY_CLOUD_NAME,
        huggingface: !!process.env.HUGGINGFACE_API_KEY,
        envLoaded: true
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
app.get('/api/test/mongo', async (req, res) => {
  try {
    const state = mongoose.connection.readyState;

    res.json({
      success: true,
      state,
      status:
        state === 1 ? 'connected' :
        state === 2 ? 'connecting' :
        state === 0 ? 'disconnected' :
        'unknown'
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
app.get('/api/test/firebase', async (req, res) => {
  try {
    const auth = getAuth();

    res.json({
      success: true,
      message: 'Firebase Admin is initialized',
      hasAuth: !!auth
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});
app.get('/api/test/cloudinary', (req, res) => {
  try {
    res.json({
      success: true,
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME ? 'set' : 'missing',
      api_key: process.env.CLOUDINARY_API_KEY ? 'set' : 'missing',
      api_secret: process.env.CLOUDINARY_API_SECRET ? 'set' : 'missing'
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
// Replace your old /api/test/huggingface endpoint with this:
app.get('/api/test/gemini', (req, res) => {
  try {
    res.json({
      success: true,
      model: process.env.GEMINI_MODEL || 'gemini-3.1-flash-image',
      apiKeyExists: !!process.env.GEMINI_API_KEY
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update the main system check object property inside /api/test/system:
// Replace "huggingface: !!process.env.HUGGINGFACE_API_KEY" with:
// gemini: !!process.env.GEMINI_API_KEY

startServer();
module.exports = app;