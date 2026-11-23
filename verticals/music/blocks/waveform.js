// Draws peaks (array of 0..1) on a canvas. No dependency. Optional upgrade: wavesurfer.js v7 with the same peaks.
function lilacDrawWaveform(canvas, peaks) {
  var c = canvas.getContext('2d'), w = canvas.width, h = canvas.height;
  c.clearRect(0, 0, w, h);
  if (!peaks || !peaks.length) { c.fillText('UNKNOWN: no peaks supplied', 8, h / 2); return; }
  var step = w / peaks.length;
  for (var i = 0; i < peaks.length; i++) { var v = Math.max(0, Math.min(1, peaks[i])) * h; c.fillRect(i * step, (h - v) / 2, Math.max(1, step - 1), v); }
}
