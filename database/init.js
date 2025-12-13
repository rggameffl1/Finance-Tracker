// {{CODE-Cycle-Integration:
//   Task_ID: #T002
//   Timestamp: 2025-12-08T05:02:33Z
//   Phase: D-Develop
//   Context-Analysis: "创建SQLite数据库schema，包含platforms、transactions、exchange_rates、settings四张表"
//   Principle_Applied: "KISS, DRY, High Cohesion"
// }}
// {{START_MODIFICATIONS}}

const Database = require('better-sqlite3');
const path = require('path');

// 数据库文件路径
const dbPath = path.join(__dirname, 'finance.db');

// 创建数据库连接
const db = new Database(dbPath);

// 启用外键约束
db.pragma('foreign_keys = ON');

console.log('正在初始化数据库...');

// 创建平台表
db.exec(`
  CREATE TABLE IF NOT EXISTS platforms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    currency TEXT NOT NULL CHECK(currency IN ('CNY', 'HKD', 'USD')),
    initial_capital REAL NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);
console.log('✓ platforms 表创建成功');

// 创建交易记录表（使用TEXT存储高精度小数）
db.exec(`
  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    platform_id INTEGER NOT NULL,
    asset_name TEXT NOT NULL,
    asset_code TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('合约', '现货', '事件')),
    direction TEXT NOT NULL CHECK(direction IN ('开多', '开空')),
    leverage TEXT NOT NULL DEFAULT '1',
    quantity TEXT,
    open_price TEXT,
    close_price TEXT,
    investment TEXT,
    open_time TEXT NOT NULL,
    close_time TEXT,
    total_profit TEXT NOT NULL DEFAULT '0',
    total_fee TEXT NOT NULL DEFAULT '0',
    reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (platform_id) REFERENCES platforms(id) ON DELETE CASCADE
  )
`);
console.log('✓ transactions 表创建成功');

// 创建索引以优化查询性能
console.log('正在创建索引...');

// 1. 平台ID索引 - 优化按平台筛选
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_transactions_platform_id
  ON transactions(platform_id)
`);
console.log('✓ idx_transactions_platform_id 索引创建成功');

// 2. 开仓时间索引 - 优化按时间排序和范围查询
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_transactions_open_time
  ON transactions(open_time DESC)
`);
console.log('✓ idx_transactions_open_time 索引创建成功');

// 3. 复合索引 - 优化同时按平台筛选和时间排序（最常用的查询模式）
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_transactions_platform_time
  ON transactions(platform_id, open_time DESC)
`);
console.log('✓ idx_transactions_platform_time 复合索引创建成功');

// 4. 资产代码索引 - 优化按资产搜索
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_transactions_asset_code
  ON transactions(asset_code)
`);
console.log('✓ idx_transactions_asset_code 索引创建成功');

// 5. 平仓时间索引 - 优化按平仓时间查询（用于归档等场景）
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_transactions_close_time
  ON transactions(close_time)
`);
console.log('✓ idx_transactions_close_time 索引创建成功');

// 创建汇率表
db.exec(`
  CREATE TABLE IF NOT EXISTS exchange_rates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_currency TEXT NOT NULL,
    to_currency TEXT NOT NULL,
    rate REAL NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(from_currency, to_currency)
  )
`);
console.log('✓ exchange_rates 表创建成功');

// 创建设置表
db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT NOT NULL UNIQUE,
    value TEXT NOT NULL
  )
`);
console.log('✓ settings 表创建成功');

// 插入默认平台数据
const insertPlatform = db.prepare(`
  INSERT OR IGNORE INTO platforms (name, currency, initial_capital) VALUES (?, ?, ?)
`);

const defaultPlatforms = [
  ['A股', 'CNY', 0],
  ['港股', 'HKD', 0],
  ['美股', 'USD', 0],
  ['虚拟币', 'USD', 0]
];

const insertPlatforms = db.transaction((platforms) => {
  for (const platform of platforms) {
    insertPlatform.run(...platform);
  }
});

insertPlatforms(defaultPlatforms);
console.log('✓ 默认平台数据插入成功');

// 插入默认汇率数据
const insertRate = db.prepare(`
  INSERT OR REPLACE INTO exchange_rates (from_currency, to_currency, rate, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)
`);

const defaultRates = [
  ['CNY', 'CNY', 1],
  ['CNY', 'HKD', 1.09],
  ['CNY', 'USD', 0.14],
  ['HKD', 'CNY', 0.92],
  ['HKD', 'HKD', 1],
  ['HKD', 'USD', 0.13],
  ['USD', 'CNY', 7.24],
  ['USD', 'HKD', 7.80],
  ['USD', 'USD', 1]
];

const insertRates = db.transaction((rates) => {
  for (const rate of rates) {
    insertRate.run(...rate);
  }
});

insertRates(defaultRates);
console.log('✓ 默认汇率数据插入成功');

// 插入默认设置
const insertSetting = db.prepare(`
  INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)
`);

const defaultSettings = [
  ['exchange_rate_update_interval', '3600000'], // 默认1小时更新一次（毫秒）
  ['display_currency', 'CNY'] // 默认显示币种
];

const insertSettings = db.transaction((settings) => {
  for (const setting of settings) {
    insertSetting.run(...setting);
  }
});

insertSettings(defaultSettings);
console.log('✓ 默认设置插入成功');

// 创建更新时间触发器
db.exec(`
  CREATE TRIGGER IF NOT EXISTS update_platforms_timestamp 
  AFTER UPDATE ON platforms
  BEGIN
    UPDATE platforms SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
  END
`);

db.exec(`
  CREATE TRIGGER IF NOT EXISTS update_transactions_timestamp 
  AFTER UPDATE ON transactions
  BEGIN
    UPDATE transactions SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
  END
`);
console.log('✓ 更新时间触发器创建成功');

// 关闭数据库连接
db.close();

console.log('\n数据库初始化完成！');
console.log(`数据库文件位置: ${dbPath}`);

// {{END_MODIFICATIONS}}