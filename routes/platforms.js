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
        COALESCE(SUM(CAST(t.total_profit AS REAL) - CAST(t.total_fee AS REAL)), 0) as total_realized_profit
      FROM platforms p
      LEFT JOIN transactions t ON p.id = t.platform_id
      GROUP BY p.id
      ORDER BY p.id
    `).all();
    
    // 计算每个平台的总资金和涨跌幅
    const result = platforms.map(p => {
      const initialCapital = parseFloat(p.initial_capital) || 0;
      const totalRealizedProfit = parseFloat(p.total_realized_profit) || 0;
      return {
        ...p,
        initial_capital: initialCapital,
        total_realized_profit: totalRealizedProfit,
        total_capital: initialCapital + totalRealizedProfit,
        change_amount: totalRealizedProfit,
        change_percent: initialCapital > 0
          ? ((totalRealizedProfit / initialCapital) * 100).toFixed(2)
          : 0
      };
    });
    
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
        COALESCE(SUM(CAST(t.total_profit AS REAL) - CAST(t.total_fee AS REAL)), 0) as total_realized_profit
      FROM platforms p
      LEFT JOIN transactions t ON p.id = t.platform_id
      WHERE p.id = ?
      GROUP BY p.id
    `).get(id);
    
    if (!platform) {
      return res.status(404).json({ error: '平台不存在' });
    }
    
    const initialCapital = parseFloat(platform.initial_capital) || 0;
    const totalRealizedProfit = parseFloat(platform.total_realized_profit) || 0;
    
    const result = {
      ...platform,
      initial_capital: initialCapital,
      total_realized_profit: totalRealizedProfit,
      total_capital: initialCapital + totalRealizedProfit,
      change_amount: totalRealizedProfit,
      change_percent: initialCapital > 0
        ? ((totalRealizedProfit / initialCapital) * 100).toFixed(2)
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