// {{CODE-Cycle-Integration:
//   Task_ID: #T006-T023
//   Timestamp: 2025-12-11T04:50:00Z
//   Phase: D-Develop
//   Context-Analysis: "设置管理API - 获取和更新系统设置，数据导入导出"
//   Principle_Applied: "RESTful, SOLID, Error Handling"
// }}
// {{START_MODIFICATIONS}}

const express = require('express');
const router = express.Router();
const db = require('../database/db');

// 获取所有设置
router.get('/', (req, res) => {
  try {
    const settings = db.prepare('SELECT * FROM settings').all();
    
    // 转换为键值对格式
    const settingsMap = {};
    settings.forEach(s => {
      settingsMap[s.key] = s.value;
    });
    
    res.json(settingsMap);
  } catch (error) {
    console.error('获取设置失败:', error);
    res.status(500).json({ error: '获取设置失败', message: error.message });
  }
});

// 获取单个设置
router.get('/:key', (req, res) => {
  try {
    const { key } = req.params;
    const setting = db.prepare('SELECT * FROM settings WHERE key = ?').get(key);
    
    if (!setting) {
      return res.status(404).json({ error: '设置项不存在' });
    }
    
    res.json(setting);
  } catch (error) {
    console.error('获取设置失败:', error);
    res.status(500).json({ error: '获取设置失败', message: error.message });
  }
});

// 更新设置
router.put('/:key', (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;
    
    if (value === undefined) {
      return res.status(400).json({ error: '请提供设置值' });
    }
    
    db.prepare(`
      INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)
    `).run(key, String(value));
    
    const updated = db.prepare('SELECT * FROM settings WHERE key = ?').get(key);
    res.json(updated);
  } catch (error) {
    console.error('更新设置失败:', error);
    res.status(500).json({ error: '更新设置失败', message: error.message });
  }
});

// 批量更新设置
router.put('/', (req, res) => {
  try {
    const settings = req.body;
    
    if (typeof settings !== 'object' || Array.isArray(settings)) {
      return res.status(400).json({ error: '请提供设置对象' });
    }
    
    const updateSetting = db.prepare(`
      INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)
    `);
    
    const updateAll = db.transaction((settingsObj) => {
      for (const [key, value] of Object.entries(settingsObj)) {
        updateSetting.run(key, String(value));
      }
    });
    
    updateAll(settings);
    
    // 返回所有设置
    const allSettings = db.prepare('SELECT * FROM settings').all();
    const settingsMap = {};
    allSettings.forEach(s => {
      settingsMap[s.key] = s.value;
    });
    
    res.json(settingsMap);
  } catch (error) {
    console.error('批量更新设置失败:', error);
    res.status(500).json({ error: '批量更新设置失败', message: error.message });
  }
});

// 删除设置
router.delete('/:key', (req, res) => {
  try {
    const { key } = req.params;
    
    const existing = db.prepare('SELECT * FROM settings WHERE key = ?').get(key);
    if (!existing) {
      return res.status(404).json({ error: '设置项不存在' });
    }
    
    db.prepare('DELETE FROM settings WHERE key = ?').run(key);
    
    res.json({ message: '设置删除成功', deleted: existing });
  } catch (error) {
    console.error('删除设置失败:', error);
    res.status(500).json({ error: '删除设置失败', message: error.message });
  }
});

// ========================================
// 数据导入导出功能（性能优化版）
// 不包含汇率数据，汇率会自动从网络获取
// ========================================

// 导出所有数据（流式处理，优化内存使用，不含汇率）
router.get('/export/all', (req, res) => {
  try {
    // 设置响应头，触发文件下载
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=finance-tracker-backup-${new Date().toISOString().slice(0, 10)}.json`);
    
    // 使用流式写入，减少内存占用
    res.write('{\n');
    res.write(`  "version": "1.1",\n`);
    res.write(`  "exportTime": "${new Date().toISOString()}",\n`);
    res.write(`  "data": {\n`);
    
    // 导出平台数据
    const platforms = db.prepare('SELECT * FROM platforms').all();
    res.write(`    "platforms": ${JSON.stringify(platforms)},\n`);
    
    // 导出交易记录（分批处理大数据）
    const transactionCount = db.prepare('SELECT COUNT(*) as count FROM transactions').get().count;
    res.write(`    "transactions": [`);
    
    if (transactionCount > 0) {
      const batchSize = 500; // 减小批次大小，提高响应性
      let offset = 0;
      let isFirst = true;
      
      while (offset < transactionCount) {
        const batch = db.prepare('SELECT * FROM transactions ORDER BY id LIMIT ? OFFSET ?').all(batchSize, offset);
        
        batch.forEach((t, index) => {
          if (!isFirst || index > 0) {
            res.write(',');
          }
          res.write(JSON.stringify(t));
          isFirst = false;
        });
        
        offset += batchSize;
      }
    }
    
    res.write(`],\n`);
    
    // 导出设置（不包含汇率数据）
    const settings = db.prepare('SELECT * FROM settings').all();
    res.write(`    "settings": ${JSON.stringify(settings)}\n`);
    
    res.write(`  }\n`);
    res.write('}\n');
    res.end();
  } catch (error) {
    console.error('导出数据失败:', error);
    res.status(500).json({ error: '导出数据失败', message: error.message });
  }
});

// 导入数据（分批处理，优化性能，不含汇率）
// 默认行为：覆盖现有交易记录数据，保留平台配置
router.post('/import/all', (req, res) => {
  try {
    const { data, options = {} } = req.body;
    
    if (!data) {
      return res.status(400).json({ error: '请提供导入数据' });
    }
    
    const { platforms, transactions, settings } = data;
    // 默认覆盖模式，除非明确指定保留
    const { keepExisting = false } = options;
    
    const result = {
      platforms: { imported: 0, skipped: 0 },
      transactions: { imported: 0, skipped: 0 },
      settings: { imported: 0, skipped: 0 }
    };
    
    // 预编译SQL语句（性能优化）
    const updatePlatformStmt = db.prepare(`
      UPDATE platforms SET initial_capital = ? WHERE id = ?
    `);
    
    const checkPlatformStmt = db.prepare('SELECT id FROM platforms WHERE id = ?');
    
    const insertTransactionStmt = db.prepare(`
      INSERT INTO transactions (
        platform_id, asset_name, asset_code, type, direction, leverage,
        quantity, open_price, close_price, investment,
        open_time, close_time, total_profit, total_fee, reason
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const upsertSettingStmt = db.prepare(`
      INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)
    `);
    
    // 使用事务确保数据一致性
    const importAll = db.transaction(() => {
      // 默认覆盖模式：清除现有交易记录数据
      // 只有当 keepExisting = true 时才保留现有数据
      if (!keepExisting) {
        db.prepare('DELETE FROM transactions').run();
      }
      
      // 导入平台数据（更新初始资金）
      if (platforms && Array.isArray(platforms)) {
        platforms.forEach(platform => {
          try {
            const existing = checkPlatformStmt.get(platform.id);
            if (existing) {
              updatePlatformStmt.run(platform.initial_capital || 0, platform.id);
              result.platforms.imported++;
            } else {
              result.platforms.skipped++;
            }
          } catch (e) {
            result.platforms.skipped++;
          }
        });
      }
      
      // 导入交易记录
      if (transactions && Array.isArray(transactions)) {
        // 预先获取所有有效平台ID
        const validPlatformIds = new Set(
          db.prepare('SELECT id FROM platforms').all().map(p => p.id)
        );
        
        // 分批处理，每批500条，避免长时间阻塞
        const batchSize = 500;
        for (let i = 0; i < transactions.length; i += batchSize) {
          const batch = transactions.slice(i, i + batchSize);
          
          batch.forEach(t => {
            try {
              // 快速检查平台是否存在
              if (!validPlatformIds.has(t.platform_id)) {
                result.transactions.skipped++;
                return;
              }
              
              insertTransactionStmt.run(
                t.platform_id,
                t.asset_name,
                t.asset_code,
                t.type,
                t.direction,
                t.leverage || '1',
                t.quantity,
                t.open_price,
                t.close_price,
                t.investment,
                t.open_time,
                t.close_time,
                t.total_profit || '0',
                t.total_fee || '0',
                t.reason
              );
              result.transactions.imported++;
            } catch (e) {
              console.error('导入交易记录失败:', e.message);
              result.transactions.skipped++;
            }
          });
        }
      }
      
      // 导入设置
      if (settings && Array.isArray(settings)) {
        settings.forEach(setting => {
          try {
            upsertSettingStmt.run(setting.key, setting.value);
            result.settings.imported++;
          } catch (e) {
            result.settings.skipped++;
          }
        });
      }
    });
    
    importAll();
    
    // 导入完成后更新索引统计信息（优化查询性能）
    try {
      db.exec('ANALYZE');
    } catch (e) {
      console.warn('ANALYZE 执行失败:', e.message);
    }
    
    res.json({
      message: '数据导入成功',
      result
    });
  } catch (error) {
    console.error('导入数据失败:', error);
    res.status(500).json({ error: '导入数据失败', message: error.message });
  }
});

// 获取数据库状态信息
router.get('/database/status', (req, res) => {
  try {
    // 获取表记录数
    const transactionCount = db.prepare('SELECT COUNT(*) as count FROM transactions').get().count;
    const platformCount = db.prepare('SELECT COUNT(*) as count FROM platforms').get().count;
    const settingCount = db.prepare('SELECT COUNT(*) as count FROM settings').get().count;
    
    // 获取索引信息
    const indexes = db.prepare(`
      SELECT name, tbl_name
      FROM sqlite_master
      WHERE type = 'index' AND sql IS NOT NULL
      ORDER BY tbl_name, name
    `).all();
    
    // 获取数据库文件大小（使用 db.dbPath 获取实际路径）
    const fs = require('fs');
    let dbSize = 0;
    try {
      const stats = fs.statSync(db.dbPath);
      dbSize = stats.size;
    } catch (e) {
      // 忽略错误，可能是文件不存在或权限问题
      console.warn('获取数据库文件大小失败:', e.message);
    }
    
    res.json({
      tables: {
        transactions: transactionCount,
        platforms: platformCount,
        settings: settingCount
      },
      indexes: indexes.map(idx => ({
        name: idx.name,
        table: idx.tbl_name
      })),
      database_size: dbSize,
      database_size_formatted: formatBytes(dbSize)
    });
  } catch (error) {
    console.error('获取数据库状态失败:', error);
    res.status(500).json({ error: '获取数据库状态失败', message: error.message });
  }
});

// 优化数据库
router.post('/database/optimize', (req, res) => {
  try {
    // 更新索引统计信息
    db.exec('ANALYZE');
    
    // 清理未使用的空间
    db.exec('VACUUM');
    
    res.json({
      message: '数据库优化完成',
      operations: ['ANALYZE', 'VACUUM']
    });
  } catch (error) {
    console.error('数据库优化失败:', error);
    res.status(500).json({ error: '数据库优化失败', message: error.message });
  }
});

// 格式化字节数
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

module.exports = router;

// {{END_MODIFICATIONS}}