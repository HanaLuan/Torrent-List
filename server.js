import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import bcrypt from "bcryptjs";
import bodyParser from "body-parser";
import cookieParser from "cookie-parser";

import parseTorrent from "parse-torrent";
import prettyBytes from "pretty-bytes";

const app = express();
const PORT = 3000;

// 创建 uploads 文件夹
if (!fs.existsSync("uploads")) fs.mkdirSync("uploads");

// ===== JSON 读写工具 =====
function readJSON(filePath, defaultData) {
    if (!fs.existsSync(filePath)) return defaultData;
    try {
        const content = fs.readFileSync(filePath, "utf8").trim();
        return content ? JSON.parse(content) : defaultData;
    } catch (e) {
        console.error(`解析 ${filePath} 失败:`, e);
        return defaultData;
    }
}

// 初始化 users.json
let users = readJSON("users.json", []);
if (users.length === 0) {
    users = [{ username: "admin", password: bcrypt.hashSync("Zako114514", 10), role: "admin" }];
    fs.writeFileSync("users.json", JSON.stringify(users, null, 2));
}

// 初始化 files.json
let files = readJSON("files.json", []);
if (files.length === 0) {
    fs.writeFileSync("files.json", JSON.stringify([], null, 2));
}

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
    }
});

// ===== 用户接口 =====
// 注册
app.post("/register", (req, res) => {
    const { username, password } = req.body;
    let users = readJSON("users.json", []);
    if (users.find(u => u.username === username)) return res.json({ success: false, message: "用户名已存在" });
    users.push({ username, password: bcrypt.hashSync(password, 10), role: "user" });
    fs.writeFileSync("users.json", JSON.stringify(users, null, 2));
    res.json({ success: true });
});

// 登录
app.post("/login", (req, res) => {
    const { username, password } = req.body;
    const users = readJSON("users.json", []);
    const user = users.find(u => u.username === username);
    if (!user) return res.json({ success: false, message: "用户不存在" });
    if (!bcrypt.compareSync(password, user.password)) return res.json({ success: false, message: "密码错误" });

    res.cookie("username", username, { maxAge: 24 * 60 * 60 * 1000 });
    res.cookie("role", user.role, { maxAge: 24 * 60 * 60 * 1000 });
    res.json({ success: true, username, role: user.role });
});

// 登出
app.post("/logout", (req, res) => {
    res.clearCookie("username");
    res.clearCookie("role");
    res.json({ success: true });
});

// ===== 文件上传 =====
app.post("/upload", upload.single("arquivo"), async (req, res) => {
    const username = req.cookies.username;
    if (!username) return res.status(403).json({ success: false, message: "请先登录" });

    const original = Buffer.from(req.file.originalname, "latin1").toString("utf8");
    const { name, ext } = path.parse(original);
    const savedName = `${name}-${Date.now()}${ext}`;
    const savedPath = path.join("uploads", savedName);
    fs.renameSync(req.file.path, savedPath);

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

    let fileList = readJSON("files.json", []);
    fileList.push({
        savedName,
        originalName: original,
        uploader: username,
        uploadTime: new Date().toISOString(),
        torrentMeta
    });
    fs.writeFileSync("files.json", JSON.stringify(fileList, null, 2));

    res.json({ success: true, file: { savedName, originalName: original, uploader: username, torrentMeta } });
});

// ===== 获取文件列表 =====
app.get("/files", (req, res) => {
    let files = readJSON("files.json", []);
    files = files.filter(f => fs.existsSync(`uploads/${f.savedName}`));
    fs.writeFileSync("files.json", JSON.stringify(files, null, 2));
    res.json(files);
});

// ===== 获取单个文件详情 =====
app.get("/file/:savedName", (req, res) => {
    const savedName = req.params.savedName;
    const files = readJSON("files.json", []);
    const file = files.find(f => f.savedName === savedName);
    if (!file) return res.status(404).json({ success: false, message: "文件不存在" });
    res.json({ success: true, file });
});

// ===== 删除文件 =====
app.post("/delete", (req, res) => {
    const { savedName } = req.body;
    const username = req.cookies.username;
    const role = req.cookies.role;
    if (!username) return res.status(403).json({ success: false, message: "请先登录" });

    let files = readJSON("files.json", []);
    const index = files.findIndex(f => f.savedName === savedName);
    if (index === -1) return res.json({ success: false, message: "文件不存在" });

    if (files[index].uploader !== username && role !== "admin") return res.json({ success: false, message: "无权限删除此文件" });

    fs.unlinkSync(`uploads/${savedName}`);
    files.splice(index, 1);
    fs.writeFileSync("files.json", JSON.stringify(files, null, 2));
    res.json({ success: true });
});

app.listen(PORT, () => console.log(`服务器已启动: http://localhost:${PORT}`));
