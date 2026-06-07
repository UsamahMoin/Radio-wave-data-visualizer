const messageInput = document.getElementById('message');
const modeSelect = document.getElementById('modeSelect');
const modeButton = document.getElementById('modeButton');
const modeButtonText = document.getElementById('modeButtonText');
const modeMenu = document.getElementById('modeMenu');
const modeOptions = Array.from(document.querySelectorAll('[data-mode]'));
const zoomInput = document.getElementById('zoom');
const zoomLabel = document.getElementById('zoomLabel');
const bitsOutput = document.getElementById('bitsOutput');
const dataCanvas = document.getElementById('dataCanvas');
const pauseBtn = document.getElementById('pauseBtn');
const clearBtn = document.getElementById('clearBtn');
const bandButtons = Array.from(document.querySelectorAll('[data-band]'));
const bandStatus = document.getElementById('bandStatus');
const bandwidthStatus = document.getElementById('bandwidthStatus');
const messageStatus = document.getElementById('messageStatus');

const encoder = new TextEncoder();
const BASE_BITS_PER_SECOND = 0.65;
const BANDS = {
  '2.4': {
    label: '2.4 GHz',
    bandwidth: 20,
    relativeBandwidth: 1,
    carrierCycles: 2,
    fskZeroCycles: 2,
    fskOneCycles: 3
  },
  '5': {
    label: '5 GHz',
    bandwidth: 80,
    relativeBandwidth: 4,
    carrierCycles: 3,
    fskZeroCycles: 3,
    fskOneCycles: 5
  },
  '6': {
    label: '6 GHz',
    bandwidth: 160,
    relativeBandwidth: 8,
    carrierCycles: 4,
    fskZeroCycles: 4,
    fskOneCycles: 6
  }
};

let selectedBand = '2.4';
let selectedMode = 'ask';
let running = true;
let streamPositionBits = 0;
let carrierPhase = 0;
let lastTime = 0;

function textToBytes(text) {
  return Array.from(encoder.encode(text));
}

function textToBits(text) {
  return textToBytes(text).flatMap(byte =>
    byte.toString(2).padStart(8, '0').split('').map(Number)
  );
}

function modulo(value, divisor) {
  return ((value % divisor) + divisor) % divisor;
}

function escapeHtml(value) {
  return value.replace(/[&<>"]/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;'
  })[char]);
}

function setupCanvas(canvas) {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const targetWidth = Math.max(1, Math.floor(rect.width * dpr));
  const targetHeight = Math.max(1, Math.floor(rect.height * dpr));

  if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
    canvas.width = targetWidth;
    canvas.height = targetHeight;
  }

  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, width: rect.width, height: rect.height };
}

function drawGrid(ctx, width, height) {
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#fbfdff';
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = '#e5ecf5';
  ctx.lineWidth = 1;
  for (let x = 0; x <= width; x += 54) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y <= height; y += 44) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  ctx.strokeStyle = '#c9d5e4';
  ctx.beginPath();
  ctx.moveTo(0, height / 2);
  ctx.lineTo(width, height / 2);
  ctx.stroke();
}

function drawBitSlices(ctx, bits, visibleBits, bitWidth, width, height) {
  const firstStreamIndex = Math.floor(streamPositionBits);
  const fraction = streamPositionBits - firstStreamIndex;

  ctx.font = '800 15px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  for (let slot = -1; slot <= visibleBits; slot++) {
    const streamIndex = firstStreamIndex + slot;
    const bitIndex = modulo(streamIndex, bits.length);
    const bit = bits[bitIndex];
    const x0 = (slot - fraction) * bitWidth;
    const x1 = x0 + bitWidth;

    if (x1 < 0 || x0 > width) continue;

    ctx.fillStyle = bit ? 'rgba(22, 163, 74, 0.11)' : 'rgba(37, 99, 235, 0.065)';
    ctx.fillRect(x0, 0, bitWidth, height);
    ctx.strokeStyle = bitIndex % 8 === 0
      ? 'rgba(15, 23, 42, 0.48)'
      : bit
        ? 'rgba(22, 163, 74, 0.30)'
        : 'rgba(37, 99, 235, 0.22)';
    ctx.lineWidth = bitIndex % 8 === 0 ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(x0, 0);
    ctx.lineTo(x0, height);
    ctx.stroke();

    const labelX = x0 + bitWidth / 2;
    if (labelX >= 0 && labelX <= width) {
      ctx.fillStyle = bit ? '#15803d' : '#1d4ed8';
      ctx.fillText(String(bit), labelX, 14);

      if (bitIndex % 8 === 0 && bitWidth > 48) {
        ctx.fillStyle = '#475569';
        ctx.font = '700 10px system-ui, sans-serif';
        ctx.fillText(`byte ${Math.floor(bitIndex / 8) + 1}`, labelX, 35);
        ctx.font = '800 15px system-ui, sans-serif';
      }
    }
  }
}

function buildFskCyclePlan(bits, band) {
  const counts = bits.map(bit => bit ? band.fskOneCycles : band.fskZeroCycles);
  const offsets = [0];
  for (const count of counts) {
    offsets.push(offsets[offsets.length - 1] + count);
  }
  return {
    counts,
    offsets,
    periodCycles: offsets[offsets.length - 1]
  };
}

function fskPhaseCycles(logicalBit, bits, cyclePlan) {
  const streamIndex = Math.floor(logicalBit);
  const local = logicalBit - streamIndex;
  const loop = Math.floor(streamIndex / bits.length);
  const bitIndex = modulo(streamIndex, bits.length);
  return (
    loop * cyclePlan.periodCycles +
    cyclePlan.offsets[bitIndex] +
    local * cyclePlan.counts[bitIndex]
  );
}

function updateSignalStatus(bits, band) {
  bandStatus.textContent = band.label;
  bandwidthStatus.textContent = `${band.bandwidth} MHz example channel`;

  if (!bits.length) {
    messageStatus.textContent = 'Waiting for a message';
    return;
  }

  const passingBit = modulo(Math.floor(streamPositionBits), bits.length) + 1;
  messageStatus.textContent = `${bits.length} bits looping • bit ${passingBit} passing`;
}

function drawEmptyState(ctx, width, height) {
  ctx.fillStyle = '#0f172a';
  ctx.font = '800 20px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Type a message to start the transmission', width / 2, height / 2 - 10);
  ctx.fillStyle = '#64748b';
  ctx.font = '500 14px system-ui, sans-serif';
  ctx.fillText('No unmodulated carrier is shown.', width / 2, height / 2 + 20);
}

function drawDataWave() {
  const bits = textToBits(messageInput.value);
  const band = BANDS[selectedBand];
  const { ctx, width, height } = setupCanvas(dataCanvas);
  drawGrid(ctx, width, height);
  updateSignalStatus(bits, band);

  const visibleBits = Number(zoomInput.value);
  zoomLabel.textContent = String(visibleBits);

  if (!bits.length) {
    drawEmptyState(ctx, width, height);
    return;
  }

  const bitWidth = width / visibleBits;
  drawBitSlices(ctx, bits, visibleBits, bitWidth, width, height);

  const center = height / 2 + 6;
  const baseAmplitude = height * 0.28;
  const cyclePlan = selectedMode === 'fsk'
    ? buildFskCyclePlan(bits, band)
    : null;

  ctx.beginPath();
  for (let x = 0; x <= width; x++) {
    const logicalBit = streamPositionBits + x / bitWidth;
    const streamIndex = Math.floor(logicalBit);
    const bitIndex = modulo(streamIndex, bits.length);
    const bit = bits[bitIndex];
    let amplitude = baseAmplitude;
    let angle;

    if (selectedMode === 'ask') {
      amplitude = bit ? baseAmplitude : baseAmplitude * 0.34;
      angle = logicalBit * band.carrierCycles * Math.PI * 2 + carrierPhase;
    } else if (selectedMode === 'fsk') {
      angle = fskPhaseCycles(logicalBit, bits, cyclePlan) * Math.PI * 2 + carrierPhase;
    } else {
      const bitPhase = bit ? Math.PI : 0;
      angle = logicalBit * band.carrierCycles * Math.PI * 2 + carrierPhase + bitPhase;
    }

    const y = center - Math.sin(angle) * amplitude;
    if (x === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }

  ctx.strokeStyle = '#16a34a';
  ctx.lineWidth = 3;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();

  const modeText = {
    ask: 'ASK: 1 uses greater amplitude; 0 uses lower amplitude.',
    fsk: 'FSK: 1 uses a higher tone; 0 uses a lower tone.',
    psk: 'PSK: the carrier phase changes with the bit.'
  }[selectedMode];

  ctx.fillStyle = '#334155';
  ctx.font = '600 13px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(modeText, 18, height - 18);
}

function renderBits() {
  const text = messageInput.value;
  if (!text) {
    bitsOutput.innerHTML = '<span class="muted">Type a message to see its UTF-8 bytes.</span>';
    return;
  }

  const html = Array.from(text).map(char => {
    const bytes = textToBytes(char);
    const binary = bytes
      .map(byte => byte.toString(2).padStart(8, '0'))
      .join(' ');
    const label = char === ' ' ? 'space' : escapeHtml(char);
    return `<span class="bit-token">${label}: ${binary}</span>`;
  }).join('');

  bitsOutput.innerHTML = html;
}

function drawAll() {
  renderBits();
  drawDataWave();
}

function animate(time) {
  if (!lastTime) lastTime = time;
  const delta = Math.min(time - lastTime, 50);
  lastTime = time;

  if (running) {
    const bits = textToBits(messageInput.value);
    const band = BANDS[selectedBand];
    if (bits.length) {
      const bitsPerSecond = BASE_BITS_PER_SECOND * band.relativeBandwidth;
      streamPositionBits = modulo(
        streamPositionBits + (delta / 1000) * bitsPerSecond,
        bits.length
      );
      carrierPhase = modulo(carrierPhase + delta * 0.008, Math.PI * 2);
    }
    drawDataWave();
  }

  requestAnimationFrame(animate);
}

messageInput.addEventListener('input', () => {
  streamPositionBits = 0;
  drawAll();
});

zoomInput.addEventListener('input', drawDataWave);
window.addEventListener('resize', drawDataWave);

function setModeMenuOpen(open, focusSelected = false) {
  modeMenu.hidden = !open;
  modeButton.setAttribute('aria-expanded', String(open));
  modeSelect.classList.toggle('is-open', open);

  if (open && focusSelected) {
    modeOptions.find(option => option.dataset.mode === selectedMode)?.focus();
  }
}

function chooseMode(option) {
  selectedMode = option.dataset.mode;
  modeButtonText.textContent = `${option.querySelector('strong').textContent}: ${option.querySelector('small').textContent.toLowerCase()}`;
  modeOptions.forEach(candidate => {
    const selected = candidate === option;
    candidate.classList.toggle('is-selected', selected);
    candidate.setAttribute('aria-checked', String(selected));
  });
  setModeMenuOpen(false);
  modeButton.focus();
  drawDataWave();
}

modeButton.addEventListener('click', () => {
  setModeMenuOpen(modeMenu.hidden);
});

modeButton.addEventListener('keydown', event => {
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault();
    setModeMenuOpen(true, true);
  }
});

modeOptions.forEach((option, index) => {
  option.addEventListener('click', () => chooseMode(option));
  option.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      chooseMode(option);
      return;
    }

    if (event.key === 'Escape') {
      setModeMenuOpen(false);
      modeButton.focus();
      return;
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      modeOptions[modulo(index + direction, modeOptions.length)].focus();
    }
  });
});

document.addEventListener('click', event => {
  if (!modeSelect.contains(event.target)) {
    setModeMenuOpen(false);
  }
});

bandButtons.forEach(button => {
  button.addEventListener('click', () => {
    selectedBand = button.dataset.band;
    bandButtons.forEach(candidate => {
      const active = candidate === button;
      candidate.classList.toggle('is-active', active);
      candidate.setAttribute('aria-pressed', String(active));
    });
    drawDataWave();
  });
});

pauseBtn.addEventListener('click', () => {
  running = !running;
  pauseBtn.textContent = running ? 'Pause' : 'Play';
  pauseBtn.setAttribute('aria-pressed', String(!running));
  drawDataWave();
});

clearBtn.addEventListener('click', () => {
  messageInput.value = '';
  streamPositionBits = 0;
  drawAll();
  messageInput.focus();
});

drawAll();
requestAnimationFrame(animate);
