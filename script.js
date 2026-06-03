const API_BASE = (document.querySelector('meta[name="sellerlink-api"]')?.content || '').replace(/\/+$/, '');

function meta(name) {
  return (document.querySelector(`meta[name="${name}"]`)?.content || '').trim();
}

function staticPayConfig() {
  const telegram = meta('sellerlink-telegram').replace(/^@/, '');
  return {
    ok: true,
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

fetchPayConfig().then((cfg) => {
  const price = cfg.price || '300';
  document.querySelectorAll('#pay-btn, .price-card.featured .btn').forEach((el) => {
    if (el.id === 'pay-btn' && el.type === 'submit') {
      el.textContent = `Продолжить — ${price} ₽`;
    }
  });
  applyPayLinks({ sbp: cfg.sbp, telegramUrl: null }, cfg);
});
