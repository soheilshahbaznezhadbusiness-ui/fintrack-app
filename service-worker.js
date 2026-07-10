/* ==========================================================================
   فین‌ترک - Service Worker
   این فایل باعث می‌شود صفحه اصلی برنامه (HTML/CSS/JS/آیکون‌ها) بدون
   اتصال اینترنت هم بارگذاری بشه. همین چیزی که باعث می‌شه برنامه به‌صورت
   یک PWA کاملاً آفلاین و قابل‌نصب کار کنه و آماده‌ی تبدیل به یک اپ
   بومی (Capacitor/Cordova) هم باشه.
   ========================================================================== */

const CACHE_NAME = 'fintrack-fa-cache-v1';

// فایل‌هایی که "پوسته اصلی" برنامه را می‌سازند - در نصب، فوراً کش می‌شوند
const APP_SHELL_FILES = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.json',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/favicon.ico',
  './assets/logo.png'
  // نکته: اگر یک نسخه لوکال از Chart.js را در ./lib/chart.min.js قرار دادی
  // (به فایل APK_CONVERSION_GUIDE.md مراجعه کن)، اینجا هم اضافه‌اش کن:
  // './lib/chart.min.js'
];

/* ---------------- نصب: کش کردن پوسته اصلی برنامه ---------------- */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL_FILES))
      .then(() => self.skipWaiting())
  );
});

/* ---------------- فعال‌سازی: پاک‌سازی کش‌های قدیمی ---------------- */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

/* ---------------- دریافت درخواست: استراتژی cache-first ----------------
   ابتدا فایل‌های کش‌شده را برمی‌گرداند (سریع‌تر و قابل‌استفاده آفلاین)
   و اگر فایلی هنوز کش نشده باشد (مثلاً اسکریپت Chart.js از CDN وقتی
   آنلاین هستیم)، آن را از شبکه دریافت می‌کند.
   ================================================================ */
self.addEventListener('fetch', (event) => {
  // فقط درخواست‌های GET را مدیریت می‌کنیم
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;

      return fetch(event.request)
        .then((networkResponse) => {
          // پاسخ‌های موفق هم‌مبدأ را برای استفاده آفلاین بعدی کش می‌کنیم
          if (
            networkResponse &&
            networkResponse.status === 200 &&
            event.request.url.startsWith(self.location.origin)
          ) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
          }
          return networkResponse;
        })
        .catch(() => {
          // اگر هم کش و هم شبکه شکست خوردند، و درخواست از نوع ناوبری بود،
          // به index.html کش‌شده برمی‌گردیم تا برنامه همچنان باز شود.
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
    })
  );
});
