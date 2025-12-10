// {{CODE-Cycle-Integration:
//   Task_ID: #T008-T012
//   Timestamp: 2025-12-08T05:09:26Z
//   Phase: D-Develop
//   Context-Analysis: "工具函数模块"
//   Principle_Applied: "DRY, Single Responsibility"
// }}
// {{START_MODIFICATIONS}}

/**
 * 工具函数集合
 */
const Utils = {
  /**
   * 格式化货币
   */
  formatCurrency(amount, currency = 'CNY', showSign = false) {
    const symbols = {
      CNY: '¥',
      HKD: 'HK$',
      USD: '$'
    };
    
    const symbol = symbols[currency] || currency;
    const formatted = Math.abs(amount).toLocaleString('zh-CN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    
    if (showSign && amount !== 0) {
      const sign = amount > 0 ? '+' : '-';
      return `${sign}${symbol}${formatted}`;
    }
    
    return amount < 0 ? `-${symbol}${formatted}` : `${symbol}${formatted}`;
  },
  
  /**
   * 格式化百分比
   */
  formatPercent(value, showSign = true) {
    const formatted = Math.abs(value).toFixed(2);
    if (showSign && value !== 0) {
      const sign = value > 0 ? '+' : '-';
      return `${sign}${formatted}%`;
    }
    return value < 0 ? `-${formatted}%` : `${formatted}%`;
  },
  
  /**
   * 格式化日期时间
   */
  formatDateTime(dateStr, format = 'full') {
    if (!dateStr) return '--';
    
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '--';
    
    const options = {
      full: {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      },
      date: {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      },
      time: {
        hour: '2-digit',
        minute: '2-digit'
      }
    };
    
    return date.toLocaleString('zh-CN', options[format] || options.full);
  },
  
  /**
   * 格式化日期时间为input[datetime-local]格式
   */
  formatDateTimeLocal(dateStr) {
    if (!dateStr) return '';
    
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    
    // 格式: YYYY-MM-DDTHH:mm
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  },
  
  /**
   * 获取盈亏CSS类名
   */
  getProfitClass(value) {
    if (value > 0) return 'profit-positive';
    if (value < 0) return 'profit-negative';
    return '';
  },
  
  /**
   * 获取平台图标
   */
  getPlatformIcon(name) {
    const icons = {
      'A股': '🇨🇳',
      '港股': '🇭🇰',
      '美股': '🇺🇸',
      '虚拟币': '₿'
    };
    return icons[name] || '📊';
  },
  
  /**
   * 防抖函数
   */
  debounce(func, wait = 300) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },
  
  /**
   * 节流函数
   */
  throttle(func, limit = 300) {
    let inThrottle;
    return function executedFunction(...args) {
      if (!inThrottle) {
        func(...args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  },
  
  /**
   * 深拷贝
   */
  deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  },
  
  /**
   * 生成唯一ID
   */
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
};

/**
 * Toast 通知管理
 */
const Toast = {
  container: null,
  
  init() {
    this.container = document.getElementById('toastContainer');
  },
  
  show(message, type = 'success', duration = 3000) {
    if (!this.container) this.init();
    
    const icons = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️'
    };
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <span class="toast-icon">${icons[type] || icons.info}</span>
      <span class="toast-message">${message}</span>
      <button class="toast-close">✕</button>
    `;
    
    // 关闭按钮事件
    toast.querySelector('.toast-close').addEventListener('click', () => {
      this.hide(toast);
    });
    
    this.container.appendChild(toast);
    
    // 自动隐藏
    if (duration > 0) {
      setTimeout(() => this.hide(toast), duration);
    }
    
    return toast;
  },
  
  hide(toast) {
    toast.classList.add('hiding');
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  },
  
  success(message, duration) {
    return this.show(message, 'success', duration);
  },
  
  error(message, duration) {
    return this.show(message, 'error', duration);
  },
  
  warning(message, duration) {
    return this.show(message, 'warning', duration);
  },
  
  info(message, duration) {
    return this.show(message, 'info', duration);
  }
};

/**
 * 模态框管理
 */
const Modal = {
  open(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('active');
      document.body.style.overflow = 'hidden';
    }
  },
  
  close(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove('active');
      document.body.style.overflow = '';
    }
  },
  
  closeAll() {
    document.querySelectorAll('.modal.active').forEach(modal => {
      modal.classList.remove('active');
    });
    document.body.style.overflow = '';
  }
};

/**
 * 自定义下拉框组件
 */
const CustomSelect = {
  /**
   * 初始化所有自定义下拉框
   */
  initAll() {
    document.querySelectorAll('select:not([data-custom-initialized])').forEach(select => {
      this.init(select);
    });
    
    // 点击外部关闭所有下拉框
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.custom-select')) {
        this.closeAll();
      }
    });
    
    // ESC键关闭所有下拉框
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeAll();
      }
    });
  },
  
  /**
   * 初始化单个下拉框
   */
  init(selectElement) {
    if (selectElement.dataset.customInitialized) return;
    
    // 创建自定义下拉框容器
    const wrapper = document.createElement('div');
    wrapper.className = 'custom-select';
    
    // 获取选项
    const options = Array.from(selectElement.options);
    const selectedOption = options.find(opt => opt.selected) || options[0];
    
    // 创建触发器
    const trigger = document.createElement('div');
    trigger.className = 'custom-select-trigger';
    trigger.innerHTML = `
      <span class="selected-text ${!selectedOption?.value ? 'placeholder' : ''}">${selectedOption?.text || '请选择'}</span>
      <span class="arrow"></span>
    `;
    
    // 创建选项列表
    const optionsList = document.createElement('div');
    optionsList.className = 'custom-select-options';
    
    options.forEach((option, index) => {
      const optionEl = document.createElement('div');
      optionEl.className = `custom-select-option ${option.selected ? 'selected' : ''}`;
      optionEl.dataset.value = option.value;
      optionEl.dataset.index = index;
      optionEl.textContent = option.text;
      
      optionEl.addEventListener('click', (e) => {
        e.stopPropagation();
        this.selectOption(wrapper, option.value, option.text);
      });
      
      optionsList.appendChild(optionEl);
    });
    
    // 组装
    wrapper.appendChild(trigger);
    wrapper.appendChild(optionsList);
    
    // 隐藏原始select并插入自定义组件
    selectElement.style.display = 'none';
    selectElement.parentNode.insertBefore(wrapper, selectElement);
    wrapper.appendChild(selectElement);
    
    // 绑定触发器点击事件
    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggle(wrapper);
    });
    
    // 键盘导航
    wrapper.addEventListener('keydown', (e) => {
      this.handleKeyboard(wrapper, e);
    });
    
    // 标记已初始化
    selectElement.dataset.customInitialized = 'true';
    wrapper.dataset.selectId = selectElement.id;
    
    // 使wrapper可聚焦
    wrapper.tabIndex = 0;
  },
  
  /**
   * 切换下拉框状态
   */
  toggle(wrapper) {
    const isOpen = wrapper.classList.contains('open');
    this.closeAll();
    if (!isOpen) {
      wrapper.classList.add('open');
      wrapper.focus();
    }
  },
  
  /**
   * 关闭所有下拉框
   */
  closeAll() {
    document.querySelectorAll('.custom-select.open').forEach(select => {
      select.classList.remove('open');
    });
  },
  
  /**
   * 选择选项
   */
  selectOption(wrapper, value, text) {
    const select = wrapper.querySelector('select');
    const trigger = wrapper.querySelector('.custom-select-trigger');
    const selectedText = trigger.querySelector('.selected-text');
    const options = wrapper.querySelectorAll('.custom-select-option');
    
    // 更新原始select
    select.value = value;
    
    // 触发change事件
    const event = new Event('change', { bubbles: true });
    select.dispatchEvent(event);
    
    // 更新显示文本
    selectedText.textContent = text;
    selectedText.classList.toggle('placeholder', !value);
    
    // 更新选中状态
    options.forEach(opt => {
      opt.classList.toggle('selected', opt.dataset.value === value);
    });
    
    // 关闭下拉框
    this.closeAll();
  },
  
  /**
   * 键盘导航
   */
  handleKeyboard(wrapper, e) {
    const options = wrapper.querySelectorAll('.custom-select-option');
    const currentIndex = Array.from(options).findIndex(opt => opt.classList.contains('selected'));
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (!wrapper.classList.contains('open')) {
          wrapper.classList.add('open');
        } else {
          const nextIndex = Math.min(currentIndex + 1, options.length - 1);
          this.highlightOption(wrapper, nextIndex);
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (wrapper.classList.contains('open')) {
          const prevIndex = Math.max(currentIndex - 1, 0);
          this.highlightOption(wrapper, prevIndex);
        }
        break;
      case 'Enter':
        e.preventDefault();
        if (wrapper.classList.contains('open')) {
          const highlighted = wrapper.querySelector('.custom-select-option.highlighted') ||
                             wrapper.querySelector('.custom-select-option.selected');
          if (highlighted) {
            this.selectOption(wrapper, highlighted.dataset.value, highlighted.textContent);
          }
        } else {
          wrapper.classList.add('open');
        }
        break;
      case 'Escape':
        this.closeAll();
        break;
    }
  },
  
  /**
   * 高亮选项
   */
  highlightOption(wrapper, index) {
    const options = wrapper.querySelectorAll('.custom-select-option');
    options.forEach((opt, i) => {
      opt.classList.toggle('highlighted', i === index);
    });
    
    // 滚动到可见区域
    const highlighted = options[index];
    if (highlighted) {
      highlighted.scrollIntoView({ block: 'nearest' });
    }
  },
  
  /**
   * 更新下拉框选项（用于动态更新）
   */
  updateOptions(selectId, options) {
    const select = document.getElementById(selectId);
    if (!select) return;
    
    const wrapper = select.closest('.custom-select');
    if (!wrapper) return;
    
    // 更新原始select
    select.innerHTML = options.map(opt =>
      `<option value="${opt.value}" ${opt.selected ? 'selected' : ''}>${opt.text}</option>`
    ).join('');
    
    // 更新自定义选项列表
    const optionsList = wrapper.querySelector('.custom-select-options');
    const selectedOption = options.find(opt => opt.selected) || options[0];
    
    optionsList.innerHTML = '';
    options.forEach((option, index) => {
      const optionEl = document.createElement('div');
      optionEl.className = `custom-select-option ${option.selected ? 'selected' : ''}`;
      optionEl.dataset.value = option.value;
      optionEl.dataset.index = index;
      optionEl.textContent = option.text;
      
      optionEl.addEventListener('click', (e) => {
        e.stopPropagation();
        CustomSelect.selectOption(wrapper, option.value, option.text);
      });
      
      optionsList.appendChild(optionEl);
    });
    
    // 更新触发器显示
    const trigger = wrapper.querySelector('.custom-select-trigger');
    const selectedText = trigger.querySelector('.selected-text');
    selectedText.textContent = selectedOption?.text || '请选择';
    selectedText.classList.toggle('placeholder', !selectedOption?.value);
  },
  
  /**
   * 设置下拉框值
   */
  setValue(selectId, value) {
    const select = document.getElementById(selectId);
    if (!select) return;
    
    const wrapper = select.closest('.custom-select');
    if (!wrapper) {
      // 如果还没有初始化自定义下拉框，直接设置原始select
      select.value = value;
      return;
    }
    
    const option = Array.from(select.options).find(opt => opt.value === value);
    if (option) {
      this.selectOption(wrapper, value, option.text);
    }
  },
  
  /**
   * 获取下拉框值
   */
  getValue(selectId) {
    const select = document.getElementById(selectId);
    return select ? select.value : null;
  }
};

/**
 * 主题管理器
 */
const ThemeManager = {
  STORAGE_KEY: 'finance-tracker-theme',
  DARK_THEME: 'dark',
  LIGHT_THEME: 'light',
  
  /**
   * 初始化主题管理器
   */
  init() {
    // 获取保存的主题或使用系统偏好
    const savedTheme = localStorage.getItem(this.STORAGE_KEY);
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initialTheme = savedTheme || (prefersDark ? this.DARK_THEME : this.LIGHT_THEME);
    
    // 应用初始主题（无动画）
    this.applyTheme(initialTheme, false);
    
    // 绑定切换按钮事件
    const toggleBtn = document.getElementById('themeToggle');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => this.toggle());
    }
    
    // 监听系统主题变化
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (!localStorage.getItem(this.STORAGE_KEY)) {
        this.applyTheme(e.matches ? this.DARK_THEME : this.LIGHT_THEME, true);
      }
    });
  },
  
  /**
   * 获取当前主题
   */
  getCurrentTheme() {
    return document.documentElement.getAttribute('data-theme') || this.DARK_THEME;
  },
  
  /**
   * 切换主题
   */
  toggle() {
    const currentTheme = this.getCurrentTheme();
    const newTheme = currentTheme === this.DARK_THEME ? this.LIGHT_THEME : this.DARK_THEME;
    this.applyTheme(newTheme, true);
    localStorage.setItem(this.STORAGE_KEY, newTheme);
  },
  
  /**
   * 应用主题
   * @param {string} theme - 主题名称
   * @param {boolean} animate - 是否使用动画
   */
  applyTheme(theme, animate = true) {
    const root = document.documentElement;
    const toggleBtn = document.getElementById('themeToggle');
    
    if (animate) {
      // 添加过渡类
      root.classList.add('theme-transitioning');
      
      // 动画结束后移除过渡类
      setTimeout(() => {
        root.classList.remove('theme-transitioning');
      }, 400);
    }
    
    // 设置主题属性
    root.setAttribute('data-theme', theme);
    
    // 更新切换按钮状态
    if (toggleBtn) {
      toggleBtn.classList.toggle('light', theme === this.LIGHT_THEME);
    }
  },
  
  /**
   * 设置主题
   * @param {string} theme - 主题名称
   */
  setTheme(theme) {
    if (theme === this.DARK_THEME || theme === this.LIGHT_THEME) {
      this.applyTheme(theme, true);
      localStorage.setItem(this.STORAGE_KEY, theme);
    }
  }
};

// {{END_MODIFICATIONS}}