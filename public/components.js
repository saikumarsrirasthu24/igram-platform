<!-- ═══════════════════════════════════════════
   iGram Digital Hub — Shared Components
   Include this JS to inject nav + footer
═══════════════════════════════════════════ -->
<script>
// ── Shared Nav HTML ──────────────────────────
const NAV_HTML = `
<div class="topbar">
  <div class="container flex-between">
    <span>📞 8106442080 &nbsp;|&nbsp; igram.hub@gmail.com</span>
    <a href="become-mitra.html">✨ Become iGram Mitra Partner →</a>
  </div>
</div>
<nav class="navbar">
  <div class="navbar-inner">
    <a href="index.html" class="navbar-brand">
      <div class="brand-icon">📡</div>
      iGram Digital
    </a>
    <ul class="navbar-nav" id="mainNav">
      <li><a href="index.html" class="nav-link" data-page="index">Home</a></li>
      <li><a href="services.html" class="nav-link" data-page="services">All Services</a></li>
      <li><a href="agriuber.html" class="nav-link" data-page="agriuber">AgriUber</a></li>
      <li><a href="igovt.html" class="nav-link" data-page="igovt">iGovt-Service</a></li>
      <li><a href="#" class="nav-link">eHealth</a></li>
      <li><a href="#" class="nav-link">eJobs</a></li>
      <li><a href="#" class="nav-link">iFinance</a></li>
      <li><a href="signin.html" class="nav-link">Sign In</a></li>
    </ul>
    <div class="navbar-actions">
      <button class="btn btn-outline btn-sm" onclick="window.location='signin.html'">Sign In</button>
      <button class="btn btn-gold btn-sm" onclick="window.location='become-mitra.html'">iGram Mitra</button>
      <button class="mobile-menu-btn" id="mobileMenuBtn" style="display:none;flex-direction:column;gap:5px;padding:8px;background:var(--purple-50);border-radius:8px;border:none;cursor:pointer;">
        <span style="display:block;width:20px;height:2px;background:var(--purple-700);border-radius:2px;transition:0.3s"></span>
        <span style="display:block;width:20px;height:2px;background:var(--purple-700);border-radius:2px;transition:0.3s"></span>
        <span style="display:block;width:20px;height:2px;background:var(--purple-700);border-radius:2px;transition:0.3s"></span>
      </button>
    </div>
  </div>
</nav>
`;

// ── Shared Footer HTML ───────────────────────
const FOOTER_HTML = `
<footer class="footer">
  <div class="container">
    <div style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:40px;padding-bottom:40px;">
      <div class="footer-brand">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">
          <div class="brand-icon">📡</div>
          <h3 style="font-size:1.2rem;">iGram Digital</h3>
        </div>
        <p style="font-size:0.85rem;line-height:1.7;margin-bottom:16px;">One Village. One Hub. Unlimited Opportunities. Empowering rural India through digital services.</p>
        <div style="display:flex;flex-direction:column;gap:6px;font-size:0.83rem;">
          <span>📞 8106442080</span>
          <span>✉️ igram.hub@gmail.com</span>
          <span>🌐 igram.digital</span>
        </div>
        <div style="display:flex;gap:8px;margin-top:16px;">
          <a href="#" class="social-btn">f</a>
          <a href="#" class="social-btn">in</a>
          <a href="#" class="social-btn">📱</a>
          <a href="#" class="social-btn">▶</a>
        </div>
      </div>
      <div>
        <p class="footer-heading">Quick Links</p>
        <a href="become-mitra.html" class="footer-link">Apply iGram Mitra</a>
        <a href="#" class="footer-link">Become Partner</a>
        <a href="#" class="footer-link">Help Desk</a>
        <a href="signin.html" class="footer-link">Sign In / Register</a>
        <a href="#" class="footer-link">Contact Us</a>
      </div>
      <div>
        <p class="footer-heading">Services</p>
        <a href="agriuber.html" class="footer-link">AgriUber</a>
        <a href="#" class="footer-link">iFarm-Track</a>
        <a href="igovt.html" class="footer-link">iGovt-Service</a>
        <a href="#" class="footer-link">eHealth</a>
        <a href="#" class="footer-link">iFinance</a>
        <a href="#" class="footer-link">eJobs</a>
        <a href="#" class="footer-link">eCoaching</a>
      </div>
      <div>
        <p class="footer-heading">Language</p>
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:20px;">
          <button onclick="setLang('en')" style="padding:5px 12px;background:var(--purple-700);color:white;border:none;border-radius:6px;font-size:0.8rem;cursor:pointer;font-family:inherit;" id="lang-en">EN</button>
          <button onclick="setLang('te')" style="padding:5px 12px;background:rgba(255,255,255,0.08);color:#9988CC;border:none;border-radius:6px;font-size:0.8rem;cursor:pointer;font-family:inherit;" id="lang-te">TE</button>
          <button onclick="setLang('hi')" style="padding:5px 12px;background:rgba(255,255,255,0.08);color:#9988CC;border:none;border-radius:6px;font-size:0.8rem;cursor:pointer;font-family:inherit;" id="lang-hi">HI</button>
          <button onclick="setLang('mr')" style="padding:5px 12px;background:rgba(255,255,255,0.08);color:#9988CC;border:none;border-radius:6px;font-size:0.8rem;cursor:pointer;font-family:inherit;" id="lang-mr">MR</button>
        </div>
        <p class="footer-heading">Support</p>
        <a href="#" class="footer-link">WhatsApp Us</a>
        <a href="#" class="footer-link">FAQ</a>
        <a href="#" class="footer-link">Privacy Policy</a>
        <a href="#" class="footer-link">Terms of Service</a>
      </div>
    </div>
  </div>
  <div class="footer-bottom">
    <div class="container flex-between" style="flex-wrap:wrap;gap:8px;">
      <span>© 2025 iGram Digital Hub. All Rights Reserved.</span>
      <span>Made for rural India 🇮🇳</span>
    </div>
  </div>
</footer>
`;

// ── ai.Sathi Widget ──────────────────────────
const AI_WIDGET_HTML = `
<div class="ai-widget" id="aiWidget">
  <div class="ai-tooltip" id="aiTooltip">
    <strong>🤖 ai.Sathi Help Desk</strong>
    <span style="color:var(--green-600);font-size:0.75rem;font-weight:500;">● Online</span>
    <p style="margin-top:6px;">Namaste! Ask me anything in Telugu, Hindi, Marathi or English.</p>
    <div style="display:flex;gap:6px;margin-top:10px;">
      <button class="btn btn-primary btn-sm" style="flex:1;" onclick="document.getElementById('aiTooltip').classList.remove('show')">Chat Now</button>
    </div>
  </div>
  <button class="ai-btn" id="aiBtn" aria-label="Open ai.Sathi Help Desk">
    <div class="ai-btn-pulse"></div>
    🤖
  </button>
</div>
`;

// ── Toast ─────────────────────────────────────
const TOAST_HTML = `<div class="toast" id="globalToast">✅ <span id="toastMsg"></span></div>`;

// ── Inject all components ─────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Nav
  const navContainer = document.getElementById('site-nav');
  if (navContainer) navContainer.innerHTML = NAV_HTML;

  // Footer
  const footerContainer = document.getElementById('site-footer');
  if (footerContainer) footerContainer.innerHTML = FOOTER_HTML;

  // AI Widget
  document.body.insertAdjacentHTML('beforeend', AI_WIDGET_HTML);
  document.body.insertAdjacentHTML('beforeend', TOAST_HTML);

  // Set active nav link
  const page = document.body.dataset.page;
  document.querySelectorAll('.nav-link[data-page]').forEach(l => {
    if (l.dataset.page === page) l.classList.add('active');
  });

  // AI tooltip toggle
  const aiBtn = document.getElementById('aiBtn');
  const aiTooltip = document.getElementById('aiTooltip');
  if (aiBtn && aiTooltip) {
    setTimeout(() => aiTooltip.classList.add('show'), 2500);
    aiBtn.addEventListener('click', () => aiTooltip.classList.toggle('show'));
    document.addEventListener('click', e => {
      if (!document.getElementById('aiWidget').contains(e.target)) {
        aiTooltip.classList.remove('show');
      }
    });
  }

  // Mobile menu
  const mobileBtn = document.getElementById('mobileMenuBtn');
  const mainNav = document.getElementById('mainNav');
  if (mobileBtn && mainNav) {
    mobileBtn.addEventListener('click', () => {
      const open = mainNav.style.display === 'flex';
      mainNav.style.display = open ? '' : 'flex';
      mainNav.style.flexDirection = open ? '' : 'column';
      mainNav.style.position = open ? '' : 'absolute';
      mainNav.style.top = open ? '' : '100%';
      mainNav.style.left = open ? '' : '0';
      mainNav.style.right = open ? '' : '0';
      mainNav.style.background = open ? '' : 'white';
      mainNav.style.padding = open ? '' : '16px 24px';
      mainNav.style.boxShadow = open ? '' : '0 8px 24px rgba(0,0,0,0.1)';
      mainNav.style.zIndex = open ? '' : '999';
    });
  }
});

// ── Toast helper ──────────────────────────────
function showToast(msg, type = 'success') {
  const toast = document.getElementById('globalToast');
  const toastMsg = document.getElementById('toastMsg');
  if (!toast || !toastMsg) return;
  toastMsg.textContent = msg;
  toast.style.background = type === 'error' ? 'var(--red-600)' : 'var(--purple-700)';
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3500);
}

// ── Language switcher ─────────────────────────
function setLang(lang) {
  ['en','te','hi','mr'].forEach(l => {
    const btn = document.getElementById('lang-' + l);
    if (btn) {
      btn.style.background = l === lang ? 'var(--purple-700)' : 'rgba(255,255,255,0.08)';
      btn.style.color = l === lang ? 'white' : '#9988CC';
    }
  });
  showToast('Language switched to ' + lang.toUpperCase());
}

// ── Counter animation ─────────────────────────
function animateCounters() {
  document.querySelectorAll('[data-count]').forEach(el => {
    const target = parseInt(el.dataset.count);
    const suffix = el.dataset.suffix || '';
    const duration = 1800;
    const start = performance.now();
    const update = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.floor(eased * target) + suffix;
      if (progress < 1) requestAnimationFrame(update);
    };
    requestAnimationFrame(update);
  });
}

// ── Intersection observer for counters ────────
const counterObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      animateCounters();
      counterObserver.disconnect();
    }
  });
}, { threshold: 0.3 });

document.addEventListener('DOMContentLoaded', () => {
  const statsEl = document.querySelector('.stats-strip');
  if (statsEl) counterObserver.observe(statsEl);
});
</script>
