'use strict';

const WS_CONFIG_KEY = 'drone-ws-config-v1';
const listeners = {
  telemetry: [],
  orders: [],
  status: []
};

let socket = null;
let currentUrl = '';
let reconnectTimer = null;
let reconnectAttempts = 0;
let manuallyClosed = false;
let lastStatus = 'local';

function getWsConfig() {
  try {
    const raw = localStorage.getItem(WS_CONFIG_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      return { url: String(data.url || '') };
    }
  } catch (err) {
    // Ignore storage errors.
  }
  return { url: '' };
}

function saveWsConfig(config) {
  try {
    localStorage.setItem(WS_CONFIG_KEY, JSON.stringify({ url: String(config.url || '') }));
  } catch (err) {
    // Ignore storage errors.
  }
}

function emit(event, data) {
  (listeners[event] || []).forEach((callback) => {
    try {
      callback(data);
    } catch (err) {
      // Ignore listener errors.
    }
  });
}

function statusText() {
  if (lastStatus === 'connected') return 'WebSocket 已连接';
  if (lastStatus === 'connecting') return '正在连接';
  if (lastStatus === 'reconnecting') return '正在重连';
  return '本地模拟';
}

function updateStatusUI() {
  document.querySelectorAll('[data-realtime-status]').forEach((el) => {
    el.textContent = statusText();
    el.classList.toggle('connected', lastStatus === 'connected');
  });
}

function setStatus(status) {
  lastStatus = status;
  updateStatusUI();
  emit('status', { status, text: statusText() });
}

function handleMessage(message) {
  if (!message || typeof message !== 'object') return;
  if (message.type === 'telemetry') emit('telemetry', message);
  if (message.type === 'orders') emit('orders', message);
}

function scheduleReconnect() {
  if (manuallyClosed) return;
  setStatus('reconnecting');
  const delay = Math.min(10000, 1500 + reconnectAttempts * 1200);
  reconnectAttempts += 1;
  clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(() => connect(currentUrl), delay);
}

function connect(url) {
  const target = url || getWsConfig().url;
  currentUrl = target;
  if (!target) {
    disconnect();
    return;
  }
  manuallyClosed = false;
  if (socket) {
    socket.onclose = null;
    socket.close();
    socket = null;
  }
  setStatus('connecting');
  const ws = new WebSocket(target);
  socket = ws;

  ws.onopen = () => {
    reconnectAttempts = 0;
    setStatus('connected');
    ws.send(JSON.stringify({ type: 'subscribe', channels: ['telemetry', 'orders'] }));
  };
  ws.onmessage = (event) => {
    try {
      handleMessage(JSON.parse(event.data));
    } catch (err) {
      // Ignore malformed messages.
    }
  };
  ws.onclose = () => {
    if (socket === ws) {
      socket = null;
      scheduleReconnect();
    }
  };
  ws.onerror = () => {
    // onclose follows.
  };
}

function disconnect() {
  manuallyClosed = true;
  clearTimeout(reconnectTimer);
  if (socket) {
    socket.onclose = null;
    socket.close();
    socket = null;
  }
  setStatus('local');
}

function send(message) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(message));
  }
}

function isConnected() {
  return Boolean(socket && socket.readyState === WebSocket.OPEN);
}

document.addEventListener('click', (e) => {
  if (e.target.closest('[data-ws-config-open]')) {
    const modal = document.getElementById('ws-config-modal');
    const form = document.getElementById('ws-config-form');
    if (!modal || !form) return;
    const config = getWsConfig();
    form.querySelector('[name="wsUrl"]').value = config.url;
    modal.classList.remove('hidden');
    return;
  }
  if (e.target.closest('[data-ws-config-close]') || e.target.id === 'ws-config-modal') {
    const modal = document.getElementById('ws-config-modal');
    if (modal) modal.classList.add('hidden');
  }
});

document.addEventListener('submit', (e) => {
  if (e.target.id !== 'ws-config-form') return;
  e.preventDefault();
  const data = new FormData(e.target);
  const url = String(data.get('wsUrl') || '').trim();
  saveWsConfig({ url });
  const modal = document.getElementById('ws-config-modal');
  if (modal) modal.classList.add('hidden');
  if (url) connect(url);
  else disconnect();
});

window.Realtime = {
  getConfig: getWsConfig,
  saveConfig: saveWsConfig,
  connect,
  disconnect,
  send,
  isConnected,
  statusText,
  on(event, callback) {
    if (!listeners[event]) listeners[event] = [];
    listeners[event].push(callback);
  }
};

const initialConfig = getWsConfig();
if (initialConfig.url) connect(initialConfig.url);
else setStatus('local');
