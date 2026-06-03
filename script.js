const API_BASE = (document.querySelector('meta[name="sellerlink-api"]')?.content || '').replace(/\/+$/, '');

document.querySelectorAll('a[href^="#"]').forEach((link) => {
  link.addEventListener('click', (event) => {
    const id = link.getAttribute('href');
    if (!id || id === '#') return;
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

function setPayMessage(text, type = '') {
  if (!payMessage) return;
  payMessage.textContent = text;
  payMessage.className = `pay-message ${type}`.trim();
}

if (payForm) {
  payForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = payEmail.value.trim();
    if (!email) {
      setPayMessage('Укажите email', 'error');
      return;
    }

    payBtn.disabled = true;
    payBtn.textContent = 'Создаём платёж…';
    setPayMessage('');

    try {
      const response = await fetch(`${API_BASE}/api/payments/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();

      if (!response.ok || !data.ok || !data.confirmationUrl) {
        throw new Error(data.error || 'Не удалось создать платёж');
      }

      window.location.href = data.confirmationUrl;
    } catch (error) {
      setPayMessage(error.message || 'Ошибка оплаты', 'error');
      payBtn.disabled = false;
      payBtn.textContent = 'Оплатить 500 ₽';
    }
  });
}
