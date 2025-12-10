// {{CODE-Cycle-Integration:
//   Task_ID: #T015-T019
//   Timestamp: 2025-12-09T04:41:00Z
//   Phase: D-Develop
//   Context-Analysis: "数据库迁移脚本 - 修复表结构，确保所有列允许NULL"
//   Principle_Applied: "KISS, Safe Migration"
// }}
// {{START_MODIFICATIONS}}

const Database = require('better-sqlite3');
const path = require('path');

// 数据库文件路径
const dbPath = path.join(__dirname, 'finance.db');

// 创建数据库连接
const db = new Database(dbPath);

console.log('正在执行数据库迁移...');

// 检查并添加新列的辅助函数
function addColumnIfNotExists(tableName, columnName, columnDef) {
  try {
    // 检查列是否存在
    const tableInfo = db.prepare(`PRAGMA table_info(${tableName})`).all();
    const columnExists = tableInfo.some(col => col.name === columnName);
    
    if (!columnExists) {
      db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDef}`);
      console.log(`✓ 添加列 ${tableName}.${columnName} 成功`);
    } else {
      console.log(`- 列 ${tableName}.${columnName} 已存在，跳过`);
    }
  } catch (error) {
    console.error(`✗ 添加列 ${tableName}.${columnName} 失败:`, error.message);
  }
}

// 检查表是否需要重建（修复NOT NULL约束问题）
function checkAndRebuildTransactionsTable() {
  try {
    const tableInfo = db.prepare(`PRAGMA table_info(transactions)`).all();
    
    // 检查是否有需要修复的列（quantity, open_price, close_price, investment 应该允许NULL）
    const columnsToCheck = ['quantity', 'open_price', 'close_price', 'investment'];
    let needsRebuild = false;
    
    for (const col of tableInfo) {
      if (columnsToCheck.includes(col.name) && col.notnull === 1) {
        console.log(`发现列 ${col.name} 有NOT NULL约束，需要修复`);
        needsRebuild = true;
      }
    }
    
    if (needsRebuild) {
      console.log('\n正在重建 transactions 表以修复约束问题...');
      
      // 开始事务
      db.exec('BEGIN TRANSACTION');
      
      try {
        // 1. 创建新表
        db.exec(`
          CREATE TABLE IF NOT EXISTS transactions_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            platform_id INTEGER NOT NULL,
            asset_name TEXT NOT NULL,
            asset_code TEXT NOT NULL,
            type TEXT NOT NULL CHECK(type IN ('合约', '现货')),
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
        
        // 2. 复制数据
        db.exec(`
          INSERT INTO transactions_new
          SELECT id, platform_id, asset_name, asset_code, type, direction,
                 COALESCE(leverage, '1'), quantity, open_price, close_price, investment,
                 open_time, close_time,
                 COALESCE(total_profit, '0'), COALESCE(total_fee, '0'),
                 reason, created_at, updated_at
          FROM transactions
        `);
        
        // 3. 删除旧表
        db.exec('DROP TABLE transactions');
        
        // 4. 重命名新表
        db.exec('ALTER TABLE transactions_new RENAME TO transactions');
        
        // 5. 重建触发器
        db.exec(`
          CREATE TRIGGER IF NOT EXISTS update_transactions_timestamp
          AFTER UPDATE ON transactions
          BEGIN
            UPDATE transactions SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
          END
        `);
        
        db.exec('COMMIT');
        console.log('✓ transactions 表重建成功');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    } else {
      console.log('- transactions 表结构正常，无需重建');
    }
  } catch (error) {
    console.error('检查/重建表失败:', error.message);
  }
}

// 迁移：添加 quantity, open_price, close_price, investment 列到 transactions 表
console.log('\n--- 迁移 transactions 表 ---');
addColumnIfNotExists('transactions', 'quantity', 'TEXT');  // 使用TEXT存储高精度小数
addColumnIfNotExists('transactions', 'open_price', 'TEXT'); // 使用TEXT存储高精度小数
addColumnIfNotExists('transactions', 'close_price', 'TEXT'); // 使用TEXT存储高精度小数
addColumnIfNotExists('transactions', 'investment', 'TEXT'); // 投入资金，使用TEXT存储高精度小数

// 检查并修复表结构
console.log('\n--- 检查表结构 ---');
checkAndRebuildTransactionsTable();

// 关闭数据库连接
db.close();

console.log('\n数据库迁移完成！');

// {{END_MODIFICATIONS}}