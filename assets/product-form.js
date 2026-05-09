/* Flash Fashion — product form (variants, AJAX add) */
(function () {
  'use strict';

  document.querySelectorAll('[data-product-form]').forEach(initForm);

  function initForm(form) {
    const productData = readProductData(form);
    if (!productData) return;

    const variantInput = form.querySelector('[name="id"]');
    const priceEl = form.querySelector('[data-product-price]');
    const compareEl = form.querySelector('[data-product-compare]');
    const submitBtn = form.querySelector('[data-product-submit]');
    const submitLabel = submitBtn ? submitBtn.querySelector('[data-product-submit-label]') : null;
    const optionPills = form.querySelectorAll('[data-option-pill]');

    function getSelectedOptions() {
      const opts = [];
      productData.options.forEach((_, i) => {
        const checked = form.querySelector(`[data-option-pill][data-option-position="${i + 1}"][data-checked="true"]`);
        opts.push(checked ? checked.getAttribute('data-option-value') : null);
      });
      return opts;
    }

    function getMatchingVariant(opts) {
      return productData.variants.find((v) => v.options.every((val, i) => val === opts[i]));
    }

    function updateAvailability() {
      const opts = getSelectedOptions();
      productData.options.forEach((_, i) => {
        const pills = form.querySelectorAll(`[data-option-pill][data-option-position="${i + 1}"]`);
        pills.forEach((pill) => {
          const probe = opts.slice();
          probe[i] = pill.getAttribute('data-option-value');
          const variant = productData.variants.find((v) => v.options.every((val, idx) => probe[idx] == null || val === probe[idx]));
          pill.setAttribute('data-soldout', variant && variant.available ? 'false' : 'true');
        });
      });
    }

    function updateSelected() {
      const opts = getSelectedOptions();
      const variant = getMatchingVariant(opts);
      if (!variant) return;
      if (variantInput) variantInput.value = variant.id;
      if (priceEl) priceEl.textContent = formatMoney(variant.price);
      if (compareEl) {
        if (variant.compare_at_price && variant.compare_at_price > variant.price) {
          compareEl.textContent = formatMoney(variant.compare_at_price);
          compareEl.removeAttribute('hidden');
        } else {
          compareEl.setAttribute('hidden', '');
        }
      }
      if (submitBtn) {
        submitBtn.disabled = !variant.available;
        if (submitLabel) submitLabel.textContent = variant.available ? 'Add to bag' : 'Sold out';
      }
      // Update url
      if (variant.id && history.replaceState) {
        const url = new URL(window.location);
        url.searchParams.set('variant', variant.id);
        history.replaceState({}, '', url);
      }
      // Update gallery if variant has featured image
      if (variant.featured_image && variant.featured_image.src) {
        const main = document.querySelector('[data-gallery-main] img');
        if (main) main.src = variant.featured_image.src;
      }
      updateAvailability();
    }

    optionPills.forEach((pill) => {
      pill.addEventListener('click', () => {
        const pos = pill.getAttribute('data-option-position');
        form.querySelectorAll(`[data-option-pill][data-option-position="${pos}"]`).forEach((p) => p.setAttribute('data-checked', 'false'));
        pill.setAttribute('data-checked', 'true');
        const labelEl = form.querySelector(`[data-option-selected="${pos}"]`);
        if (labelEl) labelEl.textContent = pill.getAttribute('data-option-value');
        updateSelected();
      });
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = new FormData(form);
      submitBtn && submitBtn.setAttribute('aria-busy', 'true');
      try {
        const res = await fetch('/cart/add.js', {
          method: 'POST',
          headers: { 'Accept': 'application/json' },
          body: data
        });
        const json = await res.json();
        if (json.status && json.status >= 400) {
          showError(form, json.description || json.message || 'Could not add to bag');
          return;
        }
        // Open cart drawer if available, else go to cart
        if (window.FlashCart && document.querySelector('[data-cart-drawer]')) {
          window.FlashCart.refresh();
          window.FlashCart.open();
        } else {
          window.location.href = '/cart';
        }
      } catch (err) {
        showError(form, 'Network error. Please try again.');
      } finally {
        submitBtn && submitBtn.removeAttribute('aria-busy');
      }
    });

    // Initialize defaults
    updateAvailability();
  }

  function readProductData(form) {
    const script = form.querySelector('script[type="application/json"][data-product-json]');
    if (!script) return null;
    try {
      return JSON.parse(script.textContent);
    } catch (e) { return null; }
  }

  function formatMoney(cents) {
    const code = (window.Shopify && Shopify.currency && Shopify.currency.active) || 'USD';
    return new Intl.NumberFormat(document.documentElement.lang || 'en', { style: 'currency', currency: code }).format(cents / 100);
  }

  function showError(form, message) {
    let el = form.querySelector('[data-product-error]');
    if (!el) {
      el = document.createElement('div');
      el.setAttribute('data-product-error', '');
      el.className = 'form-status form-status--error';
      form.appendChild(el);
    }
    el.textContent = message;
  }

  // ---- Quick add (from product card) ----
  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-quick-add]');
    if (!btn) return;
    e.preventDefault();
    const id = btn.getAttribute('data-variant-id');
    if (!id) return;
    btn.setAttribute('aria-busy', 'true');
    try {
      const res = await fetch('/cart/add.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ id, quantity: 1 })
      });
      const json = await res.json();
      if (json.status && json.status >= 400) return;
      if (window.FlashCart) {
        window.FlashCart.refresh();
        window.FlashCart.open();
      }
    } finally {
      btn.removeAttribute('aria-busy');
    }
  });

  // ---- Product gallery thumbs ----
  document.querySelectorAll('[data-gallery-thumb]').forEach((thumb) => {
    thumb.addEventListener('click', () => {
      const src = thumb.getAttribute('data-image');
      const main = document.querySelector('[data-gallery-main] img');
      if (main && src) main.src = src;
      document.querySelectorAll('[data-gallery-thumb]').forEach((t) => t.setAttribute('aria-current', 'false'));
      thumb.setAttribute('aria-current', 'true');
    });
  });
})();
