// {{CODE-Cycle-Integration:
//   Task_ID: #T041-T045
//   Timestamp: 2025-12-15T04:35:00Z
//   Phase: D-Develop
//   Context-Analysis: "主应用逻辑 - 重构资金记录逻辑，简化为存入/取出"
//   Principle_Applied: "SOLID, Event-Driven, State Management"
// }}
// {{START_MODIFICATIONS}}

/**
 * Finance Tracker 主应用
 */
const App = {
  // 应用状态
  state: {
    displayCurrency: 'CNY',
    platforms: [],
    transactions: [],
    fundRecords: [],
    exchangeRates: {},
    settings: {},
    pagination: {
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 0
    },
    fundRecordsPagination: {
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 0
    },
    currentPlatformFilter: '',
    currentFundRecordPlatformFilter: '',
    // 当前资金记录模态框的平台资金状态
    currentFundRecordPlatformStatus: null
  },
  
  /**
   * 初始化应用
   */
  async init() {
    console.log('Finance Tracker 初始化中...');
    
    // 初始化主题管理器（优先初始化，避免闪烁）
    ThemeManager.init();
    
    // 初始化Toast
    Toast.init();
    
    // 初始化自定义下拉框
    CustomSelect.initAll();
    
    // 绑定事件
    this.bindEvents();
    
    // 加载数据
    await this.loadInitialData();
    
    console.log('Finance Tracker 初始化完成');
  },
  
  /**
   * 绑定事件
   */
  bindEvents() {
    // 币种切换
    document.getElementById('displayCurrency').addEventListener('change', (e) => {
      this.state.displayCurrency = e.target.value;
      this.loadOverview();
      this.renderPlatforms();
    });
    
    // 刷新汇率按钮
    document.getElementById('refreshRatesBtn').addEventListener('click', () => {
      this.refreshExchangeRates();
    });
    
    // 设置按钮
    document.getElementById('settingsBtn').addEventListener('click', () => {
      this.openSettingsModal();
    });
    
    // 新增交易记录按钮
    document.getElementById('addTransactionBtn').addEventListener('click', () => {
      this.openTransactionModal();
    });
    
    // 平台筛选
    document.getElementById('platformFilter').addEventListener('change', (e) => {
      this.state.currentPlatformFilter = e.target.value;
      this.state.pagination.page = 1;
      this.loadTransactions();
    });
    
    // 新增资金记录按钮
    document.getElementById('addFundRecordBtn').addEventListener('click', () => {
      this.openFundRecordModal();
    });
    
    // 资金记录平台筛选
    document.getElementById('fundRecordPlatformFilter').addEventListener('change', (e) => {
      this.state.currentFundRecordPlatformFilter = e.target.value;
      this.state.fundRecordsPagination.page = 1;
      this.loadFundRecords();
    });
    
    // 资金记录表单提交
    document.getElementById('fundRecordForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveFundRecord();
    });
    
    // 资金记录平台选择变化时，加载平台资金状态
    document.getElementById('fundRecordPlatformId').addEventListener('change', (e) => {
      this.onFundRecordPlatformChange(e.target.value);
    });
    
    // 资金记录类型变化时，更新提示
    document.getElementById('fundRecordType').addEventListener('change', () => {
      this.updateFundRecordAmountHint();
    });
    
    // 资金记录金额变化时，实时校验
    document.getElementById('fundRecordAmount').addEventListener('input', () => {
      this.validateFundRecordAmount();
    });
    
    // 资金记录模态框关闭按钮
    document.getElementById('closeFundRecordModal').addEventListener('click', () => {
      Modal.close('fundRecordModal');
    });
    document.getElementById('cancelFundRecordBtn').addEventListener('click', () => {
      Modal.close('fundRecordModal');
    });
    
    // 交易记录表单提交
    document.getElementById('transactionForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveTransaction();
    });
    
    // 平台表单提交
    document.getElementById('platformForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.savePlatform();
    });
    
    // 模态框关闭按钮
    document.getElementById('closeModal').addEventListener('click', () => {
      Modal.close('transactionModal');
    });
    document.getElementById('cancelBtn').addEventListener('click', () => {
      Modal.close('transactionModal');
    });
    document.getElementById('closePlatformModal').addEventListener('click', () => {
      Modal.close('platformModal');
    });
    document.getElementById('cancelPlatformBtn').addEventListener('click', () => {
      Modal.close('platformModal');
    });
    document.getElementById('closeSettingsModal').addEventListener('click', () => {
      Modal.close('settingsModal');
    });
    
    // 设置模态框中的刷新汇率按钮
    document.getElementById('refreshRatesBtn2').addEventListener('click', () => {
      this.refreshExchangeRates();
    });
    
    // 汇率更新频率设置
    document.getElementById('updateInterval').addEventListener('change', (e) => {
      this.updateSetting('exchange_rate_update_interval', e.target.value);
    });
    
    // 涨跌颜色模式设置
    document.getElementById('profitColorMode').addEventListener('change', (e) => {
      this.updateProfitColorMode(e.target.value);
    });
    
    // 自动计算持仓量按钮
    document.getElementById('calcQuantityBtn').addEventListener('click', () => {
      this.calculateQuantity();
    });
    
    // 导出数据按钮
    document.getElementById('exportDataBtn').addEventListener('click', () => {
      this.exportData();
    });
    
    // 导入数据按钮
    document.getElementById('importDataBtn').addEventListener('click', () => {
      document.getElementById('importFileInput').click();
    });
    
    // 文件选择变化
    document.getElementById('importFileInput').addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        this.handleImportFile(e.target.files[0]);
      }
    });
    
    // 数据库优化按钮
    document.getElementById('optimizeDatabaseBtn').addEventListener('click', () => {
      this.optimizeDatabase();
    });
    
    // 点击模态框背景关闭
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', () => {
        Modal.closeAll();
      });
    });
    
    // ESC键关闭模态框
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        Modal.closeAll();
      }
    });
  },
  
  /**
   * 自动计算持仓量（投入资金 × 杠杆 / 开仓价格）
   */
  calculateQuantity() {
    const investment = document.getElementById('investment').value;
    const openPrice = document.getElementById('openPrice').value;
    const leverage = document.getElementById('leverage').value || '1';
    
    if (!investment || !openPrice) {
      Toast.warning('请先填写投入资金和开仓价格');
      return;
    }
    
    const investmentNum = parseFloat(investment);
    const openPriceNum = parseFloat(openPrice);
    const leverageNum = parseFloat(leverage) || 1;
    
    if (isNaN(investmentNum) || isNaN(openPriceNum) || openPriceNum === 0) {
      Toast.warning('投入资金和开仓价格必须是有效数字，且开仓价格不能为0');
      return;
    }
    
    if (leverageNum <= 0) {
      Toast.warning('杠杆必须大于0');
      return;
    }
    
    // 计算持仓量：投入资金 × 杠杆 / 开仓价格，保持高精度
    const quantity = (investmentNum * leverageNum) / openPriceNum;
    document.getElementById('quantity').value = quantity.toString();
    Toast.success(`持仓量已自动计算（杠杆: ${leverageNum}x）`);
  },
  
  /**
   * 格式化时间为 YYYY-MM-DD HH:mm:ss 格式
   */
  formatTimeWithSeconds(date) {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  },
  
  /**
   * 解析时间字符串（支持多种格式）
   */
  parseTimeString(timeStr) {
    if (!timeStr) return null;
    
    // 尝试直接解析
    let date = new Date(timeStr);
    if (!isNaN(date.getTime())) return date.toISOString();
    
    // 尝试解析 YYYY-MM-DD HH:mm:ss 格式
    const match = timeStr.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/);
    if (match) {
      const [, year, month, day, hours, minutes, seconds] = match;
      date = new Date(year, month - 1, day, hours, minutes, seconds);
      if (!isNaN(date.getTime())) return date.toISOString();
    }
    
    // 尝试解析 YYYY-MM-DD HH:mm 格式
    const match2 = timeStr.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})$/);
    if (match2) {
      const [, year, month, day, hours, minutes] = match2;
      date = new Date(year, month - 1, day, hours, minutes, 0);
      if (!isNaN(date.getTime())) return date.toISOString();
    }
    
    return null;
  },
  
  /**
   * 加载初始数据
   */
  async loadInitialData() {
    try {
      // 并行加载数据
      await Promise.all([
        this.loadSettings(),
        this.loadExchangeRates(),
        this.loadPlatforms(),
        this.loadOverview(),
        this.loadTransactions(),
        this.loadFundRecords()
      ]);
    } catch (error) {
      console.error('加载初始数据失败:', error);
      Toast.error('加载数据失败，请刷新页面重试');
    }
  },
  
  /**
   * 加载设置
   */
  async loadSettings() {
    try {
      this.state.settings = await API.settings.getAll();
      
      // 应用设置 - 使用 setValueSilent 避免触发 change 事件导致重复保存
      if (this.state.settings.display_currency) {
        this.state.displayCurrency = this.state.settings.display_currency;
        CustomSelect.setValueSilent('displayCurrency', this.state.displayCurrency);
      }
      
      // 汇率更新频率
      if (this.state.settings.exchange_rate_update_interval) {
        CustomSelect.setValueSilent('updateInterval', this.state.settings.exchange_rate_update_interval);
      }
      
      // 应用涨跌颜色模式
      const profitColorMode = this.state.settings.profit_color_mode || 'us';
      this.applyProfitColorMode(profitColorMode);
      CustomSelect.setValueSilent('profitColorMode', profitColorMode);
    } catch (error) {
      console.error('加载设置失败:', error);
    }
  },
  
  /**
   * 加载汇率
   */
  async loadExchangeRates() {
    try {
      const data = await API.exchangeRates.getAll();
      this.state.exchangeRates = data.rates || {};
      this.renderExchangeRates();
    } catch (error) {
      console.error('加载汇率失败:', error);
    }
  },
  
  /**
   * 加载平台数据
   */
  async loadPlatforms() {
    try {
      this.state.platforms = await API.platforms.getAll();
      this.renderPlatforms();
      this.updatePlatformFilter();
      this.updatePlatformSelect();
      this.updateFundRecordPlatformFilter();
      this.updateFundRecordPlatformSelect();
    } catch (error) {
      console.error('加载平台数据失败:', error);
    }
  },
  
  /**
   * 加载资金总览
   */
  async loadOverview() {
    try {
      const data = await API.overview.get(this.state.displayCurrency);
      this.renderOverview(data);
    } catch (error) {
      console.error('加载资金总览失败:', error);
    }
  },
  
  /**
   * 加载交易记录
   */
  async loadTransactions() {
    try {
      const params = {
        page: this.state.pagination.page,
        limit: this.state.pagination.limit
      };
      
      if (this.state.currentPlatformFilter) {
        params.platform_id = this.state.currentPlatformFilter;
      }
      
      const data = await API.transactions.getAll(params);
      this.state.transactions = data.data || [];
      this.state.pagination = data.pagination || this.state.pagination;
      
      this.renderTransactions();
      this.renderPagination();
    } catch (error) {
      console.error('加载交易记录失败:', error);
    }
  },
  
  /**
   * 加载资金记录
   */
  async loadFundRecords() {
    try {
      const params = {
        page: this.state.fundRecordsPagination.page,
        limit: this.state.fundRecordsPagination.limit
      };
      
      if (this.state.currentFundRecordPlatformFilter) {
        params.platform_id = this.state.currentFundRecordPlatformFilter;
      }
      
      const data = await API.fundRecords.getAll(params);
      this.state.fundRecords = data.data || [];
      this.state.fundRecordsPagination = data.pagination || this.state.fundRecordsPagination;
      
      this.renderFundRecords();
      this.renderFundRecordsPagination();
      
      // 加载资金汇总
      await this.loadFundSummary();
    } catch (error) {
      console.error('加载资金记录失败:', error);
    }
  },
  
  /**
   * 加载资金汇总
   */
  async loadFundSummary() {
    try {
      const data = await API.fundRecords.getSummaryByPlatform();
      this.renderFundSummary(data);
    } catch (error) {
      console.error('加载资金汇总失败:', error);
    }
  },
  
  /**
   * 渲染资金汇总卡片
   */
  renderFundSummary(data) {
    const currency = this.state.displayCurrency;
    
    // 计算总流入、总流出（转换为显示币种）
    // 后端返回的 total_inflow 和 total_outflow 都是正数（使用 ABS）
    let totalInflow = 0;
    let totalOutflow = 0;
    
    const summaryList = data.summary || data || [];
    const items = Array.isArray(summaryList) ? summaryList : [];
    
    items.forEach(item => {
      const rate = this.getExchangeRate(item.currency, currency);
      totalInflow += Math.abs(parseFloat(item.total_inflow || 0)) * rate;
      totalOutflow += Math.abs(parseFloat(item.total_outflow || 0)) * rate;
    });
    
    // 净流入 = 流入 - 流出
    const netFlow = totalInflow - totalOutflow;
    
    // 更新显示
    // 总流入显示为正数
    const inflowEl = document.getElementById('totalInflow');
    if (inflowEl) {
      inflowEl.textContent = Utils.formatCurrency(totalInflow, currency, true);
      inflowEl.className = 'card-value profit-positive';
    }
    
    // 总流出显示为负数（更直观）
    const outflowEl = document.getElementById('totalOutflow');
    if (outflowEl) {
      // 使用负数显示流出，让用户更直观地看到资金流出
      outflowEl.textContent = Utils.formatCurrency(-totalOutflow, currency, true);
      outflowEl.className = 'card-value profit-negative';
    }
    
    // 净流入根据正负显示颜色
    const netFlowEl = document.getElementById('netFlow');
    if (netFlowEl) {
      netFlowEl.textContent = Utils.formatCurrency(netFlow, currency, true);
      netFlowEl.className = `card-value ${Utils.getProfitClass(netFlow)}`;
    }
  },
  
  /**
   * 渲染资金总览
   */
  renderOverview(data) {
    const { summary } = data;
    const currency = this.state.displayCurrency;
    
    // 总资金
    document.getElementById('totalCapital').textContent = 
      Utils.formatCurrency(summary.total_capital, currency);
    
    // 初始资金
    document.getElementById('totalInitialCapital').textContent = 
      Utils.formatCurrency(summary.total_initial_capital, currency);
    
    // 总盈亏
    const profitEl = document.getElementById('totalProfit');
    profitEl.textContent = Utils.formatCurrency(summary.total_realized_profit, currency, true);
    profitEl.className = `card-value ${Utils.getProfitClass(summary.total_realized_profit)}`;
    
    // 涨跌幅 - 当初始资金为0时显示特殊标记
    const changeEl = document.getElementById('totalChangePercent');
    const changePercent = parseFloat(summary.total_change_percent);
    const totalInitialCapital = parseFloat(summary.total_initial_capital) || 0;
    
    if (totalInitialCapital === 0) {
      changeEl.textContent = '——';
      changeEl.className = 'card-value';
      changeEl.title = '初始资金为0，无法计算涨跌幅';
    } else {
      changeEl.textContent = Utils.formatPercent(changePercent);
      changeEl.className = `card-value ${Utils.getProfitClass(changePercent)}`;
      changeEl.title = '';
    }
  },
  
  /**
   * 渲染平台卡片
   */
  renderPlatforms() {
    const container = document.getElementById('platformsGrid');
    const currency = this.state.displayCurrency;
    
    if (this.state.platforms.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📊</div>
          <div class="empty-state-text">暂无平台数据</div>
        </div>
      `;
      return;
    }
    
    container.innerHTML = this.state.platforms.map(platform => {
      const icon = Utils.getPlatformIcon(platform.name);
      const rate = this.getExchangeRate(platform.currency, currency);
      
      const initialCapital = platform.initial_capital * rate;
      const totalProfit = platform.total_realized_profit * rate;
      const totalCapital = platform.total_capital * rate;
      const changePercent = parseFloat(platform.change_percent);
      const rawInitialCapital = parseFloat(platform.initial_capital) || 0;
      
      // 涨跌幅显示 - 当初始资金为0时显示特殊标记
      let changePercentDisplay, changePercentClass, changePercentTitle;
      if (rawInitialCapital === 0) {
        changePercentDisplay = '——';
        changePercentClass = '';
        changePercentTitle = '初始资金为0，无法计算涨跌幅';
      } else {
        changePercentDisplay = Utils.formatPercent(changePercent);
        changePercentClass = Utils.getProfitClass(changePercent);
        changePercentTitle = '';
      }
      
      return `
        <div class="platform-card" data-id="${platform.id}">
          <div class="platform-card-header">
            <div class="platform-name">
              <span>${icon}</span>
              <span>${platform.name}</span>
            </div>
            <span class="platform-currency">${platform.currency}</span>
          </div>
          <div class="platform-card-body">
            <div class="platform-stat">
              <span class="platform-stat-label">初始资金</span>
              <span class="platform-stat-value">${Utils.formatCurrency(initialCapital, currency)}</span>
            </div>
            <div class="platform-stat">
              <span class="platform-stat-label">总盈亏</span>
              <span class="platform-stat-value ${Utils.getProfitClass(totalProfit)}">${Utils.formatCurrency(totalProfit, currency, true)}</span>
            </div>
            <div class="platform-stat highlight">
              <span class="platform-stat-label">总资金</span>
              <span class="platform-stat-value">${Utils.formatCurrency(totalCapital, currency)}</span>
            </div>
            <div class="platform-stat">
              <span class="platform-stat-label">涨跌幅</span>
              <span class="platform-stat-value ${changePercentClass}" title="${changePercentTitle}">${changePercentDisplay}</span>
            </div>
          </div>
          <div class="platform-card-footer" style="margin-top: 16px; text-align: right;">
            <button class="btn btn-secondary btn-sm" onclick="App.openPlatformModal(${platform.id})">
              <span class="icon">✏️</span> 编辑
            </button>
          </div>
        </div>
      `;
    }).join('');
  },
  
  /**
   * 渲染交易记录表格
   */
  renderTransactions() {
    const tbody = document.getElementById('transactionsBody');
    
    if (this.state.transactions.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="12" class="empty-state">
            <div class="empty-state-icon">📝</div>
            <div class="empty-state-text">暂无交易记录</div>
          </td>
        </tr>
      `;
      return;
    }
    
    tbody.innerHTML = this.state.transactions.map(t => {
      const realizedProfit = t.realized_profit;
      const directionClass = t.direction === '开多' ? 'badge-long' : 'badge-short';
      const typeClass = t.type === '现货' ? 'badge-spot' : (t.type === '事件' ? 'badge-event' : 'badge-contract');
      
      // 格式化价格显示
      const openPriceDisplay = t.open_price ? Utils.formatCurrency(t.open_price, t.platform_currency) : '--';
      const closePriceDisplay = t.close_price ? Utils.formatCurrency(t.close_price, t.platform_currency) : '--';
      const quantityDisplay = t.quantity ? t.quantity : '--';
      
      return `
        <tr data-id="${t.id}">
          <td>${t.platform_name}</td>
          <td>
            <div class="asset-info">
              <span class="asset-name">${t.asset_name}</span>
              <span class="asset-code">${t.asset_code}</span>
            </div>
          </td>
          <td><span class="badge ${typeClass}">${t.type}</span></td>
          <td><span class="badge ${directionClass}">${t.direction}</span></td>
          <td>${t.leverage}x</td>
          <td>${Utils.formatDateTimeHTML(t.open_time)}</td>
          <td>${Utils.formatDateTimeHTML(t.close_time)}</td>
          <td>${t.holding_time || '--'}</td>
          <td class="${Utils.getProfitClass(t.total_profit)}">${Utils.formatCurrency(t.total_profit, t.platform_currency, true)}</td>
          <td>${Utils.formatCurrency(t.total_fee, t.platform_currency)}</td>
          <td class="${Utils.getProfitClass(realizedProfit)}">${Utils.formatCurrency(realizedProfit, t.platform_currency, true)}</td>
          <td>
            <div class="actions">
              <button class="btn btn-icon" onclick="App.openTransactionModal(${t.id})" title="编辑">✏️</button>
              <button class="btn btn-icon" onclick="App.deleteTransaction(${t.id})" title="删除">🗑️</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },
  
  /**
   * 渲染分页
   */
  renderPagination() {
    const container = document.getElementById('pagination');
    const { page, totalPages, total } = this.state.pagination;
    
    if (totalPages <= 1) {
      container.innerHTML = '';
      return;
    }
    
    let html = `
      <button class="pagination-btn" onclick="App.goToPage(1)" ${page === 1 ? 'disabled' : ''}>首页</button>
      <button class="pagination-btn" onclick="App.goToPage(${page - 1})" ${page === 1 ? 'disabled' : ''}>上一页</button>
    `;
    
    // 页码按钮
    const startPage = Math.max(1, page - 2);
    const endPage = Math.min(totalPages, page + 2);
    
    for (let i = startPage; i <= endPage; i++) {
      html += `
        <button class="pagination-btn ${i === page ? 'active' : ''}" onclick="App.goToPage(${i})">${i}</button>
      `;
    }
    
    html += `
      <button class="pagination-btn" onclick="App.goToPage(${page + 1})" ${page === totalPages ? 'disabled' : ''}>下一页</button>
      <button class="pagination-btn" onclick="App.goToPage(${totalPages})" ${page === totalPages ? 'disabled' : ''}>末页</button>
      <span class="pagination-info">共 ${total} 条记录</span>
    `;
    
    container.innerHTML = html;
  },
  
  /**
   * 跳转到指定页
   */
  goToPage(page) {
    if (page < 1 || page > this.state.pagination.totalPages) return;
    this.state.pagination.page = page;
    this.loadTransactions();
  },
  
  /**
   * 渲染汇率显示
   */
  renderExchangeRates() {
    const container = document.getElementById('ratesDisplay');
    const rates = this.state.exchangeRates;
    
    if (Object.keys(rates).length === 0) {
      container.innerHTML = '<div class="rate-item">暂无汇率数据</div>';
      return;
    }
    
    const pairs = [
      ['CNY', 'HKD'],
      ['CNY', 'USD'],
      ['HKD', 'USD']
    ];
    
    container.innerHTML = pairs.map(([from, to]) => {
      const rate = rates[from]?.[to]?.rate || rates[from]?.[to] || '--';
      return `
        <div class="rate-item">
          <span class="rate-label">1 ${from} =</span>
          <span class="rate-value">${typeof rate === 'number' ? rate.toFixed(4) : rate} ${to}</span>
        </div>
      `;
    }).join('');
  },
  
  /**
   * 更新平台筛选下拉框
   */
  updatePlatformFilter() {
    const options = [
      { value: '', text: '全部平台' },
      ...this.state.platforms.map(p => ({ value: String(p.id), text: p.name }))
    ];
    CustomSelect.updateOptions('platformFilter', options);
  },
  
  /**
   * 更新平台选择下拉框（表单中）
   */
  updatePlatformSelect() {
    const options = [
      { value: '', text: '请选择平台' },
      ...this.state.platforms.map(p => ({ value: String(p.id), text: `${p.name} (${p.currency})` }))
    ];
    CustomSelect.updateOptions('platformId', options);
  },
  
  /**
   * 更新资金记录平台筛选下拉框
   */
  updateFundRecordPlatformFilter() {
    const options = [
      { value: '', text: '全部平台' },
      ...this.state.platforms.map(p => ({ value: String(p.id), text: p.name }))
    ];
    CustomSelect.updateOptions('fundRecordPlatformFilter', options);
  },
  
  /**
   * 更新资金记录平台选择下拉框（表单中）
   */
  updateFundRecordPlatformSelect() {
    const options = [
      { value: '', text: '请选择平台' },
      ...this.state.platforms.map(p => ({ value: String(p.id), text: `${p.name} (${p.currency})` }))
    ];
    CustomSelect.updateOptions('fundRecordPlatformId', options);
  },
  
  /**
   * 渲染资金记录表格
   */
  renderFundRecords() {
    const tbody = document.getElementById('fundRecordsBody');
    
    if (this.state.fundRecords.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="empty-state">
            <div class="empty-state-icon">💸</div>
            <div class="empty-state-text">暂无资金记录</div>
          </td>
        </tr>
      `;
      return;
    }
    
    tbody.innerHTML = this.state.fundRecords.map(r => {
      // 简化为只有存入和取出两种类型
      const isInflow = r.type === '存入';
      const isOutflow = r.type === '取出';
      const amountClass = isInflow ? 'profit' : (isOutflow ? 'loss' : '');
      const amountPrefix = isInflow ? '+' : (isOutflow ? '-' : '');
      const displayAmount = Math.abs(r.amount);
      
      // 类型徽章样式
      const typeClass = isInflow ? 'badge-inflow' : 'badge-outflow';
      
      // 备注处理 - 添加 title 属性用于 tooltip
      const noteDisplay = r.note || '--';
      const noteTitle = r.note ? `title="${Utils.escapeHtml(r.note)}"` : '';
      
      return `
        <tr data-id="${r.id}">
          <td>${r.platform_name}</td>
          <td><span class="badge ${typeClass}">${r.type}</span></td>
          <td class="${amountClass}">${amountPrefix}${Utils.formatCurrency(displayAmount, r.platform_currency)}</td>
          <td>${Utils.formatDateTimeHTML(r.record_time)}</td>
          <td class="note-cell" ${noteTitle}>${Utils.escapeHtml(noteDisplay)}</td>
          <td>
            <div class="actions">
              <button class="btn btn-icon" onclick="App.openFundRecordModal(${r.id})" title="编辑">✏️</button>
              <button class="btn btn-icon" onclick="App.deleteFundRecord(${r.id})" title="删除">🗑️</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },
  
  /**
   * 渲染资金记录分页
   */
  renderFundRecordsPagination() {
    const container = document.getElementById('fundRecordsPagination');
    const { page, totalPages, total } = this.state.fundRecordsPagination;
    
    if (totalPages <= 1) {
      container.innerHTML = '';
      return;
    }
    
    let html = `
      <button class="pagination-btn" onclick="App.goToFundRecordPage(1)" ${page === 1 ? 'disabled' : ''}>首页</button>
      <button class="pagination-btn" onclick="App.goToFundRecordPage(${page - 1})" ${page === 1 ? 'disabled' : ''}>上一页</button>
    `;
    
    // 页码按钮
    const startPage = Math.max(1, page - 2);
    const endPage = Math.min(totalPages, page + 2);
    
    for (let i = startPage; i <= endPage; i++) {
      html += `
        <button class="pagination-btn ${i === page ? 'active' : ''}" onclick="App.goToFundRecordPage(${i})">${i}</button>
      `;
    }
    
    html += `
      <button class="pagination-btn" onclick="App.goToFundRecordPage(${page + 1})" ${page === totalPages ? 'disabled' : ''}>下一页</button>
      <button class="pagination-btn" onclick="App.goToFundRecordPage(${totalPages})" ${page === totalPages ? 'disabled' : ''}>末页</button>
      <span class="pagination-info">共 ${total} 条记录</span>
    `;
    
    container.innerHTML = html;
  },
  
  /**
   * 跳转到资金记录指定页
   */
  goToFundRecordPage(page) {
    if (page < 1 || page > this.state.fundRecordsPagination.totalPages) return;
    this.state.fundRecordsPagination.page = page;
    this.loadFundRecords();
  },
  
  /**
   * 打开资金记录模态框
   */
  async openFundRecordModal(id = null) {
    const form = document.getElementById('fundRecordForm');
    const title = document.getElementById('fundRecordModalTitle');
    
    form.reset();
    document.getElementById('fundRecordId').value = '';
    this.state.currentFundRecordPlatformStatus = null;
    this.hideAmountHint();
    
    // 重置自定义下拉框
    CustomSelect.setValue('fundRecordPlatformId', '');
    CustomSelect.setValue('fundRecordType', '存入');
    
    if (id) {
      // 编辑模式
      title.textContent = '编辑资金记录';
      try {
        const record = await API.fundRecords.getById(id);
        document.getElementById('fundRecordId').value = record.id;
        CustomSelect.setValue('fundRecordPlatformId', String(record.platform_id));
        CustomSelect.setValue('fundRecordType', record.type);
        document.getElementById('fundRecordAmount').value = record.amount;
        document.getElementById('fundRecordTime').value = this.formatTimeWithSeconds(record.record_time);
        document.getElementById('fundRecordNote').value = record.note || '';
        
        // 加载平台资金状态
        await this.onFundRecordPlatformChange(String(record.platform_id));
      } catch (error) {
        Toast.error('加载资金记录失败');
        return;
      }
    } else {
      // 新增模式
      title.textContent = '新增资金记录';
      // 设置默认记录时间为当前时间
      document.getElementById('fundRecordTime').value = this.formatTimeWithSeconds(new Date());
    }
    
    Modal.open('fundRecordModal');
  },
  
  /**
   * 当资金记录平台选择变化时
   */
  async onFundRecordPlatformChange(platformId) {
    if (!platformId) {
      this.state.currentFundRecordPlatformStatus = null;
      this.hideAmountHint();
      return;
    }
    
    try {
      const status = await API.fundRecords.getPlatformStatus(platformId);
      this.state.currentFundRecordPlatformStatus = status;
      this.updateFundRecordAmountHint();
    } catch (error) {
      console.error('获取平台资金状态失败:', error);
      this.state.currentFundRecordPlatformStatus = null;
      this.hideAmountHint();
    }
  },
  
  /**
   * 更新资金记录金额提示
   */
  updateFundRecordAmountHint() {
    const type = document.getElementById('fundRecordType').value;
    const status = this.state.currentFundRecordPlatformStatus;
    const hintEl = document.getElementById('fundRecordAmountHint');
    
    if (!status || !hintEl) {
      this.hideAmountHint();
      return;
    }
    
    const platform = this.state.platforms.find(p => p.id === parseInt(document.getElementById('fundRecordPlatformId').value));
    const currency = platform ? platform.currency : 'CNY';
    
    if (type === '取出') {
      const maxWithdraw = status.total_capital;
      hintEl.innerHTML = `
        <span class="hint-info">
          可取出金额: <strong>${Utils.formatCurrency(maxWithdraw, currency)}</strong>
          (初始资金: ${Utils.formatCurrency(status.initial_capital, currency)},
          盈亏: ${Utils.formatCurrency(status.total_profit, currency, true)})
        </span>
      `;
      hintEl.style.display = 'block';
    } else if (type === '存入') {
      hintEl.innerHTML = `
        <span class="hint-info">
          当前初始资金: <strong>${Utils.formatCurrency(status.initial_capital, currency)}</strong>
          (存入后将增加初始资金)
        </span>
      `;
      hintEl.style.display = 'block';
    } else {
      this.hideAmountHint();
    }
    
    // 同时验证当前金额
    this.validateFundRecordAmount();
  },
  
  /**
   * 隐藏金额提示
   */
  hideAmountHint() {
    const hintEl = document.getElementById('fundRecordAmountHint');
    if (hintEl) {
      hintEl.style.display = 'none';
      hintEl.innerHTML = '';
    }
  },
  
  /**
   * 验证资金记录金额
   */
  validateFundRecordAmount() {
    const type = document.getElementById('fundRecordType').value;
    const amountStr = document.getElementById('fundRecordAmount').value;
    const status = this.state.currentFundRecordPlatformStatus;
    const amountInput = document.getElementById('fundRecordAmount');
    
    // 清除之前的错误样式
    amountInput.classList.remove('input-error');
    
    if (!amountStr || !status) return true;
    
    const amount = parseFloat(amountStr);
    if (isNaN(amount)) return true;
    
    if (amount <= 0) {
      amountInput.classList.add('input-error');
      return false;
    }
    
    if (type === '取出') {
      if (amount > status.total_capital) {
        amountInput.classList.add('input-error');
        return false;
      }
    }
    
    return true;
  },
  
  /**
   * 保存资金记录
   */
  async saveFundRecord() {
    const id = document.getElementById('fundRecordId').value;
    
    // 获取并验证平台ID
    const platformIdStr = document.getElementById('fundRecordPlatformId').value;
    if (!platformIdStr) {
      Toast.error('请选择平台');
      return;
    }
    const platformId = parseInt(platformIdStr);
    if (isNaN(platformId)) {
      Toast.error('平台选择无效');
      return;
    }
    
    // 获取并验证类型（只允许存入和取出）
    const type = document.getElementById('fundRecordType').value;
    if (!type || !['存入', '取出'].includes(type)) {
      Toast.error('请选择有效的类型（存入或取出）');
      return;
    }
    
    // 获取并验证金额（必须为正数）
    const amountStr = document.getElementById('fundRecordAmount').value;
    if (!amountStr) {
      Toast.error('请输入金额');
      return;
    }
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) {
      Toast.error('金额必须是大于0的有效数字');
      return;
    }
    
    // 取出时校验金额
    if (type === '取出') {
      const status = this.state.currentFundRecordPlatformStatus;
      if (status && amount > status.total_capital) {
        const platform = this.state.platforms.find(p => p.id === platformId);
        const currency = platform ? platform.currency : 'CNY';
        Toast.error(`取出金额 ${Utils.formatCurrency(amount, currency)} 超过可用资金 ${Utils.formatCurrency(status.total_capital, currency)}`);
        return;
      }
    }
    
    // 解析时间
    const recordTimeStr = document.getElementById('fundRecordTime').value;
    const recordTime = this.parseTimeString(recordTimeStr);
    
    if (!recordTime) {
      Toast.error('记录时间格式不正确，请使用 YYYY-MM-DD HH:mm:ss 格式');
      return;
    }
    
    const data = {
      platform_id: platformId,
      type: type,
      amount: String(amount), // 确保是正数字符串
      record_time: recordTime,
      note: document.getElementById('fundRecordNote').value.trim() || null
    };
    
    try {
      if (id) {
        await API.fundRecords.update(id, data);
        Toast.success('资金记录更新成功');
      } else {
        await API.fundRecords.create(data);
        Toast.success('资金记录创建成功');
      }
      
      Modal.close('fundRecordModal');
      await this.loadFundRecords();
      await this.loadPlatforms();
      await this.loadOverview();
    } catch (error) {
      Toast.error('保存失败: ' + error.message);
    }
  },
  
  /**
   * 删除资金记录
   */
  async deleteFundRecord(id) {
    if (!confirm('确定要删除这条资金记录吗？')) return;
    
    try {
      await API.fundRecords.delete(id);
      Toast.success('资金记录删除成功');
      await this.loadFundRecords();
      await this.loadPlatforms();
      await this.loadOverview();
    } catch (error) {
      Toast.error('删除失败: ' + error.message);
    }
  },
  
  /**
   * 获取汇率
   */
  getExchangeRate(from, to) {
    if (from === to) return 1;
    return this.state.exchangeRates[from]?.[to]?.rate || 
           this.state.exchangeRates[from]?.[to] || 1;
  },
  
  /**
   * 刷新汇率
   */
  async refreshExchangeRates() {
    try {
      Toast.info('正在刷新汇率...');
      const data = await API.exchangeRates.refresh();
      
      // 更新状态
      if (data.rates) {
        this.state.exchangeRates = {};
        data.rates.forEach(r => {
          if (!this.state.exchangeRates[r.from_currency]) {
            this.state.exchangeRates[r.from_currency] = {};
          }
          this.state.exchangeRates[r.from_currency][r.to_currency] = r.rate;
        });
      }
      
      this.renderExchangeRates();
      this.renderPlatforms();
      this.loadOverview();
      
      Toast.success('汇率刷新成功');
    } catch (error) {
      console.error('刷新汇率失败:', error);
      Toast.error('刷新汇率失败: ' + error.message);
    }
  },
  
  /**
   * 打开交易记录模态框
   */
  async openTransactionModal(id = null) {
    const form = document.getElementById('transactionForm');
    const title = document.getElementById('modalTitle');
    
    form.reset();
    document.getElementById('transactionId').value = '';
    
    // 重置自定义下拉框
    CustomSelect.setValue('platformId', '');
    CustomSelect.setValue('type', '现货');
    CustomSelect.setValue('direction', '开多');
    
    if (id) {
      // 编辑模式
      title.textContent = '编辑交易记录';
      try {
        const transaction = await API.transactions.getById(id);
        document.getElementById('transactionId').value = transaction.id;
        CustomSelect.setValue('platformId', String(transaction.platform_id));
        document.getElementById('assetName').value = transaction.asset_name;
        document.getElementById('assetCode').value = transaction.asset_code;
        CustomSelect.setValue('type', transaction.type);
        CustomSelect.setValue('direction', transaction.direction);
        document.getElementById('leverage').value = transaction.leverage || '1';
        document.getElementById('quantity').value = transaction.quantity || '';
        document.getElementById('openPrice').value = transaction.open_price || '';
        document.getElementById('closePrice').value = transaction.close_price || '';
        document.getElementById('investment').value = transaction.investment || '';
        document.getElementById('openTime').value = this.formatTimeWithSeconds(transaction.open_time);
        document.getElementById('closeTime').value = this.formatTimeWithSeconds(transaction.close_time);
        document.getElementById('formTotalProfit').value = transaction.total_profit || '0';
        document.getElementById('formTotalFee').value = transaction.total_fee || '0';
        document.getElementById('reason').value = transaction.reason || '';
      } catch (error) {
        Toast.error('加载交易记录失败');
        return;
      }
    } else {
      // 新增模式
      title.textContent = '新增交易记录';
      // 设置默认开仓时间为当前时间（带秒）
      document.getElementById('openTime').value = this.formatTimeWithSeconds(new Date());
    }
    
    Modal.open('transactionModal');
  },
  
  /**
   * 保存交易记录
   */
  async saveTransaction() {
    const id = document.getElementById('transactionId').value;
    
    // 解析时间
    const openTimeStr = document.getElementById('openTime').value;
    const closeTimeStr = document.getElementById('closeTime').value;
    
    const openTime = this.parseTimeString(openTimeStr);
    const closeTime = closeTimeStr ? this.parseTimeString(closeTimeStr) : null;
    
    if (!openTime) {
      Toast.error('开仓时间格式不正确，请使用 YYYY-MM-DD HH:mm:ss 格式');
      return;
    }
    
    if (closeTimeStr && !closeTime) {
      Toast.error('平仓时间格式不正确，请使用 YYYY-MM-DD HH:mm:ss 格式');
      return;
    }
    
    // 保持原始字符串以保留高精度小数
    const data = {
      platform_id: parseInt(document.getElementById('platformId').value),
      asset_name: document.getElementById('assetName').value.trim(),
      asset_code: document.getElementById('assetCode').value.trim(),
      type: document.getElementById('type').value,
      direction: document.getElementById('direction').value,
      leverage: document.getElementById('leverage').value || '1',
      quantity: document.getElementById('quantity').value || null,
      open_price: document.getElementById('openPrice').value || null,
      close_price: document.getElementById('closePrice').value || null,
      investment: document.getElementById('investment').value || null,
      open_time: openTime,
      close_time: closeTime,
      total_profit: document.getElementById('formTotalProfit').value || '0',
      total_fee: document.getElementById('formTotalFee').value || '0',
      reason: document.getElementById('reason').value.trim() || null
    };
    
    try {
      if (id) {
        await API.transactions.update(id, data);
        Toast.success('交易记录更新成功');
      } else {
        await API.transactions.create(data);
        Toast.success('交易记录创建成功');
      }
      
      Modal.close('transactionModal');
      await this.loadTransactions();
      await this.loadPlatforms();
      await this.loadOverview();
    } catch (error) {
      Toast.error('保存失败: ' + error.message);
    }
  },
  
  /**
   * 删除交易记录
   */
  async deleteTransaction(id) {
    if (!confirm('确定要删除这条交易记录吗？')) return;
    
    try {
      await API.transactions.delete(id);
      Toast.success('交易记录删除成功');
      await this.loadTransactions();
      await this.loadPlatforms();
      await this.loadOverview();
    } catch (error) {
      Toast.error('删除失败: ' + error.message);
    }
  },
  
  /**
   * 打开平台编辑模态框
   */
  async openPlatformModal(id) {
    const platform = this.state.platforms.find(p => p.id === id);
    if (!platform) {
      Toast.error('平台不存在');
      return;
    }
    
    document.getElementById('editPlatformId').value = platform.id;
    document.getElementById('platformName').value = platform.name;
    document.getElementById('platformCurrency').value = platform.currency;
    document.getElementById('initialCapital').value = platform.initial_capital;
    
    Modal.open('platformModal');
  },
  
  /**
   * 保存平台设置
   */
  async savePlatform() {
    const id = document.getElementById('editPlatformId').value;
    const initialCapital = parseFloat(document.getElementById('initialCapital').value) || 0;
    
    try {
      await API.platforms.update(id, { initial_capital: initialCapital });
      Toast.success('平台设置保存成功');
      Modal.close('platformModal');
      await this.loadPlatforms();
      await this.loadOverview();
    } catch (error) {
      Toast.error('保存失败: ' + error.message);
    }
  },
  
  /**
   * 打开设置模态框
   */
  openSettingsModal() {
    this.renderExchangeRates();
    this.loadDatabaseStatus();
    Modal.open('settingsModal');
  },
  
  /**
   * 加载数据库状态
   */
  async loadDatabaseStatus() {
    try {
      const status = await API.settings.getDatabaseStatus();
      
      // 更新交易记录数（API返回的是 tables.transactions）
      const transactionCount = status.tables?.transactions || 0;
      document.getElementById('dbTransactionCount').textContent =
        transactionCount.toLocaleString() + ' 条';
      
      // 更新数据库大小
      const dbSize = status.database_size || 0;
      const sizeKB = dbSize / 1024;
      const sizeMB = sizeKB / 1024;
      document.getElementById('dbSize').textContent =
        dbSize === 0 ? '未知' : (sizeMB >= 1 ? `${sizeMB.toFixed(2)} MB` : `${sizeKB.toFixed(2)} KB`);
      
      // 更新索引状态
      const indexEl = document.getElementById('dbIndexStatus');
      if (status.indexes && status.indexes.length > 0) {
        indexEl.textContent = `${status.indexes.length} 个索引`;
        indexEl.className = 'status-value success';
      } else {
        indexEl.textContent = '无索引';
        indexEl.className = 'status-value warning';
      }
    } catch (error) {
      console.error('加载数据库状态失败:', error);
      document.getElementById('dbTransactionCount').textContent = '加载失败';
      document.getElementById('dbSize').textContent = '加载失败';
      document.getElementById('dbIndexStatus').textContent = '加载失败';
    }
  },
  
  /**
   * 优化数据库
   */
  async optimizeDatabase() {
    const btn = document.getElementById('optimizeDatabaseBtn');
    const originalText = btn.innerHTML;
    
    try {
      btn.disabled = true;
      btn.innerHTML = '<span class="icon">⏳</span> 优化中...';
      Toast.info('正在优化数据库...');
      
      const result = await API.settings.optimizeDatabase();
      
      Toast.success('数据库优化完成');
      
      // 重新加载数据库状态
      await this.loadDatabaseStatus();
    } catch (error) {
      console.error('数据库优化失败:', error);
      Toast.error('数据库优化失败: ' + error.message);
    } finally {
      btn.disabled = false;
      btn.innerHTML = originalText;
    }
  },
  
  /**
   * 更新设置
   */
  async updateSetting(key, value) {
    try {
      await API.settings.update(key, value);
      this.state.settings[key] = value;
      Toast.success('设置已保存');
    } catch (error) {
      Toast.error('保存设置失败: ' + error.message);
    }
  },
  
  /**
   * 更新涨跌颜色模式
   */
  async updateProfitColorMode(mode) {
    try {
      await API.settings.update('profit_color_mode', mode);
      this.state.settings.profit_color_mode = mode;
      this.applyProfitColorMode(mode);
      Toast.success('涨跌颜色设置已保存');
    } catch (error) {
      Toast.error('保存设置失败: ' + error.message);
    }
  },
  
  /**
   * 应用涨跌颜色模式
   */
  applyProfitColorMode(mode) {
    // 设置 data-profit-color 属性到 html 元素
    document.documentElement.setAttribute('data-profit-color', mode);
  },
  
  /**
   * 导出数据（不含汇率，汇率会自动从网络获取）
   */
  async exportData() {
    try {
      const exportBtn = document.getElementById('exportDataBtn');
      const originalText = exportBtn.innerHTML;
      
      // 显示导出中状态
      exportBtn.disabled = true;
      exportBtn.innerHTML = '<span class="icon">⏳</span> 导出中...';
      Toast.info('正在导出数据，请稍候...');
      
      const data = await API.settings.exportData();
      
      // 统计数据量
      const transactionCount = data.data?.transactions?.length || 0;
      const platformCount = data.data?.platforms?.length || 0;
      const settingCount = data.data?.settings?.length || 0;
      
      // 创建下载链接
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `finance-tracker-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      // 恢复按钮状态
      exportBtn.disabled = false;
      exportBtn.innerHTML = originalText;
      
      Toast.success(`数据导出成功！共导出 ${transactionCount} 条交易记录、${platformCount} 个平台、${settingCount} 项设置`);
    } catch (error) {
      console.error('导出数据失败:', error);
      Toast.error('导出数据失败: ' + error.message);
      
      // 恢复按钮状态
      const exportBtn = document.getElementById('exportDataBtn');
      exportBtn.disabled = false;
      exportBtn.innerHTML = '<span class="icon">📤</span> 导出数据';
    }
  },
  
  /**
   * 处理导入文件
   * 默认行为：覆盖现有交易记录数据（不含汇率，汇率会自动从网络获取）
   */
  async handleImportFile(file) {
    const importBtn = document.getElementById('importDataBtn');
    const originalText = importBtn.innerHTML;
    
    try {
      // 检查文件大小，给出提示
      const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
      if (file.size > 10 * 1024 * 1024) { // 大于10MB
        Toast.warning(`文件较大 (${fileSizeMB}MB)，导入可能需要较长时间，请耐心等待...`);
      }
      
      // 显示读取中状态
      importBtn.disabled = true;
      importBtn.innerHTML = '<span class="icon">⏳</span> 读取中...';
      
      // 读取文件内容
      const text = await file.text();
      let importData;
      
      try {
        importData = JSON.parse(text);
      } catch (e) {
        Toast.error('文件格式错误，请选择有效的JSON备份文件');
        importBtn.disabled = false;
        importBtn.innerHTML = originalText;
        return;
      }
      
      // 验证数据格式
      if (!importData.data) {
        Toast.error('无效的备份文件格式');
        importBtn.disabled = false;
        importBtn.innerHTML = originalText;
        return;
      }
      
      // 统计待导入数据量
      const transactionCount = importData.data?.transactions?.length || 0;
      const platformCount = importData.data?.platforms?.length || 0;
      const settingCount = importData.data?.settings?.length || 0;
      
      // 检查是否选择保留现有数据（默认不保留，即覆盖）
      const keepExisting = document.getElementById('keepExistingData').checked;
      const confirmMessage = keepExisting
        ? `确定要导入数据吗？\n\n待导入：${transactionCount} 条交易记录、${platformCount} 个平台配置、${settingCount} 项设置\n\n新数据将与现有数据合并（不推荐）。`
        : `确定要导入数据吗？\n\n待导入：${transactionCount} 条交易记录、${platformCount} 个平台配置、${settingCount} 项设置\n\n⚠️ 这将覆盖所有现有的交易记录！`;
      
      if (!confirm(confirmMessage)) {
        // 重置文件输入和按钮状态
        document.getElementById('importFileInput').value = '';
        importBtn.disabled = false;
        importBtn.innerHTML = originalText;
        return;
      }
      
      // 显示导入中状态
      importBtn.innerHTML = '<span class="icon">⏳</span> 导入中...';
      
      if (transactionCount > 1000) {
        Toast.info(`正在导入 ${transactionCount} 条交易记录，请耐心等待...`, 5000);
      } else {
        Toast.info('正在导入数据...');
      }
      
      // 传递 keepExisting 参数，默认为 false（覆盖模式）
      const result = await API.settings.importData(importData.data, { keepExisting });
      
      // 显示导入结果
      const summary = [];
      if (result.result.platforms.imported > 0) {
        summary.push(`平台: ${result.result.platforms.imported}条`);
      }
      if (result.result.transactions.imported > 0) {
        summary.push(`交易记录: ${result.result.transactions.imported}条`);
      }
      if (result.result.settings.imported > 0) {
        summary.push(`设置: ${result.result.settings.imported}条`);
      }
      
      // 显示跳过的数据
      const skipped = [];
      if (result.result.platforms.skipped > 0) {
        skipped.push(`平台: ${result.result.platforms.skipped}条`);
      }
      if (result.result.transactions.skipped > 0) {
        skipped.push(`交易记录: ${result.result.transactions.skipped}条`);
      }
      
      let message = `数据导入成功！${summary.length > 0 ? '导入了 ' + summary.join(', ') : ''}`;
      if (skipped.length > 0) {
        message += `（跳过 ${skipped.join(', ')}）`;
      }
      
      Toast.success(message, 5000);
      
      // 重新加载所有数据
      await this.loadInitialData();
      
      // 重置文件输入和按钮状态
      document.getElementById('importFileInput').value = '';
      importBtn.disabled = false;
      importBtn.innerHTML = originalText;
      
      // 关闭设置模态框
      Modal.close('settingsModal');
    } catch (error) {
      console.error('导入数据失败:', error);
      Toast.error('导入数据失败: ' + error.message);
      // 重置文件输入和按钮状态
      document.getElementById('importFileInput').value = '';
      importBtn.disabled = false;
      importBtn.innerHTML = originalText;
    }
  }
};

// 页面加载完成后初始化应用
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});

// {{END_MODIFICATIONS}}