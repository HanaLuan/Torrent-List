import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import bcrypt from "bcryptjs";
import bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import { Pool } from "pg";
import dotenv from "dotenv";

import parseTorrent from "parse-torrent";
import prettyBytes from "pretty-bytes";

// 引入管理员路由模块
import adminRouter from "./routes/admin.js";

// 加载环境变量（优先使用.env文件配置）
dotenv.config();

const app = express();
const PORT = 3000;

// 创建uploads文件夹（若不存在）
if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
}

// ===== PostgreSQL连接配置 =====
const pool = new Pool({
  user: process.env.DB_USER || "postgres",
  host: process.env.DB_HOST || "localhost",
  database: process.env.DB_NAME || "torrent_db",
  password: process.env.DB_PASSWORD || "123456",
  port: process.env.DB_PORT || 5432,
});

// ===== 中间件配置 =====
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static("public")); // 静态文件目录（前端页面）
app.use("/uploads", express.static("uploads")); // 暴露上传文件目录

// 日志中间件（记录请求信息）
app.use((req, res, next) => {
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
  const userAgent = req.headers["user-agent"] || "unknown";
  const timestamp = new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" });
  const { method, url } = req;
  console.log(`[${timestamp}] ${method} ${url} from ${ip} using ${userAgent}`);
  next();
});

// ===== Multer配置（文件上传）=====
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});
const allowedExtensions = [".torrent"];
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExtensions.includes(ext)) cb(null, true);
    else cb(new Error(`不允许的文件类型: ${ext}`));
  },
  limits: { fileSize: 50 * 1024 * 1024 }, // 限制50MB
});

// ===== 挂载管理员路由 =====
app.use("/admin", adminRouter);

// ===== 用户相关接口 =====
// 注册
app.post("/register", async (req, res) => {
  const { username, password } = req.body;
  try {
    // 检查用户名是否已存在
    const userRes = await pool.query(
      "SELECT * FROM users WHERE username = $1",
      [username]
    );
    if (userRes.rows.length > 0) {
      return res.json({ success: false, message: "用户名已存在" });
    }
    // 加密密码并创建用户
    const hashedPwd = bcrypt.hashSync(password, 10);
    await pool.query(
      "INSERT INTO users (username, password, role) VALUES ($1, $2, $3)",
      [username, hashedPwd, "user"]
    );
    res.json({ success: true });
  } catch (err) {
    console.error("注册失败:", err);
    res.status(500).json({ success: false, message: "服务器错误" });
  }
});

// 登录
app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    // 查询用户
    const userRes = await pool.query(
      "SELECT * FROM users WHERE username = $1",
      [username]
    );
    if (userRes.rows.length === 0) {
      return res.json({ success: false, message: "用户不存在" });
    }
    const user = userRes.rows[0];
    // 验证密码
    if (!bcrypt.compareSync(password, user.password)) {
      return res.json({ success: false, message: "密码错误" });
    }
    // 设置登录Cookie（有效期24小时）
    res.cookie("username", username, { maxAge: 24 * 60 * 60 * 1000 });
    res.cookie("role", user.role, { maxAge: 24 * 60 * 60 * 1000 });
    res.json({ success: true, username, role: user.role });
  } catch (err) {
    console.error("登录失败:", err);
    res.status(500).json({ success: false, message: "服务器错误" });
  }
});

// 登出
app.post("/logout", (req, res) => {
  res.clearCookie("username");
  res.clearCookie("role");
  res.json({ success: true });
});

// ===== 文件相关接口 =====
// 上传文件
app.post("/upload", upload.single("arquivo"), async (req, res, next) => {
  const username = req.cookies.username;
  if (!username) {
    return res.status(403).json({ success: false, message: "请先登录" });
  }

  try {
    // 处理原始文件名（解决中文乱码）
    const originalName = Buffer.from(req.file.originalname, "latin1").toString("utf8");
    const savedName = req.file.filename; // 使用multer生成的文件名
    const ext = path.extname(req.file.originalname).toLowerCase();

    // 解析torrent元数据
    let torrentMeta = {};
    if (ext === ".torrent") {
      try {
        const buf = fs.readFileSync(`uploads/${savedName}`);
        const parsed = parseTorrent(buf);
        const filesArr = (parsed.files || []).map(f => ({
          path: f.path,
          length: f.length,
          prettySize: prettyBytes(f.length)
        }));
        const totalLength = parsed.length || filesArr.reduce((a, b) => a + b.length, 0);
        torrentMeta = {
          infoHash: parsed.infoHash || "未知",
          name: parsed.name || "未知",
          created: parsed.created ? new Date(parsed.created).toISOString() : "未知",
          announce: parsed.announce || [],
          files: filesArr,
          length: totalLength,
          prettyTotalSize: prettyBytes(totalLength)
        };
      } catch (e) {
        console.error("种子解析失败:", e);
        torrentMeta = { error: "解析失败" };
      }
    }

    // 插入文件记录到数据库
    await pool.query(
      `INSERT INTO files 
       (saved_name, original_name, uploader, upload_time, torrent_meta) 
       VALUES ($1, $2, $3, $4, $5)`,
      [savedName, originalName, username, new Date(), torrentMeta]
    );

    res.json({ 
      success: true, 
      file: { savedName, originalName, uploader: username, torrentMeta } 
    });
  } catch (err) {
    console.error("文件上传失败:", err);
    res.status(500).json({ success: false, message: "服务器错误：" + err.message });
  }
}, (err, req, res, next) => {
  // Multer错误处理（文件大小/类型错误）
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({ success: false, message: "文件大小过大（>50MB）上传失败" });
    } else {
      return res.status(400).json({ success: false, message: "上传错误：" + err.message });
    }
  } else if (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
  next();
});

// 获取文件列表
app.get("/files", async (req, res) => {
  try {
    // 查询所有文件，过滤本地已删除的文件
    const filesRes = await pool.query("SELECT * FROM files ORDER BY upload_time DESC");
    const files = filesRes.rows.filter(f => 
      fs.existsSync(`uploads/${f.saved_name}`)
    );
    // 转换字段为驼峰命名（适配前端）
    const formattedFiles = files.map(f => ({
      savedName: f.saved_name,
      originalName: f.original_name,
      uploader: f.uploader,
      uploadTime: f.upload_time,
      torrentMeta: f.torrent_meta
    }));
    res.json(formattedFiles);
  } catch (err) {
    console.error("获取文件列表失败:", err);
    res.json([]);
  }
});

// 获取单个文件详情
app.get("/file/:savedName", async (req, res) => {
  const savedName = req.params.savedName;
  try {
    const fileRes = await pool.query(
      "SELECT * FROM files WHERE saved_name = $1",
      [savedName]
    );
    if (fileRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: "文件不存在" });
    }
    const file = fileRes.rows[0];
    res.json({
      success: true,
      file: {
        savedName: file.saved_name,
        originalName: file.original_name,
        uploader: file.uploader,
        uploadTime: file.upload_time,
        torrentMeta: file.torrent_meta
      }
    });
  } catch (err) {
    console.error("获取文件详情失败:", err);
    res.status(500).json({ success: false, message: "服务器错误" });
  }
});

// 删除文件
app.post("/delete", async (req, res) => {
  const { savedName } = req.body;
  const username = req.cookies.username;
  const role = req.cookies.role;

  if (!username) {
    return res.status(403).json({ success: false, message: "请先登录" });
  }

  try {
    // 查询文件信息
    const fileRes = await pool.query(
      "SELECT * FROM files WHERE saved_name = $1",
      [savedName]
    );
    if (fileRes.rows.length === 0) {
      return res.json({ success: false, message: "文件不存在" });
    }
    const file = fileRes.rows[0];

    // 权限校验（上传者或管理员）
    if (file.uploader !== username && role !== "admin") {
      return res.json({ success: false, message: "无权限删除此文件" });
    }

    // 删除本地文件和数据库记录
    fs.unlinkSync(`uploads/${savedName}`);
    await pool.query("DELETE FROM files WHERE saved_name = $1", [savedName]);
    res.json({ success: true });
  } catch (err) {
    console.error("删除文件失败:", err);
    res.status(500).json({ success: false, message: "服务器错误" });
  }
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`服务器已启动: http://localhost:${PORT}`);
});
