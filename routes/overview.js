// {{CODE-Cycle-Integration:
//   Task_ID: #T006
//   Timestamp: 2025-12-08T05:05:13Z
//   Phase: D-Develop
//   Context-Analysis: "统计汇总API - 资金总览，支持币种切换"
//   Principle_Applied: "RESTful, SOLID, Error Handling"
// }}
// {{START_MODIFICATIONS}}

const express = require('express');
const router = express.Router();
const db = require('../database/db');

// 获取汇率的辅助函数
function getExchangeRate(from, to) {
  if (from === to) return 1;
  
  const rate = db.prepare(
    'SELECT rate FROM exchange_rates WHERE from_currency = ? AND to_currency = ?'
  ).get(from, to);
  
  return rate ? rate.rate : 1;
}

// 获取全平台资金总览
router.get('/', (req, res) => {
  try {
    const { currency = 'CNY' } = req.query;
    
    // 验证币种
    if (!['CNY', 'HKD', 'USD'].includes(currency.toUpperCase())) {
      return res.status(400).json({ error: '币种必须是 CNY、HKD 或 USD' });
    }
    
    const targetCurrency = currency.toUpperCase();
    
    // 获取所有平台及其交易汇总
    const platforms = db.prepare(`
      SELECT
        p.*,
        COALESCE(SUM(t.total_profit - t.total_fee), 0) as total_realized_profit,
        COUNT(t.id) as transaction_count
      FROM platforms p
      LEFT JOIN transactions t ON p.id = t.platform_id
      GROUP BY p.id
      ORDER BY p.id
    `).all();
    
    // 获取各平台的资金流动汇总
    const fundFlows = db.prepare(`
      SELECT
        platform_id,
        COALESCE(SUM(CASE WHEN type IN ('存入', '分红', '利息', '转入') THEN CAST(amount AS REAL) ELSE 0 END), 0) as total_in,
        COALESCE(SUM(CASE WHEN type IN ('取出', '转出') THEN CAST(amount AS REAL) ELSE 0 END), 0) as total_out,
        COALESCE(SUM(CASE WHEN type = '其他' THEN CAST(amount AS REAL) ELSE 0 END), 0) as total_other
      FROM fund_records
      GROUP BY platform_id
    `).all();
    
    // 创建资金流动映射
    const fundFlowMap = {};
    fundFlows.forEach(f => {
      fundFlowMap[f.platform_id] = {
        total_in: f.total_in,
        total_out: f.total_out,
        total_other: f.total_other,
        net_flow: f.total_in - f.total_out + f.total_other
      };
    });
    
    // 获取所有汇率
    const rates = db.prepare('SELECT * FROM exchange_rates').all();
    const rateMap = {};
    rates.forEach(r => {
      if (!rateMap[r.from_currency]) rateMap[r.from_currency] = {};
      rateMap[r.from_currency][r.to_currency] = r.rate;
    });
    
    // 计算每个平台的数据（转换为目标币种）
    let totalInitialCapital = 0;
    let totalRealizedProfit = 0;
    let totalCapital = 0;
    
    // 计算总资金流动
    let totalFundIn = 0;
    let totalFundOut = 0;
    
    const platformDetails = platforms.map(p => {
      const rate = rateMap[p.currency]?.[targetCurrency] || 1;
      
      // 获取该平台的资金流动
      const fundFlow = fundFlowMap[p.id] || { total_in: 0, total_out: 0, total_other: 0, net_flow: 0 };
      
      const initialCapitalConverted = p.initial_capital * rate;
      const realizedProfitConverted = p.total_realized_profit * rate;
      const fundNetFlowConverted = fundFlow.net_flow * rate;
      
      // 总资金 = 初始资金 + 交易盈亏 + 资金净流入（存入-取出）
      // 注意：取出的钱不应该减少"总资金"显示，因为那是你已经赚到的钱
      // 但为了准确反映账户当前状态，我们需要考虑资金流动
      const totalCapitalConverted = initialCapitalConverted + realizedProfitConverted + fundNetFlowConverted;
      
      totalInitialCapital += initialCapitalConverted;
      totalRealizedProfit += realizedProfitConverted;
      totalCapital += totalCapitalConverted;
      totalFundIn += fundFlow.total_in * rate;
      totalFundOut += fundFlow.total_out * rate;
      
      return {
        id: p.id,
        name: p.name,
        original_currency: p.currency,
        display_currency: targetCurrency,
        exchange_rate: rate,
        initial_capital: {
          original: p.initial_capital,
          converted: initialCapitalConverted
        },
        total_realized_profit: {
          original: p.total_realized_profit,
          converted: realizedProfitConverted
        },
        fund_flow: {
          total_in: fundFlow.total_in,
          total_out: fundFlow.total_out,
          net_flow: fundFlow.net_flow,
          converted_net_flow: fundNetFlowConverted
        },
        total_capital: {
          original: p.initial_capital + p.total_realized_profit + fundFlow.net_flow,
          converted: totalCapitalConverted
        },
        change_percent: p.initial_capital > 0
          ? ((p.total_realized_profit / p.initial_capital) * 100).toFixed(2)
          : '0.00',
        transaction_count: p.transaction_count
      };
    });
    
    // 计算总体涨跌幅
    const totalChangePercent = totalInitialCapital > 0 
      ? ((totalRealizedProfit / totalInitialCapital) * 100).toFixed(2)
      : '0.00';
    
    res.json({
      display_currency: targetCurrency,
      summary: {
        total_initial_capital: totalInitialCapital,
        total_realized_profit: totalRealizedProfit,
        total_fund_in: totalFundIn,
        total_fund_out: totalFundOut,
        total_fund_net_flow: totalFundIn - totalFundOut,
        total_capital: totalCapital,
        total_change_percent: totalChangePercent,
        platform_count: platforms.length,
        total_transactions: platforms.reduce((sum, p) => sum + p.transaction_count, 0)
      },
      platforms: platformDetails,
      exchange_rates: rateMap
    });
  } catch (error) {
    console.error('获取资金总览失败:', error);
    res.status(500).json({ error: '获取资金总览失败', message: error.message });
  }
});

// 获取平台资金分布（用于图表）
router.get('/distribution', (req, res) => {
  try {
    const { currency = 'CNY' } = req.query;
    const targetCurrency = currency.toUpperCase();
    
    // 获取所有平台及其交易汇总
    const platforms = db.prepare(`
      SELECT 
        p.*,
        COALESCE(SUM(t.total_profit - t.total_fee), 0) as total_realized_profit
      FROM platforms p
      LEFT JOIN transactions t ON p.id = t.platform_id
      GROUP BY p.id
      ORDER BY p.id
    `).all();
    
    // 获取汇率
    const rates = db.prepare('SELECT * FROM exchange_rates').all();
    const rateMap = {};
    rates.forEach(r => {
      if (!rateMap[r.from_currency]) rateMap[r.from_currency] = {};
      rateMap[r.from_currency][r.to_currency] = r.rate;
    });
    
    // 计算分布数据
    const distribution = platforms.map(p => {
      const rate = rateMap[p.currency]?.[targetCurrency] || 1;
      const totalCapital = (p.initial_capital + p.total_realized_profit) * rate;
      
      return {
        name: p.name,
        value: Math.max(0, totalCapital), // 确保不为负数
        currency: targetCurrency
      };
    });
    
    // 计算总资金
    const total = distribution.reduce((sum, d) => sum + d.value, 0);
    
    // 添加百分比
    const distributionWithPercent = distribution.map(d => ({
      ...d,
      percent: total > 0 ? ((d.value / total) * 100).toFixed(2) : '0.00'
    }));
    
    res.json({
      display_currency: targetCurrency,
      total,
      distribution: distributionWithPercent
    });
  } catch (error) {
    console.error('获取资金分布失败:', error);
    res.status(500).json({ error: '获取资金分布失败', message: error.message });
  }
});

// 获取盈亏趋势（按月统计）
router.get('/trend', (req, res) => {
  try {
    const { currency = 'CNY', months = 12 } = req.query;
    const targetCurrency = currency.toUpperCase();
    
    // 获取汇率
    const rates = db.prepare('SELECT * FROM exchange_rates').all();
    const rateMap = {};
    rates.forEach(r => {
      if (!rateMap[r.from_currency]) rateMap[r.from_currency] = {};
      rateMap[r.from_currency][r.to_currency] = r.rate;
    });
    
    // 获取最近N个月的交易数据
    const transactions = db.prepare(`
      SELECT 
        t.*,
        p.currency as platform_currency,
        strftime('%Y-%m', t.close_time) as month
      FROM transactions t
      JOIN platforms p ON t.platform_id = p.id
      WHERE t.close_time IS NOT NULL
        AND t.close_time >= date('now', '-${parseInt(months)} months')
      ORDER BY t.close_time
    `).all();
    
    // 按月汇总
    const monthlyData = {};
    transactions.forEach(t => {
      if (!t.month) return;
      
      const rate = rateMap[t.platform_currency]?.[targetCurrency] || 1;
      const realizedProfit = (t.total_profit - t.total_fee) * rate;
      
      if (!monthlyData[t.month]) {
        monthlyData[t.month] = {
          month: t.month,
          profit: 0,
          loss: 0,
          net: 0,
          count: 0
        };
      }
      
      if (realizedProfit >= 0) {
        monthlyData[t.month].profit += realizedProfit;
      } else {
        monthlyData[t.month].loss += Math.abs(realizedProfit);
      }
      monthlyData[t.month].net += realizedProfit;
      monthlyData[t.month].count++;
    });
    
    // 转换为数组并排序
    const trend = Object.values(monthlyData).sort((a, b) => a.month.localeCompare(b.month));
    
    res.json({
      display_currency: targetCurrency,
      months: parseInt(months),
      trend
    });
  } catch (error) {
    console.error('获取盈亏趋势失败:', error);
    res.status(500).json({ error: '获取盈亏趋势失败', message: error.message });
  }
});

module.exports = router;

// {{END_MODIFICATIONS}}