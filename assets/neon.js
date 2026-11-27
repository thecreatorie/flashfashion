/* Neon layer: scroll reveals and the rotating hero. */
(function () {
  var root = document.documentElement;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function reveal() {
    var els = [].slice.call(document.querySelectorAll('.nx-rv:not(.is-in)'));
    if (!els.length) return;
    if (reduce || !('IntersectionObserver' in window)) {
      els.forEach(function (el) { el.classList.add('is-in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        var sibs = el.parentNode ? [].slice.call(el.parentNode.children).filter(function (c) { return c.classList.contains('nx-rv'); }) : [el];
        el.style.transitionDelay = Math.min(sibs.indexOf(el), 6) * 90 + 'ms';
        el.classList.add('is-in');
        io.unobserve(el);
        setTimeout(function () { el.classList.remove('nx-rv', 'is-in'); el.style.transitionDelay = ''; }, 1600);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
    els.forEach(function (el) { io.observe(el); });
  }

  function rotators() {
    [].slice.call(document.querySelectorAll('[data-nx-rotator]')).forEach(function (stage) {
      if (stage.nxReady) return;
      stage.nxReady = true;
      var slides = [].slice.call(stage.querySelectorAll('.nx-slide'));
      if (!slides.length) return;
      var i = 0;
      slides.forEach(function (s, n) { s.classList.toggle('is-on', n === 0); });
      if (slides.length < 2 || reduce) return;
      var ms = parseInt(stage.getAttribute('data-interval'), 10) || 3500;
      var paused = false;
      stage.addEventListener('mouseenter', function () { paused = true; });
      stage.addEventListener('mouseleave', function () { paused = false; });
      setInterval(function () {
        if (paused || document.hidden) return;
        slides[i].classList.remove('is-on');
        i = (i + 1) % slides.length;
        slides[i].classList.add('is-on');
      }, ms);
    });
  }

  function init() { root.classList.add('nx-js'); reveal(); rotators(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  document.addEventListener('shopify:section:load', init);
})();
