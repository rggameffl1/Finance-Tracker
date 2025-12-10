// {{CODE-Cycle-Integration:
//   Task_ID: #T006
//   Timestamp: 2025-12-08T05:06:08Z
//   Phase: D-Develop
//   Context-Analysis: "设置管理API - 获取和更新系统设置"
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

module.exports = router;

// {{END_MODIFICATIONS}}