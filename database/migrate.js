// {{CODE-Cycle-Integration:
//   Task_ID: #T015-T030
//   Timestamp: 2025-12-13T03:09:00Z
//   Phase: D-Develop
//   Context-Analysis: "数据库迁移脚本 - 修复表结构，确保所有列允许NULL，添加性能优化索引"
//   Principle_Applied: "KISS, Safe Migration, Performance Optimization"
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
  console.log(`创建数据目录: ${dataDir}`);
}

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

// 检查索引是否存在
function indexExists(indexName) {
  const result = db.prepare(`
    SELECT name FROM sqlite_master
    WHERE type = 'index' AND name = ?
  `).get(indexName);
  return !!result;
}

// 创建索引的辅助函数
function createIndexIfNotExists(indexName, tableName, columns, descending = false) {
  try {
    if (!indexExists(indexName)) {
      const columnDef = descending ? `${columns} DESC` : columns;
      db.exec(`CREATE INDEX ${indexName} ON ${tableName}(${columnDef})`);
      console.log(`✓ 创建索引 ${indexName} 成功`);
      return true;
    } else {
      console.log(`- 索引 ${indexName} 已存在，跳过`);
      return false;
    }
  } catch (error) {
    console.error(`✗ 创建索引 ${indexName} 失败:`, error.message);
    return false;
  }
}

// 检查表是否需要重建（修复NOT NULL约束问题 或 添加新的类型选项）
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
    
    // 检查 type 列的 CHECK 约束是否包含 '事件'
    // SQLite 无法直接查询 CHECK 约束内容，所以我们尝试插入测试
    if (!needsRebuild) {
      try {
        // 尝试检查是否支持 '事件' 类型
        const testStmt = db.prepare(`
          SELECT 1 WHERE '事件' IN ('合约', '现货', '事件')
        `);
        testStmt.get();
        
        // 通过创建临时测试来检查约束
        // 如果表存在旧的CHECK约束，需要重建
        const sqlResult = db.prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='transactions'`).get();
        if (sqlResult && sqlResult.sql) {
          // 检查 CHECK 约束是否包含 '事件'
          if (sqlResult.sql.includes("CHECK(type IN ('合约', '现货'))") &&
              !sqlResult.sql.includes("'事件'")) {
            console.log('发现 type 列的 CHECK 约束不包含 "事件"，需要重建表');
            needsRebuild = true;
          }
        }
      } catch (e) {
        // 忽略错误
      }
    }
    
    if (needsRebuild) {
      console.log('\n正在重建 transactions 表以修复约束问题...');
      
      // 开始事务
      db.exec('BEGIN TRANSACTION');
      
      try {
        // 1. 创建新表（包含 '事件' 类型）
        db.exec(`
          CREATE TABLE IF NOT EXISTS transactions_new (
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
        console.log('✓ transactions 表重建成功（支持 合约/现货/事件 类型）');
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

// 创建性能优化索引
console.log('\n--- 创建性能优化索引 ---');
let indexCount = 0;

// 1. 平台ID索引 - 优化按平台筛选查询
if (createIndexIfNotExists('idx_transactions_platform_id', 'transactions', 'platform_id')) {
  indexCount++;
}

// 2. 开仓时间索引 - 优化按时间排序和范围查询
if (createIndexIfNotExists('idx_transactions_open_time', 'transactions', 'open_time', true)) {
  indexCount++;
}

// 3. 复合索引（平台+时间）- 优化同时按平台筛选和时间排序（最常用的查询模式）
if (createIndexIfNotExists('idx_transactions_platform_time', 'transactions', 'platform_id, open_time DESC')) {
  indexCount++;
}

// 4. 资产代码索引 - 优化按资产搜索
if (createIndexIfNotExists('idx_transactions_asset_code', 'transactions', 'asset_code')) {
  indexCount++;
}

// 5. 平仓时间索引 - 优化按平仓时间查询（用于归档等场景）
if (createIndexIfNotExists('idx_transactions_close_time', 'transactions', 'close_time')) {
  indexCount++;
}

if (indexCount > 0) {
  console.log(`\n✓ 共创建 ${indexCount} 个新索引`);
}

// 显示当前索引状态
console.log('\n--- 当前数据库索引状态 ---');
const indexes = db.prepare(`
  SELECT name, tbl_name
  FROM sqlite_master
  WHERE type = 'index' AND sql IS NOT NULL
  ORDER BY tbl_name, name
`).all();

if (indexes.length > 0) {
  indexes.forEach(idx => {
    console.log(`  - ${idx.name} (表: ${idx.tbl_name})`);
  });
} else {
  console.log('  无自定义索引');
}

// 执行数据库优化
console.log('\n--- 执行数据库优化 ---');
try {
  db.exec('ANALYZE');
  console.log('✓ 已更新数据库统计信息 (ANALYZE)');
} catch (error) {
  console.error('✗ ANALYZE 失败:', error.message);
}

// 关闭数据库连接
db.close();

console.log('\n数据库迁移完成！');

// {{END_MODIFICATIONS}}