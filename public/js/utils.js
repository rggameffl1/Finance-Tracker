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
   * 格式化日期时间为两行显示（HTML格式）
   * 返回带有日期和时间分开的HTML结构
   */
  formatDateTimeHTML(dateStr) {
    if (!dateStr) return '--';
    
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '--';
    
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    const dateText = `${year}/${month}/${day}`;
    const timeText = `${hours}:${minutes}`;
    
    return `<div class="datetime-cell"><span class="date">${dateText}</span><span class="time">${timeText}</span></div>`;
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
  },
  
  /**
   * 转义HTML特殊字符，防止XSS攻击
   */
  escapeHtml(text) {
    if (!text) return '';
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return String(text).replace(/[&<>"']/g, m => map[m]);
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
   * 静默设置下拉框值（不触发change事件）
   * 用于加载设置时更新显示，避免触发保存
   */
  setValueSilent(selectId, value) {
    const select = document.getElementById(selectId);
    if (!select) return;
    
    // 设置原始select的值
    select.value = value;
    
    const wrapper = select.closest('.custom-select');
    if (!wrapper) return;
    
    // 更新自定义下拉框的显示（不触发change事件）
    const trigger = wrapper.querySelector('.custom-select-trigger');
    const selectedText = trigger.querySelector('.selected-text');
    const options = wrapper.querySelectorAll('.custom-select-option');
    
    const option = Array.from(select.options).find(opt => opt.value === value);
    if (option) {
      // 更新显示文本
      selectedText.textContent = option.text;
      selectedText.classList.toggle('placeholder', !value);
      
      // 更新选中状态
      options.forEach(opt => {
        opt.classList.toggle('selected', opt.dataset.value === value);
      });
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
 * 主题管理器 - 带透明圆形扩散动画（克隆页面内容实现真正的透明效果）
 */
const ThemeManager = {
  STORAGE_KEY: 'finance-tracker-theme',
  DARK_THEME: 'dark',
  LIGHT_THEME: 'light',
  isAnimating: false,
  
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
      toggleBtn.addEventListener('click', (e) => this.toggle(e));
    }
    
    // 监听系统主题变化
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (!localStorage.getItem(this.STORAGE_KEY)) {
        this.applyTheme(e.matches ? this.DARK_THEME : this.LIGHT_THEME, false);
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
   * 切换主题（带透明圆形扩散动画）
   */
  async toggle(event) {
    if (this.isAnimating) return;
    
    const currentTheme = this.getCurrentTheme();
    const newTheme = currentTheme === this.DARK_THEME ? this.LIGHT_THEME : this.DARK_THEME;
    const toggleBtn = document.getElementById('themeToggle');
    
    // 获取按钮位置作为动画起点
    let x, y;
    if (toggleBtn) {
      const rect = toggleBtn.getBoundingClientRect();
      x = rect.left + rect.width / 2;
      y = rect.top + rect.height / 2;
      
      // 添加脉冲效果
      toggleBtn.classList.add('switching');
      setTimeout(() => toggleBtn.classList.remove('switching'), 300);
    } else {
      x = window.innerWidth / 2;
      y = window.innerHeight / 2;
    }
    
    // 尝试使用 View Transitions API（如果支持）
    if (document.startViewTransition) {
      await this.animateWithViewTransition(x, y, newTheme);
    } else if (this.supportsClipPath()) {
      // 降级方案：使用截图 + clip-path
      await this.animateWithScreenshot(x, y, newTheme);
    } else {
      // 最终降级：直接切换
      this.applyTheme(newTheme, true);
    }
    
    localStorage.setItem(this.STORAGE_KEY, newTheme);
  },
  
  /**
   * 检查浏览器是否支持 clip-path 动画
   */
  supportsClipPath() {
    return CSS.supports && CSS.supports('clip-path', 'circle(50%)');
  },
  
  /**
   * 使用 View Transitions API 实现动画（最佳方案）
   * 切换到浅色：浅色（新视图）从按钮向外扩散
   * 切换到深色：浅色（旧视图）从外向按钮收缩
   */
  async animateWithViewTransition(x, y, newTheme) {
    this.isAnimating = true;
    const root = document.documentElement;
    
    // 计算需要覆盖整个屏幕的圆的半径
    const maxRadius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y)
    );
    
    const isGoingToLight = newTheme === this.LIGHT_THEME;
    
    // 禁用 CSS 过渡效果，避免闪屏
    root.classList.add('theme-clip-animating');
    
    // 在动画开始前设置 z-index
    // 切换到浅色：新视图在上面（浅色扩散覆盖深色）
    // 切换到深色：旧视图在上面（浅色收缩露出深色）
    if (isGoingToLight) {
      root.style.setProperty('--vt-old-z', '1');
      root.style.setProperty('--vt-new-z', '9999');
    } else {
      root.style.setProperty('--vt-old-z', '9999');
      root.style.setProperty('--vt-new-z', '1');
    }
    
    try {
      const transition = document.startViewTransition(() => {
        this.applyTheme(newTheme, false);
      });
      
      // 等待准备完成
      await transition.ready;
      
      // 应用自定义动画 - 更流畅的参数
      const duration = 600;
      const easing = 'cubic-bezier(0.22, 1, 0.36, 1)';
      
      if (isGoingToLight) {
        // 切换到浅色：新视图（浅色）从按钮向外扩散
        document.documentElement.animate(
          {
            clipPath: [
              `circle(0px at ${x}px ${y}px)`,
              `circle(${maxRadius}px at ${x}px ${y}px)`
            ]
          },
          {
            duration,
            easing,
            fill: 'forwards',
            pseudoElement: '::view-transition-new(root)'
          }
        );
      } else {
        // 切换到深色：旧视图（浅色）从外向按钮收缩
        document.documentElement.animate(
          {
            clipPath: [
              `circle(${maxRadius}px at ${x}px ${y}px)`,
              `circle(0px at ${x}px ${y}px)`
            ]
          },
          {
            duration,
            easing,
            fill: 'forwards',
            pseudoElement: '::view-transition-old(root)'
          }
        );
      }
      
      await transition.finished;
    } catch (e) {
      console.warn('View Transition failed:', e);
      this.applyTheme(newTheme, false);
    }
    
    // 清理 - 延迟一点时间确保动画完全结束
    setTimeout(() => {
      root.style.removeProperty('--vt-old-z');
      root.style.removeProperty('--vt-new-z');
      root.classList.remove('theme-clip-animating');
      this.isAnimating = false;
    }, 50);
  },
  
  /**
   * 使用 clip-path 实现动画（降级方案）
   * 切换到浅色：浅色覆盖层从按钮向外扩散
   * 切换到深色：浅色覆盖层从外向按钮收缩
   */
  async animateWithScreenshot(x, y, newTheme) {
    this.isAnimating = true;
    const root = document.documentElement;
    
    // 计算需要覆盖整个屏幕的圆的半径
    const maxRadius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y)
    );
    
    const isGoingToLight = newTheme === this.LIGHT_THEME;
    
    // 禁用默认过渡
    root.classList.add('theme-clip-animating');
    
    const overlay = document.createElement('div');
    overlay.id = 'theme-transition-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      pointer-events: none;
      z-index: 99999;
      will-change: clip-path;
    `;
    
    document.body.appendChild(overlay);
    
    // 更流畅的动画参数
    const duration = 600;
    const easing = 'cubic-bezier(0.22, 1, 0.36, 1)';
    
    // 浅色背景样式
    const lightBg = '#f8fafc';
    const lightGradient = 'radial-gradient(ellipse at top, rgba(99, 102, 241, 0.05) 0%, transparent 50%), radial-gradient(ellipse at bottom right, rgba(16, 185, 129, 0.03) 0%, transparent 50%)';
    
    if (isGoingToLight) {
      // 切换到浅色：浅色覆盖层从按钮向外扩散
      overlay.style.background = lightBg;
      overlay.style.backgroundImage = lightGradient;
      overlay.style.clipPath = `circle(0px at ${x}px ${y}px)`;
      
      // 触发重排
      overlay.offsetHeight;
      
      // 开始扩散动画
      overlay.style.transition = `clip-path ${duration}ms ${easing}`;
      overlay.style.clipPath = `circle(${maxRadius}px at ${x}px ${y}px)`;
      
      // 动画中间切换主题
      setTimeout(() => {
        this.applyTheme(newTheme, false);
      }, duration / 2);
      
    } else {
      // 切换到深色：浅色覆盖层从外向按钮收缩
      overlay.style.background = lightBg;
      overlay.style.backgroundImage = lightGradient;
      overlay.style.clipPath = `circle(${maxRadius}px at ${x}px ${y}px)`;
      
      // 先切换主题（被覆盖层遮住）
      this.applyTheme(newTheme, false);
      
      // 触发重排
      overlay.offsetHeight;
      
      // 开始收缩动画
      overlay.style.transition = `clip-path ${duration}ms ${easing}`;
      overlay.style.clipPath = `circle(0px at ${x}px ${y}px)`;
    }
    
    // 动画结束后清理
    setTimeout(() => {
      overlay.remove();
      root.classList.remove('theme-clip-animating');
      this.isAnimating = false;
    }, duration);
  },
  
  /**
   * 应用主题
   * @param {string} theme - 主题名称
   * @param {boolean} animate - 是否使用CSS过渡动画
   */
  applyTheme(theme, animate = true) {
    const root = document.documentElement;
    const toggleBtn = document.getElementById('themeToggle');
    
    if (animate && !root.classList.contains('theme-clip-animating')) {
      root.classList.add('theme-transitioning');
      setTimeout(() => {
        root.classList.remove('theme-transitioning');
      }, 400);
    }
    
    // 设置主题属性
    root.setAttribute('data-theme', theme);
    
    // 更新切换按钮状态和aria标签
    if (toggleBtn) {
      toggleBtn.classList.toggle('light', theme === this.LIGHT_THEME);
      toggleBtn.setAttribute('aria-label',
        theme === this.DARK_THEME ? '切换到浅色主题' : '切换到深色主题'
      );
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