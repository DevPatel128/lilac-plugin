// Consent banner: remembers the choice in this browser only (localStorage) and tells the page with a "lilac:consent" event. Nothing is sent anywhere.
(() => {
  const b = document.getElementById('cookie-banner'); if (!b) return;
  let saved = null; try { saved = localStorage.getItem('lilac-consent'); } catch {}
  const say = (v) => document.dispatchEvent(new CustomEvent('lilac:consent', { detail: v }));
  if (saved) return say(saved);
  b.hidden = false;
  b.addEventListener('click', (e) => { const v = e.target.dataset?.consent; if (!v) return; try { localStorage.setItem('lilac-consent', v); } catch {} b.hidden = true; say(v); });
})();
