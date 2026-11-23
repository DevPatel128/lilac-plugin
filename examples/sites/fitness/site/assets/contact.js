// Trial-class form: browser-side validation only. Nothing is sent anywhere.
(function () {
  var f = document.getElementById('trial');
  if (!f) return;
  f.noValidate = true;
  var out = document.getElementById('result');
  var rules = {
    name: function (v) { return v.trim().length < 2 ? 'Enter your name (at least 2 characters).' : ''; },
    email: function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? '' : 'Enter an email like name@example.com.'; },
    cls: function (v) { return v ? '' : 'Choose a class.'; },
    day: function (v) { return v ? '' : 'Choose a day.'; },
    level: function (v) { return v ? '' : 'Choose a level.'; }
  };
  function check(el) {
    var m = rules[el.id](el.value), e = document.getElementById('e-' + el.id);
    e.textContent = m; el.setAttribute('aria-invalid', m ? 'true' : 'false');
    return !m;
  }
  Object.keys(rules).forEach(function (k) {
    f.elements[k].addEventListener('blur', function () { check(f.elements[k]); });
  });
  f.addEventListener('submit', function (ev) {
    ev.preventDefault();
    var bad = Object.keys(rules).filter(function (k) { return !check(f.elements[k]); });
    if (bad.length) { out.textContent = ''; f.elements[bad[0]].focus(); return; }
    out.textContent = 'Demo: nothing was sent. Still Water is a fictional studio, so no one received this request.';
    out.className = 'ok';
    out.focus();
  });
})();
