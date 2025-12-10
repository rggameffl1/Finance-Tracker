// {{CODE-Cycle-Integration:
//   Task_ID: #T001-T006
//   Timestamp: 2025-12-08T05:02:57Z
//   Phase: D-Develop
//   Context-Analysis: "主服务入口，整合所有API路由"
//   Principle_Applied: "KISS, High Cohesion, Low Coupling"
// }}
// {{START_MODIFICATIONS}}

const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API路由
const platformsRouter = require('./routes/platforms');
const transactionsRouter = require('./routes/transactions');
const exchangeRatesRouter = require('./routes/exchangeRates');
const overviewRouter = require('./routes/overview');
const settingsRouter = require('./routes/settings');

app.use('/api/platforms', platformsRouter);
app.use('/api/transactions', transactionsRouter);
app.use('/api/exchange-rates', exchangeRatesRouter);
app.use('/api/overview', overviewRouter);
app.use('/api/settings', settingsRouter);

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(500).json({ 
    error: '服务器内部错误', 
    message: err.message 
  });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║   💰 Finance Tracker 服务已启动                            ║
║                                                            ║
║   本地访问: http://localhost:${PORT}                         ║
║   API文档: http://localhost:${PORT}/api/health               ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
  `);
});

// {{END_MODIFICATIONS}}