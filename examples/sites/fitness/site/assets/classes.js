// Timetable filters by day and level. Without JS the whole table shows. Rows slide in (transform/opacity) on change.
(function () {
  var rows = [].slice.call(document.querySelectorAll('#tt tbody tr'));
  var host = document.getElementById('filters');
  if (!rows.length || !host) return;
  var days = ['Any', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], levels = ['Any', 'Beginner', 'All levels', 'Experienced'];
  var state = { day: 'Any', level: 'Any' }, count = document.getElementById('count');
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function group(key, label, opts) {
    var f = document.createElement('fieldset'), l = document.createElement('legend'), c = document.createElement('div');
    l.textContent = label; c.className = 'chips'; f.appendChild(l); f.appendChild(c);
    opts.forEach(function (o) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'chip'; b.textContent = o; b.setAttribute('aria-pressed', String(o === 'Any'));
      b.addEventListener('click', function () {
        state[key] = o;
        [].forEach.call(c.children, function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        apply();
      });
      c.appendChild(b);
    });
    host.appendChild(f);
  }
  group('day', 'Day', days); group('level', 'Level', levels);
  function apply() {
    var n = 0;
    rows.forEach(function (r) {
      var ok = (state.day === 'Any' || r.dataset.day === state.day) && (state.level === 'Any' || r.dataset.level === state.level);
      r.hidden = !ok;
      r.classList.remove('enter');
      if (ok) {
        if (!reduce) { void r.offsetWidth; r.style.setProperty('--d', n * 45 + 'ms'); r.classList.add('enter'); }
        n++;
      }
    });
    count.textContent = n ? 'Showing ' + n + ' of ' + rows.length + ' sample classes.' : 'No sample class matches. Choose Any for day or level.';
  }
  var reset = document.createElement('button');
  reset.type = 'button'; reset.className = 'btn ghost sm'; reset.textContent = 'Show all classes'; reset.hidden = true;
  reset.addEventListener('click', function () {
    state.day = 'Any'; state.level = 'Any';
    [].forEach.call(host.querySelectorAll('.chip'), function (x) { x.setAttribute('aria-pressed', String(x.textContent === 'Any')); });
    apply();
  });
  count.parentNode.insertBefore(reset, count.nextSibling);
  var base = apply;
  apply = function () { base(); reset.hidden = state.day === 'Any' && state.level === 'Any'; };
  apply();
})();
