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

// 数据库文件路径
const dbPath = path.join(__dirname, 'finance.db');

// 创建数据库连接（单例模式）
const db = new Database(dbPath);

// 启用外键约束
db.pragma('foreign_keys = ON');

module.exports = db;

// {{END_MODIFICATIONS}}