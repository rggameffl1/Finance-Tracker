// {{CODE-Cycle-Integration:
//   Task_ID: #T003
//   Timestamp: 2025-12-08T05:03:18Z
//   Phase: D-Develop
//   Context-Analysis: "平台管理API - CRUD接口实现"
//   Principle_Applied: "RESTful, SOLID, Error Handling"
// }}
// {{START_MODIFICATIONS}}

const express = require('express');
const router = express.Router();
const db = require('../database/db');

// 获取所有平台
router.get('/', (req, res) => {
  try {
    const platforms = db.prepare(`
      SELECT 
        p.*,
        COALESCE(SUM(t.total_profit - t.total_fee), 0) as total_realized_profit
      FROM platforms p
      LEFT JOIN transactions t ON p.id = t.platform_id
      GROUP BY p.id
      ORDER BY p.id
    `).all();
    
    // 计算每个平台的总资金和涨跌幅
    const result = platforms.map(p => ({
      ...p,
      total_capital: p.initial_capital + p.total_realized_profit,
      change_amount: p.total_realized_profit,
      change_percent: p.initial_capital > 0 
        ? ((p.total_realized_profit / p.initial_capital) * 100).toFixed(2)
        : 0
    }));
    
    res.json(result);
  } catch (error) {
    console.error('获取平台列表失败:', error);
    res.status(500).json({ error: '获取平台列表失败', message: error.message });
  }
});

// 获取单个平台
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const platform = db.prepare(`
      SELECT 
        p.*,
        COALESCE(SUM(t.total_profit - t.total_fee), 0) as total_realized_profit
      FROM platforms p
      LEFT JOIN transactions t ON p.id = t.platform_id
      WHERE p.id = ?
      GROUP BY p.id
    `).get(id);
    
    if (!platform) {
      return res.status(404).json({ error: '平台不存在' });
    }
    
    const result = {
      ...platform,
      total_capital: platform.initial_capital + platform.total_realized_profit,
      change_amount: platform.total_realized_profit,
      change_percent: platform.initial_capital > 0 
        ? ((platform.total_realized_profit / platform.initial_capital) * 100).toFixed(2)
        : 0
    };
    
    res.json(result);
  } catch (error) {
    console.error('获取平台详情失败:', error);
    res.status(500).json({ error: '获取平台详情失败', message: error.message });
  }
});

// 创建平台
router.post('/', (req, res) => {
  try {
    const { name, currency, initial_capital } = req.body;
    
    if (!name || !currency) {
      return res.status(400).json({ error: '平台名称和币种为必填项' });
    }
    
    if (!['CNY', 'HKD', 'USD'].includes(currency)) {
      return res.status(400).json({ error: '币种必须是 CNY、HKD 或 USD' });
    }
    
    const result = db.prepare(`
      INSERT INTO platforms (name, currency, initial_capital) VALUES (?, ?, ?)
    `).run(name, currency, initial_capital || 0);
    
    const newPlatform = db.prepare('SELECT * FROM platforms WHERE id = ?').get(result.lastInsertRowid);
    
    res.status(201).json(newPlatform);
  } catch (error) {
    console.error('创建平台失败:', error);
    if (error.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: '平台名称已存在' });
    }
    res.status(500).json({ error: '创建平台失败', message: error.message });
  }
});

// 更新平台
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { name, currency, initial_capital } = req.body;
    
    const existing = db.prepare('SELECT * FROM platforms WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: '平台不存在' });
    }
    
    if (currency && !['CNY', 'HKD', 'USD'].includes(currency)) {
      return res.status(400).json({ error: '币种必须是 CNY、HKD 或 USD' });
    }
    
    db.prepare(`
      UPDATE platforms 
      SET name = COALESCE(?, name),
          currency = COALESCE(?, currency),
          initial_capital = COALESCE(?, initial_capital)
      WHERE id = ?
    `).run(name, currency, initial_capital, id);
    
    const updated = db.prepare('SELECT * FROM platforms WHERE id = ?').get(id);
    res.json(updated);
  } catch (error) {
    console.error('更新平台失败:', error);
    if (error.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: '平台名称已存在' });
    }
    res.status(500).json({ error: '更新平台失败', message: error.message });
  }
});

// 删除平台
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    
    const existing = db.prepare('SELECT * FROM platforms WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: '平台不存在' });
    }
    
    // 由于设置了 ON DELETE CASCADE，删除平台会自动删除相关交易记录
    db.prepare('DELETE FROM platforms WHERE id = ?').run(id);
    
    res.json({ message: '平台删除成功', deleted: existing });
  } catch (error) {
    console.error('删除平台失败:', error);
    res.status(500).json({ error: '删除平台失败', message: error.message });
  }
});

module.exports = router;

// {{END_MODIFICATIONS}}