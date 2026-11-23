// Runs before first paint (classic script, no inline code allowed by the CSP): apply saved theme and motion settings.
try {
  var s = JSON.parse(localStorage.getItem('pocket-habits') || '{}').settings || {};
  if (s.theme === 'light' || s.theme === 'dark') document.documentElement.dataset.theme = s.theme;
  if (s.motion === 'off') document.documentElement.dataset.motion = 'off';
} catch (e) { /* no storage: defaults apply */ }
