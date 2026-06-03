const API_BASE = (document.querySelector('meta[name="sellerlink-api"]')?.content || '').replace(/\/+$/, '');

function meta(name) {
  return (document.querySelector(`meta[name="${name}"]`)?.content || '').trim();
}

function paymentsEnabledFromMeta() {
  return meta('sellerlink-payments-enabled') !== 'false';
}

function staticPayConfig() {
  const telegram = meta('sellerlink-telegram').replace(/^@/, '');
  const enabled = paymentsEnabledFromMeta();
  return {
    ok: true,
    paymentsEnabled: enabled,
    paymentsMessage: enabled
      ? ''
      : 'Оплата пока недоступна. Подключаем онлайн-кассу.',
    price: meta('sellerlink-price') || '300',
    currency: 'RUB',
    sbp: {
      url: meta('sellerlink-sbp-url') || null,
      phone: meta('sellerlink-sbp-phone') || null,
      recipient: meta('sellerlink-sbp-recipient') || null,
    },
    telegram: {
      username: telegram || null,
      url: telegram ? `https://t.me/${telegram}` : null,
    },
    yookassa: false,
  };
}

async function fetchPayConfig() {
  if (API_BASE) {
    try {
      const res = await fetch(`${API_BASE}/api/pay/config`);
      if (res.ok) return res.json();
    } catch {}
  }
  return staticPayConfig();
}

async function createPayIntent(email) {
  if (API_BASE) {
    const res = await fetch(`${API_BASE}/api/pay/intent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error || 'Не удалось создать заявку');
    return data;
  }

  const cfg = staticPayConfig();
  const telegram = cfg.telegram?.username;
  if (!telegram) throw new Error('Укажите sellerlink-telegram в meta лендинга или подключите API');

  return {
    ok: true,
    orderId: null,
    email,
    price: cfg.price,
    sbp: cfg.sbp,
    telegramUrl: `https://t.me/${telegram}?start=buy`,
    localOnly: true,
  };
}

document.querySelectorAll('a[href^="#"]').forEach((link) => {
  link.addEventListener('click', (event) => {
    const id = link.getAttribute('href');
    if (!id || id === '#') {
      event.preventDefault();
      return;
    }
    if (!id.startsWith('#')) return;
    const target = document.querySelector(id);
    if (!target) return;
    event.preventDefault();
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
});

const payForm = document.getElementById('pay-form');
const payEmail = document.getElementById('pay-email');
const payBtn = document.getElementById('pay-btn');
const payMessage = document.getElementById('pay-message');
const paySteps = document.getElementById('pay-steps');
const paySbpHint = document.getElementById('pay-sbp-hint');
const paySbpLink = document.getElementById('pay-sbp-link');
const payTelegramLink = document.getElementById('pay-telegram-link');
const payPriceLabel = document.getElementById('pay-price-label');
const payCopyId = document.getElementById('pay-copy-id');
const payPaused = document.getElementById('pay-paused');
const payNote = document.getElementById('pay-note');

function setPaymentsUi(enabled) {
  if (payPaused) payPaused.classList.toggle('hidden', enabled);
  if (payForm) {
    payForm.classList.toggle('hidden', !enabled);
    payForm.hidden = !enabled;
  }
  if (payNote) payNote.classList.toggle('hidden', !enabled);
  document.querySelectorAll('.price-card.featured .btn').forEach((el) => {
    if (!enabled) {
      el.classList.add('btn-ghost');
      el.textContent = 'Оплата скоро';
    } else {
      el.classList.remove('btn-ghost');
      el.textContent = 'Купить Pro';
    }
  });
}

setPaymentsUi(paymentsEnabledFromMeta());

let currentOrderId = null;

function setPayMessage(text, type = '') {
  if (!payMessage) return;
  payMessage.textContent = text;
  payMessage.className = `pay-message ${type}`.trim();
}

function applyPayLinks(intent, cfg) {
  const sbpUrl = intent.sbp?.url || cfg.sbp?.url;
  if (paySbpLink) {
    if (sbpUrl) {
      paySbpLink.href = sbpUrl;
      paySbpLink.classList.remove('hidden');
    } else {
      paySbpLink.href = '#';
      paySbpLink.classList.add('hidden');
    }
  }

  const telegramUrl =
    intent.telegramUrl ||
    (cfg.telegram?.username ? `https://t.me/${cfg.telegram.username}?start=buy` : cfg.telegram?.url);
  if (payTelegramLink && telegramUrl) {
    payTelegramLink.href = telegramUrl;
  }
}

function showPaySteps(intent, cfg) {
  if (!paySteps) return;
  paySteps.classList.remove('hidden');
  currentOrderId = intent.orderId;

  const price = intent.price || cfg.price || '300';
  if (payPriceLabel) payPriceLabel.textContent = price;
  if (payBtn) payBtn.textContent = 'Готово — жду ключ на email';

  applyPayLinks(intent, cfg);

  const sbpParts = [];
  if (intent.sbp?.url || cfg.sbp?.url) {
    sbpParts.push('Перейдите по ссылке СБП или отсканируйте QR в приложении банка.');
  }

  const phone = intent.sbp?.phone || cfg.sbp?.phone;
  const recipient = intent.sbp?.recipient || cfg.sbp?.recipient;
  if (phone) sbpParts.push(`Телефон: ${phone}`);
  if (recipient) sbpParts.push(`Получатель: ${recipient}`);
  if (intent.orderId) sbpParts.push(`В комментарии к переводу: ${intent.orderId}`);
  else sbpParts.push('В боте введите тот же email, что указали выше.');

  if (paySbpHint) paySbpHint.textContent = sbpParts.join(' · ');

  if (payCopyId) {
    if (intent.orderId) {
      payCopyId.classList.remove('hidden');
      payCopyId.onclick = async () => {
        try {
          await navigator.clipboard.writeText(intent.orderId);
          setPayMessage('ID заявки скопирован', 'success');
        } catch {
          setPayMessage(intent.orderId);
        }
      };
    } else {
      payCopyId.classList.add('hidden');
    }
  }

  setPayMessage(
    intent.localOnly
      ? 'В Telegram нажмите /buy и введите тот же email, затем оплатите СБП.'
      : 'Заявка создана. Оплатите СБП и откройте Telegram.',
    'success'
  );
}

if (payForm) {
  payForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = payEmail.value.trim().toLowerCase();
    if (!email) {
      setPayMessage('Укажите email', 'error');
      return;
    }

    const consent = document.getElementById('pay-consent');
    if (consent && !consent.checked) {
      setPayMessage('Подтвердите согласие с офертой и условиями', 'error');
      return;
    }

    payBtn.disabled = true;
    const cfg = await fetchPayConfig();
    const price = cfg.price || '300';
    payBtn.textContent = 'Создаём заявку…';
    setPayMessage('');

    try {
      const intent = await createPayIntent(email);
      showPaySteps(intent, cfg);
      payEmail.readOnly = true;
    } catch (error) {
      setPayMessage(error.message || 'Ошибка', 'error');
      payBtn.disabled = false;
      payBtn.textContent = `Продолжить — ${price} ₽`;
    }
  });
}

const demoCleanBtn = document.getElementById('demo-clean-btn');
const demoCard = document.getElementById('demo-card');
const demoCopyBtn = document.getElementById('demo-copy-btn');
const demoAfterText = document.getElementById('demo-after-text');
const CLEAN_RESULT = '12345678';

if (demoCleanBtn && demoCard) {
  demoCleanBtn.addEventListener('click', () => {
    demoCard.classList.add('demo-done');
    if (demoAfterText) demoAfterText.textContent = CLEAN_RESULT;
    if (demoCopyBtn) demoCopyBtn.classList.remove('hidden');
    demoCleanBtn.textContent = 'DONE';
    demoCleanBtn.disabled = true;
  });
}

if (demoCopyBtn) {
  demoCopyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(CLEAN_RESULT);
      demoCopyBtn.textContent = 'Скопировано!';
      setTimeout(() => {
        demoCopyBtn.textContent = 'COPY';
      }, 2000);
    } catch {
      demoCopyBtn.textContent = CLEAN_RESULT;
    }
  });
}

fetchPayConfig().then((cfg) => {
  const enabled = cfg.paymentsEnabled !== false;
  setPaymentsUi(enabled);
  if (!enabled) return;

  const price = cfg.price || '300';
  document.querySelectorAll('#pay-btn, .price-card.featured .btn').forEach((el) => {
    if (el.id === 'pay-btn' && el.type === 'submit') {
      el.textContent = `Продолжить — ${price} ₽`;
    }
  });
  applyPayLinks({ sbp: cfg.sbp, telegramUrl: null }, cfg);
});

/* Hero demo */
const demoBtn = document.getElementById('demo-clean-btn');
const demoCard = document.getElementById('demo-card');
const demoAfterText = document.getElementById('demo-after-text');
const demoCopyBtn = document.getElementById('demo-copy-btn');
const DEMO_RESULT = '12345678';

if (demoBtn && demoCard) {
  demoBtn.addEventListener('click', () => {
    demoCard.classList.add('demo-done');
    demoBtn.textContent = 'DONE';
    demoBtn.disabled = true;
    if (demoCopyBtn) demoCopyBtn.classList.remove('hidden');
  });
}

if (demoCopyBtn && demoAfterText) {
  demoCopyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(DEMO_RESULT);
      demoCopyBtn.textContent = 'Скопировано!';
      setTimeout(() => {
        demoCopyBtn.textContent = 'COPY';
      }, 2000);
    } catch {
      demoCopyBtn.textContent = DEMO_RESULT;
    }
  });
}

const navToggle = document.getElementById('nav-toggle');
const siteHeader = document.querySelector('.site-header');
const navMenu = document.getElementById('nav-menu');

if (navToggle && siteHeader && navMenu) {
  navToggle.addEventListener('click', () => {
    const open = siteHeader.classList.toggle('nav-open');
    navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  navMenu.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      siteHeader.classList.remove('nav-open');
      navToggle.setAttribute('aria-expanded', 'false');
    });
  });
}
