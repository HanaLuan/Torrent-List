import { Pool } from "pg";
import dotenv from "dotenv";
import fs from "fs";

// 加载环境变量
dotenv.config();

// PostgreSQL 连接配置（与 server.js 一致）
const pool = new Pool({
  user: process.env.DB_USER || "postgres",
  host: process.env.DB_HOST || "localhost",
  database: process.env.DB_NAME || "torrent_db",
  password: process.env.DB_PASSWORD || "123456",
  port: process.env.DB_PORT || 5432,
});

// 数据库初始化函数
async function initDB() {
  let client;
  try {
    // 连接数据库
    client = await pool.connect();
    console.log("✅ 数据库连接成功");

    // 1. 创建 users 表
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        username VARCHAR(50) PRIMARY KEY,
        password VARCHAR(100) NOT NULL,
        role VARCHAR(20) NOT NULL DEFAULT 'user'
      );
    `);
    console.log("✅ users 表初始化完成（已存在则跳过）");

    // 2. 创建 files 表
    await client.query(`
      CREATE TABLE IF NOT EXISTS files (
        saved_name VARCHAR(255) PRIMARY KEY,
        original_name VARCHAR(255) NOT NULL,
        uploader VARCHAR(50) NOT NULL,
        upload_time TIMESTAMP NOT NULL,
        torrent_meta JSONB,
        FOREIGN KEY (uploader) REFERENCES users(username)
      );
    `);
    console.log("✅ files 表初始化完成（已存在则跳过）");

    // 3. 创建默认管理员（不存在则创建）
    const adminRes = await client.query(
      "SELECT * FROM users WHERE username = 'admin'"
    );
    if (adminRes.rows.length === 0) {
      const bcrypt = await import("bcryptjs"); // 动态导入（避免依赖提前加载）
      const hashedPwd = bcrypt.hashSync("Zako114514", 10);
      await client.query(
        "INSERT INTO users (username, password, role) VALUES ($1, $2, $3)",
        ["admin", hashedPwd, "admin"]
      );
      console.log("✅ 默认管理员创建成功（admin/Zako114514）");
    } else {
      console.log("✅ 管理员账号已存在（无需重复创建）");
    }

    console.log("\n🎉 数据库初始化全部完成！");
  } catch (err) {
    console.error("❌ 数据库初始化失败：", err.message);
    process.exit(1); // 初始化失败退出进程
  } finally {
    // 释放数据库连接
    if (client) client.release();
    await pool.end(); // 关闭连接池
  }
}

// 执行初始化
initDB();
