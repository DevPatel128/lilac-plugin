// Corner Kiln (fictional demo): reveal on scroll, menu filter, today's hours, motion pause, booking form check. No network.
(function () {
  var d = document, root = d.documentElement;

  // Reveal + underline draw. Without IntersectionObserver everything is shown at once.
  var targets = d.querySelectorAll('.reveal, .draw');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { threshold: 0.15 });
    targets.forEach(function (t) { io.observe(t); });
  } else targets.forEach(function (t) { t.classList.add('in'); });

  // Pause / play for continuous animation (steam, proving loaf).
  var btns = d.querySelectorAll('[data-motion-toggle]');
  function paint() {
    var p = root.classList.contains('paused');
    btns.forEach(function (b) { b.setAttribute('aria-pressed', String(p)); b.textContent = p ? 'Play motion' : 'Pause motion'; });
  }
  try { if (sessionStorage.getItem('ck-paused') === '1') root.classList.add('paused'); } catch (e) { /* storage blocked: fine */ }
  btns.forEach(function (b) {
    b.addEventListener('click', function () {
      root.classList.toggle('paused');
      try { sessionStorage.setItem('ck-paused', root.classList.contains('paused') ? '1' : '0'); } catch (e) { /* ignore */ }
      paint();
    });
  });
  paint();

  // Menu filter: sections carry data-cat; chips carry data-filter.
  var chips = d.querySelectorAll('.chip[data-filter]');
  chips.forEach(function (c) {
    c.addEventListener('click', function () {
      var f = c.getAttribute('data-filter');
      chips.forEach(function (o) { o.setAttribute('aria-pressed', String(o === c)); });
      d.querySelectorAll('[data-cat]').forEach(function (s) { s.hidden = !(f === 'all' || s.getAttribute('data-cat') === f); });
      var live = d.getElementById('filter-status');
      if (live) live.textContent = f === 'all' ? 'Showing every category.' : 'Showing ' + c.textContent + ' only.';
    });
  });

  // Highlight today's row (uses the visitor's device clock).
  var row = d.querySelector('tr[data-day="' + new Date().getDay() + '"]');
  if (row) {
    row.classList.add('today');
    var cell = row.querySelector('th');
    if (cell) { var b = d.createElement('span'); b.className = 'badge'; b.textContent = 'Today'; cell.appendChild(b); }
  }

  // Booking form: validate in the browser, then say nothing was sent.
  var form = d.getElementById('booking');
  if (form) {
    form.noValidate = true; // native checks apply only when this script does not run
    // Error prevention (UX-0085): no booking in the past. Uses the visitor's device clock, local date.
    var t = new Date(), today = t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0');
    form.elements.date.min = today;
    var rules = {
      name: function (v) { return v.trim().length < 2 ? 'Please enter a name (at least 2 characters).' : ''; },
      email: function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? '' : 'Please enter an email like name@example.test.'; },
      date: function (v) { return !v ? 'Please pick a day.' : v < today ? 'Please pick today or a later day.' : ''; },
      guests: function (v) { var n = Number(v); return n >= 1 && n <= 12 && Math.floor(n) === n ? '' : 'Please choose 1 to 12 guests.'; }
    };
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var first = null;
      Object.keys(rules).forEach(function (k) {
        var el = form.elements[k], msg = rules[k](el.value), out = d.getElementById(k + '-err');
        el.setAttribute('aria-invalid', msg ? 'true' : 'false');
        out.textContent = msg;
        if (msg && !first) first = el;
      });
      var ok = d.getElementById('booking-ok');
      if (first) { ok.classList.remove('show'); first.focus(); return; }
      ok.classList.add('show');
      ok.focus();
      form.reset();
    });
  }
})();
