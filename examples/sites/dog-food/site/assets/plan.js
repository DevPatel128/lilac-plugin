// Biscuit & Bowl (FICTIONAL SAMPLE): products page. Filter by life stage, pick items, show a sample summary, clear. No storage, no network.
(function () {
  var items = Array.prototype.slice.call(document.querySelectorAll('.product'));
  var chosen = {}; // id -> {name, price}
  var chips = document.querySelectorAll('[data-filter]');
  var list = document.getElementById('chosen'), empty = document.getElementById('empty');
  var total = document.getElementById('total'), count = document.getElementById('count');
  var rm = matchMedia('(prefers-reduced-motion: reduce)'), seen = {}, cur = 0, raf = 0, tm = 0;
  function money(n) { return 'BB$ ' + n.toFixed(2); }
  function render() {
    var ids = Object.keys(chosen), sum = 0;
    list.textContent = '';
    ids.forEach(function (id) {
      var li = document.createElement('li');
      var a = document.createElement('span'); a.textContent = chosen[id].name;
      var b = document.createElement('span'); b.textContent = money(chosen[id].price);
      if (!seen[id]) li.className = 'slide';
      li.appendChild(a); li.appendChild(b); list.appendChild(li); sum += chosen[id].price;
    });
    seen = {}; ids.forEach(function (id) { seen[id] = 1; });
    empty.hidden = ids.length > 0; setTotal(sum);
    document.getElementById('plan-line').textContent = ids.length ? 'Your plan: ' + ids.length + (ids.length === 1 ? ' item, ' : ' items, ') + money(sum) + '.' : 'Your plan: nothing chosen yet.';
  }
  // total counts to its new value (text only; the wrapper just pulses with transform)
  function setTotal(to) {
    cancelAnimationFrame(raf); clearTimeout(tm);
    if (rm.matches || to === cur) { cur = to; total.textContent = money(to); return; }
    var from = cur, t0 = 0;
    tm = setTimeout(function () { cancelAnimationFrame(raf); cur = to; total.textContent = money(to); }, 520); // exact final value even if frames are throttled
    total.classList.remove('bump'); void total.offsetWidth; total.classList.add('bump');
    (function step(t) {
      t0 = t0 || t; var k = Math.min((t - t0) / 450, 1);
      cur = k < 1 ? from + (to - from) * (1 - Math.pow(1 - k, 3)) : to; total.textContent = money(cur);
      if (k < 1) raf = requestAnimationFrame(step);
    })(performance.now());
  }
  chips.forEach(function (chip) {
    chip.addEventListener('click', function () {
      var f = chip.getAttribute('data-filter'), n = 0;
      chips.forEach(function (c) { c.setAttribute('aria-pressed', String(c === chip)); });
      items.forEach(function (p, i) {
        var show = f === 'all' || p.dataset.stage === f;
        if (show) {
          n++; p.classList.remove('leaving');
          if (p.hidden) { p.hidden = false; p.classList.remove('rv', 'in'); p.style.transitionDelay = ''; if (!rm.matches) { p.style.animationDelay = (n - 1) * 60 + 'ms'; p.classList.add('pop'); setTimeout(function () { p.classList.remove('pop'); p.style.animationDelay = ''; }, 700); } }
        } else if (!p.hidden && !p.classList.contains('leaving')) {
          if (rm.matches) p.hidden = true;
          else { p.classList.add('leaving'); setTimeout(function () { if (p.classList.contains('leaving')) { p.hidden = true; p.classList.remove('leaving'); } }, 200); }
        }
      });
      count.textContent = 'Showing ' + n + ' of ' + items.length + ' products.';
    });
  });
  items.forEach(function (p) {
    var btn = p.querySelector('[data-add]');
    btn.addEventListener('click', function () {
      var id = p.dataset.id, on = !(id in chosen);
      if (on) chosen[id] = { name: p.dataset.name, price: parseFloat(p.dataset.price) }; else delete chosen[id];
      btn.setAttribute('aria-pressed', String(on)); btn.textContent = on ? 'Remove from plan' : 'Add to plan';
      render();
    });
  });
  document.getElementById('clear').addEventListener('click', function () {
    chosen = {};
    items.forEach(function (p) { var b = p.querySelector('[data-add]'); b.setAttribute('aria-pressed', 'false'); b.textContent = 'Add to plan'; });
    render();
  });
  render();
})();
