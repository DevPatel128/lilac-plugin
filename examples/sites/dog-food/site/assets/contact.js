// Biscuit & Bowl (FICTIONAL SAMPLE): contact form. Validates in the browser, then shows a demo message. Nothing is sent anywhere.
(function () {
  var form = document.getElementById('contact'), result = document.getElementById('result');
  var rules = {
    name: function (v) { return v.trim() ? '' : 'Please tell us your name.'; },
    email: function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) ? '' : 'Please enter an email address like name@example.com.'; },
    topic: function (v) { return v ? '' : 'Please choose a topic.'; },
    msg: function (v) { return v.trim().length >= 10 ? '' : 'Please write at least 10 characters.'; }
  };
  form.noValidate = true; // native checks apply only when this script does not run
  document.getElementById('send').disabled = false;
  var ids = { name: 'name', email: 'email', topic: 'topic', msg: 'msg' };
  function check(k) {
    var el = document.getElementById(ids[k]), msg = rules[k](el.value);
    document.getElementById(ids[k] + '-e').textContent = msg;
    if (msg) el.setAttribute('aria-invalid', 'true'); else el.removeAttribute('aria-invalid');
    return !msg;
  }
  Object.keys(rules).forEach(function (k) {
    document.getElementById(ids[k]).addEventListener('blur', function () { check(k); });
  });
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var bad = Object.keys(rules).filter(function (k) { return !check(k); });
    var sum = document.getElementById('errsum'), ul = sum.querySelector('ul');
    if (bad.length) {
      ul.textContent = '';
      bad.forEach(function (k) {
        var li = document.createElement('li'), a = document.createElement('a');
        a.href = '#' + ids[k]; a.textContent = document.getElementById(ids[k] + '-e').textContent;
        a.addEventListener('click', function (ev) { ev.preventDefault(); document.getElementById(ids[k]).focus(); });
        li.appendChild(a); ul.appendChild(li);
      });
      sum.hidden = false; result.hidden = true; sum.focus(); return;
    }
    sum.hidden = true; form.reset(); result.hidden = false; result.focus();
  });
})();
