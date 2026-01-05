// {{CODE-Cycle-Integration:
//   Task_ID: #T056-T058
//   Timestamp: 2026-01-05T04:38:00Z
//   Phase: D-Develop
//   Context-Analysis: "交易记录API - CRUD接口实现，自动计算持仓时间和实现盈亏，新增统计分析接口"
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

// 格式化持仓时间（毫秒转可读格式）
function formatHoldingTimeMs(ms) {
  if (!ms || ms <= 0) return '0秒';
  
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  
  let result = '';
  if (days > 0) result += `${days}天`;
  if (hours > 0) result += `${hours}小时`;
  if (minutes > 0 && days === 0) result += `${minutes}分钟`;
  
  return result || '0分钟';
}

// 计算持仓时间毫秒数
function calculateHoldingTimeMs(openTime, closeTime) {
  if (!openTime || !closeTime) return 0;
  const open = new Date(openTime);
  const close = new Date(closeTime);
  const diffMs = close - open;
  return diffMs > 0 ? diffMs : 0;
}

// 格式化交易记录
function formatTransaction(t) {
  return {
    ...t,
    holding_time: calculateHoldingTime(t.open_time, t.close_time),
    realized_profit: t.total_profit - t.total_fee
  };
}

// 获取所有交易记录（支持传统分页和游标分页）
router.get('/', (req, res) => {
  try {
    const { platform_id, page = 1, limit = 50, cursor, cursor_id } = req.query;
    const limitNum = Math.min(parseInt(limit) || 50, 100); // 最大100条
    
    // 使用游标分页（更高效，适合大数据量）
    if (cursor) {
      return handleCursorPagination(req, res, platform_id, cursor, cursor_id, limitNum);
    }
    
    // 传统 OFFSET 分页（兼容现有前端）
    const offset = (parseInt(page) - 1) * limitNum;
    
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
    params.push(limitNum, offset);
    
    const transactions = db.prepare(query).all(...params);
    const { total } = db.prepare(countQuery).get(...countParams);
    
    const result = transactions.map(formatTransaction);
    
    // 生成游标信息（供前端切换到游标分页时使用）
    const lastItem = transactions[transactions.length - 1];
    const nextCursor = lastItem ? {
      open_time: lastItem.open_time,
      id: lastItem.id
    } : null;
    
    res.json({
      data: result,
      pagination: {
        page: parseInt(page),
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      },
      // 游标分页信息（可选使用）
      cursor_info: {
        next_cursor: nextCursor ? Buffer.from(JSON.stringify(nextCursor)).toString('base64') : null,
        has_more: offset + transactions.length < total
      }
    });
  } catch (error) {
    console.error('获取交易记录失败:', error);
    res.status(500).json({ error: '获取交易记录失败', message: error.message });
  }
});

// 游标分页处理函数（更高效，适合大数据量）
function handleCursorPagination(req, res, platform_id, cursor, cursor_id, limit) {
  try {
    // 解析游标
    let cursorData = null;
    try {
      cursorData = JSON.parse(Buffer.from(cursor, 'base64').toString('utf8'));
    } catch (e) {
      return res.status(400).json({ error: '无效的游标' });
    }
    
    const { open_time, id } = cursorData;
    
    // 构建查询（使用索引优化）
    let query = `
      SELECT t.*, p.name as platform_name, p.currency as platform_currency
      FROM transactions t
      JOIN platforms p ON t.platform_id = p.id
      WHERE (t.open_time < ? OR (t.open_time = ? AND t.id < ?))
    `;
    const params = [open_time, open_time, id];
    
    if (platform_id) {
      query += ' AND t.platform_id = ?';
      params.push(platform_id);
    }
    
    query += ' ORDER BY t.open_time DESC, t.id DESC LIMIT ?';
    params.push(limit + 1); // 多取一条判断是否有下一页
    
    const transactions = db.prepare(query).all(...params);
    
    // 判断是否有更多数据
    const hasMore = transactions.length > limit;
    if (hasMore) {
      transactions.pop(); // 移除多取的那一条
    }
    
    const result = transactions.map(formatTransaction);
    
    // 生成下一页游标
    const lastItem = transactions[transactions.length - 1];
    const nextCursor = lastItem && hasMore ? {
      open_time: lastItem.open_time,
      id: lastItem.id
    } : null;
    
    res.json({
      data: result,
      cursor_info: {
        next_cursor: nextCursor ? Buffer.from(JSON.stringify(nextCursor)).toString('base64') : null,
        has_more: hasMore
      }
    });
  } catch (error) {
    console.error('游标分页查询失败:', error);
    res.status(500).json({ error: '获取交易记录失败', message: error.message });
  }
}

// ==================== 统计分析API ====================

// 获取总统计数据 (任务56)
router.get('/stats', (req, res) => {
  try {
    const { platform_id } = req.query;
    
    // 构建基础查询条件
    let whereClause = '';
    const params = [];
    if (platform_id) {
      whereClause = 'WHERE t.platform_id = ?';
      params.push(platform_id);
    }
    
    // 获取所有交易记录用于计算
    const transactions = db.prepare(`
      SELECT t.*, p.name as platform_name, p.currency as platform_currency
      FROM transactions t
      JOIN platforms p ON t.platform_id = p.id
      ${whereClause}
      ORDER BY t.open_time DESC
    `).all(...params);
    
    if (transactions.length === 0) {
      return res.json({
        summary: {
          total_trades: 0,
          profit_trades: 0,
          loss_trades: 0,
          total_profit: 0,
          total_fee: 0,
          realized_profit: 0,
          win_rate: 0,
          max_profit: 0,
          max_loss: 0,
          avg_profit: 0,
          profit_loss_ratio: 0,
          total_investment: 0,
          roi: 0,
          total_holding_time_formatted: '0',
          avg_holding_time_formatted: '0',
          first_trade: null,
          last_trade: null
        },
        by_asset: [],
        type_distribution: {},
        direction_distribution: {}
      });
    }
    
    // 计算汇总统计
    let totalProfit = 0;
    let totalFee = 0;
    let totalInvestment = 0;
    let profitTrades = 0;
    let lossTrades = 0;
    let maxProfit = 0;
    let maxLoss = 0;
    let totalHoldingTimeMs = 0;
    let closedTradesCount = 0;
    
    // 按交易对分组统计
    const assetMap = new Map();
    // 按类型分组统计
    const typeMap = new Map();
    // 按方向分组统计
    const directionMap = new Map();
    
    transactions.forEach(t => {
      const profit = parseFloat(t.total_profit) || 0;
      const fee = parseFloat(t.total_fee) || 0;
      const realizedProfit = profit - fee;
      const investment = parseFloat(t.investment) || 0;
      
      totalProfit += profit;
      totalFee += fee;
      totalInvestment += investment;
      
      if (realizedProfit > 0) {
        profitTrades++;
        if (realizedProfit > maxProfit) maxProfit = realizedProfit;
      } else if (realizedProfit < 0) {
        lossTrades++;
        if (realizedProfit < maxLoss) maxLoss = realizedProfit;
      }
      
      // 计算持仓时间
      if (t.close_time) {
        const holdingMs = calculateHoldingTimeMs(t.open_time, t.close_time);
        totalHoldingTimeMs += holdingMs;
        closedTradesCount++;
      }
      
      // 按交易对分组
      const assetKey = `${t.asset_code}|${t.platform_id}`;
      if (!assetMap.has(assetKey)) {
        assetMap.set(assetKey, {
          asset_code: t.asset_code,
          asset_name: t.asset_name,
          platform_id: t.platform_id,
          platform_name: t.platform_name,
          platform_currency: t.platform_currency,
          count: 0,
          profit_count: 0,
          loss_count: 0,
          total_profit: 0,
          total_fee: 0,
          realized_profit: 0
        });
      }
      const assetData = assetMap.get(assetKey);
      assetData.count++;
      assetData.total_profit += profit;
      assetData.total_fee += fee;
      assetData.realized_profit += realizedProfit;
      if (realizedProfit > 0) assetData.profit_count++;
      else if (realizedProfit < 0) assetData.loss_count++;
      
      // 按类型分组
      const typeKey = t.type || '未知';
      if (!typeMap.has(typeKey)) {
        typeMap.set(typeKey, { count: 0, profit: 0, fee: 0 });
      }
      const typeData = typeMap.get(typeKey);
      typeData.count++;
      typeData.profit += profit;
      typeData.fee += fee;
      
      // 按方向分组
      const dirKey = t.direction || '未知';
      if (!directionMap.has(dirKey)) {
        directionMap.set(dirKey, { count: 0, profit: 0, fee: 0 });
      }
      const dirData = directionMap.get(dirKey);
      dirData.count++;
      dirData.profit += profit;
      dirData.fee += fee;
    });
    
    const totalTrades = transactions.length;
    const realizedProfit = totalProfit - totalFee;
    const winRate = totalTrades > 0 ? (profitTrades / totalTrades * 100) : 0;
    const avgProfit = totalTrades > 0 ? (realizedProfit / totalTrades) : 0;
    
    // 计算盈亏比
    const avgWin = profitTrades > 0 ? (Array.from(assetMap.values()).reduce((sum, a) => sum + (a.realized_profit > 0 ? a.realized_profit : 0), 0) / profitTrades) : 0;
    const avgLossAbs = lossTrades > 0 ? Math.abs(Array.from(assetMap.values()).reduce((sum, a) => sum + (a.realized_profit < 0 ? a.realized_profit : 0), 0) / lossTrades) : 0;
    const profitLossRatio = avgLossAbs > 0 ? (avgWin / avgLossAbs) : (avgWin > 0 ? Infinity : 0);
    
    // ROI
    const roi = totalInvestment > 0 ? (realizedProfit / totalInvestment * 100) : 0;
    
    // 持仓时间
    const avgHoldingTimeMs = closedTradesCount > 0 ? (totalHoldingTimeMs / closedTradesCount) : 0;
    
    // 按交易对分组数组（按实现盈亏排序）
    const byAsset = Array.from(assetMap.values())
      .map(a => ({
        ...a,
        win_rate: a.count > 0 ? (a.profit_count / a.count * 100).toFixed(1) : '0.0'
      }))
      .sort((a, b) => b.realized_profit - a.realized_profit);
    
    // 类型分布
    const typeDistribution = {};
    typeMap.forEach((data, type) => {
      typeDistribution[type] = {
        count: data.count,
        percent: (data.count / totalTrades * 100).toFixed(1),
        profit: data.profit,
        fee: data.fee,
        realized_profit: data.profit - data.fee
      };
    });
    
    // 方向分布
    const directionDistribution = {};
    directionMap.forEach((data, dir) => {
      directionDistribution[dir] = {
        count: data.count,
        percent: (data.count / totalTrades * 100).toFixed(1),
        profit: data.profit,
        fee: data.fee,
        realized_profit: data.profit - data.fee
      };
    });
    
    // 首次和最近交易时间
    const sortedByTime = [...transactions].sort((a, b) => new Date(a.open_time) - new Date(b.open_time));
    const firstTrade = sortedByTime[0]?.open_time || null;
    const lastTrade = sortedByTime[sortedByTime.length - 1]?.open_time || null;
    
    res.json({
      summary: {
        total_trades: totalTrades,
        profit_trades: profitTrades,
        loss_trades: lossTrades,
        total_profit: totalProfit,
        total_fee: totalFee,
        realized_profit: realizedProfit,
        win_rate: parseFloat(winRate.toFixed(2)),
        max_profit: maxProfit,
        max_loss: maxLoss,
        avg_profit: parseFloat(avgProfit.toFixed(2)),
        profit_loss_ratio: profitLossRatio === Infinity ? '∞' : parseFloat(profitLossRatio.toFixed(2)),
        total_investment: totalInvestment,
        roi: parseFloat(roi.toFixed(2)),
        total_holding_time_formatted: formatHoldingTimeMs(totalHoldingTimeMs),
        avg_holding_time_formatted: formatHoldingTimeMs(avgHoldingTimeMs),
        first_trade: firstTrade,
        last_trade: lastTrade,
        asset_count: assetMap.size
      },
      by_asset: byAsset,
      type_distribution: typeDistribution,
      direction_distribution: directionDistribution
    });
  } catch (error) {
    console.error('获取总统计数据失败:', error);
    res.status(500).json({ error: '获取总统计数据失败', message: error.message });
  }
});

// 获取交易对列表 (任务57)
router.get('/asset-codes', (req, res) => {
  try {
    const { platform_id } = req.query;
    
    let whereClause = '';
    const params = [];
    if (platform_id) {
      whereClause = 'WHERE t.platform_id = ?';
      params.push(platform_id);
    }
    
    const assetCodes = db.prepare(`
      SELECT
        t.asset_code,
        t.asset_name,
        t.platform_id,
        p.name as platform_name,
        p.currency as platform_currency,
        COUNT(*) as trade_count,
        SUM(CAST(t.total_profit AS REAL) - CAST(t.total_fee AS REAL)) as total_realized_profit
      FROM transactions t
      JOIN platforms p ON t.platform_id = p.id
      ${whereClause}
      GROUP BY t.asset_code, t.platform_id
      ORDER BY trade_count DESC
    `).all(...params);
    
    res.json({
      data: assetCodes.map(a => ({
        ...a,
        total_realized_profit: parseFloat(a.total_realized_profit) || 0
      }))
    });
  } catch (error) {
    console.error('获取交易对列表失败:', error);
    res.status(500).json({ error: '获取交易对列表失败', message: error.message });
  }
});

// 获取单个交易对统计 (任务58)
router.get('/asset-stats/:asset_code', (req, res) => {
  try {
    const { asset_code } = req.params;
    const { platform_id } = req.query;
    
    // 构建查询条件
    let whereClause = 'WHERE t.asset_code = ?';
    const params = [asset_code];
    
    if (platform_id) {
      whereClause += ' AND t.platform_id = ?';
      params.push(platform_id);
    }
    
    // 获取该交易对的所有交易记录
    const transactions = db.prepare(`
      SELECT t.*, p.name as platform_name, p.currency as platform_currency
      FROM transactions t
      JOIN platforms p ON t.platform_id = p.id
      ${whereClause}
      ORDER BY t.open_time DESC
    `).all(...params);
    
    if (transactions.length === 0) {
      return res.status(404).json({ error: '未找到该交易对的交易记录' });
    }
    
    // 获取基本信息
    const firstRecord = transactions[0];
    const assetName = firstRecord.asset_name;
    const platformName = firstRecord.platform_name;
    const platformCurrency = firstRecord.platform_currency;
    const platformId = firstRecord.platform_id;
    
    // 计算统计数据
    let totalProfit = 0;
    let totalFee = 0;
    let totalInvestment = 0;
    let profitTrades = 0;
    let lossTrades = 0;
    let maxProfit = 0;
    let maxLoss = 0;
    let totalHoldingTimeMs = 0;
    let closedTradesCount = 0;
    let profitSum = 0;  // 盈利交易的总盈利
    let lossSum = 0;    // 亏损交易的总亏损(绝对值)
    
    // 按类型分组统计
    const typeMap = new Map();
    // 按方向分组统计
    const directionMap = new Map();
    
    transactions.forEach(t => {
      const profit = parseFloat(t.total_profit) || 0;
      const fee = parseFloat(t.total_fee) || 0;
      const realizedProfit = profit - fee;
      const investment = parseFloat(t.investment) || 0;
      
      totalProfit += profit;
      totalFee += fee;
      totalInvestment += investment;
      
      if (realizedProfit > 0) {
        profitTrades++;
        profitSum += realizedProfit;
        if (realizedProfit > maxProfit) maxProfit = realizedProfit;
      } else if (realizedProfit < 0) {
        lossTrades++;
        lossSum += Math.abs(realizedProfit);
        if (realizedProfit < maxLoss) maxLoss = realizedProfit;
      }
      
      // 计算持仓时间
      if (t.close_time) {
        const holdingMs = calculateHoldingTimeMs(t.open_time, t.close_time);
        totalHoldingTimeMs += holdingMs;
        closedTradesCount++;
      }
      
      // 按类型分组
      const typeKey = t.type || '未知';
      if (!typeMap.has(typeKey)) {
        typeMap.set(typeKey, { count: 0, profit: 0, fee: 0 });
      }
      const typeData = typeMap.get(typeKey);
      typeData.count++;
      typeData.profit += profit;
      typeData.fee += fee;
      
      // 按方向分组
      const dirKey = t.direction || '未知';
      if (!directionMap.has(dirKey)) {
        directionMap.set(dirKey, { count: 0, profit: 0, fee: 0 });
      }
      const dirData = directionMap.get(dirKey);
      dirData.count++;
      dirData.profit += profit;
      dirData.fee += fee;
    });
    
    const totalTrades = transactions.length;
    const realizedProfit = totalProfit - totalFee;
    const winRate = totalTrades > 0 ? (profitTrades / totalTrades * 100) : 0;
    const avgProfit = totalTrades > 0 ? (realizedProfit / totalTrades) : 0;
    
    // 计算盈亏比 (平均盈利 / 平均亏损)
    const avgWin = profitTrades > 0 ? (profitSum / profitTrades) : 0;
    const avgLossAbs = lossTrades > 0 ? (lossSum / lossTrades) : 0;
    const profitLossRatio = avgLossAbs > 0 ? (avgWin / avgLossAbs) : (avgWin > 0 ? Infinity : 0);
    
    // ROI
    const roi = totalInvestment > 0 ? (realizedProfit / totalInvestment * 100) : 0;
    
    // 持仓时间
    const avgHoldingTimeMs = closedTradesCount > 0 ? (totalHoldingTimeMs / closedTradesCount) : 0;
    
    // 类型分布
    const typeDistribution = {};
    typeMap.forEach((data, type) => {
      typeDistribution[type] = {
        count: data.count,
        percent: (data.count / totalTrades * 100).toFixed(1),
        profit: data.profit,
        fee: data.fee,
        realized_profit: data.profit - data.fee
      };
    });
    
    // 方向分布
    const directionDistribution = {};
    directionMap.forEach((data, dir) => {
      directionDistribution[dir] = {
        count: data.count,
        percent: (data.count / totalTrades * 100).toFixed(1),
        profit: data.profit,
        fee: data.fee,
        realized_profit: data.profit - data.fee
      };
    });
    
    // 首次和最近交易时间
    const sortedByTime = [...transactions].sort((a, b) => new Date(a.open_time) - new Date(b.open_time));
    const firstTrade = sortedByTime[0]?.open_time || null;
    const lastTrade = sortedByTime[sortedByTime.length - 1]?.open_time || null;
    
    res.json({
      asset_code: asset_code,
      asset_name: assetName,
      platform: {
        id: platformId,
        name: platformName,
        currency: platformCurrency
      },
      summary: {
        total_trades: totalTrades,
        profit_trades: profitTrades,
        loss_trades: lossTrades,
        total_profit: totalProfit,
        total_fee: totalFee,
        realized_profit: realizedProfit,
        win_rate: parseFloat(winRate.toFixed(2)),
        max_profit: maxProfit,
        max_loss: maxLoss,
        avg_profit: parseFloat(avgProfit.toFixed(2)),
        profit_loss_ratio: profitLossRatio === Infinity ? '∞' : parseFloat(profitLossRatio.toFixed(2)),
        total_investment: totalInvestment,
        roi: parseFloat(roi.toFixed(2)),
        total_holding_time_ms: totalHoldingTimeMs,
        total_holding_time_formatted: formatHoldingTimeMs(totalHoldingTimeMs),
        avg_holding_time_ms: avgHoldingTimeMs,
        avg_holding_time_formatted: formatHoldingTimeMs(avgHoldingTimeMs),
        first_trade: firstTrade,
        last_trade: lastTrade
      },
      type_distribution: typeDistribution,
      direction_distribution: directionDistribution,
      transactions: transactions.map(formatTransaction)
    });
  } catch (error) {
    console.error('获取交易对统计失败:', error);
    res.status(500).json({ error: '获取交易对统计失败', message: error.message });
  }
});

// ==================== CRUD API ====================

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
    if (!['合约', '现货', '事件'].includes(type)) {
      return res.status(400).json({ error: '类型必须是 合约、现货 或 事件' });
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
    if (type && !['合约', '现货', '事件'].includes(type)) {
      return res.status(400).json({ error: '类型必须是 合约、现货 或 事件' });
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