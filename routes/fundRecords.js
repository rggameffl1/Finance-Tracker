// {{CODE-Cycle-Integration:
//   Task_ID: #T041
//   Timestamp: 2025-12-15T04:35:00Z
//   Phase: D-Develop
//   Context-Analysis: "资金记录API重构 - 简化为存入/取出两类操作，实现初始资金联动"
//   Principle_Applied: "RESTful, SOLID, Error Handling, Transaction Safety"
// }}
// {{START_MODIFICATIONS}}

const express = require('express');
const router = express.Router();
const db = require('../database/db');

// 有效的资金记录类型（简化为只有存入和取出）
const VALID_TYPES = ['存入', '取出'];

// 格式化资金记录
function formatFundRecord(r) {
  return {
    ...r,
    amount: parseFloat(r.amount) || 0
  };
}

/**
 * 获取平台的当前资金状态
 * @param {number} platformId - 平台ID
 * @returns {Object} { initial_capital, total_profit, total_capital }
 */
function getPlatformFundStatus(platformId) {
  const result = db.prepare(`
    SELECT
      p.initial_capital,
      COALESCE(SUM(t.total_profit - t.total_fee), 0) as total_profit
    FROM platforms p
    LEFT JOIN transactions t ON p.id = t.platform_id
    WHERE p.id = ?
    GROUP BY p.id
  `).get(platformId);
  
  if (!result) {
    return null;
  }
  
  const initialCapital = parseFloat(result.initial_capital) || 0;
  const totalProfit = parseFloat(result.total_profit) || 0;
  const totalCapital = initialCapital + totalProfit;
  
  return {
    initial_capital: initialCapital,
    total_profit: totalProfit,
    total_capital: totalCapital
  };
}

/**
 * 更新平台的初始资金
 * @param {number} platformId - 平台ID
 * @param {number} newInitialCapital - 新的初始资金
 */
function updatePlatformInitialCapital(platformId, newInitialCapital) {
  db.prepare('UPDATE platforms SET initial_capital = ? WHERE id = ?')
    .run(String(newInitialCapital), platformId);
}

// 获取所有资金记录（支持分页）
router.get('/', (req, res) => {
  try {
    const { platform_id, page = 1, limit = 50 } = req.query;
    const limitNum = Math.min(parseInt(limit) || 50, 100);
    const offset = (parseInt(page) - 1) * limitNum;
    
    let query = `
      SELECT f.*, p.name as platform_name, p.currency as platform_currency
      FROM fund_records f
      JOIN platforms p ON f.platform_id = p.id
    `;
    let countQuery = 'SELECT COUNT(*) as total FROM fund_records f';
    const params = [];
    const countParams = [];
    
    if (platform_id) {
      query += ' WHERE f.platform_id = ?';
      countQuery += ' WHERE f.platform_id = ?';
      params.push(platform_id);
      countParams.push(platform_id);
    }
    
    query += ' ORDER BY f.record_time DESC LIMIT ? OFFSET ?';
    params.push(limitNum, offset);
    
    const records = db.prepare(query).all(...params);
    const { total } = db.prepare(countQuery).get(...countParams);
    
    const result = records.map(formatFundRecord);
    
    res.json({
      data: result,
      pagination: {
        page: parseInt(page),
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('获取资金记录失败:', error);
    res.status(500).json({ error: '获取资金记录失败', message: error.message });
  }
});

// 获取平台资金流动汇总（必须放在 /:id 之前，避免被当作 id 参数）
router.get('/summary/by-platform', (req, res) => {
  try {
    const summary = db.prepare(`
      SELECT
        p.id as platform_id,
        p.name as platform_name,
        p.currency,
        COALESCE(SUM(CASE WHEN f.type = '存入' THEN ABS(CAST(f.amount AS REAL)) ELSE 0 END), 0) as total_inflow,
        COALESCE(SUM(CASE WHEN f.type = '取出' THEN ABS(CAST(f.amount AS REAL)) ELSE 0 END), 0) as total_outflow,
        COUNT(f.id) as record_count
      FROM platforms p
      LEFT JOIN fund_records f ON p.id = f.platform_id
      GROUP BY p.id
      ORDER BY p.id
    `).all();
    
    // 计算净流入（流入 - 流出）
    const result = summary.map(s => ({
      ...s,
      net_flow: s.total_inflow - s.total_outflow
    }));
    
    res.json({ summary: result });
  } catch (error) {
    console.error('获取资金流动汇总失败:', error);
    res.status(500).json({ error: '获取资金流动汇率失败', message: error.message });
  }
});

// 获取平台资金状态（用于前端校验取出金额）
router.get('/platform-status/:platformId', (req, res) => {
  try {
    const { platformId } = req.params;
    const status = getPlatformFundStatus(platformId);
    
    if (!status) {
      return res.status(404).json({ error: '平台不存在' });
    }
    
    res.json(status);
  } catch (error) {
    console.error('获取平台资金状态失败:', error);
    res.status(500).json({ error: '获取平台资金状态失败', message: error.message });
  }
});

// 获取单个资金记录
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const record = db.prepare(`
      SELECT f.*, p.name as platform_name, p.currency as platform_currency
      FROM fund_records f
      JOIN platforms p ON f.platform_id = p.id
      WHERE f.id = ?
    `).get(id);
    
    if (!record) {
      return res.status(404).json({ error: '资金记录不存在' });
    }
    
    res.json(formatFundRecord(record));
  } catch (error) {
    console.error('获取资金记录详情失败:', error);
    res.status(500).json({ error: '获取资金记录详情失败', message: error.message });
  }
});

// 创建资金记录
router.post('/', (req, res) => {
  try {
    const {
      platform_id,
      type,
      amount,
      record_time,
      note
    } = req.body;
    
    // 验证必填字段
    if (!platform_id || !type || amount === undefined || amount === null || !record_time) {
      return res.status(400).json({
        error: '缺少必填字段',
        required: ['platform_id', 'type', 'amount', 'record_time']
      });
    }
    
    // 验证平台是否存在
    const platform = db.prepare('SELECT * FROM platforms WHERE id = ?').get(platform_id);
    if (!platform) {
      return res.status(400).json({ error: '指定的平台不存在' });
    }
    
    // 验证类型（只允许存入和取出）
    if (!VALID_TYPES.includes(type)) {
      return res.status(400).json({ error: `类型必须是以下之一: ${VALID_TYPES.join(', ')}` });
    }
    
    // 验证金额（必须为正数）
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      return res.status(400).json({ error: '金额必须是大于0的有效数字' });
    }
    
    // 获取平台当前资金状态
    const fundStatus = getPlatformFundStatus(platform_id);
    if (!fundStatus) {
      return res.status(400).json({ error: '获取平台资金状态失败' });
    }
    
    let newInitialCapital = fundStatus.initial_capital;
    
    if (type === '存入') {
      // 存入：增加初始资金
      newInitialCapital = fundStatus.initial_capital + amountNum;
    } else if (type === '取出') {
      // 取出：需要校验并处理三种场景
      const { initial_capital, total_profit, total_capital } = fundStatus;
      
      // 场景3：取出 > 总资金 → 阻止操作
      if (amountNum > total_capital) {
        return res.status(400).json({
          error: '取出金额超过可用资金',
          details: {
            requested: amountNum,
            available: total_capital,
            initial_capital: initial_capital,
            total_profit: total_profit
          },
          message: `取出金额 ${amountNum} 超过总资金 ${total_capital.toFixed(2)}，无法取出`
        });
      }
      
      // 场景1：取出 ≤ 初始资金 → 只减少初始资金
      if (amountNum <= initial_capital) {
        newInitialCapital = initial_capital - amountNum;
      } else {
        // 场景2：初始资金 < 取出 ≤ 总资金 → 初始资金归零
        // 注意：总盈亏是由交易记录计算的，不在这里修改
        // 但我们需要记录这个取出会"消耗"部分盈利
        newInitialCapital = 0;
        // 超出初始资金的部分会从盈利中扣除，但盈利是由交易记录计算的
        // 所以这里我们只需要将初始资金设为0
        // 实际的"盈利扣除"效果会通过初始资金为0来体现在涨跌幅计算中
      }
    }
    
    // 使用事务确保数据一致性
    const insertAndUpdate = db.transaction(() => {
      // 1. 插入资金记录
      const result = db.prepare(`
        INSERT INTO fund_records (platform_id, type, amount, record_time, note)
        VALUES (?, ?, ?, ?, ?)
      `).run(platform_id, type, String(amountNum), record_time, note || null);
      
      // 2. 更新平台初始资金
      updatePlatformInitialCapital(platform_id, newInitialCapital);
      
      return result.lastInsertRowid;
    });
    
    const newRecordId = insertAndUpdate();
    
    const newRecord = db.prepare(`
      SELECT f.*, p.name as platform_name, p.currency as platform_currency
      FROM fund_records f
      JOIN platforms p ON f.platform_id = p.id
      WHERE f.id = ?
    `).get(newRecordId);
    
    res.status(201).json({
      ...formatFundRecord(newRecord),
      platform_fund_status: getPlatformFundStatus(platform_id)
    });
  } catch (error) {
    console.error('创建资金记录失败:', error);
    res.status(500).json({ error: '创建资金记录失败', message: error.message });
  }
});

// 更新资金记录
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const {
      platform_id,
      type,
      amount,
      record_time,
      note
    } = req.body;
    
    // 验证ID
    const idNum = parseInt(id);
    if (isNaN(idNum)) {
      return res.status(400).json({ error: '无效的记录ID' });
    }
    
    const existing = db.prepare('SELECT * FROM fund_records WHERE id = ?').get(idNum);
    if (!existing) {
      return res.status(404).json({ error: '资金记录不存在' });
    }
    
    // 确定最终的平台ID
    let finalPlatformId = existing.platform_id;
    if (platform_id !== undefined && platform_id !== null) {
      const platformIdNum = parseInt(platform_id);
      if (isNaN(platformIdNum)) {
        return res.status(400).json({ error: '无效的平台ID' });
      }
      const platform = db.prepare('SELECT * FROM platforms WHERE id = ?').get(platformIdNum);
      if (!platform) {
        return res.status(400).json({ error: '指定的平台不存在' });
      }
      finalPlatformId = platformIdNum;
    }
    
    // 确定最终的类型
    let finalType = existing.type;
    if (type !== undefined && type !== null && type !== '') {
      if (!VALID_TYPES.includes(type)) {
        return res.status(400).json({ error: `类型必须是以下之一: ${VALID_TYPES.join(', ')}` });
      }
      finalType = type;
    }
    
    // 确定最终的金额
    let finalAmount = parseFloat(existing.amount);
    if (amount !== undefined && amount !== null && amount !== '') {
      const amountNum = parseFloat(amount);
      if (isNaN(amountNum) || amountNum <= 0) {
        return res.status(400).json({ error: '金额必须是大于0的有效数字' });
      }
      finalAmount = amountNum;
    }
    
    // 处理备注
    const noteValue = note !== undefined ? (note || null) : existing.note;
    
    // 计算需要对初始资金的调整
    // 首先撤销旧记录的影响，然后应用新记录的影响
    const oldPlatformId = existing.platform_id;
    const oldType = existing.type;
    const oldAmount = parseFloat(existing.amount);
    
    // 获取旧平台和新平台的资金状态
    const oldPlatformStatus = getPlatformFundStatus(oldPlatformId);
    const newPlatformStatus = finalPlatformId !== oldPlatformId
      ? getPlatformFundStatus(finalPlatformId)
      : oldPlatformStatus;
    
    if (!oldPlatformStatus || !newPlatformStatus) {
      return res.status(400).json({ error: '获取平台资金状态失败' });
    }
    
    // 计算撤销旧记录后的初始资金
    let oldPlatformNewInitial = oldPlatformStatus.initial_capital;
    if (oldType === '存入') {
      oldPlatformNewInitial -= oldAmount;
    } else if (oldType === '取出') {
      oldPlatformNewInitial += oldAmount;
    }
    
    // 如果平台没变，基于撤销后的状态计算新的初始资金
    // 如果平台变了，需要分别处理两个平台
    let newPlatformNewInitial = newPlatformStatus.initial_capital;
    
    if (finalPlatformId === oldPlatformId) {
      // 同一平台，基于撤销后的状态
      newPlatformNewInitial = oldPlatformNewInitial;
    }
    
    // 应用新记录的影响
    if (finalType === '存入') {
      newPlatformNewInitial += finalAmount;
    } else if (finalType === '取出') {
      // 需要校验取出金额
      // 计算应用新记录后的总资金
      const effectiveInitial = newPlatformNewInitial;
      const effectiveTotalCapital = effectiveInitial + newPlatformStatus.total_profit;
      
      if (finalAmount > effectiveTotalCapital) {
        return res.status(400).json({
          error: '取出金额超过可用资金',
          details: {
            requested: finalAmount,
            available: effectiveTotalCapital
          },
          message: `取出金额 ${finalAmount} 超过总资金 ${effectiveTotalCapital.toFixed(2)}，无法取出`
        });
      }
      
      if (finalAmount <= effectiveInitial) {
        newPlatformNewInitial = effectiveInitial - finalAmount;
      } else {
        newPlatformNewInitial = 0;
      }
    }
    
    // 使用事务确保数据一致性
    const updateTransaction = db.transaction(() => {
      // 1. 更新资金记录
      db.prepare(`
        UPDATE fund_records SET
          platform_id = ?,
          type = ?,
          amount = ?,
          record_time = COALESCE(?, record_time),
          note = ?
        WHERE id = ?
      `).run(
        finalPlatformId,
        finalType,
        String(finalAmount),
        record_time || null,
        noteValue,
        idNum
      );
      
      // 2. 更新平台初始资金
      if (finalPlatformId !== oldPlatformId) {
        // 平台变了，需要更新两个平台
        updatePlatformInitialCapital(oldPlatformId, oldPlatformNewInitial);
        updatePlatformInitialCapital(finalPlatformId, newPlatformNewInitial);
      } else {
        // 同一平台
        updatePlatformInitialCapital(finalPlatformId, newPlatformNewInitial);
      }
    });
    
    updateTransaction();
    
    const updated = db.prepare(`
      SELECT f.*, p.name as platform_name, p.currency as platform_currency
      FROM fund_records f
      JOIN platforms p ON f.platform_id = p.id
      WHERE f.id = ?
    `).get(idNum);
    
    res.json({
      ...formatFundRecord(updated),
      platform_fund_status: getPlatformFundStatus(finalPlatformId)
    });
  } catch (error) {
    console.error('更新资金记录失败:', error);
    res.status(500).json({ error: '更新资金记录失败', message: error.message });
  }
});

// 删除资金记录
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    
    const existing = db.prepare('SELECT * FROM fund_records WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: '资金记录不存在' });
    }
    
    const platformId = existing.platform_id;
    const type = existing.type;
    const amount = parseFloat(existing.amount);
    
    // 获取平台当前资金状态
    const fundStatus = getPlatformFundStatus(platformId);
    if (!fundStatus) {
      return res.status(400).json({ error: '获取平台资金状态失败' });
    }
    
    // 计算撤销该记录后的初始资金
    let newInitialCapital = fundStatus.initial_capital;
    if (type === '存入') {
      // 撤销存入：减少初始资金
      newInitialCapital -= amount;
    } else if (type === '取出') {
      // 撤销取出：增加初始资金
      newInitialCapital += amount;
    }
    
    // 使用事务确保数据一致性
    const deleteTransaction = db.transaction(() => {
      // 1. 删除资金记录
      db.prepare('DELETE FROM fund_records WHERE id = ?').run(id);
      
      // 2. 更新平台初始资金
      updatePlatformInitialCapital(platformId, newInitialCapital);
    });
    
    deleteTransaction();
    
    res.json({
      message: '资金记录删除成功',
      deleted: formatFundRecord(existing),
      platform_fund_status: getPlatformFundStatus(platformId)
    });
  } catch (error) {
    console.error('删除资金记录失败:', error);
    res.status(500).json({ error: '删除资金记录失败', message: error.message });
  }
});

module.exports = router;

// {{END_MODIFICATIONS}}