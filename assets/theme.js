/* Flash Fashion — global JS */
(function () {
  'use strict';

  // ---- Mobile menu ----
  const menuToggle = document.querySelector('[data-menu-toggle]');
  const menu = document.querySelector('[data-mobile-menu]');
  const menuClose = document.querySelector('[data-menu-close]');

  function openMenu() {
    if (!menu) return;
    menu.setAttribute('open', '');
    document.body.style.overflow = 'hidden';
    const firstLink = menu.querySelector('a, button');
    if (firstLink) firstLink.focus();
  }
  function closeMenu() {
    if (!menu) return;
    menu.removeAttribute('open');
    document.body.style.overflow = '';
    if (menuToggle) menuToggle.focus();
  }
  if (menuToggle) menuToggle.addEventListener('click', openMenu);
  if (menuClose) menuClose.addEventListener('click', closeMenu);
  if (menu) {
    menu.addEventListener('click', (e) => { if (e.target === menu) closeMenu(); });
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (menu && menu.hasAttribute('open')) closeMenu();
    }
  });

  // ---- Header scroll behaviour ----
  const header = document.querySelector('[data-header]');
  if (header) {
    let last = 0;
    window.addEventListener('scroll', () => {
      const y = window.scrollY;
      header.classList.toggle('is-scrolled', y > 8);
      last = y;
    }, { passive: true });
  }

  // ---- Reveal on scroll ----
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.05 });
    document.querySelectorAll('[data-reveal]').forEach((el) => io.observe(el));
  }

  // ---- Newsletter inline status ----
  document.querySelectorAll('form.newsletter__form').forEach((form) => {
    form.addEventListener('submit', () => {
      const status = form.querySelector('[data-newsletter-status]');
      if (status) status.textContent = '';
    });
  });

  // ---- Quantity inputs (cart page + drawer) ----
  document.addEventListener('click', (e) => {
    const dec = e.target.closest('[data-qty-dec]');
    const inc = e.target.closest('[data-qty-inc]');
    if (!dec && !inc) return;
    e.preventDefault();
    const wrap = (dec || inc).closest('.qty');
    if (!wrap) return;
    const input = wrap.querySelector('input');
    if (!input) return;
    const min = Number(input.min || 0);
    let val = Number(input.value || 0);
    val += inc ? 1 : -1;
    if (val < min) val = min;
    input.value = val;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });

  // ---- Predictive search (basic toggle) ----
  const searchToggle = document.querySelector('[data-search-toggle]');
  const searchModal = document.querySelector('[data-search-modal]');
  const searchClose = document.querySelector('[data-search-close]');
  if (searchToggle && searchModal) {
    searchToggle.addEventListener('click', () => {
      searchModal.setAttribute('open', '');
      const input = searchModal.querySelector('input[type="search"]');
      if (input) input.focus();
    });
  }
  if (searchClose) searchClose.addEventListener('click', () => searchModal && searchModal.removeAttribute('open'));
})();
