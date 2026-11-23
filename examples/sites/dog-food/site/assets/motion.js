// Biscuit & Bowl (FICTIONAL SAMPLE): motion helpers. Only transform and opacity animate; everything is skipped under prefers-reduced-motion. No network.
(function () {
  var d = document, root = d.documentElement, rm = matchMedia('(prefers-reduced-motion: reduce)');
  // pause / play for the looping animations
  var btns = d.querySelectorAll('[data-pause]');
  btns.forEach(function (b) {
    b.addEventListener('click', function () {
      var p = root.classList.toggle('motion-paused');
      btns.forEach(function (x) { x.textContent = p ? 'Play animation' : 'Pause animation'; });
    });
  });
  if (rm.matches) return;
  // scroll reveal: .rv is added here, so no-JS visitors never get a hidden start state
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        var el = e.target; io.unobserve(el); el.classList.add('in');
        el.addEventListener('transitionend', function f(ev) {
          if (ev.propertyName !== 'opacity') return;
          el.classList.remove('rv', 'in'); el.style.transitionDelay = ''; el.removeEventListener('transitionend', f);
        });
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    d.querySelectorAll('.band .wrap > *, .split > *, .picks li, .product, .steps li, .paws, .faq details, .note, .gloss, form').forEach(function (el) {
      el.style.transitionDelay = (Array.prototype.indexOf.call(el.parentNode.children, el) % 6) * 70 + 'ms';
      el.classList.add('rv'); io.observe(el);
    });
  }
  // nav underline glides to the hovered or focused link, back to the current page on leave
  var ul = d.querySelector('nav ul');
  if (ul) {
    var ind = d.createElement('span'); ind.className = 'nav-ind'; ind.setAttribute('aria-hidden', 'true'); ul.appendChild(ind);
    var cur = ul.querySelector('[aria-current]') || ul.querySelector('a');
    var to = function (a) {
      var r = a.getBoundingClientRect(), u = ul.getBoundingClientRect();
      ind.style.setProperty('--x', r.left - u.left + 'px'); ind.style.setProperty('--y', r.bottom - u.top - 5 + 'px'); ind.style.setProperty('--w', r.width / 100);
    };
    to(cur); requestAnimationFrame(function () { requestAnimationFrame(function () { ind.classList.add('ready'); }); });
    ul.querySelectorAll('a').forEach(function (a) {
      ['mouseenter', 'focus'].forEach(function (ev) { a.addEventListener(ev, function () { to(a); }); });
      ['mouseleave', 'blur'].forEach(function (ev) { a.addEventListener(ev, function () { to(cur); }); });
    });
    addEventListener('resize', function () { to(cur); });
  }
  // page-leave fade; bfcache restore clears it
  d.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a || e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || a.target || a.origin !== location.origin || a.pathname === location.pathname) return;
    e.preventDefault(); root.classList.add('leaving'); setTimeout(function () { location.href = a.href; }, 200);
  });
  addEventListener('pageshow', function () { root.classList.remove('leaving'); });
})();
