/* Flash Fashion — cart drawer */
(function () {
  'use strict';

  const drawer = document.querySelector('[data-cart-drawer]');
  const openers = document.querySelectorAll('[data-cart-open]');
  const closers = document.querySelectorAll('[data-cart-close]');

  function openDrawer() {
    if (!drawer) return;
    drawer.setAttribute('open', '');
    document.body.style.overflow = 'hidden';
  }
  function closeDrawer() {
    if (!drawer) return;
    drawer.removeAttribute('open');
    document.body.style.overflow = '';
  }
  function toggleFromUrl(e) {
    if (!drawer) return;
    e.preventDefault();
    openDrawer();
    refreshDrawer();
  }
  openers.forEach((el) => el.addEventListener('click', toggleFromUrl));
  closers.forEach((el) => el.addEventListener('click', closeDrawer));
  if (drawer) {
    drawer.addEventListener('click', (e) => { if (e.target === drawer) closeDrawer(); });
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && drawer && drawer.hasAttribute('open')) closeDrawer();
  });

  function formatMoney(cents) {
    const amount = (cents / 100).toFixed(2);
    return (window.Shopify && Shopify.currency && Shopify.currency.active)
      ? new Intl.NumberFormat(document.documentElement.lang || 'en', { style: 'currency', currency: Shopify.currency.active }).format(cents / 100)
      : '$' + amount;
  }

  async function fetchCart() {
    const res = await fetch('/cart.js', { headers: { 'Accept': 'application/json' } });
    return res.json();
  }

  function renderLine(item) {
    const img = item.image ? item.image.replace(/\.([a-z]+)\?/, '_120x.$1?') : '';
    const variant = item.options_with_values && item.options_with_values.map(o => o.value).join(' / ');
    return `
      <article class="cart-line" data-line-key="${item.key}">
        <div class="cart-line__media">
          ${img ? `<img src="${img}" alt="${item.product_title}" loading="lazy" width="88" height="117">` : ''}
        </div>
        <div class="cart-line__info">
          <a class="cart-line__title" href="${item.url}">${item.product_title}</a>
          ${variant ? `<div class="cart-line__variant">${variant}</div>` : ''}
          <div class="cart-line__bottom">
            <div class="qty">
              <button type="button" data-qty-dec aria-label="Decrease">−</button>
              <input type="number" min="0" value="${item.quantity}" data-line-qty="${item.key}">
              <button type="button" data-qty-inc aria-label="Increase">+</button>
            </div>
            <span class="cart-line__price">${formatMoney(item.final_line_price)}</span>
          </div>
          <button type="button" class="cart-line__remove" data-line-remove="${item.key}">Remove</button>
        </div>
      </article>
    `;
  }

  function renderEmpty() {
    return `
      <div class="cart-drawer__empty">
        <p>Your bag is empty.</p>
        <a class="btn btn--primary" href="/collections/all">Shop the collection</a>
      </div>
    `;
  }

  async function refreshDrawer() {
    if (!drawer) return;
    const cart = await fetchCart();
    const itemsEl = drawer.querySelector('[data-cart-items]');
    const totalEl = drawer.querySelector('[data-cart-total]');
    const countEls = document.querySelectorAll('[data-cart-count]');
    const footEl = drawer.querySelector('[data-cart-foot]');

    countEls.forEach((el) => {
      el.textContent = cart.item_count;
      if (cart.item_count > 0) el.removeAttribute('hidden');
      else el.setAttribute('hidden', '');
    });

    if (cart.item_count === 0) {
      if (itemsEl) itemsEl.innerHTML = renderEmpty();
      if (footEl) footEl.style.display = 'none';
    } else {
      if (itemsEl) itemsEl.innerHTML = cart.items.map(renderLine).join('');
      if (footEl) footEl.style.display = '';
    }
    if (totalEl) totalEl.textContent = formatMoney(cart.total_price);
  }

  async function changeLine(key, quantity) {
    const res = await fetch('/cart/change.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ id: key, quantity })
    });
    return res.json();
  }

  document.addEventListener('change', async (e) => {
    const target = e.target;
    if (target.matches('[data-line-qty]')) {
      const key = target.getAttribute('data-line-qty');
      const qty = Math.max(0, Number(target.value || 0));
      await changeLine(key, qty);
      refreshDrawer();
    }
  });

  document.addEventListener('click', async (e) => {
    const removeBtn = e.target.closest('[data-line-remove]');
    if (!removeBtn) return;
    e.preventDefault();
    const key = removeBtn.getAttribute('data-line-remove');
    await changeLine(key, 0);
    refreshDrawer();
  });

  // Cart note
  const noteField = document.querySelector('[data-cart-note]');
  if (noteField) {
    let timer;
    noteField.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        fetch('/cart/update.js', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ note: noteField.value })
        });
      }, 400);
    });
  }

  // Public API
  window.FlashCart = { open: openDrawer, close: closeDrawer, refresh: refreshDrawer };
})();
