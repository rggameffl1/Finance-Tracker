// {{CODE-Cycle-Integration:
//   Task_ID: #T005
//   Timestamp: 2025-12-08T05:22:38Z
//   Phase: D-Develop
//   Context-Analysis: "汇率管理API - 获取汇率和手动刷新，使用多个备用API源"
//   Principle_Applied: "RESTful, SOLID, Error Handling, Fallback Strategy"
// }}
// {{START_MODIFICATIONS}}

const express = require('express');
const router = express.Router();
const db = require('../database/db');

// 备用汇率数据（当所有API都失败时使用）
const fallbackRates = {
  'CNY': { 'CNY': 1, 'HKD': 1.09, 'USD': 0.14 },
  'HKD': { 'CNY': 0.92, 'HKD': 1, 'USD': 0.13 },
  'USD': { 'CNY': 7.24, 'HKD': 7.80, 'USD': 1 }
};

// 方法1: 使用免费的 exchangerate.host API
async function fetchFromExchangeRateHost(from, to) {
  try {
    const fetch = (await import('node-fetch')).default;
    const url = `https://api.exchangerate.host/convert?from=${from}&to=${to}&amount=1`;
    
    const response = await fetch(url, { timeout: 10000 });
    const data = await response.json();
    
    if (data && data.success && data.result) {
      console.log(`  ✓ exchangerate.host: ${from} -> ${to}: ${data.result}`);
      return data.result;
    }
    return null;
  } catch (error) {
    console.warn(`  exchangerate.host 失败: ${error.message}`);
    return null;
  }
}

// 方法2: 使用 frankfurter.app API (欧洲央行数据)
async function fetchFromFrankfurter(from, to) {
  try {
    const fetch = (await import('node-fetch')).default;
    const url = `https://api.frankfurter.app/latest?from=${from}&to=${to}`;
    
    const response = await fetch(url, { timeout: 10000 });
    const data = await response.json();
    
    if (data && data.rates && data.rates[to]) {
      console.log(`  ✓ frankfurter.app: ${from} -> ${to}: ${data.rates[to]}`);
      return data.rates[to];
    }
    return null;
  } catch (error) {
    console.warn(`  frankfurter.app 失败: ${error.message}`);
    return null;
  }
}

// 方法3: 使用 open.er-api.com (免费汇率API)
async function fetchFromOpenErApi(from, to) {
  try {
    const fetch = (await import('node-fetch')).default;
    const url = `https://open.er-api.com/v6/latest/${from}`;
    
    const response = await fetch(url, { timeout: 10000 });
    const data = await response.json();
    
    if (data && data.result === 'success' && data.rates && data.rates[to]) {
      console.log(`  ✓ open.er-api.com: ${from} -> ${to}: ${data.rates[to]}`);
      return data.rates[to];
    }
    return null;
  } catch (error) {
    console.warn(`  open.er-api.com 失败: ${error.message}`);
    return null;
  }
}

// 综合获取汇率函数（尝试多个API源）
async function fetchExchangeRate(from, to) {
  if (from === to) return 1;
  
  console.log(`  正在获取 ${from} -> ${to} 汇率...`);
  
  // 尝试多个API源
  let rate = await fetchFromOpenErApi(from, to);
  if (rate) return rate;
  
  rate = await fetchFromFrankfurter(from, to);
  if (rate) return rate;
  
  rate = await fetchFromExchangeRateHost(from, to);
  if (rate) return rate;
  
  // 所有API都失败，使用备用汇率
  const fallbackRate = fallbackRates[from]?.[to];
  if (fallbackRate) {
    console.log(`  ⚠ 使用备用汇率: ${from} -> ${to}: ${fallbackRate}`);
    return fallbackRate;
  }
  
  console.warn(`  ✗ 无法获取 ${from} -> ${to} 汇率`);
  return null;
}

// 获取所有汇率
router.get('/', (req, res) => {
  try {
    const rates = db.prepare('SELECT * FROM exchange_rates ORDER BY from_currency, to_currency').all();
    
    // 转换为更易用的格式
    const rateMap = {};
    rates.forEach(r => {
      if (!rateMap[r.from_currency]) {
        rateMap[r.from_currency] = {};
      }
      rateMap[r.from_currency][r.to_currency] = {
        rate: r.rate,
        updated_at: r.updated_at
      };
    });
    
    res.json({
      rates: rateMap,
      raw: rates
    });
  } catch (error) {
    console.error('获取汇率失败:', error);
    res.status(500).json({ error: '获取汇率失败', message: error.message });
  }
});

// 获取特定汇率
router.get('/:from/:to', (req, res) => {
  try {
    const { from, to } = req.params;
    const rate = db.prepare(
      'SELECT * FROM exchange_rates WHERE from_currency = ? AND to_currency = ?'
    ).get(from.toUpperCase(), to.toUpperCase());
    
    if (!rate) {
      return res.status(404).json({ error: '汇率不存在' });
    }
    
    res.json(rate);
  } catch (error) {
    console.error('获取汇率失败:', error);
    res.status(500).json({ error: '获取汇率失败', message: error.message });
  }
});

// 手动刷新汇率
router.post('/refresh', async (req, res) => {
  try {
    console.log('\n========================================');
    console.log('开始刷新汇率...');
    console.log('========================================\n');
    
    const currencies = ['CNY', 'HKD', 'USD'];
    const results = [];
    const errors = [];
    
    // 更新汇率的prepared statement
    const updateRate = db.prepare(`
      INSERT OR REPLACE INTO exchange_rates (from_currency, to_currency, rate, updated_at)
      VALUES (?, ?, ?, datetime('now', 'localtime'))
    `);
    
    // 获取所有货币对的汇率
    for (const from of currencies) {
      for (const to of currencies) {
        if (from === to) {
          // 同币种汇率为1
          updateRate.run(from, to, 1);
          results.push({ from, to, rate: 1, source: 'fixed' });
        } else {
          const rate = await fetchExchangeRate(from, to);
          if (rate !== null) {
            updateRate.run(from, to, rate);
            results.push({ from, to, rate, source: 'api' });
          } else {
            // 使用备用汇率
            const fallbackRate = fallbackRates[from]?.[to] || 1;
            updateRate.run(from, to, fallbackRate);
            results.push({ from, to, rate: fallbackRate, source: 'fallback' });
          }
        }
        
        // 添加小延迟避免请求过快
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
    
    console.log('\n========================================');
    console.log('汇率刷新完成！');
    console.log('========================================\n');
    
    // 获取更新后的所有汇率
    const allRates = db.prepare('SELECT * FROM exchange_rates ORDER BY from_currency, to_currency').all();
    
    res.json({
      message: '汇率刷新完成',
      updated: results,
      errors: errors.length > 0 ? errors : undefined,
      rates: allRates
    });
  } catch (error) {
    console.error('刷新汇率失败:', error);
    res.status(500).json({ error: '刷新汇率失败', message: error.message });
  }
});

// 手动设置汇率
router.put('/:from/:to', (req, res) => {
  try {
    const { from, to } = req.params;
    const { rate } = req.body;
    
    if (typeof rate !== 'number' || rate <= 0) {
      return res.status(400).json({ error: '汇率必须是大于0的数字' });
    }
    
    const fromUpper = from.toUpperCase();
    const toUpper = to.toUpperCase();
    
    if (!['CNY', 'HKD', 'USD'].includes(fromUpper) || !['CNY', 'HKD', 'USD'].includes(toUpper)) {
      return res.status(400).json({ error: '币种必须是 CNY、HKD 或 USD' });
    }
    
    db.prepare(`
      INSERT OR REPLACE INTO exchange_rates (from_currency, to_currency, rate, updated_at) 
      VALUES (?, ?, ?, datetime('now'))
    `).run(fromUpper, toUpper, rate);
    
    const updated = db.prepare(
      'SELECT * FROM exchange_rates WHERE from_currency = ? AND to_currency = ?'
    ).get(fromUpper, toUpper);
    
    res.json(updated);
  } catch (error) {
    console.error('设置汇率失败:', error);
    res.status(500).json({ error: '设置汇率失败', message: error.message });
  }
});

module.exports = router;

// {{END_MODIFICATIONS}}