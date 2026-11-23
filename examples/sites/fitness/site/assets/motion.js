// Still Water motion: reveal, button ripple, wave parallax, breathing pause/play. Transform and opacity only.
(function () {
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var d = document;
  // staggered reveal
  var rv = [].slice.call(d.querySelectorAll('[data-rv]'));
  function show(el) { el.classList.add('in'); }
  if (reduce || !('IntersectionObserver' in window)) rv.forEach(show);
  else {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { show(e.target); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px' });
    rv.forEach(function (el, i) { if (!el.style.getPropertyValue('--d')) el.style.setProperty('--d', (i % 4) * 90 + 'ms'); io.observe(el); });
    setTimeout(function () { rv.forEach(show); }, 4000); // failsafe: never leave content hidden
  }
  if (reduce) return;
  // gentle press ripple
  d.addEventListener('pointerdown', function (e) {
    var b = e.target.closest && e.target.closest('.btn');
    if (!b) return;
    var r = b.getBoundingClientRect(), s = Math.max(r.width, r.height) * 2, p = d.createElement('span');
    p.className = 'rip';
    p.style.cssText = 'width:' + s + 'px;height:' + s + 'px;left:' + (e.clientX - r.left - s / 2) + 'px;top:' + (e.clientY - r.top - s / 2) + 'px';
    b.appendChild(p);
    setTimeout(function () { p.remove(); }, 650);
  });
  // soft parallax on wave layers
  var waves = [].slice.call(d.querySelectorAll('.wave[data-speed]')), tick = false;
  function par() {
    var y = Math.min(window.scrollY, 700);
    waves.forEach(function (w) { w.style.transform = 'translate3d(0,' + (y * w.dataset.speed).toFixed(1) + 'px,0)'; });
    tick = false;
  }
  if (waves.length) addEventListener('scroll', function () { if (!tick) { tick = true; requestAnimationFrame(par); } }, { passive: true });
})();
// breathing circle: starts only when JS can offer a pause button
(function () {
  var b = document.querySelector('.breath');
  if (!b || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  b.classList.add('run');
  var btn = document.createElement('button');
  btn.type = 'button'; btn.className = 'btn ghost sm'; btn.textContent = 'Pause'; btn.setAttribute('aria-pressed', 'false');
  btn.setAttribute('aria-label', 'Pause the circle animation');
  btn.addEventListener('click', function () {
    var p = b.classList.toggle('paused');
    btn.textContent = p ? 'Play' : 'Pause';
    btn.setAttribute('aria-pressed', String(p));
    btn.setAttribute('aria-label', p ? 'Play the circle animation' : 'Pause the circle animation');
  });
  b.appendChild(btn);
})();
