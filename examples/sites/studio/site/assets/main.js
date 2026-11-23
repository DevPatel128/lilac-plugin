// Atelier Nord (fictional sample): progressive enhancement only. Content is visible without this file.
(function () {
  var doc = document, rm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var q = function (s, r) { return Array.prototype.slice.call((r || doc).querySelectorAll(s)); };
  window.__ok = true;

  // reveals: drawings draw themselves, frames wipe in, text rises
  var targets = q('.dwg, .reveal, .rise');
  var counters = q('.num[data-n]');
  function count(el) {
    var n = +el.getAttribute('data-n'), t0 = null;
    function step(t) {
      if (t0 === null) t0 = t;
      var k = Math.min((t - t0) / 900, 1);
      el.textContent = ('0' + Math.round(n * k)).slice(-2);
      if (k < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  if (rm || !('IntersectionObserver' in window)) {
    targets.forEach(function (e) { e.classList.add('in'); });
  } else {
    counters.forEach(function (e) { e.textContent = '00'; });
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (en) {
        if (!en.isIntersecting) return;
        en.target.classList.add('in');
        io.unobserve(en.target);
      });
    }, { threshold: 0.15 });
    targets.forEach(function (e) { io.observe(e); });
    var co = new IntersectionObserver(function (es) {
      es.forEach(function (en) {
        if (!en.isIntersecting) return;
        count(en.target); co.unobserve(en.target);
      });
    }, { threshold: 0.6 });
    counters.forEach(function (e) { co.observe(e); });
  }

  // gentle parallax on the hero drawing: transform only, never touches scrolling
  var par = q('[data-par]')[0];
  if (par && !rm) {
    var tick = false;
    var upd = function () {
      tick = false;
      var y = Math.min(window.scrollY, 900);
      par.style.transform = 'translate3d(0,' + (y * 0.08).toFixed(1) + 'px,0)';
    };
    addEventListener('scroll', function () { if (!tick) { tick = true; requestAnimationFrame(upd); } }, { passive: true });
  }

  // project filter
  var grid = doc.getElementById('grid');
  if (grid) {
    var chips = q('.chip'), cards = q('.card', grid), out = doc.getElementById('count');
    chips.forEach(function (c) {
      c.addEventListener('click', function () {
        var f = c.getAttribute('data-f'), shown = 0;
        chips.forEach(function (x) { x.setAttribute('aria-pressed', x === c ? 'true' : 'false'); });
        cards.forEach(function (card) {
          var on = f === 'all' || card.getAttribute('data-cat') === f;
          card.hidden = !on;
          if (on) { card.classList.toggle('alt', shown % 2 === 1); shown++; }
        });
        out.textContent = f === 'all' ? 'Showing all ' + shown + ' sample projects.' : 'Showing ' + shown + ' of ' + cards.length + ' sample projects (' + f + ').';
      });
    });
  }

  // enquiry form: validates in the browser, sends nothing
  var f = doc.getElementById('f');
  if (f) {
    f.setAttribute('novalidate', '');
    f.querySelector('button[type=submit]').disabled = false;
    var msg = {
      n: function (v) { return v.trim() ? '' : 'Enter your name.'; },
      e: function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? '' : 'Enter an email address like name@example.com.'; },
      t: function (v) { return v ? '' : 'Choose a project type.'; },
      m: function (v) { return v.trim().length >= 10 ? '' : 'Write at least 10 characters about the project.'; }
    };
    f.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var first = null, sent = doc.getElementById('sent');
      sent.textContent = '';
      Object.keys(msg).forEach(function (id) {
        var el = doc.getElementById(id), err = doc.getElementById(id + '-e'), m = msg[id](el.value);
        err.textContent = m;
        if (m) { el.setAttribute('aria-invalid', 'true'); if (!first) first = el; } else el.removeAttribute('aria-invalid');
      });
      if (first) { first.focus(); return; }
      f.reset();
      sent.textContent = 'Demo: nothing was sent. This studio is fictional and your answers stayed in your browser.';
      sent.focus();
    });
  }
})();
