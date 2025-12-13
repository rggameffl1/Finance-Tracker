// {{CODE-Cycle-Integration:
//   Task_ID: #T002
//   Timestamp: 2025-12-08T05:03:09Z
//   Phase: D-Develop
//   Context-Analysis: "数据库连接模块，供所有路由共享使用"
//   Principle_Applied: "DRY, Single Responsibility"
// }}
// {{START_MODIFICATIONS}}

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// 数据库文件路径 - 使用环境变量或默认路径
// Docker 环境使用 /app/data 目录（独立于代码目录）
// 本地开发使用 database/ 目录
const dataDir = process.env.DATA_DIR || path.join(__dirname);
const dbPath = path.join(dataDir, 'finance.db');

// 确保数据目录存在
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// 创建数据库连接（单例模式）
const db = new Database(dbPath);

// 启用外键约束
db.pragma('foreign_keys = ON');

// 导出数据库路径供其他模块使用
db.dbPath = dbPath;

module.exports = db;

// {{END_MODIFICATIONS}}