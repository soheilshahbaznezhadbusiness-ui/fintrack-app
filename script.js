/* ==========================================================================
   فین‌ترک - مدیریت مالی و مخاطبین شخصی
   script.js (نسخه فارسی)

   معماری (الگوی ماژولار):
   - CONFIG                 : ثابت‌های سراسری برنامه
   - StorageService         : لایه خواندن/نوشتن LocalStorage
   - ValidationUtils        : اعتبارسنجی‌های قابل استفاده مجدد
   - FormatUtils            : فرمت‌دهی تاریخ و مبلغ
   - ToastService           : پیام‌های Toast
   - ModalService           : باز/بسته کردن مودال‌ها + دیالوگ تایید
   - ThemeService           : مدیریت تم روشن/تاریک
   - AuthService            : ورود / ثبت‌نام / خروج / تغییر رمز
   - FinanceService         : عملیات درآمد، هزینه و بودجه
   - ContactService         : عملیات مخاطبین
   - ReportService          : تجمیع داده برای گزارش‌ها و نمودارها
   - ChartService           : رندر نمودارهای Chart.js
   - NavigationService      : تعویض صفحات (SPA)
   - DashboardController    : رندر صفحه داشبورد
   - TransactionsController : رندر/فیلتر/مرتب‌سازی تراکنش‌ها
   - ContactsController     : رندر/فیلتر مخاطبین
   - ReportsController      : رندر صفحه گزارش‌ها
   - SettingsController     : رندر صفحه تنظیمات
   - App                    : راه‌اندازی برنامه و اتصال رویدادها
   ========================================================================== */

'use strict';

/* ==========================================================================
   تنظیمات کلی برنامه
   ========================================================================== */
const CONFIG = {
  STORAGE_KEYS: {
    USER: 'fintrack_user',
    SESSION: 'fintrack_session',
    THEME: 'fintrack_theme',
    INCOMES: 'fintrack_incomes',
    EXPENSES: 'fintrack_expenses',
    BUDGET: 'fintrack_budget',
    CONTACTS: 'fintrack_contacts',
    SETTINGS: 'fintrack_settings',
    PROFILE_PHOTO: 'fintrack_profile_photo',
    BALANCE_VISIBILITY: 'fintrack_balance_hidden'
  },
  // دسته‌بندی‌های هزینه - کلید و برچسب هر دو فارسی هستند
  CATEGORIES: {
    'غذا': { icon: '🍔', color: '#FF6B6B' },
    'حمل‌ونقل': { icon: '🚗', color: '#4ECDC4' },
    'قبوض': { icon: '🧾', color: '#FFD93D' },
    'خرید': { icon: '🛍️', color: '#A78BFA' },
    'سرگرمی': { icon: '🎬', color: '#FF8FAB' },
    'سلامت': { icon: '🏥', color: '#6BCB77' },
    'متفرقه': { icon: '📦', color: '#95A5A6' }
  },
  MAX_USERNAME_LENGTH: 30,
  MAX_PASSWORD_LENGTH: 25,
  MIN_PASSWORD_LENGTH: 6,
  MAX_DESCRIPTION_LENGTH: 256,
  PHONE_MIN_LENGTH: 10,
  PHONE_MAX_LENGTH: 11,
  BUDGET_WARNING_THRESHOLD: 80, // درصد
  TOAST_DURATION: 3500,
  SPLASH_DURATION: 1600
};


/* ==========================================================================
   سرویس ذخیره‌سازی (LocalStorage)
   ========================================================================== */
const StorageService = (function () {
  function get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(key);
      return raw !== null ? JSON.parse(raw) : fallback;
    } catch (err) {
      console.error('خطا در خواندن StorageService برای کلید:', key, err);
      return fallback;
    }
  }

  function set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (err) {
      console.error('خطا در نوشتن StorageService برای کلید:', key, err);
      return false;
    }
  }

  function remove(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (err) {
      console.error('خطا در حذف StorageService برای کلید:', key, err);
      return false;
    }
  }

  function clearAll() {
    try {
      Object.values(CONFIG.STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
      return true;
    } catch (err) {
      console.error('خطا در پاک‌سازی کامل StorageService:', err);
      return false;
    }
  }

  return { get, set, remove, clearAll };
})();


/* ==========================================================================
   تابع هش ساده
   توجه: این یک هش ساده و سبک سمت کلاینت است که فقط به این دلیل استفاده
   شده که این برنامه کاملاً آفلاین است و سروری در کار نیست. این روش از
   نظر رمزنگاری امن نیست. در یک محصول واقعی باید رمز عبور در سمت سرور
   با الگوریتم مناسب (bcrypt، Argon2 و غیره) هش و بررسی شود.
   ========================================================================== */
function simpleHash(text) {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0; // تبدیل به عدد صحیح ۳۲ بیتی
  }
  return 'h' + Math.abs(hash).toString(36) + '_' + text.length;
}


/* ==========================================================================
   اعتبارسنجی‌ها
   ========================================================================== */
const ValidationUtils = (function () {
  function isRequired(value) {
    return value !== undefined && value !== null && String(value).trim().length > 0;
  }

  function isValidUsername(username) {
    const trimmed = (username || '').trim();
    return trimmed.length >= 3 && trimmed.length <= CONFIG.MAX_USERNAME_LENGTH;
  }

  // رمز عبور باید بین حداقل و حداکثر مجاز باشد و شامل حداقل یک حرف
  // بزرگ، یک حرف کوچک و یک عدد باشد (حروف انگلیسی).
  function isValidPassword(password) {
    const value = password || '';
    if (value.length < CONFIG.MIN_PASSWORD_LENGTH || value.length > CONFIG.MAX_PASSWORD_LENGTH) {
      return false;
    }
    const hasUpper = /[A-Z]/.test(value);
    const hasLower = /[a-z]/.test(value);
    const hasDigit = /[0-9]/.test(value);
    return hasUpper && hasLower && hasDigit;
  }

  function isValidAmount(amount) {
    const num = parseFloat(amount);
    return !isNaN(num) && num > 0;
  }

  function isValidDate(dateStr) {
    return isRequired(dateStr) && !isNaN(new Date(dateStr).getTime());
  }

  // شماره تلفن باید فقط شامل عدد باشد و طولش بین ۱۰ تا ۱۱ رقم باشد
  function isValidPhone(phone) {
    const trimmed = (phone || '').trim();
    const regex = new RegExp(`^[0-9]{${CONFIG.PHONE_MIN_LENGTH},${CONFIG.PHONE_MAX_LENGTH}}$`);
    return regex.test(trimmed);
  }

  function isValidCardNumber(card) {
    if (!isRequired(card)) return true; // اختیاری است
    const digitsOnly = card.replace(/[\s-]/g, '');
    return /^[0-9]{12,19}$/.test(digitsOnly);
  }

  // توضیحات/یادداشت‌ها نباید از حداکثر طول مجاز بیشتر باشند
  function isValidDescriptionLength(text) {
    return (text || '').length <= CONFIG.MAX_DESCRIPTION_LENGTH;
  }

  return {
    isRequired,
    isValidUsername,
    isValidPassword,
    isValidAmount,
    isValidDate,
    isValidPhone,
    isValidCardNumber,
    isValidDescriptionLength
  };
})();


/* ==========================================================================
   فرمت‌دهی تاریخ و مبلغ
   ========================================================================== */
const FormatUtils = (function () {
  function pad(num) {
    return String(num).padStart(2, '0');
  }

  function getCurrencySymbol() {
    const settings = StorageService.get(CONFIG.STORAGE_KEYS.SETTINGS, {});
    return settings.currency || 'تومان';
  }

  // مبلغ همیشه به‌صورت «عدد + واحد پول» نمایش داده می‌شود (مثلاً «۱۵۰,۰۰۰ تومان»)
  function formatCurrency(amount) {
    const num = parseFloat(amount) || 0;
    const symbol = getCurrencySymbol();
    const formattedNum = num.toLocaleString('fa-IR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    return `${formattedNum} ${symbol}`;
  }

  // تاریخ به‌صورت رشته میلادی ISO ذخیره می‌شود (برای سازگاری با <input type="date">)
  function toISODate(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function getMonthKey(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
  }

  // نمایش تاریخ با تقویم شمسی (فقط برای نمایش؛ داده اصلی میلادی باقی می‌ماند)
  function formatDate(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('fa-IR', { month: 'long', day: 'numeric', year: 'numeric' });
  }

  function formatDateShort(date) {
    return date.toLocaleDateString('fa-IR', { month: 'short', day: 'numeric' });
  }

  function formatDateTime(isoStr) {
    if (!isoStr) return '-';
    const date = new Date(isoStr);
    return date.toLocaleDateString('fa-IR', { month: 'long', day: 'numeric', year: 'numeric' }) +
      ' - ' + date.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
  }

  function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  return {
    getCurrencySymbol,
    formatCurrency,
    toISODate,
    getMonthKey,
    formatDate,
    formatDateShort,
    formatDateTime,
    capitalize
  };
})();


/* ==========================================================================
   سرویس پیام‌های Toast
   ========================================================================== */
const ToastService = (function () {
  const ICONS = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };

  function show(message, type = 'info', duration = CONFIG.TOAST_DURATION) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    const iconSpan = document.createElement('span');
    iconSpan.className = 'toast-icon';
    iconSpan.textContent = ICONS[type] || ICONS.info;

    const msgSpan = document.createElement('span');
    msgSpan.className = 'toast-message';
    msgSpan.textContent = message;

    toast.appendChild(iconSpan);
    toast.appendChild(msgSpan);
    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('toast-hide');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  return {
    success: (msg) => show(msg, 'success'),
    error: (msg) => show(msg, 'error'),
    warning: (msg) => show(msg, 'warning'),
    info: (msg) => show(msg, 'info')
  };
})();


/* ==========================================================================
   سرویس مودال‌ها
   ========================================================================== */
const ModalService = (function () {
  function open(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function close(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.classList.add('hidden');
    document.body.style.overflow = '';
  }

  function closeAll() {
    document.querySelectorAll('.modal-overlay').forEach((m) => m.classList.add('hidden'));
    document.body.style.overflow = '';
  }

  // دیالوگ تایید عمومی. آبجکت ورودی: { title, message, icon, confirmLabel, onConfirm }
  function confirmAction(options) {
    const titleEl = document.getElementById('confirmTitle');
    const msgEl = document.getElementById('confirmMessage');
    const iconEl = document.getElementById('confirmIcon');
    const okBtn = document.getElementById('confirmOkBtn');
    const cancelBtn = document.getElementById('confirmCancelBtn');

    titleEl.textContent = options.title || 'مطمئنی؟';
    msgEl.textContent = options.message || 'این عمل قابل بازگشت نیست.';
    iconEl.textContent = options.icon || '⚠️';
    okBtn.textContent = options.confirmLabel || 'تایید';

    // بازتعریف onclick به‌طور خودکار هندلرهای قبلی را حذف می‌کند
    okBtn.onclick = () => {
      close('confirmModal');
      if (typeof options.onConfirm === 'function') options.onConfirm();
    };
    cancelBtn.onclick = () => close('confirmModal');

    open('confirmModal');
  }

  return { open, close, closeAll, confirmAction };
})();


/* ==========================================================================
   سرویس تم (روشن/تاریک)
   ========================================================================== */
const ThemeService = (function () {
  function apply(theme) {
    document.documentElement.setAttribute('data-theme', theme);

    const toggleBtn = document.getElementById('themeToggleBtn');
    if (toggleBtn) toggleBtn.textContent = theme === 'dark' ? '☀️' : '🌙';

    const switchInput = document.getElementById('darkModeSwitch');
    if (switchInput) switchInput.checked = theme === 'dark';

    // نمودارها را دوباره رسم می‌کند تا رنگشان با تم جدید هماهنگ شود
    if (window.__chartsInitialized) {
      ReportsController.refreshCharts();
      DashboardController.refreshChart();
    }
  }

  function setTheme(theme) {
    StorageService.set(CONFIG.STORAGE_KEYS.THEME, theme);
    apply(theme);
  }

  function toggle() {
    const current = StorageService.get(CONFIG.STORAGE_KEYS.THEME, 'light');
    setTheme(current === 'dark' ? 'light' : 'dark');
  }

  function init() {
    const saved = StorageService.get(CONFIG.STORAGE_KEYS.THEME, 'light');
    apply(saved);
  }

  return { init, apply, setTheme, toggle };
})();


/* ==========================================================================
   سرویس احراز هویت
   ========================================================================== */
const AuthService = (function () {
  function isRegistered() {
    return !!StorageService.get(CONFIG.STORAGE_KEYS.USER);
  }

  function register(username, password) {
    const user = {
      username: username.trim(),
      password: simpleHash(password),
      createdAt: new Date().toISOString()
    };
    StorageService.set(CONFIG.STORAGE_KEYS.USER, user);
    StorageService.set(CONFIG.STORAGE_KEYS.SESSION, { isLoggedIn: true, loginAt: new Date().toISOString() });
    return user;
  }

  function login(username, password) {
    const user = StorageService.get(CONFIG.STORAGE_KEYS.USER);
    if (!user) {
      return { success: false, message: 'حساب کاربری پیدا نشد. لطفاً ابتدا ثبت‌نام کن.' };
    }
    if (user.username !== username.trim() || user.password !== simpleHash(password)) {
      return { success: false, message: 'نام کاربری یا رمز عبور اشتباه است.' };
    }
    StorageService.set(CONFIG.STORAGE_KEYS.SESSION, { isLoggedIn: true, loginAt: new Date().toISOString() });
    return { success: true };
  }

  function logout() {
    StorageService.set(CONFIG.STORAGE_KEYS.SESSION, { isLoggedIn: false });
  }

  function isLoggedIn() {
    const session = StorageService.get(CONFIG.STORAGE_KEYS.SESSION);
    return !!(session && session.isLoggedIn);
  }

  function getCurrentUser() {
    return StorageService.get(CONFIG.STORAGE_KEYS.USER);
  }

  function changePassword(currentPassword, newPassword) {
    const user = getCurrentUser();
    if (!user) return { success: false, message: 'حساب کاربری‌ای پیدا نشد.' };
    if (user.password !== simpleHash(currentPassword)) {
      return { success: false, message: 'رمز عبور فعلی اشتباه است.' };
    }
    user.password = simpleHash(newPassword);
    StorageService.set(CONFIG.STORAGE_KEYS.USER, user);
    return { success: true };
  }

  return { isRegistered, register, login, logout, isLoggedIn, getCurrentUser, changePassword };
})();


/* ==========================================================================
   سرویس مالی (درآمد، هزینه، بودجه)
   ========================================================================== */
const FinanceService = (function () {
  function generateId(prefix) {
    return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  }

  /* ---------- درآمد ---------- */
  function getIncomes() {
    return StorageService.get(CONFIG.STORAGE_KEYS.INCOMES, []);
  }

  function saveIncomes(list) {
    StorageService.set(CONFIG.STORAGE_KEYS.INCOMES, list);
  }

  function addIncome(data) {
    const list = getIncomes();
    const item = {
      id: generateId('inc'),
      title: data.title.trim(),
      amount: parseFloat(data.amount),
      date: data.date,
      description: (data.description || '').trim(),
      createdAt: new Date().toISOString()
    };
    list.push(item);
    saveIncomes(list);
    return item;
  }

  function updateIncome(id, data) {
    const list = getIncomes();
    const idx = list.findIndex((i) => i.id === id);
    if (idx === -1) return null;
    list[idx] = {
      ...list[idx],
      title: data.title.trim(),
      amount: parseFloat(data.amount),
      date: data.date,
      description: (data.description || '').trim()
    };
    saveIncomes(list);
    return list[idx];
  }

  function deleteIncome(id) {
    saveIncomes(getIncomes().filter((i) => i.id !== id));
  }

  function getIncomeById(id) {
    return getIncomes().find((i) => i.id === id) || null;
  }

  /* ---------- هزینه ---------- */
  function getExpenses() {
    return StorageService.get(CONFIG.STORAGE_KEYS.EXPENSES, []);
  }

  function saveExpenses(list) {
    StorageService.set(CONFIG.STORAGE_KEYS.EXPENSES, list);
  }

  function addExpense(data) {
    const list = getExpenses();
    const item = {
      id: generateId('exp'),
      title: data.title.trim(),
      amount: parseFloat(data.amount),
      category: data.category,
      date: data.date,
      description: (data.description || '').trim(),
      createdAt: new Date().toISOString()
    };
    list.push(item);
    saveExpenses(list);
    return item;
  }

  function updateExpense(id, data) {
    const list = getExpenses();
    const idx = list.findIndex((e) => e.id === id);
    if (idx === -1) return null;
    list[idx] = {
      ...list[idx],
      title: data.title.trim(),
      amount: parseFloat(data.amount),
      category: data.category,
      date: data.date,
      description: (data.description || '').trim()
    };
    saveExpenses(list);
    return list[idx];
  }

  function deleteExpense(id) {
    saveExpenses(getExpenses().filter((e) => e.id !== id));
  }

  function getExpenseById(id) {
    return getExpenses().find((e) => e.id === id) || null;
  }

  /* ---------- تراکنش‌های ترکیبی ---------- */
  function getAllTransactions() {
    const incomes = getIncomes().map((i) => ({ ...i, type: 'income' }));
    const expenses = getExpenses().map((e) => ({ ...e, type: 'expense' }));
    return [...incomes, ...expenses];
  }

  /* ---------- مجموع‌ها ---------- */
  function getTotalIncome() {
    return getIncomes().reduce((sum, i) => sum + parseFloat(i.amount), 0);
  }

  function getTotalExpense() {
    return getExpenses().reduce((sum, e) => sum + parseFloat(e.amount), 0);
  }

  function getBalance() {
    return getTotalIncome() - getTotalExpense();
  }

  /* ---------- بودجه ---------- */
  function getBudget() {
    const budget = StorageService.get(CONFIG.STORAGE_KEYS.BUDGET);
    const currentMonth = FormatUtils.getMonthKey(new Date());
    if (budget && budget.month === currentMonth) return budget;
    return null; // بودجه فقط برای ماهی که تنظیم شده معتبر است
  }

  function setBudget(amount) {
    const budget = { monthlyLimit: parseFloat(amount), month: FormatUtils.getMonthKey(new Date()) };
    StorageService.set(CONFIG.STORAGE_KEYS.BUDGET, budget);
    return budget;
  }

  function getBudgetUsage() {
    const budget = getBudget();
    if (!budget) return null;
    const currentMonth = FormatUtils.getMonthKey(new Date());
    const used = getExpenses()
      .filter((e) => e.date.startsWith(currentMonth))
      .reduce((sum, e) => sum + parseFloat(e.amount), 0);
    const remaining = budget.monthlyLimit - used;
    const percent = budget.monthlyLimit > 0 ? (used / budget.monthlyLimit) * 100 : 0;
    return { limit: budget.monthlyLimit, used, remaining, percent };
  }

  return {
    getIncomes, addIncome, updateIncome, deleteIncome, getIncomeById,
    getExpenses, addExpense, updateExpense, deleteExpense, getExpenseById,
    getAllTransactions, getTotalIncome, getTotalExpense, getBalance,
    getBudget, setBudget, getBudgetUsage
  };
})();


/* ==========================================================================
   سرویس مخاطبین
   ========================================================================== */
const ContactService = (function () {
  function generateId() {
    return `con_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  }

  function getContacts() {
    return StorageService.get(CONFIG.STORAGE_KEYS.CONTACTS, []);
  }

  function saveContacts(list) {
    StorageService.set(CONFIG.STORAGE_KEYS.CONTACTS, list);
  }

  function addContact(data) {
    const list = getContacts();
    const now = new Date().toISOString();
    const item = {
      id: generateId(),
      firstName: data.firstName.trim(),
      lastName: data.lastName.trim(),
      phone: data.phone.trim(),
      cardNumber: (data.cardNumber || '').trim(),
      notes: (data.notes || '').trim(),
      createdAt: now,
      updatedAt: now
    };
    list.push(item);
    saveContacts(list);
    return item;
  }

  function updateContact(id, data) {
    const list = getContacts();
    const idx = list.findIndex((c) => c.id === id);
    if (idx === -1) return null;
    list[idx] = {
      ...list[idx],
      firstName: data.firstName.trim(),
      lastName: data.lastName.trim(),
      phone: data.phone.trim(),
      cardNumber: (data.cardNumber || '').trim(),
      notes: (data.notes || '').trim(),
      updatedAt: new Date().toISOString()
    };
    saveContacts(list);
    return list[idx];
  }

  function deleteContact(id) {
    saveContacts(getContacts().filter((c) => c.id !== id));
  }

  function getContactById(id) {
    return getContacts().find((c) => c.id === id) || null;
  }

  return { getContacts, addContact, updateContact, deleteContact, getContactById };
})();


/* ==========================================================================
   سرویس گزارش‌ها
   داده تراکنش‌ها را برای صفحه گزارش‌ها تجمیع می‌کند.
   ========================================================================== */
const ReportService = (function () {
  function getRangeStart(range) {
    const now = new Date();
    if (range === 'daily') {
      return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    }
    if (range === 'weekly') {
      const start = new Date(now);
      start.setDate(now.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      return start;
    }
    // ماهانه
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }

  function getSummary(range) {
    const start = getRangeStart(range);
    const incomes = FinanceService.getIncomes().filter((i) => new Date(i.date + 'T00:00:00') >= start);
    const expenses = FinanceService.getExpenses().filter((e) => new Date(e.date + 'T00:00:00') >= start);

    const totalIncome = incomes.reduce((sum, i) => sum + parseFloat(i.amount), 0);
    const totalExpense = expenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);
    const netSavings = totalIncome - totalExpense;
    const avgExpense = expenses.length ? totalExpense / expenses.length : 0;

    return { totalIncome, totalExpense, netSavings, avgExpense, incomes, expenses };
  }

  function getCategoryBreakdown(range) {
    const { expenses } = getSummary(range);
    const map = {};
    expenses.forEach((e) => {
      map[e.category] = (map[e.category] || 0) + parseFloat(e.amount);
    });
    return map;
  }

  function buildDailyTrend(numDays) {
    const labels = [];
    const incomeData = [];
    const expenseData = [];
    const allIncomes = FinanceService.getIncomes();
    const allExpenses = FinanceService.getExpenses();

    for (let i = numDays - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = FormatUtils.toISODate(d);
      labels.push(FormatUtils.formatDateShort(d));
      incomeData.push(allIncomes.filter((x) => x.date === dateStr).reduce((s, x) => s + parseFloat(x.amount), 0));
      expenseData.push(allExpenses.filter((x) => x.date === dateStr).reduce((s, x) => s + parseFloat(x.amount), 0));
    }
    return { labels, incomeData, expenseData };
  }

  function buildWeeklyTrend(numWeeks) {
    const labels = [];
    const incomeData = [];
    const expenseData = [];
    const allIncomes = FinanceService.getIncomes();
    const allExpenses = FinanceService.getExpenses();

    for (let w = numWeeks - 1; w >= 0; w--) {
      const end = new Date();
      end.setDate(end.getDate() - w * 7);
      const start = new Date(end);
      start.setDate(end.getDate() - 6);
      labels.push(`${FormatUtils.formatDateShort(start)} تا ${FormatUtils.formatDateShort(end)}`);

      const inc = allIncomes.filter((x) => {
        const d = new Date(x.date + 'T00:00:00');
        return d >= start && d <= end;
      }).reduce((s, x) => s + parseFloat(x.amount), 0);

      const exp = allExpenses.filter((x) => {
        const d = new Date(x.date + 'T00:00:00');
        return d >= start && d <= end;
      }).reduce((s, x) => s + parseFloat(x.amount), 0);

      incomeData.push(inc);
      expenseData.push(exp);
    }
    return { labels, incomeData, expenseData };
  }

  function buildMonthlyTrend(numMonths) {
    const labels = [];
    const incomeData = [];
    const expenseData = [];
    const allIncomes = FinanceService.getIncomes();
    const allExpenses = FinanceService.getExpenses();

    for (let m = numMonths - 1; m >= 0; m--) {
      const d = new Date();
      d.setMonth(d.getMonth() - m);
      const monthKey = FormatUtils.getMonthKey(d);
      labels.push(d.toLocaleDateString('fa-IR', { month: 'short', year: 'numeric' }));

      incomeData.push(allIncomes.filter((x) => x.date.startsWith(monthKey)).reduce((s, x) => s + parseFloat(x.amount), 0));
      expenseData.push(allExpenses.filter((x) => x.date.startsWith(monthKey)).reduce((s, x) => s + parseFloat(x.amount), 0));
    }
    return { labels, incomeData, expenseData };
  }

  function getTrendData(range) {
    if (range === 'daily') return buildDailyTrend(7);
    if (range === 'weekly') return buildWeeklyTrend(4);
    return buildMonthlyTrend(6);
  }

  return { getSummary, getCategoryBreakdown, getTrendData };
})();


/* ==========================================================================
   سرویس نمودارها
   مدیریت نمونه‌های Chart.js (ساخت، حذف، رنگ‌های هماهنگ با تم)
   ========================================================================== */
const ChartService = (function () {
  const chartInstances = {};

  function getCssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function destroyChart(canvasId) {
    if (chartInstances[canvasId]) {
      chartInstances[canvasId].destroy();
      delete chartInstances[canvasId];
    }
  }

  function renderBarChart(canvasId, labels, incomeData, expenseData) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || typeof Chart === 'undefined') return;
    destroyChart(canvasId);

    const textColor = getCssVar('--text-secondary');
    const gridColor = getCssVar('--border-color');

    chartInstances[canvasId] = new Chart(canvas.getContext('2d'), {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: 'درآمد', data: incomeData, backgroundColor: getCssVar('--accent-success'), borderRadius: 6, maxBarThickness: 36 },
          { label: 'هزینه', data: expenseData, backgroundColor: getCssVar('--accent-danger'), borderRadius: 6, maxBarThickness: 36 }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { color: textColor, boxWidth: 12, font: { size: 11, family: 'Vazirmatn' } } }
        },
        scales: {
          x: { ticks: { color: textColor, font: { size: 10, family: 'Vazirmatn' } }, grid: { display: false } },
          y: { ticks: { color: textColor, font: { size: 10, family: 'Vazirmatn' } }, grid: { color: gridColor } }
        }
      }
    });
  }

  function renderDoughnutChart(canvasId, categoryMap) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || typeof Chart === 'undefined') return;
    destroyChart(canvasId);

    const labels = Object.keys(categoryMap);
    const data = Object.values(categoryMap);
    const colors = labels.map((l) => (CONFIG.CATEGORIES[l] ? CONFIG.CATEGORIES[l].color : '#95A5A6'));
    const textColor = getCssVar('--text-secondary');

    chartInstances[canvasId] = new Chart(canvas.getContext('2d'), {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{ data, backgroundColor: colors, borderWidth: 0 }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '65%',
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${ctx.label}: ${FormatUtils.formatCurrency(ctx.raw)}`
            }
          }
        }
      }
    });

    renderCategoryLegend(labels, colors, data);
  }

  function renderCategoryLegend(labels, colors, data) {
    const legendEl = document.getElementById('categoryLegend');
    if (!legendEl) return;
    legendEl.innerHTML = '';

    if (labels.length === 0) {
      legendEl.innerHTML = '<p style="font-size:12px;">داده‌ای برای هزینه در این بازه وجود ندارد.</p>';
      return;
    }

    labels.forEach((label, idx) => {
      const item = document.createElement('div');
      item.className = 'legend-item';
      const icon = CONFIG.CATEGORIES[label] ? CONFIG.CATEGORIES[label].icon : '📦';
      item.innerHTML = `<span class="legend-dot" style="background:${colors[idx]}"></span>${icon} ${label}`;
      legendEl.appendChild(item);
    });
  }

  function renderLineChart(canvasId, labels, incomeData, expenseData) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || typeof Chart === 'undefined') return;
    destroyChart(canvasId);

    const textColor = getCssVar('--text-secondary');
    const gridColor = getCssVar('--border-color');

    chartInstances[canvasId] = new Chart(canvas.getContext('2d'), {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'درآمد', data: incomeData, borderColor: getCssVar('--accent-success'),
            backgroundColor: 'transparent', tension: 0.35, pointRadius: 3
          },
          {
            label: 'هزینه', data: expenseData, borderColor: getCssVar('--accent-danger'),
            backgroundColor: 'transparent', tension: 0.35, pointRadius: 3
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { color: textColor, boxWidth: 12, font: { size: 11, family: 'Vazirmatn' } } }
        },
        scales: {
          x: { ticks: { color: textColor, font: { size: 9, family: 'Vazirmatn' } }, grid: { display: false } },
          y: { ticks: { color: textColor, font: { size: 10, family: 'Vazirmatn' } }, grid: { color: gridColor } }
        }
      }
    });
  }

  return { renderBarChart, renderDoughnutChart, renderLineChart, destroyChart };
})();


/* ==========================================================================
   سرویس ناوبری (تعویض صفحات SPA)
   ========================================================================== */
const NavigationService = (function () {
  function switchView(viewId, title) {
    document.querySelectorAll('.view').forEach((v) => v.classList.remove('active-view'));
    const target = document.getElementById(viewId);
    if (target) target.classList.add('active-view');

    document.querySelectorAll('.nav-item').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.view === viewId);
    });

    const titleEl = document.getElementById('viewTitle');
    if (titleEl && title) titleEl.textContent = title;

    const mainEl = document.getElementById('appMain');
    if (mainEl) mainEl.scrollTop = 0;

    // هر بار که یک صفحه فعال می‌شود، کنترلر مربوطه را رندر می‌کند
    if (viewId === 'dashboardView') DashboardController.render();
    if (viewId === 'transactionsView') TransactionsController.render();
    if (viewId === 'contactsView') ContactsController.render();
    if (viewId === 'reportsView') ReportsController.render();
    if (viewId === 'settingsView') SettingsController.render();
  }

  return { switchView };
})();


/* ==========================================================================
   کنترلر داشبورد
   ========================================================================== */
const DashboardController = (function () {
  function renderGreeting() {
    const user = AuthService.getCurrentUser();
    const usernameEl = document.getElementById('greetingUsername');
    if (usernameEl && user) usernameEl.textContent = user.username;

    const dateEl = document.getElementById('greetingDate');
    if (dateEl) {
      dateEl.textContent = new Date().toLocaleDateString('fa-IR', {
        weekday: 'long', month: 'long', day: 'numeric'
      });
    }
  }

  function isBalanceHidden() {
    return StorageService.get(CONFIG.STORAGE_KEYS.BALANCE_VISIBILITY, false);
  }

  function renderStats() {
    const totalIncome = FinanceService.getTotalIncome();
    const totalExpense = FinanceService.getTotalExpense();
    const balance = totalIncome - totalExpense;
    const totalTransactions = FinanceService.getAllTransactions().length;
    const totalContacts = ContactService.getContacts().length;

    const balanceEl = document.getElementById('dashBalance');
    const hidden = isBalanceHidden();
    balanceEl.textContent = hidden ? '••••••••' : FormatUtils.formatCurrency(balance);

    const toggleBtn = document.getElementById('toggleBalanceVisibilityBtn');
    if (toggleBtn) {
      toggleBtn.textContent = hidden ? '🙈' : '👁️';
      toggleBtn.classList.toggle('is-hidden', hidden);
    }

    document.getElementById('dashTotalIncome').textContent = FormatUtils.formatCurrency(totalIncome);
    document.getElementById('dashTotalExpense').textContent = FormatUtils.formatCurrency(totalExpense);
    document.getElementById('dashTotalTransactions').textContent = totalTransactions.toLocaleString('fa-IR');
    document.getElementById('dashTotalContacts').textContent = totalContacts.toLocaleString('fa-IR');
  }

  function renderBudget() {
    const usage = FinanceService.getBudgetUsage();
    const emptyText = document.getElementById('budgetEmptyText');
    const progressWrapper = document.getElementById('budgetProgressWrapper');
    const fill = document.getElementById('budgetProgressFill');
    const usedText = document.getElementById('budgetUsedText');
    const remainingText = document.getElementById('budgetRemainingText');
    const warningText = document.getElementById('budgetWarningText');

    if (!usage) {
      emptyText.classList.remove('hidden');
      progressWrapper.classList.add('hidden');
      return;
    }

    emptyText.classList.add('hidden');
    progressWrapper.classList.remove('hidden');

    const percent = Math.min(usage.percent, 100);
    fill.style.width = `${percent}%`;
    fill.classList.remove('warning', 'danger');

    usedText.textContent = `استفاده‌شده: ${FormatUtils.formatCurrency(usage.used)}`;
    remainingText.textContent = `باقی‌مانده: ${FormatUtils.formatCurrency(Math.max(usage.remaining, 0))}`;

    if (usage.percent >= 100) {
      fill.classList.add('danger');
      warningText.textContent = `⚠️ شما از بودجه ماهانه به میزان ${FormatUtils.formatCurrency(Math.abs(usage.remaining))} فراتر رفته‌اید!`;
      warningText.classList.remove('hidden');
      warningText.classList.add('danger');
    } else if (usage.percent >= CONFIG.BUDGET_WARNING_THRESHOLD) {
      fill.classList.add('warning');
      warningText.textContent = `⚠️ شما ${usage.percent.toFixed(0)}٪ از بودجه ماهانه خود را استفاده کرده‌اید.`;
      warningText.classList.remove('hidden');
      warningText.classList.remove('danger');
    } else {
      warningText.classList.add('hidden');
    }
  }

  function renderChart() {
    const totalIncome = FinanceService.getTotalIncome();
    const totalExpense = FinanceService.getTotalExpense();
    ChartService.renderBarChart('dashboardBarChart', ['مجموع کل'], [totalIncome], [totalExpense]);
    window.__chartsInitialized = true;
  }

  function renderRecentTransactions() {
    const list = FinanceService.getAllTransactions()
      .sort((a, b) => new Date(b.date) - new Date(a.date) || new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5);

    const container = document.getElementById('recentTransactionsList');
    container.innerHTML = '';

    if (list.length === 0) {
      container.innerHTML = '<div class="empty-state"><p class="empty-icon">📭</p><p class="empty-title">هنوز تراکنشی ثبت نشده</p><p class="empty-subtitle">دکمه + رو بزن تا یکی اضافه کنی</p></div>';
      return;
    }

    list.forEach((tx) => container.appendChild(TransactionsController.buildTransactionItem(tx, false)));
  }

  function render() {
    renderGreeting();
    renderStats();
    renderBudget();
    renderChart();
    renderRecentTransactions();
  }

  function refreshChart() {
    renderChart();
  }

  function toggleBalanceVisibility() {
    const hidden = isBalanceHidden();
    StorageService.set(CONFIG.STORAGE_KEYS.BALANCE_VISIBILITY, !hidden);
    renderStats();
  }

  return { render, refreshChart, toggleBalanceVisibility };
})();


/* ==========================================================================
   کنترلر تراکنش‌ها
   ========================================================================== */
const TransactionsController = (function () {
  const state = {
    filterType: 'all', // all | income | expense
    search: '',
    category: '',
    dateFrom: '',
    dateTo: '',
    sort: 'newest'
  };

  function buildTransactionItem(tx, showActions = true) {
    const item = document.createElement('div');
    item.className = 'transaction-item';

    const isIncome = tx.type === 'income';
    const iconBg = isIncome ? 'var(--accent-success-light)' : `${CONFIG.CATEGORIES[tx.category] ? CONFIG.CATEGORIES[tx.category].color + '22' : 'var(--accent-danger-light)'}`;
    const iconChar = isIncome ? '⬆️' : (CONFIG.CATEGORIES[tx.category] ? CONFIG.CATEGORIES[tx.category].icon : '📦');

    item.innerHTML = `
      <div class="transaction-icon" style="background:${iconBg}">${iconChar}</div>
      <div class="transaction-info">
        <div class="transaction-title">${escapeHtml(tx.title)}</div>
        <div class="transaction-meta">${isIncome ? 'درآمد' : escapeHtml(tx.category)} • ${FormatUtils.formatDate(tx.date)}</div>
      </div>
      <div class="transaction-amount-wrapper">
        <div class="transaction-amount ${isIncome ? 'income' : 'expense'}">${isIncome ? '+' : '-'}${FormatUtils.formatCurrency(tx.amount)}</div>
        ${showActions ? `<div class="transaction-actions">
          <button class="transaction-action-btn" data-action="edit" data-id="${tx.id}" data-type="${tx.type}">✏️</button>
          <button class="transaction-action-btn" data-action="delete" data-id="${tx.id}" data-type="${tx.type}">🗑️</button>
        </div>` : ''}
      </div>
    `;
    return item;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function getFilteredTransactions() {
    let list = FinanceService.getAllTransactions();

    if (state.filterType !== 'all') {
      list = list.filter((t) => t.type === state.filterType);
    }

    if (state.search.trim()) {
      const q = state.search.trim().toLowerCase();
      list = list.filter((t) => t.title.toLowerCase().includes(q));
    }

    if (state.category) {
      list = list.filter((t) => t.category === state.category);
    }

    if (state.dateFrom) {
      list = list.filter((t) => t.date >= state.dateFrom);
    }

    if (state.dateTo) {
      list = list.filter((t) => t.date <= state.dateTo);
    }

    switch (state.sort) {
      case 'oldest':
        list.sort((a, b) => new Date(a.date) - new Date(b.date));
        break;
      case 'highest':
        list.sort((a, b) => b.amount - a.amount);
        break;
      case 'lowest':
        list.sort((a, b) => a.amount - b.amount);
        break;
      default: // جدیدترین
        list.sort((a, b) => new Date(b.date) - new Date(a.date));
    }

    return list;
  }

  function render() {
    const list = getFilteredTransactions();
    const container = document.getElementById('fullTransactionList');
    const emptyState = document.getElementById('transactionsEmptyState');
    container.innerHTML = '';

    if (list.length === 0) {
      emptyState.classList.remove('hidden');
      return;
    }
    emptyState.classList.add('hidden');
    list.forEach((tx) => container.appendChild(buildTransactionItem(tx, true)));
  }

  function setFilterType(type) {
    state.filterType = type;
    render();
  }

  function setSearch(value) {
    state.search = value;
    render();
  }

  function setCategory(value) {
    state.category = value;
    render();
  }

  function setDateFrom(value) {
    state.dateFrom = value;
    render();
  }

  function setDateTo(value) {
    state.dateTo = value;
    render();
  }

  function setSort(value) {
    state.sort = value;
    render();
  }

  function clearFilters() {
    state.category = '';
    state.dateFrom = '';
    state.dateTo = '';
    state.sort = 'newest';
    document.getElementById('filterCategory').value = '';
    document.getElementById('filterDateFrom').value = '';
    document.getElementById('filterDateTo').value = '';
    document.getElementById('sortSelect').value = 'newest';
    render();
  }

  return {
    render, buildTransactionItem, setFilterType, setSearch,
    setCategory, setDateFrom, setDateTo, setSort, clearFilters
  };
})();


/* ==========================================================================
   کنترلر مخاطبین
   ========================================================================== */
const ContactsController = (function () {
  const state = { search: '', sort: 'firstName' };

  function getInitials(contact) {
    return `${(contact.firstName[0] || '')}${(contact.lastName[0] || '')}`;
  }

  function getFilteredContacts() {
    let list = ContactService.getContacts();

    if (state.search.trim()) {
      const q = state.search.trim().toLowerCase();
      list = list.filter((c) =>
        `${c.firstName} ${c.lastName}`.toLowerCase().includes(q) || c.phone.includes(q)
      );
    }

    switch (state.sort) {
      case 'firstNameDesc':
        list.sort((a, b) => b.firstName.localeCompare(a.firstName, 'fa'));
        break;
      case 'recent':
        list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        break;
      default:
        list.sort((a, b) => a.firstName.localeCompare(b.firstName, 'fa'));
    }

    return list;
  }

  function buildContactItem(contact) {
    const item = document.createElement('div');
    item.className = 'contact-item';
    item.dataset.id = contact.id;
    item.innerHTML = `
      <div class="contact-avatar">${getInitials(contact)}</div>
      <div class="contact-info">
        <div class="contact-name">${contact.firstName} ${contact.lastName}</div>
        <div class="contact-phone">📞 ${contact.phone}</div>
      </div>
      <span class="contact-arrow">›</span>
    `;
    return item;
  }

  function render() {
    const list = getFilteredContacts();
    const container = document.getElementById('contactsList');
    const emptyState = document.getElementById('contactsEmptyState');
    container.innerHTML = '';

    if (list.length === 0) {
      emptyState.classList.remove('hidden');
      return;
    }
    emptyState.classList.add('hidden');
    list.forEach((c) => container.appendChild(buildContactItem(c)));
  }

  function setSearch(value) {
    state.search = value;
    render();
  }

  function setSort(value) {
    state.sort = value;
    render();
  }

  return { render, setSearch, setSort, getInitials };
})();


/* ==========================================================================
   کنترلر گزارش‌ها
   ========================================================================== */
const ReportsController = (function () {
  const state = { range: 'daily' };

  function renderSummary() {
    const summary = ReportService.getSummary(state.range);
    document.getElementById('reportTotalIncome').textContent = FormatUtils.formatCurrency(summary.totalIncome);
    document.getElementById('reportTotalExpense').textContent = FormatUtils.formatCurrency(summary.totalExpense);
    document.getElementById('reportNetSavings').textContent = FormatUtils.formatCurrency(summary.netSavings);
    document.getElementById('reportAvgExpense').textContent = FormatUtils.formatCurrency(summary.avgExpense);
  }

  function renderCharts() {
    const categoryMap = ReportService.getCategoryBreakdown(state.range);
    ChartService.renderDoughnutChart('categoryDoughnutChart', categoryMap);

    const summary = ReportService.getSummary(state.range);
    ChartService.renderBarChart('incomeExpenseBarChart', ['درآمد', 'هزینه'],
      [summary.totalIncome, 0], [0, summary.totalExpense]);

    const trend = ReportService.getTrendData(state.range);
    ChartService.renderLineChart('trendLineChart', trend.labels, trend.incomeData, trend.expenseData);

    window.__chartsInitialized = true;
  }

  function setRange(range) {
    state.range = range;
    render();
  }

  function render() {
    renderSummary();
    renderCharts();
  }

  function refreshCharts() {
    renderCharts();
  }

  return { render, setRange, refreshCharts };
})();


/* ==========================================================================
   کنترلر تنظیمات
   ========================================================================== */
const SettingsController = (function () {
  function renderProfilePhoto() {
    const avatarEl = document.getElementById('profileAvatar');
    const photo = StorageService.get(CONFIG.STORAGE_KEYS.PROFILE_PHOTO, null);
    if (photo) {
      avatarEl.innerHTML = `<img src="${photo}" alt="عکس پروفایل" />`;
    } else {
      avatarEl.textContent = '👤';
    }
  }

  function render() {
    const user = AuthService.getCurrentUser();
    if (user) {
      document.getElementById('settingsUsername').textContent = user.username;
      document.getElementById('settingsMemberSince').textContent =
        `عضویت از ${FormatUtils.formatDate(user.createdAt.slice(0, 10))}`;
    }

    const settings = StorageService.get(CONFIG.STORAGE_KEYS.SETTINGS, { currency: 'تومان' });
    document.getElementById('currencySelect').value = settings.currency || 'تومان';

    const theme = StorageService.get(CONFIG.STORAGE_KEYS.THEME, 'light');
    document.getElementById('darkModeSwitch').checked = theme === 'dark';

    renderProfilePhoto();
  }

  // فایل تصویر انتخاب‌شده را می‌خواند، آن را به یک مربع کوچک (۳۰۰x۳۰۰) تغییر
  // اندازه می‌دهد تا حجمش برای ذخیره در LocalStorage مناسب باشد، و آن را
  // به‌صورت رشته base64 ذخیره می‌کند.
  function setProfilePhotoFromFile(file) {
    return new Promise((resolve, reject) => {
      if (!file || !file.type.startsWith('image/')) {
        reject(new Error('فایل انتخاب‌شده یک تصویر معتبر نیست.'));
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const SIZE = 300;
          const canvas = document.createElement('canvas');
          canvas.width = SIZE;
          canvas.height = SIZE;
          const ctx = canvas.getContext('2d');

          // برش مربعی از وسط تصویر (cover) تا آواتار همیشه گرد و متقارن باشد
          const minSide = Math.min(img.width, img.height);
          const sx = (img.width - minSide) / 2;
          const sy = (img.height - minSide) / 2;
          ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, SIZE, SIZE);

          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          StorageService.set(CONFIG.STORAGE_KEYS.PROFILE_PHOTO, dataUrl);
          renderProfilePhoto();
          resolve(dataUrl);
        };
        img.onerror = () => reject(new Error('بارگذاری تصویر با خطا مواجه شد.'));
        img.src = e.target.result;
      };
      reader.onerror = () => reject(new Error('خواندن فایل با خطا مواجه شد.'));
      reader.readAsDataURL(file);
    });
  }

  function setCurrency(symbol) {
    const settings = StorageService.get(CONFIG.STORAGE_KEYS.SETTINGS, {});
    settings.currency = symbol;
    StorageService.set(CONFIG.STORAGE_KEYS.SETTINGS, settings);
    // چون واحد پول روی همه مبالغ اثر می‌گذارد، داشبورد را دوباره رندر می‌کنیم
    DashboardController.render();
  }

  function exportData() {
    const data = {};
    Object.entries(CONFIG.STORAGE_KEYS).forEach(([key, storageKey]) => {
      data[key] = StorageService.get(storageKey);
    });
    // قبل از خروجی گرفتن، هش رمز عبور را حذف می‌کنیم
    if (data.USER) delete data.USER.password;

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `fintrack-backup-${FormatUtils.toISODate(new Date())}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function resetAllData() {
    const user = AuthService.getCurrentUser();
    StorageService.clearAll();
    // حساب کاربری حفظ می‌شود، اما داده‌های مالی/مخاطبین و نشست پاک می‌شوند
    if (user) StorageService.set(CONFIG.STORAGE_KEYS.USER, user);
    StorageService.set(CONFIG.STORAGE_KEYS.SESSION, { isLoggedIn: false });
  }

  return { render, setCurrency, exportData, resetAllData, setProfilePhotoFromFile };
})();


/* ==========================================================================
   App (راه‌اندازی برنامه + اتصال رویدادها)
   ========================================================================== */
const App = (function () {

  /* ---------------- اسپلش و مسیر ورود ---------------- */
  function initSplash() {
    setTimeout(() => {
      const splash = document.getElementById('splashScreen');
      splash.classList.add('fade-out');
      setTimeout(() => {
        splash.style.display = 'none';
        routeToInitialScreen();
      }, 600);
    }, CONFIG.SPLASH_DURATION);
  }

  function routeToInitialScreen() {
    if (AuthService.isLoggedIn()) {
      showAppShell();
    } else {
      showLoginScreen();
    }
  }

  function showLoginScreen() {
    document.getElementById('appShell').classList.add('hidden');
    document.getElementById('loginScreen').classList.remove('hidden');
    document.getElementById('loginForm').classList.remove('hidden');
    document.getElementById('registerForm').classList.add('hidden');
  }

  function showAppShell() {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('appShell').classList.remove('hidden');
    NavigationService.switchView('dashboardView', 'داشبورد');
  }

  /* ---------------- کمک‌کننده‌های نمایش خطا ---------------- */
  function setFieldError(inputId, errorId, message) {
    const input = document.getElementById(inputId);
    const errorEl = document.getElementById(errorId);
    if (input) input.classList.toggle('input-error', !!message);
    if (errorEl) errorEl.textContent = message || '';
  }

  function clearFieldErrors(ids) {
    ids.forEach(({ inputId, errorId }) => setFieldError(inputId, errorId, ''));
  }

  /* ---------------- فرم‌های احراز هویت ---------------- */
  function bindAuthForms() {
    document.getElementById('showRegisterBtn').addEventListener('click', () => {
      document.getElementById('loginForm').classList.add('hidden');
      document.getElementById('registerForm').classList.remove('hidden');
    });

    document.getElementById('showLoginBtn').addEventListener('click', () => {
      document.getElementById('registerForm').classList.add('hidden');
      document.getElementById('loginForm').classList.remove('hidden');
    });

    document.getElementById('loginForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const username = document.getElementById('loginUsername').value;
      const password = document.getElementById('loginPassword').value;

      clearFieldErrors([
        { inputId: 'loginUsername', errorId: 'loginUsernameError' },
        { inputId: 'loginPassword', errorId: 'loginPasswordError' }
      ]);

      let valid = true;
      if (!ValidationUtils.isRequired(username)) {
        setFieldError('loginUsername', 'loginUsernameError', 'نام کاربری الزامی است.');
        valid = false;
      }
      if (!ValidationUtils.isRequired(password)) {
        setFieldError('loginPassword', 'loginPasswordError', 'رمز عبور الزامی است.');
        valid = false;
      }
      if (!valid) return;

      if (!AuthService.isRegistered()) {
        ToastService.error('حساب کاربری‌ای پیدا نشد. لطفاً ابتدا ثبت‌نام کن.');
        document.getElementById('loginForm').classList.add('hidden');
        document.getElementById('registerForm').classList.remove('hidden');
        return;
      }

      const result = AuthService.login(username, password);
      if (result.success) {
        ToastService.success('خوش برگشتی!');
        document.getElementById('loginForm').reset();
        showAppShell();
      } else {
        setFieldError('loginPassword', 'loginPasswordError', result.message);
      }
    });

    document.getElementById('registerForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const username = document.getElementById('registerUsername').value;
      const password = document.getElementById('registerPassword').value;
      const confirmPassword = document.getElementById('registerConfirmPassword').value;

      clearFieldErrors([
        { inputId: 'registerUsername', errorId: 'registerUsernameError' },
        { inputId: 'registerPassword', errorId: 'registerPasswordError' },
        { inputId: 'registerConfirmPassword', errorId: 'registerConfirmPasswordError' }
      ]);

      let valid = true;
      if (!ValidationUtils.isValidUsername(username)) {
        setFieldError('registerUsername', 'registerUsernameError', `نام کاربری باید بین ۳ تا ${CONFIG.MAX_USERNAME_LENGTH} کاراکتر باشد.`);
        valid = false;
      }
      if (!ValidationUtils.isValidPassword(password)) {
        setFieldError('registerPassword', 'registerPasswordError', `رمز عبور باید ${CONFIG.MIN_PASSWORD_LENGTH} تا ${CONFIG.MAX_PASSWORD_LENGTH} کاراکتر باشد و شامل حداقل یک حرف بزرگ، یک حرف کوچک و یک عدد باشد.`);
        valid = false;
      }
      if (password !== confirmPassword) {
        setFieldError('registerConfirmPassword', 'registerConfirmPasswordError', 'رمزهای عبور مطابقت ندارند.');
        valid = false;
      }
      if (!valid) return;

      AuthService.register(username, password);
      StorageService.set(CONFIG.STORAGE_KEYS.SETTINGS, { currency: 'تومان' });
      ToastService.success('حساب کاربری با موفقیت ساخته شد!');
      document.getElementById('registerForm').reset();
      showAppShell();
    });

    document.querySelectorAll('.toggle-password').forEach((btn) => {
      btn.addEventListener('click', () => {
        const target = document.getElementById(btn.dataset.target);
        if (!target) return;
        target.type = target.type === 'password' ? 'text' : 'password';
      });
    });
  }

  /* ---------------- ناوبری ---------------- */
  function bindNavigation() {
    document.querySelectorAll('.nav-item').forEach((btn) => {
      btn.addEventListener('click', () => {
        NavigationService.switchView(btn.dataset.view, btn.dataset.title);
      });
    });

    document.querySelectorAll('[data-nav]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const navBtn = document.querySelector(`.nav-item[data-view="${btn.dataset.nav}"]`);
        NavigationService.switchView(btn.dataset.nav, navBtn ? navBtn.dataset.title : '');
      });
    });
  }

  /* ---------------- تم و خروج ---------------- */
  function bindHeaderActions() {
    document.getElementById('themeToggleBtn').addEventListener('click', () => ThemeService.toggle());

    document.getElementById('darkModeSwitch').addEventListener('change', (e) => {
      ThemeService.setTheme(e.target.checked ? 'dark' : 'light');
    });

    function handleLogout() {
      ModalService.confirmAction({
        title: 'خروج از حساب',
        message: 'مطمئنی می‌خوای از حساب کاربری خارج بشی؟',
        icon: '🚪',
        confirmLabel: 'خروج',
        onConfirm: () => {
          AuthService.logout();
          document.getElementById('loginForm').reset();
          showLoginScreen();
          ToastService.info('با موفقیت از حساب خارج شدی.');
        }
      });
    }

    document.getElementById('logoutBtn').addEventListener('click', handleLogout);
    document.getElementById('settingsLogoutBtn').addEventListener('click', handleLogout);

    document.getElementById('toggleBalanceVisibilityBtn').addEventListener('click', () => {
      DashboardController.toggleBalanceVisibility();
    });
  }

  /* ---------------- مودال‌ها: بستن عمومی ---------------- */
  function bindModalGenerics() {
    document.querySelectorAll('[data-close-modal]').forEach((btn) => {
      btn.addEventListener('click', () => ModalService.close(btn.dataset.closeModal));
    });

    document.querySelectorAll('.modal-overlay').forEach((overlay) => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) ModalService.close(overlay.id);
      });
    });
  }

  /* ---------------- دکمه شناور و منوی افزودن ---------------- */
  function bindFab() {
    document.getElementById('fabAddBtn').addEventListener('click', () => ModalService.open('addOptionsModal'));

    document.getElementById('addIncomeOption').addEventListener('click', () => {
      ModalService.close('addOptionsModal');
      openIncomeModal();
    });
    document.getElementById('addExpenseOption').addEventListener('click', () => {
      ModalService.close('addOptionsModal');
      openExpenseModal();
    });
    document.getElementById('addContactOption').addEventListener('click', () => {
      ModalService.close('addOptionsModal');
      openContactModal();
    });
  }

  /* ---------------- مودال درآمد ---------------- */
  function openIncomeModal(income = null) {
    const form = document.getElementById('incomeForm');
    form.reset();
    clearFieldErrors([
      { inputId: 'incomeTitle', errorId: 'incomeTitleError' },
      { inputId: 'incomeAmount', errorId: 'incomeAmountError' },
      { inputId: 'incomeDate', errorId: 'incomeDateError' }
    ]);

    document.getElementById('incomeModalTitle').textContent = income ? 'ویرایش درآمد' : 'افزودن درآمد';
    document.getElementById('incomeId').value = income ? income.id : '';
    document.getElementById('incomeTitle').value = income ? income.title : '';
    document.getElementById('incomeAmount').value = income ? income.amount : '';
    document.getElementById('incomeDate').value = income ? income.date : FormatUtils.toISODate(new Date());
    document.getElementById('incomeDescription').value = income ? income.description : '';

    ModalService.open('incomeModal');
  }

  function bindIncomeForm() {
    document.getElementById('incomeForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const id = document.getElementById('incomeId').value;
      const title = document.getElementById('incomeTitle').value;
      const amount = document.getElementById('incomeAmount').value;
      const date = document.getElementById('incomeDate').value;
      const description = document.getElementById('incomeDescription').value;

      clearFieldErrors([
        { inputId: 'incomeTitle', errorId: 'incomeTitleError' },
        { inputId: 'incomeAmount', errorId: 'incomeAmountError' },
        { inputId: 'incomeDate', errorId: 'incomeDateError' },
        { inputId: 'incomeDescription', errorId: 'incomeDescriptionError' }
      ]);

      let valid = true;
      if (!ValidationUtils.isRequired(title)) {
        setFieldError('incomeTitle', 'incomeTitleError', 'عنوان الزامی است.');
        valid = false;
      }
      if (!ValidationUtils.isValidAmount(amount)) {
        setFieldError('incomeAmount', 'incomeAmountError', 'مبلغ معتبری بزرگ‌تر از صفر وارد کن.');
        valid = false;
      }
      if (!ValidationUtils.isValidDate(date)) {
        setFieldError('incomeDate', 'incomeDateError', 'یک تاریخ معتبر انتخاب کن.');
        valid = false;
      }
      if (!ValidationUtils.isValidDescriptionLength(description)) {
        setFieldError('incomeDescription', 'incomeDescriptionError', `توضیحات نباید بیشتر از ${CONFIG.MAX_DESCRIPTION_LENGTH} کاراکتر باشد.`);
        valid = false;
      }
      if (!valid) return;

      const data = { title, amount, date, description };
      if (id) {
        FinanceService.updateIncome(id, data);
        ToastService.success('درآمد با موفقیت ویرایش شد.');
      } else {
        FinanceService.addIncome(data);
        ToastService.success('درآمد با موفقیت اضافه شد.');
      }

      ModalService.close('incomeModal');
      refreshCurrentView();
    });
  }

  /* ---------------- مودال هزینه ---------------- */
  function openExpenseModal(expense = null) {
    const form = document.getElementById('expenseForm');
    form.reset();
    clearFieldErrors([
      { inputId: 'expenseTitle', errorId: 'expenseTitleError' },
      { inputId: 'expenseAmount', errorId: 'expenseAmountError' },
      { inputId: 'expenseDate', errorId: 'expenseDateError' }
    ]);

    document.getElementById('expenseModalTitle').textContent = expense ? 'ویرایش هزینه' : 'افزودن هزینه';
    document.getElementById('expenseId').value = expense ? expense.id : '';
    document.getElementById('expenseTitle').value = expense ? expense.title : '';
    document.getElementById('expenseAmount').value = expense ? expense.amount : '';
    document.getElementById('expenseCategory').value = expense ? expense.category : 'غذا';
    document.getElementById('expenseDate').value = expense ? expense.date : FormatUtils.toISODate(new Date());
    document.getElementById('expenseDescription').value = expense ? expense.description : '';

    ModalService.open('expenseModal');
  }

  function checkBudgetAfterExpense() {
    const usage = FinanceService.getBudgetUsage();
    if (!usage) return;
    if (usage.percent >= 100) {
      ToastService.error('از بودجه ماهانه‌ات فراتر رفتی!');
    } else if (usage.percent >= CONFIG.BUDGET_WARNING_THRESHOLD) {
      ToastService.warning(`شما ${usage.percent.toFixed(0)}٪ از بودجه ماهانه خود را استفاده کرده‌اید.`);
    }
  }

  function bindExpenseForm() {
    document.getElementById('expenseForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const id = document.getElementById('expenseId').value;
      const title = document.getElementById('expenseTitle').value;
      const amount = document.getElementById('expenseAmount').value;
      const category = document.getElementById('expenseCategory').value;
      const date = document.getElementById('expenseDate').value;
      const description = document.getElementById('expenseDescription').value;

      clearFieldErrors([
        { inputId: 'expenseTitle', errorId: 'expenseTitleError' },
        { inputId: 'expenseAmount', errorId: 'expenseAmountError' },
        { inputId: 'expenseDate', errorId: 'expenseDateError' },
        { inputId: 'expenseDescription', errorId: 'expenseDescriptionError' }
      ]);

      let valid = true;
      if (!ValidationUtils.isRequired(title)) {
        setFieldError('expenseTitle', 'expenseTitleError', 'عنوان الزامی است.');
        valid = false;
      }
      if (!ValidationUtils.isValidAmount(amount)) {
        setFieldError('expenseAmount', 'expenseAmountError', 'مبلغ معتبری بزرگ‌تر از صفر وارد کن.');
        valid = false;
      }
      if (!ValidationUtils.isValidDate(date)) {
        setFieldError('expenseDate', 'expenseDateError', 'یک تاریخ معتبر انتخاب کن.');
        valid = false;
      }
      if (!ValidationUtils.isValidDescriptionLength(description)) {
        setFieldError('expenseDescription', 'expenseDescriptionError', `توضیحات نباید بیشتر از ${CONFIG.MAX_DESCRIPTION_LENGTH} کاراکتر باشد.`);
        valid = false;
      }
      if (!valid) return;

      const data = { title, amount, category, date, description };
      if (id) {
        FinanceService.updateExpense(id, data);
        ToastService.success('هزینه با موفقیت ویرایش شد.');
      } else {
        FinanceService.addExpense(data);
        ToastService.success('هزینه با موفقیت اضافه شد.');
      }

      ModalService.close('expenseModal');
      refreshCurrentView();
      checkBudgetAfterExpense();
    });
  }

  /* ---------------- مودال مخاطب ---------------- */
  function openContactModal(contact = null) {
    const form = document.getElementById('contactForm');
    form.reset();
    clearFieldErrors([
      { inputId: 'contactFirstName', errorId: 'contactFirstNameError' },
      { inputId: 'contactLastName', errorId: 'contactLastNameError' },
      { inputId: 'contactPhone', errorId: 'contactPhoneError' },
      { inputId: 'contactCard', errorId: 'contactCardError' }
    ]);

    document.getElementById('contactModalTitle').textContent = contact ? 'ویرایش مخاطب' : 'افزودن مخاطب';
    document.getElementById('contactId').value = contact ? contact.id : '';
    document.getElementById('contactFirstName').value = contact ? contact.firstName : '';
    document.getElementById('contactLastName').value = contact ? contact.lastName : '';
    document.getElementById('contactPhone').value = contact ? contact.phone : '';
    document.getElementById('contactCard').value = contact ? contact.cardNumber : '';
    document.getElementById('contactNotes').value = contact ? contact.notes : '';

    ModalService.open('contactModal');
  }

  function bindContactForm() {
    // اجازه تایپ فقط عدد در فیلد شماره تلفن (حداکثر تعداد رقم مجاز)
    document.getElementById('contactPhone').addEventListener('input', (e) => {
      e.target.value = e.target.value.replace(/[^0-9]/g, '').slice(0, CONFIG.PHONE_MAX_LENGTH);
    });

    document.getElementById('contactForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const id = document.getElementById('contactId').value;
      const firstName = document.getElementById('contactFirstName').value;
      const lastName = document.getElementById('contactLastName').value;
      const phone = document.getElementById('contactPhone').value;
      const cardNumber = document.getElementById('contactCard').value;
      const notes = document.getElementById('contactNotes').value;

      clearFieldErrors([
        { inputId: 'contactFirstName', errorId: 'contactFirstNameError' },
        { inputId: 'contactLastName', errorId: 'contactLastNameError' },
        { inputId: 'contactPhone', errorId: 'contactPhoneError' },
        { inputId: 'contactCard', errorId: 'contactCardError' },
        { inputId: 'contactNotes', errorId: 'contactNotesError' }
      ]);

      let valid = true;
      if (!ValidationUtils.isRequired(firstName)) {
        setFieldError('contactFirstName', 'contactFirstNameError', 'نام الزامی است.');
        valid = false;
      }
      if (!ValidationUtils.isRequired(lastName)) {
        setFieldError('contactLastName', 'contactLastNameError', 'نام خانوادگی الزامی است.');
        valid = false;
      }
      if (!ValidationUtils.isValidPhone(phone)) {
        setFieldError('contactPhone', 'contactPhoneError', `شماره تلفن باید فقط عدد باشد و بین ${CONFIG.PHONE_MIN_LENGTH} تا ${CONFIG.PHONE_MAX_LENGTH} رقم داشته باشد.`);
        valid = false;
      }
      if (!ValidationUtils.isValidCardNumber(cardNumber)) {
        setFieldError('contactCard', 'contactCardError', 'شماره کارت باید بین ۱۲ تا ۱۹ رقم باشد.');
        valid = false;
      }
      if (!ValidationUtils.isValidDescriptionLength(notes)) {
        setFieldError('contactNotes', 'contactNotesError', `یادداشت نباید بیشتر از ${CONFIG.MAX_DESCRIPTION_LENGTH} کاراکتر باشد.`);
        valid = false;
      }
      if (!valid) return;

      const data = { firstName, lastName, phone, cardNumber, notes };
      if (id) {
        ContactService.updateContact(id, data);
        ToastService.success('مخاطب با موفقیت ویرایش شد.');
      } else {
        ContactService.addContact(data);
        ToastService.success('مخاطب با موفقیت اضافه شد.');
      }

      ModalService.close('contactModal');
      refreshCurrentView();
    });
  }

  /* ---------------- مودال جزئیات مخاطب ---------------- */
  function openContactDetailsModal(contactId) {
    const contact = ContactService.getContactById(contactId);
    if (!contact) return;

    document.getElementById('contactDetailsAvatar').textContent = ContactsController.getInitials(contact);
    document.getElementById('contactDetailsName').textContent = `${contact.firstName} ${contact.lastName}`;
    document.getElementById('contactDetailsPhone').textContent = contact.phone;
    document.getElementById('contactDetailsCard').textContent = contact.cardNumber || 'ثبت نشده';
    document.getElementById('contactDetailsNotes').textContent = contact.notes || 'یادداشتی ثبت نشده.';
    document.getElementById('contactDetailsCreated').textContent = FormatUtils.formatDateTime(contact.createdAt);

    document.getElementById('contactDetailsEditBtn').onclick = () => {
      ModalService.close('contactDetailsModal');
      openContactModal(contact);
    };

    document.getElementById('contactDetailsDeleteBtn').onclick = () => {
      ModalService.confirmAction({
        title: 'حذف مخاطب',
        message: `مخاطب ${contact.firstName} ${contact.lastName} حذف بشه؟ این عمل قابل بازگشت نیست.`,
        icon: '🗑️',
        confirmLabel: 'حذف',
        onConfirm: () => {
          ContactService.deleteContact(contactId);
          ModalService.close('contactDetailsModal');
          ToastService.success('مخاطب حذف شد.');
          refreshCurrentView();
        }
      });
    };

    ModalService.open('contactDetailsModal');
  }

  /* ---------------- مودال بودجه ---------------- */
  function bindBudgetModal() {
    function openBudgetModal() {
      const budget = FinanceService.getBudget();
      document.getElementById('budgetAmount').value = budget ? budget.monthlyLimit : '';
      setFieldError('budgetAmount', 'budgetAmountError', '');
      ModalService.open('budgetModal');
    }

    document.getElementById('editBudgetBtn').addEventListener('click', openBudgetModal);
    document.getElementById('openBudgetModalBtn').addEventListener('click', openBudgetModal);

    document.getElementById('budgetForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const amount = document.getElementById('budgetAmount').value;

      if (!ValidationUtils.isValidAmount(amount)) {
        setFieldError('budgetAmount', 'budgetAmountError', 'مبلغ بودجه معتبری بزرگ‌تر از صفر وارد کن.');
        return;
      }

      FinanceService.setBudget(amount);
      ModalService.close('budgetModal');
      ToastService.success('بودجه ماهانه به‌روزرسانی شد.');
      DashboardController.render();
    });
  }

  /* ---------------- مودال تغییر رمز عبور ---------------- */
  function bindChangePasswordModal() {
    document.getElementById('openChangePasswordBtn').addEventListener('click', () => {
      document.getElementById('changePasswordForm').reset();
      clearFieldErrors([
        { inputId: 'currentPasswordInput', errorId: 'currentPasswordError' },
        { inputId: 'newPasswordInput', errorId: 'newPasswordError' },
        { inputId: 'confirmNewPasswordInput', errorId: 'confirmNewPasswordError' }
      ]);
      ModalService.open('changePasswordModal');
    });

    document.getElementById('changePasswordForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const current = document.getElementById('currentPasswordInput').value;
      const newPass = document.getElementById('newPasswordInput').value;
      const confirmPass = document.getElementById('confirmNewPasswordInput').value;

      clearFieldErrors([
        { inputId: 'currentPasswordInput', errorId: 'currentPasswordError' },
        { inputId: 'newPasswordInput', errorId: 'newPasswordError' },
        { inputId: 'confirmNewPasswordInput', errorId: 'confirmNewPasswordError' }
      ]);

      let valid = true;
      if (!ValidationUtils.isRequired(current)) {
        setFieldError('currentPasswordInput', 'currentPasswordError', 'رمز عبور فعلی الزامی است.');
        valid = false;
      }
      if (!ValidationUtils.isValidPassword(newPass)) {
        setFieldError('newPasswordInput', 'newPasswordError', `رمز عبور باید ${CONFIG.MIN_PASSWORD_LENGTH} تا ${CONFIG.MAX_PASSWORD_LENGTH} کاراکتر باشد و شامل حداقل یک حرف بزرگ، یک حرف کوچک و یک عدد باشد.`);
        valid = false;
      }
      if (newPass !== confirmPass) {
        setFieldError('confirmNewPasswordInput', 'confirmNewPasswordError', 'رمزهای عبور مطابقت ندارند.');
        valid = false;
      }
      if (!valid) return;

      const result = AuthService.changePassword(current, newPass);
      if (result.success) {
        ToastService.success('رمز عبور با موفقیت به‌روزرسانی شد.');
        ModalService.close('changePasswordModal');
      } else {
        setFieldError('currentPasswordInput', 'currentPasswordError', result.message);
      }
    });
  }

  /* ---------------- اتصال رویدادهای صفحه تراکنش‌ها ---------------- */
  function bindTransactionsView() {
    document.querySelectorAll('#transactionsView .segmented-btn[data-filter-type]').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#transactionsView .segmented-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        TransactionsController.setFilterType(btn.dataset.filterType);
      });
    });

    document.getElementById('transactionSearchInput').addEventListener('input', (e) => {
      TransactionsController.setSearch(e.target.value);
    });

    document.getElementById('toggleFiltersBtn').addEventListener('click', () => {
      document.getElementById('advancedFilters').classList.toggle('hidden');
    });

    document.getElementById('filterCategory').addEventListener('change', (e) => TransactionsController.setCategory(e.target.value));
    document.getElementById('filterDateFrom').addEventListener('change', (e) => TransactionsController.setDateFrom(e.target.value));
    document.getElementById('filterDateTo').addEventListener('change', (e) => TransactionsController.setDateTo(e.target.value));
    document.getElementById('sortSelect').addEventListener('change', (e) => TransactionsController.setSort(e.target.value));
    document.getElementById('clearFiltersBtn').addEventListener('click', () => TransactionsController.clearFilters());

    // Event delegation برای دکمه‌های ویرایش/حذف داخل آیتم‌های تراکنش
    document.getElementById('fullTransactionList').addEventListener('click', handleTransactionAction);
    document.getElementById('recentTransactionsList').addEventListener('click', handleTransactionAction);
  }

  function handleTransactionAction(e) {
    const btn = e.target.closest('.transaction-action-btn');
    if (!btn) return;
    const { id, type, action } = btn.dataset;

    if (action === 'edit') {
      if (type === 'income') {
        openIncomeModal(FinanceService.getIncomeById(id));
      } else {
        openExpenseModal(FinanceService.getExpenseById(id));
      }
    } else if (action === 'delete') {
      ModalService.confirmAction({
        title: 'حذف تراکنش',
        message: 'مطمئنی می‌خوای این تراکنش رو حذف کنی؟',
        icon: '🗑️',
        confirmLabel: 'حذف',
        onConfirm: () => {
          if (type === 'income') {
            FinanceService.deleteIncome(id);
          } else {
            FinanceService.deleteExpense(id);
          }
          ToastService.success('تراکنش حذف شد.');
          refreshCurrentView();
        }
      });
    }
  }

  /* ---------------- اتصال رویدادهای صفحه مخاطبین ---------------- */
  function bindContactsView() {
    document.getElementById('contactSearchInput').addEventListener('input', (e) => {
      ContactsController.setSearch(e.target.value);
    });
    document.getElementById('contactSortSelect').addEventListener('change', (e) => {
      ContactsController.setSort(e.target.value);
    });
    document.getElementById('contactsList').addEventListener('click', (e) => {
      const item = e.target.closest('.contact-item');
      if (item) openContactDetailsModal(item.dataset.id);
    });
  }

  /* ---------------- اتصال رویدادهای صفحه گزارش‌ها ---------------- */
  function bindReportsView() {
    document.querySelectorAll('#reportsView .segmented-btn[data-report-range]').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#reportsView .segmented-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        ReportsController.setRange(btn.dataset.reportRange);
      });
    });
  }

  /* ---------------- اتصال رویدادهای صفحه تنظیمات ---------------- */
  function bindSettingsView() {
    document.getElementById('changeProfilePhotoBtn').addEventListener('click', () => {
      document.getElementById('profilePhotoInput').click();
    });

    document.getElementById('profilePhotoInput').addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;

      SettingsController.setProfilePhotoFromFile(file)
        .then(() => ToastService.success('عکس پروفایل با موفقیت به‌روزرسانی شد.'))
        .catch((err) => ToastService.error(err.message || 'بارگذاری عکس با خطا مواجه شد.'))
        .finally(() => { e.target.value = ''; });
    });

    document.getElementById('currencySelect').addEventListener('change', (e) => {
      SettingsController.setCurrency(e.target.value);
      ToastService.success('واحد پول به‌روزرسانی شد.');
    });

    document.getElementById('exportDataBtn').addEventListener('click', () => {
      SettingsController.exportData();
      ToastService.success('داده‌ها با موفقیت خروجی گرفته شد.');
    });

    document.getElementById('resetDataBtn').addEventListener('click', () => {
      ModalService.confirmAction({
        title: 'بازنشانی تمامی داده‌ها',
        message: 'این کار تمام تراکنش‌ها، مخاطبین و بودجه رو برای همیشه پاک می‌کنه. حساب کاربری‌ات باقی می‌مونه. ادامه بدم؟',
        icon: '⚠️',
        confirmLabel: 'بازنشانی',
        onConfirm: () => {
          SettingsController.resetAllData();
          ToastService.success('تمامی داده‌ها بازنشانی شد.');
          NavigationService.switchView('dashboardView', 'داشبورد');
        }
      });
    });
  }

  /* ---------------- کمک‌کننده بازرندر صفحه فعلی ---------------- */
  function refreshCurrentView() {
    const activeView = document.querySelector('.view.active-view');
    if (!activeView) return;
    NavigationService.switchView(activeView.id, document.getElementById('viewTitle').textContent);
  }

  /* ---------------- راه‌اندازی ---------------- */
  function init() {
    ThemeService.init();
    bindAuthForms();
    bindNavigation();
    bindHeaderActions();
    bindModalGenerics();
    bindFab();
    bindIncomeForm();
    bindExpenseForm();
    bindContactForm();
    bindBudgetModal();
    bindChangePasswordModal();
    bindTransactionsView();
    bindContactsView();
    bindReportsView();
    bindSettingsView();
    initSplash();
  }

  return { init };
})();

/* ==========================================================================
   راه‌اندازی پس از آماده شدن DOM
   ========================================================================== */
document.addEventListener('DOMContentLoaded', App.init);
