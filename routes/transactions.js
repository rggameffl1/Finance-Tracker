// {{CODE-Cycle-Integration:
//   Task_ID: #T004
//   Timestamp: 2025-12-08T05:04:12Z
//   Phase: D-Develop
//   Context-Analysis: "交易记录API - CRUD接口实现，自动计算持仓时间和实现盈亏"
//   Principle_Applied: "RESTful, SOLID, Error Handling"
// }}
// {{START_MODIFICATIONS}}

const express = require('express');
const router = express.Router();
const db = require('../database/db');

// 计算持仓时间的辅助函数（支持秒级精度）
function calculateHoldingTime(openTime, closeTime) {
  if (!closeTime) return null;
  
  const open = new Date(openTime);
  const close = new Date(closeTime);
  const diffMs = close - open;
  
  if (diffMs < 0) return null;
  
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);
  
  let result = '';
  if (days > 0) result += `${days}天`;
  if (hours > 0) result += `${hours}小时`;
  if (minutes > 0) result += `${minutes}分钟`;
  if (seconds > 0 && days === 0) result += `${seconds}秒`; // 只在不足1天时显示秒
  
  return result || '0秒';
}

// 格式化交易记录
function formatTransaction(t) {
  return {
    ...t,
    holding_time: calculateHoldingTime(t.open_time, t.close_time),
    realized_profit: t.total_profit - t.total_fee
  };
}

// 获取所有交易记录
router.get('/', (req, res) => {
  try {
    const { platform_id, page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;
    
    let query = `
      SELECT t.*, p.name as platform_name, p.currency as platform_currency
      FROM transactions t
      JOIN platforms p ON t.platform_id = p.id
    `;
    let countQuery = 'SELECT COUNT(*) as total FROM transactions t';
    const params = [];
    const countParams = [];
    
    if (platform_id) {
      query += ' WHERE t.platform_id = ?';
      countQuery += ' WHERE t.platform_id = ?';
      params.push(platform_id);
      countParams.push(platform_id);
    }
    
    query += ' ORDER BY t.open_time DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    const transactions = db.prepare(query).all(...params);
    const { total } = db.prepare(countQuery).get(...countParams);
    
    const result = transactions.map(formatTransaction);
    
    res.json({
      data: result,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('获取交易记录失败:', error);
    res.status(500).json({ error: '获取交易记录失败', message: error.message });
  }
});

// 获取单个交易记录
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const transaction = db.prepare(`
      SELECT t.*, p.name as platform_name, p.currency as platform_currency
      FROM transactions t
      JOIN platforms p ON t.platform_id = p.id
      WHERE t.id = ?
    `).get(id);
    
    if (!transaction) {
      return res.status(404).json({ error: '交易记录不存在' });
    }
    
    res.json(formatTransaction(transaction));
  } catch (error) {
    console.error('获取交易记录详情失败:', error);
    res.status(500).json({ error: '获取交易记录详情失败', message: error.message });
  }
});

// 创建交易记录
router.post('/', (req, res) => {
  try {
    const {
      platform_id,
      asset_name,
      asset_code,
      type,
      direction,
      leverage = 1,
      quantity,
      open_price,
      close_price,
      investment,
      open_time,
      close_time,
      total_profit = 0,
      total_fee = 0,
      reason
    } = req.body;
    
    // 验证必填字段
    if (!platform_id || !asset_name || !asset_code || !type || !direction || !open_time) {
      return res.status(400).json({
        error: '缺少必填字段',
        required: ['platform_id', 'asset_name', 'asset_code', 'type', 'direction', 'open_time']
      });
    }
    
    // 验证平台是否存在
    const platform = db.prepare('SELECT * FROM platforms WHERE id = ?').get(platform_id);
    if (!platform) {
      return res.status(400).json({ error: '指定的平台不存在' });
    }
    
    // 验证类型
    if (!['合约', '现货'].includes(type)) {
      return res.status(400).json({ error: '类型必须是 合约 或 现货' });
    }
    
    // 验证方向
    if (!['开多', '开空'].includes(direction)) {
      return res.status(400).json({ error: '方向必须是 开多 或 开空' });
    }
    
    // 验证杠杆（使用字符串转换以保持精度）
    const leverageVal = parseFloat(leverage) || 1;
    if (leverageVal < 1) {
      return res.status(400).json({ error: '杠杆倍数必须大于等于1' });
    }
    
    // 使用TEXT存储高精度小数，保持原始字符串
    const result = db.prepare(`
      INSERT INTO transactions (
        platform_id, asset_name, asset_code, type, direction,
        leverage, quantity, open_price, close_price, investment, open_time, close_time, total_profit, total_fee, reason
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      platform_id, asset_name, asset_code, type, direction,
      String(leverageVal),
      quantity !== undefined && quantity !== null && quantity !== '' ? String(quantity) : null,
      open_price !== undefined && open_price !== null && open_price !== '' ? String(open_price) : null,
      close_price !== undefined && close_price !== null && close_price !== '' ? String(close_price) : null,
      investment !== undefined && investment !== null && investment !== '' ? String(investment) : null,
      open_time, close_time || null, String(total_profit || 0), String(total_fee || 0), reason || null
    );
    
    const newTransaction = db.prepare(`
      SELECT t.*, p.name as platform_name, p.currency as platform_currency
      FROM transactions t
      JOIN platforms p ON t.platform_id = p.id
      WHERE t.id = ?
    `).get(result.lastInsertRowid);
    
    res.status(201).json(formatTransaction(newTransaction));
  } catch (error) {
    console.error('创建交易记录失败:', error);
    res.status(500).json({ error: '创建交易记录失败', message: error.message });
  }
});

// 更新交易记录
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const {
      platform_id,
      asset_name,
      asset_code,
      type,
      direction,
      leverage,
      quantity,
      open_price,
      close_price,
      investment,
      open_time,
      close_time,
      total_profit,
      total_fee,
      reason
    } = req.body;
    
    const existing = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: '交易记录不存在' });
    }
    
    // 验证平台是否存在
    if (platform_id) {
      const platform = db.prepare('SELECT * FROM platforms WHERE id = ?').get(platform_id);
      if (!platform) {
        return res.status(400).json({ error: '指定的平台不存在' });
      }
    }
    
    // 验证类型
    if (type && !['合约', '现货'].includes(type)) {
      return res.status(400).json({ error: '类型必须是 合约 或 现货' });
    }
    
    // 验证方向
    if (direction && !['开多', '开空'].includes(direction)) {
      return res.status(400).json({ error: '方向必须是 开多 或 开空' });
    }
    
    // 验证杠杆
    if (leverage !== undefined && parseFloat(leverage) < 1) {
      return res.status(400).json({ error: '杠杆倍数必须大于等于1' });
    }
    
    // 使用TEXT存储高精度小数
    db.prepare(`
      UPDATE transactions SET
        platform_id = COALESCE(?, platform_id),
        asset_name = COALESCE(?, asset_name),
        asset_code = COALESCE(?, asset_code),
        type = COALESCE(?, type),
        direction = COALESCE(?, direction),
        leverage = COALESCE(?, leverage),
        quantity = ?,
        open_price = ?,
        close_price = ?,
        investment = ?,
        open_time = COALESCE(?, open_time),
        close_time = ?,
        total_profit = COALESCE(?, total_profit),
        total_fee = COALESCE(?, total_fee),
        reason = ?
      WHERE id = ?
    `).run(
      platform_id, asset_name, asset_code, type, direction,
      leverage !== undefined ? String(leverage) : null,
      quantity !== undefined && quantity !== null && quantity !== '' ? String(quantity) : existing.quantity,
      open_price !== undefined && open_price !== null && open_price !== '' ? String(open_price) : existing.open_price,
      close_price !== undefined && close_price !== null && close_price !== '' ? String(close_price) : existing.close_price,
      investment !== undefined && investment !== null && investment !== '' ? String(investment) : existing.investment,
      open_time,
      close_time !== undefined ? close_time : existing.close_time,
      total_profit !== undefined ? String(total_profit) : null,
      total_fee !== undefined ? String(total_fee) : null,
      reason !== undefined ? reason : existing.reason, id
    );
    
    const updated = db.prepare(`
      SELECT t.*, p.name as platform_name, p.currency as platform_currency
      FROM transactions t
      JOIN platforms p ON t.platform_id = p.id
      WHERE t.id = ?
    `).get(id);
    
    res.json(formatTransaction(updated));
  } catch (error) {
    console.error('更新交易记录失败:', error);
    res.status(500).json({ error: '更新交易记录失败', message: error.message });
  }
});

// 删除交易记录
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    
    const existing = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: '交易记录不存在' });
    }
    
    db.prepare('DELETE FROM transactions WHERE id = ?').run(id);
    
    res.json({ message: '交易记录删除成功', deleted: formatTransaction(existing) });
  } catch (error) {
    console.error('删除交易记录失败:', error);
    res.status(500).json({ error: '删除交易记录失败', message: error.message });
  }
});

// 批量删除交易记录
router.post('/batch-delete', (req, res) => {
  try {
    const { ids } = req.body;
    
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: '请提供要删除的交易记录ID数组' });
    }
    
    const placeholders = ids.map(() => '?').join(',');
    const deleteStmt = db.prepare(`DELETE FROM transactions WHERE id IN (${placeholders})`);
    const result = deleteStmt.run(...ids);
    
    res.json({ message: '批量删除成功', deletedCount: result.changes });
  } catch (error) {
    console.error('批量删除交易记录失败:', error);
    res.status(500).json({ error: '批量删除交易记录失败', message: error.message });
  }
});

module.exports = router;

// {{END_MODIFICATIONS}}