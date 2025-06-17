import express from "express";
import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import multer from "multer";
import { pipeline } from "@huggingface/transformers";
import dotenv from "dotenv";
import cors from "cors";
import { body, validationResult, param } from "express-validator";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const settings = {
  PROJECT_NAME: "Customer Support Platform API",
  API_V1_STR: "/api/v1",
  PORT: process.env.PORT || 8000,
  DATABASE_URL:
    process.env.DATABASE_URL || "mongodb://localhost:27017/support_platform",
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  SECRET_KEY: process.env.SECRET_KEY,
  ALGORITHM: "HS256",
  ACCESS_TOKEN_EXPIRE_MINUTES: parseInt(
    process.env.ACCESS_TOKEN_EXPIRE_MINUTES || "60",
    10
  ),
  ADMIN_EMAIL: process.env.ADMIN_EMAIL,
  UPLOAD_DIR: "platform_uploads",
  CHAT_ATTACHMENTS_SUBDIR: "chat_attachments",
  ALLOWED_CHAT_MIME_TYPES: [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "application/pdf",
    "audio/mpeg",
    "audio/ogg",
    "audio/wav",
    "audio/aac",
    "audio/mp4",
    "video/mp4",
    "video/webm",
    "video/ogg",
    "text/plain",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ],
  MAX_CHAT_FILE_SIZE_MB: 15,
  BACKEND_CORS_ORIGINS: (
    process.env.BACKEND_CORS_ORIGINS || "http://localhost:5173"
  ).split(","),
  SUMMARIZATION_MODEL_CHECKPOINT:
    process.env.SUMMARIZATION_MODEL_CHECKPOINT ||
    "user10383/t5-small-finetuned-samsum-onnx",
};

fs.mkdirSync(settings.UPLOAD_DIR, { recursive: true });
fs.mkdirSync(path.join(settings.UPLOAD_DIR, settings.CHAT_ATTACHMENTS_SUBDIR), {
  recursive: true,
});

let summarizationPipeline = null;

async function loadSummarizationModelOnStartup() {
  if (settings.SUMMARIZATION_MODEL_CHECKPOINT && !summarizationPipeline) {
    try {
      console.log(
        `Loading summarization model: ${settings.SUMMARIZATION_MODEL_CHECKPOINT}...`
      );
      summarizationPipeline = await pipeline(
        "summarization",
        settings.SUMMARIZATION_MODEL_CHECKPOINT
      );
      console.log("Summarization model loaded successfully.");
    } catch (e) {
      console.error(
        `Error loading summarization model '${settings.SUMMARIZATION_MODEL_CHECKPOINT}': ${e}. Summarization will be unavailable.`
      );
      summarizationPipeline = null;
    }
  } else if (!settings.SUMMARIZATION_MODEL_CHECKPOINT) {
    console.log(
      "Summarization model checkpoint not configured. Summarization will be unavailable."
    );
  }
}

async function generateSummary(inputText, maxLength = 200, minLength = 40) {
  if (!summarizationPipeline) {
    console.log("Summarization pipeline not loaded. Cannot generate summary.");
    return null;
  }
  if (!inputText || !inputText.trim()) {
    return "";
  }
  try {
    const output = await summarizationPipeline(inputText, {
      max_length: maxLength,
      min_length: minLength,
    });
    console.log(output);
    return output[0].summary_text;
  } catch (e) {
    console.error(`Error during summary generation: ${e}`);
    return "Error occurred during summary generation.";
  }
}

function formatChatHistoryForSummary(chatHistoryArray) {
  try {
    if (!Array.isArray(chatHistoryArray)) return "";

    return chatHistoryArray
      .map((msgData) => {
        if (typeof msgData !== "object" || msgData === null) return null;
        const senderName = msgData.sender_name || "User";
        const contentData = msgData.content;
        let textContent = "";

        if (typeof contentData === "object" && contentData !== null) {
          textContent = contentData.text || "";
          if (
            contentData.file_info &&
            typeof contentData.file_info === "object"
          ) {
            const fileName = contentData.file_info.name || "attachment";
            textContent = `${textContent} [${fileName} attached]`.trim();
          }
        } else if (typeof contentData === "string") {
          textContent = contentData;
        }

        return textContent ? `${senderName}: ${textContent}` : null;
      })
      .filter(Boolean)
      .join("\n");
  } catch (e) {
    console.error("Error formatting chat history for summarization:", e);
    return "";
  }
}

const UserRole = { customer: "customer", agent: "agent", admin: "admin" };
const ConversationStatus = {
  open: "open",
  assigned: "assigned",
  in_progress: "in_progress",
  pending_customer: "pending_customer",
  resolved: "resolved",
  closed: "closed",
};

const schemaOptions = {
  timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  toJSON: {
    virtuals: true, // This is crucial for virtuals to be included in JSON output
    transform: (doc, ret) => {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
    },
  },
  toObject: {
    virtuals: true, // Also include virtuals in object conversions
  },
};

const userSchema = new mongoose.Schema(
  {
    google_id: { type: String, unique: true, required: true, index: true },
    email: { type: String, unique: true, required: true, lowercase: true },
    full_name: String,
    profile_pic_url: String,
    role: {
      type: String,
      enum: Object.values(UserRole),
      default: UserRole.customer,
      required: true,
    },
    is_active: { type: Boolean, default: true, required: true },
    is_blocked: { type: Boolean, default: false, required: true },
  },
  schemaOptions
);
const User = mongoose.model("User", userSchema);

const conversationSchema = new mongoose.Schema(
  {
    customer_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    agent_id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    status: {
      type: String,
      enum: Object.values(ConversationStatus),
      default: ConversationStatus.open,
      required: true,
    },
    subject: String,
    chat_history: { type: Array, default: [] },
    summary: String,
    assigned_at: Date,
    last_message_at: { type: Date, default: Date.now, index: true },
    resolved_at: Date,
    closed_at: Date,
  },
  schemaOptions
);

// FIX: Define virtuals to solve the StrictPopulateError.
// This allows `.populate('customer')` to work by mapping it to `customer_id`.
conversationSchema.virtual("customer", {
  ref: "User",
  localField: "customer_id",
  foreignField: "_id",
  justOne: true,
});

conversationSchema.virtual("agent", {
  ref: "User",
  localField: "agent_id",
  foreignField: "_id",
  justOne: true,
});

const Conversation = mongoose.model("Conversation", conversationSchema);

const app = express();
const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: { origin: settings.BACKEND_CORS_ORIGINS, methods: ["GET", "POST"] },
  path: "/ws/socket.io",
});

app.use(cors({ origin: settings.BACKEND_CORS_ORIGINS, credentials: true }));
app.use(express.json());

const googleClient = new OAuth2Client(settings.GOOGLE_CLIENT_ID);

const createAccessToken = (payload) => {
  return jwt.sign(payload, settings.SECRET_KEY, {
    algorithm: settings.ALGORITHM,
    expiresIn: `${settings.ACCESS_TOKEN_EXPIRE_MINUTES}m`,
  });
};

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token)
    return res.status(401).send({ detail: "Could not validate credentials" });

  try {
    const payload = jwt.verify(token, settings.SECRET_KEY, {
      algorithms: [settings.ALGORITHM],
    });
    const user = await User.findOne({ google_id: payload.sub });

    if (!user) throw new Error("User not found");
    if (!user.is_active)
      return res.status(403).send({ detail: "User account is inactive." });
    if (user.is_blocked)
      return res.status(403).send({ detail: "User account is blocked." });
    if (user.role !== payload.role)
      return res
        .status(403)
        .send({ detail: "User role mismatch. Please re-login." });

    req.user = user;
    next();
  } catch (err) {
    return res
      .status(401)
      .header("WWW-Authenticate", "Bearer")
      .send({ detail: "Could not validate credentials" });
  }
};

const requireRole = (roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).send({
      detail: `Operation not permitted. Requires one of: ${roles.join(", ")}`,
    });
  }
  next();
};

const requireAdmin = requireRole([UserRole.admin]);
const requireAgentOrAdmin = requireRole([UserRole.agent, UserRole.admin]);
const requireCustomer = requireRole([UserRole.customer]);

const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ detail: errors.array() });
  }
  next();
};

const attachmentStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const conversationId = req.params.conversation_id;
    const dest = path.join(
      settings.UPLOAD_DIR,
      settings.CHAT_ATTACHMENTS_SUBDIR,
      conversationId
    );
    fs.mkdirSync(dest, { recursive: true });
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    const conversationId = req.params.conversation_id;
    const ext = path.extname(file.originalname) || ".bin";
    const safeExt = ext.replace(/[^a-zA-Z0-9.]/g, "").slice(0, 20);
    cb(null, `chat_${conversationId}_${uuidv4()}${safeExt}`);
  },
});

const uploadAttachment = multer({
  storage: attachmentStorage,
  limits: { fileSize: settings.MAX_CHAT_FILE_SIZE_MB * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (settings.ALLOWED_CHAT_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type: ${file.mimetype}.`), false);
    }
  },
}).single("file");

const activeSidsInRooms = {};
const userInfoBySid = {};

io.use(async (socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token)
    return next(new Error("Authentication error: Token not provided."));

  try {
    const payload = jwt.verify(token, settings.SECRET_KEY);
    const user = await User.findOne({ google_id: payload.sub });
    if (user && user.is_active && !user.is_blocked) {
      socket.user = user;
      next();
    } else {
      next(new Error("Authentication error: Invalid user."));
    }
  } catch (err) {
    next(new Error("Authentication error: Invalid token."));
  }
});

io.on("connection", (socket) => {
  const user = socket.user;
  userInfoBySid[socket.id] = {
    user_id: user.id.toString(), // Ensure IDs are strings
    google_id: user.google_id,
    name: user.full_name || user.email,
    role: user.role,
    sid: socket.id,
  };
  console.log(
    `User ${user.full_name || user.email} (SID: ${socket.id}) connected.`
  );
  socket.emit("connection_ack", {
    user_id: user.id,
    message: "Successfully connected to chat server.",
  });

  socket.on("join_conversation", async (data) => {
    const { conversation_id } = data;
    const userInfo = userInfoBySid[socket.id];
    if (!userInfo || !conversation_id) return;

    // Population now works because of the virtuals
    const conv = await Conversation.findById(conversation_id).populate(
      "customer agent"
    );
    if (!conv) {
      return socket.emit("error_message", {
        conversation_id,
        message: "Conversation not found.",
      });
    }

    const isCustomer = conv.customer_id.equals(userInfo.user_id);
    const isAgentOrAdmin = [UserRole.agent, UserRole.admin].includes(
      userInfo.role
    );
    if (!isCustomer && !isAgentOrAdmin) {
      return socket.emit("error_message", {
        conversation_id,
        message: "You are not authorized to join this conversation.",
      });
    }
    if (conv.status === ConversationStatus.closed) {
      return socket.emit("error_message", {
        conversation_id,
        message: "This conversation is closed and cannot be joined.",
      });
    }

    const roomName = `conversation_${conversation_id}`;
    socket.join(roomName);
    if (!activeSidsInRooms[conversation_id])
      activeSidsInRooms[conversation_id] = new Set();
    activeSidsInRooms[conversation_id].add(socket.id);

    console.log(`User ${userInfo.name} joined conversation ${conversation_id}`);

    socket.emit("conversation_joined", conv.toJSON());

    const participants = Array.from(activeSidsInRooms[conversation_id] || [])
      .map((sid) => userInfoBySid[sid])
      .filter(Boolean);
    io.to(roomName).emit("participant_update", {
      conversation_id,
      participants,
    });
    socket.to(roomName).emit("system_message", {
      conversation_id,
      text: `${userInfo.name} has joined the chat.`,
    });
  });

  socket.on("send_message", async (data) => {
    const userInfo = userInfoBySid[socket.id];
    if (!userInfo) return;

    const { conversation_id, content } = data;
    if (!conversation_id || !content || (!content.text && !content.file_info)) {
      return socket.emit("error_message", { message: "Invalid message data." });
    }

    const conv = await Conversation.findById(conversation_id);
    if (!conv)
      return socket.emit("error_message", {
        message: "Conversation not found.",
      });

    const messagePayload = {
      sender_id: userInfo.user_id,
      sender_name: userInfo.name,
      sender_role: userInfo.role,
      content,
      conversation_id,
      timestamp: new Date().toISOString(),
    };

    conv.chat_history.push(messagePayload);
    conv.last_message_at = new Date();
    const oldStatus = conv.status;
    if (
      [UserRole.agent, UserRole.admin].includes(userInfo.role) &&
      [ConversationStatus.open, ConversationStatus.assigned].includes(
        conv.status
      )
    ) {
      conv.status = ConversationStatus.in_progress;
      if (!conv.assigned_at && conv.agent_id) {
        conv.assigned_at = new Date();
      }
    }
    await conv.save();

    const roomName = `conversation_${conversation_id}`;
    io.to(roomName).emit("new_message", messagePayload);

    if (conv.status !== oldStatus) {
      io.to(roomName).emit("conversation_status_update", {
        conversation_id,
        text: `Conversation status updated to ${conv.status}.`,
        detail: { new_status: conv.status },
      });
    }
  });

  socket.on("user_typing_start", (data) => {
    const userInfo = userInfoBySid[socket.id];
    if (!userInfo || !data.conversation_id) return;
    socket
      .to(`conversation_${data.conversation_id}`)
      .emit("typing_start_broadcast", {
        user_id: userInfo.user_id,
        user_name: userInfo.name,
        conversation_id: data.conversation_id,
      });
  });

  socket.on("user_typing_stop", (data) => {
    const userInfo = userInfoBySid[socket.id];
    if (!userInfo || !data.conversation_id) return;
    socket
      .to(`conversation_${data.conversation_id}`)
      .emit("typing_stop_broadcast", {
        user_id: userInfo.user_id,
        user_name: userInfo.name,
        conversation_id: data.conversation_id,
      });
  });

  socket.on("leave_conversation", (data) => {
    const { conversation_id } = data;
    const userInfo = userInfoBySid[socket.id];
    if (!userInfo || !conversation_id) return;

    const roomName = `conversation_${conversation_id}`;
    socket.leave(roomName);

    if (activeSidsInRooms[conversation_id]) {
      activeSidsInRooms[conversation_id].delete(socket.id);
      if (activeSidsInRooms[conversation_id].size === 0) {
        delete activeSidsInRooms[conversation_id];
      }
    }

    console.log(`User ${userInfo.name} left conversation ${conversation_id}`);
    const participants = Array.from(activeSidsInRooms[conversation_id] || [])
      .map((sid) => userInfoBySid[sid])
      .filter(Boolean);
    io.to(roomName).emit("participant_update", {
      conversation_id,
      participants,
    });
    io.to(roomName).emit("system_message", {
      conversation_id,
      text: `${userInfo.name} has left the chat.`,
    });
  });

  socket.on("disconnect", () => {
    const userInfo = userInfoBySid[socket.id];
    if (userInfo) {
      console.log(`User ${userInfo.name} (SID: ${socket.id}) disconnected.`);
      for (const convId in activeSidsInRooms) {
        if (activeSidsInRooms[convId].has(socket.id)) {
          socket.to(`conversation_${convId}`).emit("system_message", {
            conversation_id: convId,
            text: `${userInfo.name} has left the chat.`,
          });
          activeSidsInRooms[convId].delete(socket.id);
          const participants = Array.from(activeSidsInRooms[convId])
            .map((sid) => userInfoBySid[sid])
            .filter(Boolean);
          io.to(`conversation_${convId}`).emit("participant_update", {
            conversation_id: convId,
            participants,
          });
        }
      }
      delete userInfoBySid[socket.id];
    }
  });
});

const apiRouter = express.Router();
const authRouter = express.Router();

authRouter.post(
  "/token/google",
  body("credential").isString().notEmpty(),
  validateRequest,
  async (req, res) => {
    if (!settings.GOOGLE_CLIENT_ID) {
      return res
        .status(503)
        .send({ detail: "Google Client ID not configured on server." });
    }
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken: req.body.credential,
        audience: settings.GOOGLE_CLIENT_ID,
      });
      const {
        sub: google_id,
        email,
        name: full_name,
        picture: profile_pic_url,
      } = ticket.getPayload();

      let user = await User.findOne({ google_id });
      // FIX: Added 'ahlad.p@gmail.com' to admin promotion logic.
      const hardcodedAdmins = [
        settings.ADMIN_EMAIL,
        "ahlad.p@gmail.com",
      ].filter(Boolean);

      if (!user) {
        if (await User.findOne({ email })) {
          return res.status(409).send({
            detail: "Email already registered with a different Google account.",
          });
        }
        const userData = { google_id, email, full_name, profile_pic_url };
        if (hardcodedAdmins.includes(email)) {
          userData.role = UserRole.admin;
          console.log(
            `User ${email} automatically promoted to Admin on creation.`
          );
        }
        user = await User.create(userData);
      } else {
        user.full_name = full_name;
        user.profile_pic_url = profile_pic_url;
        if (hardcodedAdmins.includes(email) && user.role !== UserRole.admin) {
          user.role = UserRole.admin;
          console.log(`User ${email} promoted to Admin during login.`);
        }
        await user.save();
      }

      if (!user.is_active)
        return res.status(403).send({ detail: "Your account is inactive." });
      if (user.is_blocked)
        return res
          .status(403)
          .send({ detail: "Your account has been blocked." });

      const accessToken = createAccessToken({
        sub: user.google_id,
        role: user.role,
      });
      res.json({
        access_token: accessToken,
        token_type: "bearer",
        user: user.toJSON(),
      });
    } catch (e) {
      console.error("Google login error:", e);
      return res
        .status(401)
        .send({ detail: `Invalid Google token: ${e.message}` });
    }
  }
);

authRouter.get("/me", authenticateToken, (req, res) => {
  res.json(req.user.toJSON());
});

const conversationsRouter = express.Router();
conversationsRouter.use(authenticateToken);

conversationsRouter.post(
  "/",
  requireCustomer,
  [
    body("subject").optional().isString().isLength({ max: 255 }),
    body("initial_message_text").optional().isString().isLength({ max: 2000 }),
  ],
  validateRequest,
  async (req, res) => {
    const { subject, initial_message_text } = req.body;
    const customer = req.user;

    const conv = await Conversation.create({
      subject,
      customer_id: customer.id,
    });

    if (initial_message_text) {
      const messagePayload = {
        sender_id: customer.id,
        sender_name: customer.full_name || customer.email,
        sender_role: customer.role,
        content: { text: initial_message_text },
        conversation_id: conv.id.toString(),
        timestamp: new Date().toISOString(),
      };
      conv.chat_history.push(messagePayload);
      await conv.save();
    }

    const fullConv = await Conversation.findById(conv.id).populate(
      "customer agent"
    );
    res.status(201).json(fullConv);
  }
);

conversationsRouter.get("/", async (req, res) => {
  const { skip = 0, limit = 10 } = req.query;
  const user = req.user;
  let query = {};

  if (user.role === UserRole.customer) {
    query = { customer_id: user.id };
  } else {
    query = { agent_id: user.id };
  }
  const conversations = await Conversation.find(query)
    .populate("customer agent")
    .sort({ last_message_at: -1 })
    .skip(parseInt(skip))
    .limit(parseInt(limit));
  res.json(conversations);
});

conversationsRouter.get(
  "/:conversation_id",
  param("conversation_id").isMongoId(),
  validateRequest,
  async (req, res) => {
    const conv = await Conversation.findById(
      req.params.conversation_id
    ).populate("customer agent");
    if (!conv)
      return res.status(404).send({ detail: "Conversation not found" });

    const isCustomer = conv.customer_id.equals(req.user.id);
    const isAgent = conv.agent_id && conv.agent_id.equals(req.user.id);
    const isAdmin = req.user.role === UserRole.admin;

    if (!isCustomer && !isAgent && !isAdmin) {
      return res
        .status(403)
        .send({ detail: "Not authorized to view this conversation" });
    }
    res.json(conv);
  }
);

conversationsRouter.patch(
  "/:conversation_id/status",
  [
    param("conversation_id").isMongoId(),
    body("new_status").isIn(Object.values(ConversationStatus)),
  ],
  validateRequest,
  async (req, res) => {
    const { new_status } = req.body;
    const conv = await Conversation.findById(req.params.conversation_id);
    if (!conv)
      return res.status(404).send({ detail: "Conversation not found" });

    const isAgentOrAdmin = [UserRole.agent, UserRole.admin].includes(
      req.user.role
    );
    if (!isAgentOrAdmin && ![ConversationStatus.open].includes(new_status)) {
      return res.status(403).send({
        detail: `User role ${req.user.role} cannot set status to ${new_status}.`,
      });
    }

    conv.status = new_status;
    const now = new Date();
    if (new_status === ConversationStatus.resolved) conv.resolved_at = now;
    else if (new_status === ConversationStatus.closed) {
      conv.closed_at = now;
      if (!conv.resolved_at) conv.resolved_at = now;
    }
    await conv.save();

    const roomName = `conversation_${conv.id}`;
    io.to(roomName).emit("conversation_status_update", {
      conversation_id: conv.id,
      text: `${
        req.user.full_name || req.user.email
      } updated conversation status to: ${new_status}.`,
      detail: { new_status: new_status, updated_by_user_id: req.user.id },
    });

    const fullConv = await Conversation.findById(conv.id).populate(
      "customer agent"
    );
    res.json(fullConv);
  }
);

conversationsRouter.post(
  "/:conversation_id/attachments",
  param("conversation_id").isMongoId(),
  validateRequest,
  (req, res) => {
    uploadAttachment(req, res, async (err) => {
      if (err) {
        console.error("Upload error:", err.message);
        return res.status(400).json({ detail: err.message });
      }
      if (!req.file) {
        return res.status(400).json({ detail: "No file uploaded." });
      }

      const conversationId = req.params.conversation_id;
      const conv = await Conversation.findById(conversationId);
      if (!conv)
        return res.status(404).json({ detail: "Conversation not found." });

      const isAuthorized =
        conv.customer_id.equals(req.user.id) ||
        (conv.agent_id && conv.agent_id.equals(req.user.id)) ||
        req.user.role === UserRole.admin;
      if (!isAuthorized) {
        fs.unlinkSync(req.file.path);
        return res
          .status(403)
          .json({ detail: "Not authorized to upload to this conversation." });
      }

      const fileInfo = {
        url: `${settings.API_V1_STR}/files/attachments/${conversationId}/${req.file.filename}`,
        name: req.file.originalname,
        mime_type: req.file.mimetype,
        size: req.file.size,
      };

      const messagePayload = {
        sender_id: req.user.id.toString(),
        sender_name: req.user.full_name || req.user.email,
        sender_role: req.user.role,
        content: {
          text: ``, // Keep text empty, file name is shown in the UI automatically
          file_info: fileInfo,
        },
        conversation_id: conversationId,
        timestamp: new Date().toISOString(),
      };

      conv.chat_history.push(messagePayload);
      conv.last_message_at = new Date();
      await conv.save();

      io.to(`conversation_${conversationId}`).emit(
        "new_message",
        messagePayload
      );

      res.json(fileInfo);
    });
  }
);

const adminRouter = express.Router();
adminRouter.use(authenticateToken, requireAdmin);

adminRouter.get("/users", async (req, res) => {
  const { skip = 0, limit = 50, role } = req.query;
  const query = {};
  if (role && Object.values(UserRole).includes(role)) {
    query.role = role;
  }
  const users = await User.find(query)
    .sort({ _id: 1 })
    .skip(parseInt(skip))
    .limit(parseInt(limit));
  res.json(users);
});

adminRouter.patch(
  "/users/:user_id",
  param("user_id").isMongoId(),
  validateRequest,
  async (req, res) => {
    const userToUpdate = await User.findById(req.params.user_id);
    if (!userToUpdate)
      return res.status(404).send({ detail: "User not found" });

    if (
      userToUpdate.id === req.user.id &&
      (req.body.is_blocked ||
        req.body.is_active === false ||
        (req.body.role && req.body.role !== UserRole.admin))
    ) {
      return res.status(403).send({
        detail:
          "Admins cannot block, deactivate, or change their own role from admin.",
      });
    }

    const { full_name, role, is_active, is_blocked } = req.body;
    if (full_name !== undefined) userToUpdate.full_name = full_name;
    if (role !== undefined) userToUpdate.role = role;
    if (is_active !== undefined) userToUpdate.is_active = is_active;
    if (is_blocked !== undefined) userToUpdate.is_blocked = is_blocked;

    await userToUpdate.save();
    res.json(userToUpdate.toJSON());
  }
);

adminRouter.get("/conversations", async (req, res) => {
  const { skip = 0, limit = 20, status, customer_id, agent_id } = req.query;
  const query = {};
  if (status) query.status = status;
  if (customer_id) query.customer_id = customer_id;
  if (agent_id) query.agent_id = agent_id;
  const conversations = await Conversation.find(query)
    .populate("customer agent")
    .sort({ last_message_at: -1 })
    .skip(parseInt(skip))
    .limit(parseInt(limit));
  res.json(conversations);
});

adminRouter.post(
  "/conversations/:conversation_id/assign",
  [param("conversation_id").isMongoId(), body("agent_id").isMongoId()],
  validateRequest,
  async (req, res) => {
    const conv = await Conversation.findById(req.params.conversation_id);
    if (!conv)
      return res.status(404).send({ detail: "Conversation not found" });

    const agent = await User.findById(req.body.agent_id);
    if (!agent || ![UserRole.agent, UserRole.admin].includes(agent.role)) {
      return res
        .status(400)
        .send({ detail: "Invalid agent ID or user is not an agent/admin." });
    }

    conv.agent_id = agent.id;
    conv.assigned_at = new Date();
    if (conv.status === ConversationStatus.open) {
      conv.status = ConversationStatus.assigned;
    }
    await conv.save();

    const fullConv = await Conversation.findById(conv.id).populate(
      "customer agent"
    );

    const roomName = `conversation_${conv.id}`;
    const payload = {
      conversation_id: conv.id,
      text: `Conversation assigned to agent: ${
        agent.full_name || agent.email
      }.`,
      detail: {
        agent_id: agent.id,
        agent_name: agent.full_name,
        new_status: conv.status,
      },
    };
    io.to(roomName).emit("conversation_assigned", payload);
    io.to(roomName).emit("system_message", payload);

    res.json(fullConv);
  }
);

adminRouter.post(
  "/conversations/:conversation_id/summarize",
  param("conversation_id").isMongoId(),
  validateRequest,
  async (req, res) => {
    const conv = await Conversation.findById(req.params.conversation_id);
    if (!conv)
      return res.status(404).send({ detail: "Conversation not found" });
    if (
      ![ConversationStatus.resolved, ConversationStatus.closed].includes(
        conv.status
      )
    ) {
      return res.status(400).send({
        detail:
          "Conversation must be resolved or closed to generate a summary.",
      });
    }

    const formattedText = formatChatHistoryForSummary(conv.chat_history);
    if (!formattedText) {
      conv.summary = "Could not format chat history for summarization.";
    } else {
      const summaryText = await generateSummary(formattedText);
      if (summaryText === null) {
        return res.status(500).send({
          detail: "Summary generation failed. Model might not be loaded.",
        });
      }
      conv.summary = summaryText;
    }
    await conv.save();
    const fullConv = await Conversation.findById(conv.id).populate(
      "customer agent"
    );
    res.json(fullConv);
  }
);

const filesRouter = express.Router();

function getSafeFilePath(baseDir, subDir, filename, dynamicSubDir = null) {
  if (
    filename.includes("..") ||
    filename.includes("/") ||
    filename.includes("\\")
  ) {
    return null;
  }
  const fullDir = dynamicSubDir
    ? path.resolve(__dirname, baseDir, subDir, dynamicSubDir)
    : path.resolve(__dirname, baseDir, subDir);

  const requestedPath = path.resolve(fullDir, filename);

  if (!requestedPath.startsWith(fullDir)) return null;
  if (!fs.existsSync(requestedPath)) return null;

  return requestedPath;
}

filesRouter.get(
  "/attachments/:conversation_id/:filename",
  authenticateToken,
  async (req, res) => {
    const { conversation_id, filename } = req.params;

    const conv = await Conversation.findById(conversation_id);
    if (!conv)
      return res.status(404).send({ detail: "Conversation not found." });

    const isAuthorized =
      conv.customer_id.equals(req.user.id) ||
      (conv.agent_id &&
        conv.agent_id.equals(req.user.id) &&
        [UserRole.agent, UserRole.admin].includes(req.user.role)) ||
      req.user.role === UserRole.admin;

    if (!isAuthorized) {
      return res
        .status(403)
        .send({ detail: "Not authorized to access this attachment." });
    }

    const filePath = getSafeFilePath(
      settings.UPLOAD_DIR,
      settings.CHAT_ATTACHMENTS_SUBDIR,
      filename,
      conversation_id
    );
    if (!filePath) return res.status(404).send({ detail: "File not found" });
    res.sendFile(filePath);
  }
);

const agentRouter = express.Router();
agentRouter.use(authenticateToken, requireAgentOrAdmin);

agentRouter.get("/conversations", async (req, res) => {
  const { skip = 0, limit = 50, status } = req.query;
  const query = {
    $or: [{ status: "open" }, { agent_id: req.user.id }],
  };

  if (status && Object.values(ConversationStatus).includes(status)) {
    query.status = status;
  }

  try {
    const conversations = await Conversation.find(query)
      .populate("customer agent")
      .sort({ last_message_at: -1 })
      .skip(parseInt(skip))
      .limit(parseInt(limit));
    res.json(conversations);
  } catch (error) {
    console.error("Error fetching agent conversations:", error);
    res.status(500).json({ detail: "Failed to fetch conversations." });
  }
});

apiRouter.use("/auth", authRouter);
apiRouter.use("/conversations", conversationsRouter);
apiRouter.use("/admin", adminRouter);
apiRouter.use("/files", filesRouter);
apiRouter.use("/agent", agentRouter);

app.use(settings.API_V1_STR, apiRouter);

app.get("/", (req, res) => {
  res.json({
    message: `Welcome to ${settings.PROJECT_NAME}! API V1 at ${settings.API_V1_STR}. WebSocket at /ws`,
  });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send({ detail: "Something went wrong!" });
});

async function startServer() {
  try {
    await mongoose.connect(settings.DATABASE_URL);
    console.log("Database connection has been established successfully.");

    await loadSummarizationModelOnStartup();

    httpServer.listen(settings.PORT, () => {
      console.log(
        `${settings.PROJECT_NAME} is running on http://localhost:${settings.PORT}`
      );
    });
  } catch (error) {
    console.error("Unable to start the server:", error);
    process.exit(1);
  }
}

startServer();
