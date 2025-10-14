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

// 加载环境变量（需创建.env文件）
dotenv.config();

const app = express();
const PORT = 3000;

// 创建 uploads 文件夹
if (!fs.existsSync("uploads")) fs.mkdirSync("uploads");

// ===== PostgreSQL连接配置 =====
const pool = new Pool({
  user: process.env.DB_USER || "postgres",    // 数据库用户名
  host: process.env.DB_HOST || "localhost",   // 数据库地址
  database: process.env.DB_NAME || "torrent_db",  // 数据库名
  password: process.env.DB_PASSWORD || "123456",  // 数据库密码
  port: process.env.DB_PORT || 5432,          // 端口（默认5432）
});

// 初始化数据库（创建表和默认管理员）
async function initDB() {
  try {
    // 创建表（如果不存在）
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        username VARCHAR(50) PRIMARY KEY,
        password VARCHAR(100) NOT NULL,
        role VARCHAR(20) NOT NULL DEFAULT 'user'
      );
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS files (
        saved_name VARCHAR(100) PRIMARY KEY,
        original_name VARCHAR(255) NOT NULL,
        uploader VARCHAR(50) NOT NULL,
        upload_time TIMESTAMP NOT NULL,
        torrent_meta JSONB,
        FOREIGN KEY (uploader) REFERENCES users(username)
      );
    `);

    // 检查是否有默认管理员，没有则创建
    const adminRes = await pool.query(
      "SELECT * FROM users WHERE username = 'admin'"
    );
    if (adminRes.rows.length === 0) {
      const hashedPwd = bcrypt.hashSync("Zako114514", 10);
      await pool.query(
        "INSERT INTO users (username, password, role) VALUES ($1, $2, $3)",
        ["admin", hashedPwd, "admin"]
      );
      console.log("默认管理员创建成功");
    }
    console.log("数据库初始化完成");
  } catch (err) {
    console.error("数据库初始化失败:", err);
  }
}
initDB();  // 启动时初始化


// ===== 中间件 =====
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static("public"));
app.use("/uploads", express.static("uploads"));

// ===== 日志中间件 =====
app.use((req, res, next) => {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const userAgent = req.headers['user-agent'] || 'unknown';
  const timestamp = new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" });
  const { method, url } = req;
  console.log(`[${timestamp}] ${method} ${url} from ${ip} using ${userAgent}`);
  next();
});

// ===== Multer 配置 =====
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const allowedExtensions = [".torrent"];
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExtensions.includes(ext)) cb(null, true);
    else cb(new Error(`不允许的文件类型: ${ext}`));
  },
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});


// ===== 用户接口（替换为PostgreSQL操作）=====
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
    // 插入新用户
    const hashedPwd = bcrypt.hashSync(password, 10);
    await pool.query(
      "INSERT INTO users (username, password, role) VALUES ($1, $2, $3)",
      [username, hashedPwd, "user"]
    );
    res.json({ success: true });
  } catch (err) {
    console.error("注册失败:", err);
    res.json({ success: false, message: "服务器错误" });
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
    // 设置cookie
    res.cookie("username", username, { maxAge: 24 * 60 * 60 * 1000 });
    res.cookie("role", user.role, { maxAge: 24 * 60 * 60 * 1000 });
    res.json({ success: true, username, role: user.role });
  } catch (err) {
    console.error("登录失败:", err);
    res.json({ success: false, message: "服务器错误" });
  }
});

// 登出
app.post("/logout", (req, res) => {
  res.clearCookie("username");
  res.clearCookie("role");
  res.json({ success: true });
});


// ===== 文件接口（替换为PostgreSQL操作）=====
// 上传文件
app.post("/upload", upload.single("arquivo"), async (req, res) => {
  const username = req.cookies.username;
  if (!username) return res.status(403).json({ success: false, message: "请先登录" });

  try {
    // 处理文件名编码
    const original = Buffer.from(req.file.originalname, "latin1").toString("utf8");
    const { name, ext } = path.parse(original);
    const savedName = `${name}-${Date.now()}${ext}`;
    const savedPath = path.join("uploads", savedName);
    fs.renameSync(req.file.path, savedPath);

    // 解析torrent元数据
    let torrentMeta = {};
    if (ext.toLowerCase() === ".torrent") {
      try {
        const buf = fs.readFileSync(savedPath);
        const parsed = parseTorrent(buf);
        const filesArr = (parsed.files || []).map(f => ({
          path: f.path,
          length: f.length,
          prettySize: prettyBytes(f.length)
        }));
        const totalLength = parsed.length || filesArr.reduce((a,b)=>a+b.length,0);
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
      [savedName, original, username, new Date(), torrentMeta]
    );

    res.json({ success: true, file: { savedName, originalName: original, uploader: username, torrentMeta } });
  } catch (err) {
    console.error("文件上传失败:", err);
    res.json({ success: false, message: "服务器错误" });
  }
});

// ===== 获取文件列表 =====
app.get("/files", async (req, res) => {
  try {
    // 查询所有文件，并过滤本地已删除的文件
    const filesRes = await pool.query("SELECT * FROM files ORDER BY upload_time DESC");
    const files = filesRes.rows.filter(f => 
      fs.existsSync(`uploads/${f.saved_name}`)
    );
    // 转换字段名（数据库用下划线，前端用驼峰）
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

// ===== 获取单个文件详情 =====
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
    // 转换字段名
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
  if (!username) return res.status(403).json({ success: false, message: "请先登录" });

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
    await pool.query(
      "DELETE FROM files WHERE saved_name = $1",
      [savedName]
    );
    res.json({ success: true });
  } catch (err) {
    console.error("删除文件失败:", err);
    res.json({ success: false, message: "服务器错误" });
  }
});


app.listen(PORT, () => console.log(`服务器已启动: http://localhost:${PORT}`));
