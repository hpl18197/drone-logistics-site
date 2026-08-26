'use strict';

let orders = loadOrders();
let currentId = null;

const listEl = document.getElementById('order-list');
const countEl = document.getElementById('order-count');
const modalEl = document.getElementById('track-modal');
const trackTitleEl = document.getElementById('track-title');
const trackBodyEl = document.getElementById('track-body');

const CUSTOMER_STATUS = {
  '待调度': '已接单',
  '待拣货': '仓库准备中',
  '待起飞': '等待起飞',
  '飞行中': '配送中',
  '待校验': '即将到达',
  '待交付': '待签收',
  '已完成': '已完成'
};

const STATUS_CLASS = {
  '待调度': 'gray',
  '待拣货': 'blue',
  '待起飞': 'violet',
  '飞行中': 'teal',
  '待校验': 'amber',
  '待交付': 'green',
  '已完成': 'green'
};

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c]));
}

function nowTime() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function customerStatus(status) {
  return CUSTOMER_STATUS[status] || status;
}

function statusBadge(status) {
  return `<span class="badge ${STATUS_CLASS[status] || 'gray'}">${esc(customerStatus(status))}</span>`;
}

function customerProgress(order) {
  if (order.status === '待调度') return 5;
  if (order.status === '待拣货') return 25;
  if (order.status === '待起飞') return 40;
  if (order.status === '飞行中') return Math.round(order.progress || 0);
  if (order.status === '待校验') return 92;
  if (order.status === '待交付') return 96;
  if (order.status === '已完成') return 100;
  return 0;
}

function orderCard(order) {
  const action = order.status === '待交付'
    ? `<button class="btn success" data-action="sign" data-id="${esc(order.id)}"><i data-lucide="user-check"></i>确认签收</button>`
    : `<button class="btn" data-action="track" data-id="${esc(order.id)}"><i data-lucide="navigation"></i>查看进度</button>`;
  return `
    <div class="order-card">
      <div class="order-card-main">
        <div class="order-title">${esc(order.id)} · ${esc(order.customer)}</div>
        <div class="order-meta">${esc(order.cargoType)} · ${order.weightKg} kg · ${order.distanceKm} km</div>
      </div>
      <div class="order-card-actions">
        ${statusBadge(order.status)}
        ${action}
      </div>
    </div>
  `;
}

function renderOrderList() {
  if (!orders.length) {
    listEl.innerHTML = '<div class="empty">暂无订单</div>';
    countEl.textContent = '0';
    return;
  }
  listEl.innerHTML = orders.map(orderCard).join('');
  countEl.textContent = String(orders.length);
}

function timelineSteps(order) {
  const status = order.status;
  const steps = [
    { name: '订单提交', done: true },
    { name: '智能调度', done: status !== '待调度' },
    { name: '仓库装载', done: ['待起飞', '飞行中', '待校验', '待交付', '已完成'].includes(status) },
    { name: '飞行配送', done: ['飞行中', '待校验', '待交付', '已完成'].includes(status) },
    { name: '客户签收', done: ['待交付', '已完成'].includes(status) }
  ];
  const activeIndex = steps.findIndex((s) => !s.done);
  return steps.map((s, i) => {
    const state = s.done ? 'done' : i === activeIndex ? 'active' : '';
    return `
      <div class="timeline-step ${state}">
        <span class="timeline-dot"></span>
        <div class="timeline-name">${s.name}</div>
        <div class="timeline-sub">${s.done ? '已完成' : state === 'active' ? '进行中' : '待进行'}</div>
      </div>
    `;
  }).join('');
}

function trackAction(order) {
  if (order.status === '待交付') {
    return `
      <div class="operation-area">
        <div class="badge green">无人机已到达</div>
        <div class="operation-actions">
          <button class="btn success" data-action="sign" data-id="${esc(order.id)}">
            <i data-lucide="user-check"></i>确认签收
          </button>
        </div>
      </div>
    `;
  }
  if (order.status === '已完成') {
    return `
      <div class="operation-area">
        <div class="badge green">配送已完成</div>
        <div class="order-meta" style="margin-top:8px">签收时间：${esc(order.deliveredAt || '-')}</div>
      </div>
    `;
  }
  return `
    <div class="operation-area">
      <div class="badge teal">工作人员处理中</div>
    </div>
  `;
}

function renderTrack() {
  const order = orders.find((o) => o.id === currentId);
  if (!order) {
    modalEl.classList.add('hidden');
    return;
  }
  trackTitleEl.textContent = `${order.id} 配送跟踪`;
  const progress = customerProgress(order);
  trackBodyEl.innerHTML = `
    <div class="detail-list">
      <div class="detail-row"><span class="detail-label">收货人</span><span class="detail-value">${esc(order.customer)}</span></div>
      <div class="detail-row"><span class="detail-label">收货地址</span><span class="detail-value">${esc(order.address)}</span></div>
      <div class="detail-row"><span class="detail-label">货物</span><span class="detail-value">${esc(order.cargoType)} · ${order.weightKg} kg</span></div>
      <div class="detail-row"><span class="detail-label">状态</span><span class="detail-value">${statusBadge(order.status)}</span></div>
    </div>
    <div class="progress">
      <div class="progress-head"><span>配送进度</span><strong>${progress}%</strong></div>
      <div class="progress-track"><div class="progress-fill" style="width:${progress}%"></div></div>
    </div>
    <div class="timeline">${timelineSteps(order)}</div>
    <div id="track-map-container"></div>
    ${trackAction(order)}
  `;
  modalEl.classList.remove('hidden');
  if (window.lucide) window.lucide.createIcons();
  MapHelper.renderMap(document.getElementById('track-map-container'), order);
}

function render() {
  renderOrderList();
  renderTrack();
  if (window.lucide) window.lucide.createIcons();
}

function toast(message) {
  const wrap = document.getElementById('toast-wrap');
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = message;
  wrap.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transition = 'opacity 0.2s ease';
    setTimeout(() => el.remove(), 220);
  }, 2400);
}

function signOrder(id) {
  const order = orders.find((o) => o.id === id);
  if (!order || order.status !== '待交付') return;
  order.status = '已完成';
  order.progress = 100;
  order.deliveredAt = nowTime();
  saveOrders(orders);
  render();
  toast(`${order.id} 签收完成`);
}

document.addEventListener('click', (e) => {
  if (e.target.closest('[data-action="track"]')) {
    currentId = e.target.closest('[data-action="track"]').dataset.id;
    render();
    return;
  }
  if (e.target.closest('[data-action="sign"]')) {
    signOrder(e.target.closest('[data-action="sign"]').dataset.id);
    return;
  }
  if (e.target.closest('#close-modal') || e.target.id === 'track-modal') {
    modalEl.classList.add('hidden');
  }
});

document.getElementById('order-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const data = new FormData(e.target);
  const customer = String(data.get('customer') || '').trim();
  const phone = String(data.get('phone') || '').trim();
  const address = String(data.get('address') || '').trim();
  const distance = Number(data.get('distance'));
  const weight = Number(data.get('weight'));
  const cargoType = String(data.get('cargoType'));
  const priority = String(data.get('priority'));

  if (!customer || !phone || !address) {
    toast('请填写完整的收货信息');
    return;
  }
  if (!distance || distance <= 0 || !weight || weight <= 0 || weight > 32) {
    toast('请填写有效的距离和重量');
    return;
  }

  const order = {
    id: nextOrderId(orders),
    customer,
    phone,
    address,
    weightKg: weight,
    distanceKm: distance,
    cargoType,
    priority,
    status: '待调度',
    droneModel: null,
    droneSerial: null,
    batteryCount: null,
    items: buildItems(cargoType, weight),
    createdAt: nowTime(),
    progress: 0,
    checks: { data: false, visual: false },
    startedAt: null,
    deliveredAt: null
  };
  orders.unshift(order);
  saveOrders(orders);
  currentId = order.id;
  render();
  toast(`订单 ${order.id} 已提交`);
});

setInterval(() => {
  const fresh = loadOrders();
  const changed = reconcileOrders(fresh);
  if (changed) saveOrders(fresh);
  if (JSON.stringify(fresh) !== JSON.stringify(orders)) {
    orders = fresh;
    render();
  }
}, 1500);

render();
if (window.lucide) window.lucide.createIcons();
