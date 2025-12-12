// {{CODE-Cycle-Integration:
//   Task_ID: #T008-T012
//   Timestamp: 2025-12-08T05:09:02Z
//   Phase: D-Develop
//   Context-Analysis: "API调用封装模块"
//   Principle_Applied: "DRY, Single Responsibility, Error Handling"
// }}
// {{START_MODIFICATIONS}}

/**
 * API 调用封装
 */
const API = {
  baseUrl: '/api',
  
  /**
   * 通用请求方法
   */
  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    };
    
    try {
      const response = await fetch(url, config);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || data.message || '请求失败');
      }
      
      return data;
    } catch (error) {
      console.error(`API请求失败 [${endpoint}]:`, error);
      throw error;
    }
  },
  
  /**
   * GET 请求
   */
  get(endpoint, params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const url = queryString ? `${endpoint}?${queryString}` : endpoint;
    return this.request(url, { method: 'GET' });
  },
  
  /**
   * POST 请求
   */
  post(endpoint, data = {}) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },
  
  /**
   * PUT 请求
   */
  put(endpoint, data = {}) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },
  
  /**
   * DELETE 请求
   */
  delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  },
  
  // ========================================
  // 平台相关 API
  // ========================================
  
  platforms: {
    /**
     * 获取所有平台
     */
    getAll() {
      return API.get('/platforms');
    },
    
    /**
     * 获取单个平台
     */
    getById(id) {
      return API.get(`/platforms/${id}`);
    },
    
    /**
     * 创建平台
     */
    create(data) {
      return API.post('/platforms', data);
    },
    
    /**
     * 更新平台
     */
    update(id, data) {
      return API.put(`/platforms/${id}`, data);
    },
    
    /**
     * 删除平台
     */
    delete(id) {
      return API.delete(`/platforms/${id}`);
    }
  },
  
  // ========================================
  // 交易记录相关 API
  // ========================================
  
  transactions: {
    /**
     * 获取交易记录列表
     */
    getAll(params = {}) {
      return API.get('/transactions', params);
    },
    
    /**
     * 获取单个交易记录
     */
    getById(id) {
      return API.get(`/transactions/${id}`);
    },
    
    /**
     * 创建交易记录
     */
    create(data) {
      return API.post('/transactions', data);
    },
    
    /**
     * 更新交易记录
     */
    update(id, data) {
      return API.put(`/transactions/${id}`, data);
    },
    
    /**
     * 删除交易记录
     */
    delete(id) {
      return API.delete(`/transactions/${id}`);
    },
    
    /**
     * 批量删除交易记录
     */
    batchDelete(ids) {
      return API.post('/transactions/batch-delete', { ids });
    }
  },
  
  // ========================================
  // 汇率相关 API
  // ========================================
  
  exchangeRates: {
    /**
     * 获取所有汇率
     */
    getAll() {
      return API.get('/exchange-rates');
    },
    
    /**
     * 获取特定汇率
     */
    get(from, to) {
      return API.get(`/exchange-rates/${from}/${to}`);
    },
    
    /**
     * 刷新汇率
     */
    refresh() {
      return API.post('/exchange-rates/refresh');
    },
    
    /**
     * 设置汇率
     */
    set(from, to, rate) {
      return API.put(`/exchange-rates/${from}/${to}`, { rate });
    }
  },
  
  // ========================================
  // 总览相关 API
  // ========================================
  
  overview: {
    /**
     * 获取资金总览
     */
    get(currency = 'CNY') {
      return API.get('/overview', { currency });
    },
    
    /**
     * 获取资金分布
     */
    getDistribution(currency = 'CNY') {
      return API.get('/overview/distribution', { currency });
    },
    
    /**
     * 获取盈亏趋势
     */
    getTrend(currency = 'CNY', months = 12) {
      return API.get('/overview/trend', { currency, months });
    }
  },
  
  // ========================================
  // 设置相关 API
  // ========================================
  
  settings: {
    /**
     * 获取所有设置
     */
    getAll() {
      return API.get('/settings');
    },
    
    /**
     * 获取单个设置
     */
    get(key) {
      return API.get(`/settings/${key}`);
    },
    
    /**
     * 更新设置
     */
    update(key, value) {
      return API.put(`/settings/${key}`, { value });
    },
    
    /**
     * 批量更新设置
     */
    updateAll(settings) {
      return API.put('/settings', settings);
    },
    
    /**
     * 导出所有数据
     */
    async exportData() {
      const response = await fetch('/api/settings/export/all');
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '导出失败');
      }
      return response.json();
    },
    
    /**
     * 导入数据
     */
    importData(data, options = {}) {
      return API.post('/settings/import/all', { data, options });
    }
  }
};

// {{END_MODIFICATIONS}}