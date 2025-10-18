// routes/admin.js
import express from "express";
import { Pool } from "pg";
import bcrypt from "bcryptjs";
import fs from "fs";
import dotenv from "dotenv";

// 加载环境变量
dotenv.config();

// 创建路由实例
const router = express.Router();

// 数据库连接（与 server.js 共享配置）
const pool = new Pool({
  user: process.env.DB_USER || "postgres",
  host: process.env.DB_HOST || "localhost",
  database: process.env.DB_NAME || "torrent_db",
  password: process.env.DB_PASSWORD || "123456",
  port: process.env.DB_PORT || 5432,
});

// 权限中间件：验证是否为管理员（抽离重复逻辑）
const isAdmin = (req, res, next) => {
  const role = req.cookies.role;
  if (role !== "admin") {
    return res.status(403).json({ success: false, message: "无管理员权限" });
  }
  next();
};

// 1. 获取系统概览数据
router.get("/dashboard", isAdmin, async (req, res) => {
  try {
    const userCount = await pool.query("SELECT COUNT(*) FROM users");
    const fileCount = await pool.query("SELECT COUNT(*) FROM files");
    const sizeRes = await pool.query("SELECT torrent_meta->>'length' AS length FROM files");
    const totalSize = sizeRes.rows.reduce((total, item) => total + (parseInt(item.length) || 0), 0);

    res.json({
      success: true,
      data: {
        userCount: parseInt(userCount.rows[0].count),
        fileCount: parseInt(fileCount.rows[0].count),
        totalSize: totalSize
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "数据获取失败" });
  }
});

// 2. 获取所有用户列表
router.get("/users", isAdmin, async (req, res) => {
  try {
    const resUsers = await pool.query("SELECT username, role FROM users ORDER BY username");
    res.json({ success: true, users: resUsers.rows });
  } catch (err) {
    console.error("获取用户列表失败:", err);
    res.status(500).json({ success: false, message: "获取用户列表失败" });
  }
});

// 3. 管理员修改自身密码
router.post("/change-pwd", isAdmin, async (req, res) => {
  const { oldPwd, newPwd } = req.body;
  try {
    const userRes = await pool.query("SELECT * FROM users WHERE username = $1", ["admin"]);
    const admin = userRes.rows[0];
    if (!admin) return res.json({ success: false, message: "管理员账号不存在" });
    if (!bcrypt.compareSync(oldPwd, admin.password)) {
      return res.json({ success: false, message: "旧密码错误" });
    }
    const newHashedPwd = bcrypt.hashSync(newPwd, 10);
    await pool.query("UPDATE users SET password = $1 WHERE username = $2", [newHashedPwd, "admin"]);
    res.json({ success: true, message: "密码修改成功！请重新登录" });
  } catch (err) {
    console.error("管理员密码修改失败:", err);
    res.status(500).json({ success: false, message: "服务器错误" });
  }
});

// 4. 管理员修改指定用户密码
router.post("/change-user-pwd", isAdmin, async (req, res) => {
  const { username, newPwd } = req.body;
  if (!username || !newPwd) {
    return res.status(400).json({ success: false, message: "用户名和新密码不能为空" });
  }
  try {
    const userRes = await pool.query("SELECT * FROM users WHERE username = $1", [username]);
    if (userRes.rows.length === 0) return res.json({ success: false, message: "目标用户不存在" });
    const newHashedPwd = bcrypt.hashSync(newPwd, 10);
    await pool.query("UPDATE users SET password = $1 WHERE username = $2", [newHashedPwd, username]);
    res.json({ success: true, message: `用户【${username}】密码修改成功！` });
  } catch (err) {
    console.error("修改用户密码失败:", err);
    res.status(500).json({ success: false, message: "服务器错误" });
  }
});

// 5. 管理员新增用户
router.post("/user/add", isAdmin, async (req, res) => {
  const { username, password, role } = req.body;
  if (!username || !password || !["user", "admin"].includes(role)) {
    return res.status(400).json({ 
      success: false, 
      message: "参数错误：用户名/密码不能为空，角色只能是user/admin" 
    });
  }
  try {
    const userRes = await pool.query("SELECT * FROM users WHERE username = $1", [username]);
    if (userRes.rows.length > 0) return res.json({ success: false, message: "用户名已存在" });
    const hashedPwd = bcrypt.hashSync(password, 10);
    await pool.query("INSERT INTO users (username, password, role) VALUES ($1, $2, $3)", [username, hashedPwd, role]);
    res.json({ success: true, message: `用户【${username}】创建成功！` });
  } catch (err) {
    console.error("新增用户失败:", err);
    res.status(500).json({ success: false, message: "服务器错误" });
  }
});

// 6. 管理员删除用户
router.post("/user/delete", isAdmin, async (req, res) => {
  const { username } = req.body;
  if (username === "admin") {
    return res.json({ success: false, message: "禁止删除管理员账号！" });
  }
  try {
    const userRes = await pool.query("SELECT * FROM users WHERE username = $1", [username]);
    if (userRes.rows.length === 0) return res.json({ success: false, message: "目标用户不存在" });
    // 删除用户上传的文件
    const filesRes = await pool.query("SELECT saved_name FROM files WHERE uploader = $1", [username]);
    filesRes.rows.forEach(file => {
      const filePath = `uploads/${file.saved_name}`;
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    });
    await pool.query("DELETE FROM files WHERE uploader = $1", [username]);
    await pool.query("DELETE FROM users WHERE username = $1", [username]);
    res.json({ success: true, message: `用户【${username}】及关联文件已删除！` });
  } catch (err) {
    console.error("删除用户失败:", err);
    res.status(500).json({ success: false, message: "服务器错误" });
  }
});

// 7. 管理员修改用户角色
router.post("/user/change-role", isAdmin, async (req, res) => {
  const { username, newRole } = req.body;
  if (!username || !["user", "admin"].includes(newRole)) {
    return res.status(400).json({ 
      success: false, 
      message: "参数错误：用户名不能为空，角色只能是user/admin" 
    });
  }
  if (username === "admin" && newRole === "user") {
    return res.json({ success: false, message: "禁止将管理员角色降级为普通用户！" });
  }
  try {
    const userRes = await pool.query("SELECT * FROM users WHERE username = $1", [username]);
    if (userRes.rows.length === 0) return res.json({ success: false, message: "目标用户不存在" });
    await pool.query("UPDATE users SET role = $1 WHERE username = $2", [newRole, username]);
    res.json({
      success: true,
      message: `用户【${username}】角色已修改为【${newRole === "admin" ? "管理员" : "普通用户"}】！`
    });
  } catch (err) {
    console.error("修改用户角色失败:", err);
    res.status(500).json({ success: false, message: "服务器错误" });
  }
});

// 导出路由
export default router;
