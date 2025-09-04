# Torrent-list

一个基于 Express.js 的磁力种子存储站。

## 官方网站: [那我问你](https://wap-ac.ybmq.dpdns.org/)
注：亲爱的四川移动，河北移动，重庆移动网友，你们本地的运营商似乎屏蔽了我的域名😡😡😡

## 功能特性

- 用户系统
  - 支持用户注册和登录
  - 管理员权限控制
  - 默认管理员账号/密码: admin/Zako114514
- 文件管理
  - 支持上传 .torrent 文件
  - 自动解析种子文件信息
  - 显示文件大小、InfoHash、创建时间等元数据
  - 支持文件删除（用户只能删除自己的文件，管理员可删除所有文件）
- 安全性
  - 用户密码加密存储
  - Cookie 登录认证
  - 上传文件类型限制

## 技术栈

- Backend: Express.js
- 文件处理: Multer
- 密码加密: bcryptjs
- 种子解析: parse-torrent
- 文件大小格式化: pretty-bytes

## 安装与运行

1. 克隆仓库
```bash
git clone [仓库地址]
```

2. 安装依赖
```bash
npm install
```

3. 运行服务器
```bash
node server.js
```

服务器将在 http://localhost:3000 启动

## API 接口

### 用户相关
- POST `/register` - 用户注册
- POST `/login` - 用户登录
- POST `/logout` - 用户登出

### 文件相关
- POST `/upload` - 上传文件
- GET `/files` - 获取文件列表
- GET `/file/:savedName` - 获取单个文件详情
- POST `/delete` - 删除文件

## 存储结构

- `users.json` - 用户数据
- `files.json` - 文件元数据
- `uploads/` - 文件存储目录

## 注意事项

- 仅支持 .torrent 文件上传
- 首次运行会自动创建必要的文件和目录
- 默认管理员账号请及时修改密码
