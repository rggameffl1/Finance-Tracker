// {{CODE-Cycle-Integration:
//   Task_ID: #T007
//   Timestamp: 2025-12-08T05:06:35Z
//   Phase: D-Develop
//   Context-Analysis: "汇率爬取独立脚本 - 从Bing获取汇率，支持定时任务"
//   Principle_Applied: "KISS, Error Handling, CLI Interface"
// }}
// {{START_MODIFICATIONS}}

const Database = require('better-sqlite3');
const path = require('path');
const cron = require('node-cron');

// 数据库路径
const dbPath = path.join(__dirname, '..', 'database', 'finance.db');

// 解析命令行参数
const args = process.argv.slice(2);
const isCronMode = args.includes('--cron');
const intervalArg = args.find(arg => arg.startsWith('--interval='));
const interval = intervalArg ? parseInt(intervalArg.split('=')[1]) : 3600000; // 默认1小时

// 货币对
const currencies = ['CNY', 'HKD', 'USD'];

// 从Bing获取汇率
async function fetchBingExchangeRate(from, to) {
  try {
    const fetch = (await import('node-fetch')).default;
    const url = `https://www.bing.com/search?q=1+${from}+to+${to}`;
    
    console.log(`  正在获取 ${from} -> ${to} 汇率...`);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const html = await response.text();
    
    // 多种正则模式尝试提取汇率
    const patterns = [
      // Bing货币转换器的数值
      /data-precision="[\d.]+">([0-9.]+)</,
      /class="b_focusTextLarge"[^>]*>([0-9.]+)</,
      // 文本格式 "1 CNY = 0.14 USD"
      new RegExp(`1\\s*${from}\\s*=\\s*([0-9.]+)\\s*${to}`, 'i'),
      // 其他可能的格式
      /<div[^>]*class="[^"]*currencyVal[^"]*"[^>]*>([0-9.]+)</,
      /id="knowledge"[^>]*>.*?([0-9.]+)\s*${to}/is
    ];
    
    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        const rate = parseFloat(match[1]);
        // 验证汇率在合理范围内
        if (rate > 0 && rate < 10000) {
          console.log(`  ✓ ${from} -> ${to}: ${rate}`);
          return rate;
        }
      }
    }
    
    console.warn(`  ✗ 无法从Bing获取 ${from} -> ${to} 汇率`);
    return null;
  } catch (error) {
    console.error(`  ✗ 获取汇率失败 ${from} -> ${to}:`, error.message);
    return null;
  }
}

// 备用汇率源 - 使用固定汇率（当Bing无法获取时）
const fallbackRates = {
  'CNY': { 'CNY': 1, 'HKD': 1.09, 'USD': 0.14 },
  'HKD': { 'CNY': 0.92, 'HKD': 1, 'USD': 0.13 },
  'USD': { 'CNY': 7.24, 'HKD': 7.80, 'USD': 1 }
};

// 更新所有汇率
async function updateAllRates() {
  console.log('\n========================================');
  console.log('开始更新汇率...');
  console.log('时间:', new Date().toLocaleString('zh-CN'));
  console.log('========================================\n');
  
  let db;
  try {
    db = new Database(dbPath);
    db.pragma('foreign_keys = ON');
    
    const updateRate = db.prepare(`
      INSERT OR REPLACE INTO exchange_rates (from_currency, to_currency, rate, updated_at) 
      VALUES (?, ?, ?, datetime('now', 'localtime'))
    `);
    
    let successCount = 0;
    let failCount = 0;
    
    for (const from of currencies) {
      for (const to of currencies) {
        if (from === to) {
          // 同币种汇率为1
          updateRate.run(from, to, 1);
          successCount++;
          console.log(`  ✓ ${from} -> ${to}: 1 (固定)`);
        } else {
          const rate = await fetchBingExchangeRate(from, to);
          if (rate !== null) {
            updateRate.run(from, to, rate);
            successCount++;
          } else {
            // 使用备用汇率
            const fallbackRate = fallbackRates[from]?.[to];
            if (fallbackRate) {
              updateRate.run(from, to, fallbackRate);
              console.log(`  ⚠ ${from} -> ${to}: ${fallbackRate} (备用)`);
              successCount++;
            } else {
              failCount++;
            }
          }
        }
        
        // 添加延迟避免请求过快
        if (from !== to) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }
    
    console.log('\n========================================');
    console.log(`汇率更新完成！成功: ${successCount}, 失败: ${failCount}`);
    console.log('========================================\n');
    
    // 显示当前所有汇率
    const allRates = db.prepare('SELECT * FROM exchange_rates ORDER BY from_currency, to_currency').all();
    console.log('当前汇率表:');
    console.log('----------------------------------------');
    allRates.forEach(r => {
      console.log(`  ${r.from_currency} -> ${r.to_currency}: ${r.rate} (更新于 ${r.updated_at})`);
    });
    console.log('----------------------------------------\n');
    
  } catch (error) {
    console.error('更新汇率时发生错误:', error);
  } finally {
    if (db) db.close();
  }
}

// 主函数
async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║                                                            ║');
  console.log('║   💱 Finance Tracker 汇率更新脚本                          ║');
  console.log('║                                                            ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');
  
  if (isCronMode) {
    // 定时任务模式
    const cronExpression = '0 * * * *'; // 每小时执行一次
    console.log(`启动定时任务模式，每小时更新一次汇率...`);
    console.log(`Cron表达式: ${cronExpression}`);
    console.log('按 Ctrl+C 停止\n');
    
    // 立即执行一次
    await updateAllRates();
    
    // 设置定时任务
    cron.schedule(cronExpression, async () => {
      await updateAllRates();
    });
  } else if (intervalArg) {
    // 间隔模式
    console.log(`启动间隔模式，每 ${interval / 1000} 秒更新一次汇率...`);
    console.log('按 Ctrl+C 停止\n');
    
    // 立即执行一次
    await updateAllRates();
    
    // 设置定时器
    setInterval(async () => {
      await updateAllRates();
    }, interval);
  } else {
    // 单次执行模式
    console.log('单次执行模式\n');
    await updateAllRates();
    console.log('完成！');
    process.exit(0);
  }
}

// 运行
main().catch(error => {
  console.error('脚本执行失败:', error);
  process.exit(1);
});

// {{END_MODIFICATIONS}}