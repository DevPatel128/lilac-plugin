// Persistent player. One <audio> outside #swap; fetch-and-swap of <main> keeps audio playing. No autoplay, no network at load.
(function () {
  var audio = document.getElementById('audio'), btn = document.getElementById('play'), now = document.getElementById('now');
  function toggle() { if (!audio.src) return; if (audio.paused) audio.play(); else audio.pause(); }
  btn.addEventListener('click', toggle);
  audio.addEventListener('play', function () { btn.textContent = 'Pause'; btn.setAttribute('aria-label', 'Pause'); });
  audio.addEventListener('pause', function () { btn.textContent = 'Play'; btn.setAttribute('aria-label', 'Play'); });
  // keyboard: Space or K toggles, unless the user is typing or on another control
  document.addEventListener('keydown', function (e) {
    var t = e.target, tag = t && t.tagName;
    if (/^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(tag) || (t && t.isContentEditable)) return;
    if (e.key === ' ' || e.key === 'k' || e.key === 'K') { e.preventDefault(); toggle(); }
  });
  window.lilacPlay = function (src, title, artist) {
    audio.src = src; now.textContent = title; audio.play();
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({ title: title, artist: artist || '' });
      navigator.mediaSession.setActionHandler('play', function () { audio.play(); });
      navigator.mediaSession.setActionHandler('pause', function () { audio.pause(); });
    }
  };
  // fetch-and-swap navigation; any failure falls back to a normal page load
  function swap(url, push) {
    var main = document.getElementById('swap');
    fetch(url).then(function (r) { if (!r.ok) throw 0; return r.text(); }).then(function (html) {
      var next = new DOMParser().parseFromString(html, 'text/html').getElementById('swap');
      if (!next) throw 0;
      main.innerHTML = next.innerHTML; document.title = new DOMParser().parseFromString(html, 'text/html').title;
      if (push) history.pushState(null, '', url);
      main.focus();
    }).catch(function () { location.href = url; });
  }
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a || a.target || e.metaKey || e.ctrlKey || e.shiftKey || a.origin !== location.origin || a.hash && a.pathname === location.pathname) return;
    e.preventDefault(); swap(a.href, true);
  });
  window.addEventListener('popstate', function () { swap(location.href, false); });
})();
