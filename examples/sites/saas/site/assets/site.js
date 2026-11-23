// Tasklane (FICTIONAL demo). Progressive enhancement: the page is complete without this file.
(function () {
  var d = document, reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (s, r) { return (r || d).querySelector(s); }, $$ = function (s, r) { return [].slice.call((r || d).querySelectorAll(s)); };

  // 1. reveal on scroll, staggered by --i
  var rv = $$('.reveal');
  if (rv.length) {
    var show = function (e) { e.classList.add('in'); };
    if (reduce || !('IntersectionObserver' in window)) rv.forEach(show);
    else {
      var io = new IntersectionObserver(function (es) { es.forEach(function (x) { if (x.isIntersecting) { show(x.target); io.unobserve(x.target); } }); }, { threshold: .15 });
      rv.forEach(function (e, i) { e.style.setProperty('--i', i % 3); io.observe(e); });
      setTimeout(function () { rv.forEach(show); }, 4000); // failsafe: never leave content hidden
    }
  }

  // 2. scroll progress (transform only, no number)
  var pi = $('.progress i');
  if (pi) {
    var tick = false, upd = function () {
      var h = d.documentElement.scrollHeight - innerHeight;
      pi.style.transform = 'scaleX(' + (h > 0 ? Math.min(1, scrollY / h) : 0) + ')'; tick = false;
    };
    addEventListener('scroll', function () { if (!tick) { tick = true; requestAnimationFrame(upd); } }, { passive: true });
    addEventListener('resize', upd); upd();
  }

  // 3. nav indicator glides to hovered/focused link, rests on current page
  var nav = $('.nav ul'), ind = $('.nav-ind');
  if (nav && ind) {
    var links = $$('a', nav), cur = $('a[aria-current=page]', nav);
    var go = function (a) {
      if (!a) { ind.style.opacity = 0; return; }
      var n = nav.getBoundingClientRect(), r = a.getBoundingClientRect();
      ind.style.opacity = 1;
      ind.style.transform = 'translate(' + (r.left - n.left) + 'px,' + (r.bottom - n.top - 3) + 'px) scaleX(' + r.width + ')';
    };
    var rest = function () { go(cur); };
    links.forEach(function (a) { ['mouseenter', 'focus'].forEach(function (ev) { a.addEventListener(ev, function () { go(a); }); }); ['mouseleave', 'blur'].forEach(function (ev) { a.addEventListener(ev, rest); }); });
    addEventListener('resize', rest); rest();
  }

  // 4. pricing toggle
  var pr = $('#pricing');
  if (pr) {
    var b = $('.sw button', pr), lbl = function (y) { b.setAttribute('aria-checked', y ? 'true' : 'false'); pr.setAttribute('data-b', y ? 'y' : 'm'); };
    b.addEventListener('click', function () { lbl(b.getAttribute('aria-checked') !== 'true'); });
    lbl(false);
  }

  // 5. hero kanban loop with pause/play
  var board = $('.board');
  if (board) {
    var cards = $$('.card', board), box = $('.cards', board), btn = $('.pp');
    // [col,row] for cards A..E per step; each state keeps every lane tidy (no overlaps)
    var S = [
      [[0, 0], [0, 1], [0, 2], [1, 0], [2, 0]],
      [[1, 1], [0, 0], [0, 1], [1, 0], [2, 0]],
      [[1, 0], [0, 0], [0, 1], [2, 1], [2, 0]],
      [[1, 0], [1, 1], [0, 0], [2, 1], [2, 0]],
      [[2, 2], [1, 0], [0, 0], [2, 1], [2, 0]]
    ];
    var step = 0, t = null, playing = false;
    var put = function (n) { cards.forEach(function (c, i) { c.style.setProperty('--c', S[n][i][0]); c.style.setProperty('--r', S[n][i][1]); c.dataset.c = S[n][i][0]; }); };
    var label = function () { if (btn) { btn.textContent = playing ? 'Pause' : 'Play'; btn.setAttribute('aria-label', (playing ? 'Pause' : 'Play') + ' the board animation'); } };
    var next = function () {
      if (step === S.length - 1) { // fade out, reset, fade in: avoids cards sweeping backwards
        box.classList.add('fade');
        setTimeout(function () { step = 0; put(0); box.classList.remove('fade'); }, 300);
      } else put(++step);
    };
    var play = function () { if (!t) t = setInterval(next, 1900); playing = true; label(); };
    var stop = function () { clearInterval(t); t = null; playing = false; label(); };
    if (reduce) { put(2); } // static, readable: cards spread across lanes, one done
    else { put(0); play(); }
    if (btn) btn.addEventListener('click', function () { playing ? stop() : play(); });
  }

  // 6. demo form validation (nothing is sent)
  var f = $('#demo-form');
  if (f) {
    f.noValidate = true; // native checks apply only when this script does not run
    var rules = {
      name: function (v) { return v.trim() ? '' : 'Enter your name.'; },
      email: function (v) { return /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(v.trim()) ? '' : 'Enter an email address like name@example.com.'; },
      size: function (v) { return v ? '' : 'Choose a team size.'; }
    }, msg = $('#sent');
    var check = function (k) {
      var el = f.elements[k], e = rules[k](el.value, el), o = $('#err-' + k);
      o.textContent = e; if (e) el.setAttribute('aria-invalid', 'true'); else el.removeAttribute('aria-invalid');
      return !e;
    };
    Object.keys(rules).forEach(function (k) { f.elements[k].addEventListener('blur', function () { check(k); }); });
    f.addEventListener('submit', function (ev) {
      ev.preventDefault(); msg.hidden = true;
      var bad = Object.keys(rules).filter(function (k) { return !check(k); });
      if (bad.length) { f.elements[bad[0]].focus(); return; }
      f.reset(); msg.hidden = false; msg.focus();
    });
  }
})();
