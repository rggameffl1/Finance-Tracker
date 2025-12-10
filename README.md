# 💰 Finance Tracker - 多平台资金管理系统

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-20+-green?style=flat-square&logo=node.js" alt="Node.js">
  <img src="https://img.shields.io/badge/Express-4.x-blue?style=flat-square&logo=express" alt="Express">
  <img src="https://img.shields.io/badge/SQLite-3-blue?style=flat-square&logo=sqlite" alt="SQLite">
  <img src="https://img.shields.io/badge/Docker-Ready-2496ED?style=flat-square&logo=docker" alt="Docker">
  <img src="https://img.shields.io/badge/License-GPL%20v3.0-red?style=flat-square&logo=gnu" alt="License">
</p>

一个轻量级的多平台资金追踪与记账系统，支持 A股、港股、美股、虚拟币等多种投资平台的资金管理。

## 🖼️ 预览图
![1](https://github.com/rggameffl1/Finance-Tracker/blob/main/images/FireShot Capture 008 - Finance Tracker - 多平台资金管理系统 - [localhost].png)
![2](https://github.com/rggameffl1/Finance-Tracker/blob/main/images/FireShot Capture 009 - Finance Tracker - 多平台资金管理系统 - [localhost].png)
![3](https://github.com/rggameffl1/Finance-Tracker/blob/main/images/FireShot Capture 010 - Finance Tracker - 多平台资金管理系统 - [localhost].png)

## ✨ 功能特性

### 📊 资金总览
- 全平台资金汇总展示
- 支持 CNY/HKD/USD 多币种显示
- 实时汇率转换
- 总盈亏与涨跌幅统计

### 🏛️ 平台管理
- 预设 A股、港股、美股、虚拟币四大平台
- 自定义初始资金设置
- 各平台独立币种配置

### 📝 交易记录
- 完整的交易记录管理（增删改查）
- 支持现货/合约交易类型
- 支持开多/开空方向
- 杠杆倍数记录
- 开仓/平仓价格与时间
- 盈亏与手续费统计
- 交易理由备注

### 💱 汇率管理
- 自动从 Bing 获取实时汇率
- 支持定时自动更新
- 备用汇率机制保证可用性

### 🎨 用户体验
- 响应式设计，支持移动端
- 深色/浅色主题切换
- 现代化 UI 界面

## 🛠️ 技术栈

- **后端**: Node.js + Express.js
- **数据库**: SQLite (better-sqlite3)
- **前端**: 原生 HTML/CSS/JavaScript
- **汇率获取**: Cheerio + Node-fetch
- **定时任务**: Node-cron
- **容器化**: Docker + Docker Compose

## 📦 快速开始

### 方式一：Docker 部署（推荐）

#### 前置要求
- Docker 20.10+
- Docker Compose 2.0+

#### 部署步骤

```bash
# 1. 克隆项目
git clone https://github.com/your-username/finance-tracker.git
cd finance-tracker

# 2. 使用 Docker Compose 启动
docker-compose up -d

# 3. 查看日志
docker-compose logs -f

# 4. 访问应用
# 打开浏览器访问 http://localhost:3000
```

#### Docker 常用命令

```bash
# 停止服务
docker-compose down

# 重新构建并启动
docker-compose up -d --build

# 查看容器状态
docker-compose ps

# 进入容器
docker exec -it finance-tracker sh

# 查看数据卷
docker volume ls | grep finance

# 备份数据库
docker cp finance-tracker:/app/database/finance.db ./backup/
```

### 方式二：本地开发

#### 前置要求
- Node.js 20+
- npm 或 yarn
- Python 3 (用于编译 better-sqlite3)
- C++ 编译工具链

#### 安装步骤

```bash
# 1. 克隆项目
git clone https://github.com/your-username/finance-tracker.git
cd finance-tracker

# 2. 安装依赖
npm install

# 3. 初始化数据库
npm run init-db

# 4. 启动服务
npm start

# 或使用开发模式（自动重启）
npm run dev
```

## 📖 使用说明

### 首次使用

1. 访问 `http://localhost:3000`
2. 系统已预设四个平台（A股、港股、美股、虚拟币）
3. 点击平台卡片上的设置按钮，配置各平台的初始资金
4. 点击"新增记录"添加交易记录

### 交易记录管理

| 字段 | 说明 |
|------|------|
| 平台 | 选择交易所属平台 |
| 名称 | 资产名称，如"腾讯控股"、"BTC" |
| 代码 | 资产代码，如"00700.HK"、"BTC-USDT" |
| 类型 | 现货或合约 |
| 方向 | 开多或开空 |
| 杠杆 | 杠杆倍数，现货默认为1 |
| 开仓价格 | 买入/开仓时的价格 |
| 平仓价格 | 卖出/平仓时的价格（可选） |
| 投入资金 | 本次交易投入的资金 |
| 持仓量 | 持有数量，可自动计算 |
| 开仓时间 | 交易开始时间 |
| 平仓时间 | 交易结束时间（可选） |
| 总盈亏 | 本次交易的盈亏金额 |
| 总费用 | 手续费等费用 |
| 交易理由 | 记录交易决策原因 |

### 汇率更新

```bash
# 手动更新汇率
npm run fetch-rates

# 启动定时更新（每小时）
npm run fetch-rates:cron
```

## 🔌 API 接口

### 健康检查
```
GET /api/health
```

### 平台管理
```
GET    /api/platforms          # 获取所有平台
GET    /api/platforms/:id      # 获取单个平台
PUT    /api/platforms/:id      # 更新平台信息
```

### 交易记录
```
GET    /api/transactions       # 获取交易记录（支持分页和筛选）
GET    /api/transactions/:id   # 获取单条记录
POST   /api/transactions       # 创建交易记录
PUT    /api/transactions/:id   # 更新交易记录
DELETE /api/transactions/:id   # 删除交易记录
```

### 汇率
```
GET    /api/exchange-rates     # 获取所有汇率
POST   /api/exchange-rates/refresh  # 刷新汇率
```

### 总览
```
GET    /api/overview           # 获取资金总览数据
```

### 设置
```
GET    /api/settings           # 获取设置
PUT    /api/settings/:key      # 更新设置
```

## 📁 项目结构

```
finance-tracker/
├── database/
│   ├── db.js              # 数据库连接模块
│   ├── init.js            # 数据库初始化脚本
│   └── finance.db         # SQLite 数据库文件
├── public/
│   ├── index.html         # 前端页面
│   ├── css/
│   │   └── style.css      # 样式文件
│   └── js/
│       ├── api.js         # API 调用模块
│       ├── app.js         # 主应用逻辑
│       └── utils.js       # 工具函数
├── routes/
│   ├── platforms.js       # 平台路由
│   ├── transactions.js    # 交易记录路由
│   ├── exchangeRates.js   # 汇率路由
│   ├── overview.js        # 总览路由
│   └── settings.js        # 设置路由
├── scripts/
│   └── fetchExchangeRate.js  # 汇率获取脚本
├── server.js              # 服务入口
├── package.json           # 项目配置
├── Dockerfile             # Docker 镜像配置
├── docker-compose.yml     # Docker Compose 配置
├── .dockerignore          # Docker 忽略文件
└── README.md              # 项目文档
```

## 🗄️ 数据库结构

### platforms 表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| name | TEXT | 平台名称 |
| currency | TEXT | 币种 (CNY/HKD/USD) |
| initial_capital | REAL | 初始资金 |
| created_at | DATETIME | 创建时间 |
| updated_at | DATETIME | 更新时间 |

### transactions 表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| platform_id | INTEGER | 平台ID（外键） |
| asset_name | TEXT | 资产名称 |
| asset_code | TEXT | 资产代码 |
| type | TEXT | 类型（合约/现货） |
| direction | TEXT | 方向（开多/开空） |
| leverage | TEXT | 杠杆倍数 |
| quantity | TEXT | 持仓量 |
| open_price | TEXT | 开仓价格 |
| close_price | TEXT | 平仓价格 |
| investment | TEXT | 投入资金 |
| open_time | TEXT | 开仓时间 |
| close_time | TEXT | 平仓时间 |
| total_profit | TEXT | 总盈亏 |
| total_fee | TEXT | 总费用 |
| reason | TEXT | 交易理由 |

### exchange_rates 表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| from_currency | TEXT | 源币种 |
| to_currency | TEXT | 目标币种 |
| rate | REAL | 汇率 |
| updated_at | DATETIME | 更新时间 |

## 🔧 环境变量

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| PORT | 3000 | 服务端口 |
| NODE_ENV | production | 运行环境 |
| TZ | Asia/Shanghai | 时区设置 |

## 📝 更新日志

### v1.0.0 (2024-12)
- 🎉 首次发布
- ✅ 多平台资金管理
- ✅ 交易记录 CRUD
- ✅ 实时汇率获取
- ✅ 多币种支持
- ✅ Docker 部署支持
- ✅ 深色/浅色主题

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 提交 Pull Request

## 📝 许可证

本项目采用 GNU General Public License v3.0 (GPL v3.0) 许可证

### GPL v3.0 意味着：

✅ **可自由使用、修改和分发**
- 您可以自由地使用、修改和分发本软件
- 可用于个人和商业目的

📝 **必须开源修改版本**
- 如果您修改了代码并分发，必须开源修改后的版本
- 任何衍生作品也必须使用 GPL v3.0 协议

📝 **必须保留原作者版权**
- 需要保留原作者的版权声明
- 必须标明原始作者和贡献者

📝 **衍生作品必须使用 GPL v3.0 协议**
- 基于本项目创建的任何衍生作品都必须使用相同的许可证
- 确保开源精神的传承

### 许可证文件
- 完整许可证文本请查看 [LICENSE](LICENSE) 文件
- 或访问 [GNU GPL v3.0 官方页面](https://www.gnu.org/licenses/gpl-3.0.html)

### 商业使用
- ✅ 允许商业使用
- ✅ 允许集成到商业产品中
- ⚠️ 但整个产品必须开源并使用 GPL v3.0 许可证

## 🙏 致谢

- [Express.js](https://expressjs.com/) - Web 框架
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) - SQLite 驱动
- [Cheerio](https://cheerio.js.org/) - HTML 解析
- [Node-cron](https://github.com/node-cron/node-cron) - 定时任务

---

<p align="center">
  Made with ❤️ for better financial management
</p>
