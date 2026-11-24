// Renders tour dates into an element. Empty or missing data -> UNKNOWN text. Never invents dates.
function lilacRenderTour(el, dates) {
  if (!Array.isArray(dates) || !dates.length) { el.textContent = 'UNKNOWN: no tour dates supplied'; return; }
  el.textContent = '';
  var ul = document.createElement('ul');
  dates.forEach(function (d) { var li = document.createElement('li'); li.textContent = [d.date, d.city, d.venue].filter(Boolean).join(' - '); ul.appendChild(li); });
  el.appendChild(ul);
}
if (typeof module !== 'undefined') module.exports = { lilacRenderTour: lilacRenderTour };
