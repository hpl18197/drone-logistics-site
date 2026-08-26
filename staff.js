'use strict';

let orders = loadOrders();
let currentId = orders[0]?.id || null;

const listEl = document.getElementById('order-list');
const countEl = document.getElementById('order-count');
const detailEl = document.getElementById('detail-body');

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

function statusBadge(status) {
  return `<span class="badge ${STATUS_CLASS[status] || 'gray'}">${esc(status)}</span>`;
}

function cardAction(order) {
  if (order.status === '待调度') return `<button class="btn" data-action="dispatch"><i data-lucide="cpu"></i>智能调度</button>`;
  if (order.status === '待拣货') return `<button class="btn" data-action="pick"><i data-lucide="clipboard-check"></i>完成拣货</button>`;
  if (order.status === '待起飞') return `<button class="btn" data-action="takeoff"><i data-lucide="play"></i>起飞</button>`;
  if (order.status === '飞行中' || order.status === '待校验') return `<button class="btn" data-action="select"><i data-lucide="eye"></i>查看</button>`;
  if (order.status === '待交付') return `<button class="btn" disabled><i data-lucide="package-check"></i>等待签收</button>`;
  return '';
}

function orderCard(order) {
  return `
    <div class="order-card" data-id="${esc(order.id)}">
      <div class="order-card-main">
        <div class="order-title">${esc(order.id)} · ${esc(order.customer)}</div>
        <div class="order-meta">${esc(order.cargoType)} · ${order.weightKg} kg · ${order.distanceKm} km</div>
      </div>
      <div class="order-card-actions">
        ${statusBadge(order.status)}
        ${cardAction(order)}
      </div>
    </div>
  `;
}

function renderList() {
  if (!orders.length) {
    listEl.innerHTML = '<div class="empty">暂无订单</div>';
    countEl.textContent = '0';
    return;
  }
  listEl.innerHTML = orders.map(orderCard).join('');
  countEl.textContent = String(orders.length);
}

function flightProgress(order) {
  if (order.status === '飞行中') return Math.round(order.progress || 0);
  if (order.status === '待校验') return 100;
  if (order.status === '待交付') return 100;
  if (order.status === '已完成') return 100;
  return 0;
}

function operationArea(order) {
  if (order.status === '待调度') {
    return `
      <div class="operation-area">
        <div class="badge gray">待调度</div>
        <div class="operation-actions">
          <button class="btn primary" data-action="dispatch" data-id="${esc(order.id)}">
            <i data-lucide="cpu"></i>智能调度
          </button>
        </div>
      </div>
    `;
  }
  if (order.status === '待拣货') {
    return `
      <div class="operation-area">
        <div class="badge blue">已生成装货清单</div>
        <div class="operation-actions">
          <button class="btn primary" data-action="pick" data-id="${esc(order.id)}">
            <i data-lucide="clipboard-check"></i>完成拣货并绑定
          </button>
        </div>
      </div>
    `;
  }
  if (order.status === '待起飞') {
    return `
      <div class="operation-area">
        <div class="badge violet">待起飞</div>
        <div class="operation-actions">
          <button class="btn primary" data-action="takeoff" data-id="${esc(order.id)}">
            <i data-lucide="play"></i>起飞执行
          </button>
        </div>
      </div>
    `;
  }
  if (order.status === '飞行中') {
    const progress = flightProgress(order);
    return `
      <div class="operation-area">
        <div class="badge teal">飞行中 · 自动巡检</div>
        <div class="progress">
          <div class="progress-head"><span>飞行进度</span><strong>${progress}%</strong></div>
          <div class="progress-track"><div class="progress-fill" style="width:${progress}%"></div></div>
        </div>
      </div>
    `;
  }
  if (order.status === '待校验') {
    const dataOk = order.checks?.data;
    const visualOk = order.checks?.visual;
    const ready = dataOk && visualOk;
    return `
      <div class="operation-area">
        <div class="badge amber">地面站二次校验</div>
        <div class="operation-actions">
          <button class="btn ${dataOk ? 'success' : ''}" data-action="check-data" data-id="${esc(order.id)}">
            <i data-lucide="shield-check"></i>${dataOk ? '数据已核验' : '数据核验'}
          </button>
          <button class="btn ${visualOk ? 'success' : ''}" data-action="check-visual" data-id="${esc(order.id)}">
            <i data-lucide="camera"></i>${visualOk ? '画面已核验' : '画面核验'}
          </button>
          <button class="btn primary" data-action="land" data-id="${esc(order.id)}" ${ready ? '' : 'disabled'}>
            <i data-lucide="navigation"></i>允许降落
          </button>
        </div>
      </div>
    `;
  }
  if (order.status === '待交付') {
    return `
      <div class="operation-area">
        <div class="badge green">等待客户签收</div>
      </div>
    `;
  }
  if (order.status === '已完成') {
    return `
      <div class="operation-area">
        <div class="badge green">任务已完成</div>
        <div class="order-meta" style="margin-top:8px">签收时间：${esc(order.deliveredAt || '-')}</div>
      </div>
    `;
  }
  return '';
}

function renderDetail() {
  const order = orders.find((o) => o.id === currentId) || orders[0];
  if (!order) {
    detailEl.innerHTML = '<div class="empty">暂无订单</div>';
    return;
  }
  currentId = order.id;
  const itemsText = (order.items || []).map((item) => `${esc(item.name)} x ${item.count}`).join('、');
  detailEl.innerHTML = `
    <div class="panel-body">
      <div class="detail-list">
        <div class="detail-row"><span class="detail-label">订单号</span><span class="detail-value">${esc(order.id)}</span></div>
        <div class="detail-row"><span class="detail-label">客户</span><span class="detail-value">${esc(order.customer)}</span></div>
        <div class="detail-row"><span class="detail-label">地址</span><span class="detail-value">${esc(order.address)}</span></div>
        <div class="detail-row"><span class="detail-label">重量 / 距离</span><span class="detail-value">${order.weightKg} kg / ${order.distanceKm} km</span></div>
        <div class="detail-row"><span class="detail-label">装货清单</span><span class="detail-value">${itemsText || '-'}</span></div>
        <div class="detail-row"><span class="detail-label">无人机</span><span class="detail-value">${esc(order.droneSerial || order.droneModel || '待匹配')}</span></div>
        <div class="detail-row"><span class="detail-label">电池</span><span class="detail-value">${order.batteryCount ? `${order.batteryCount} 组` : '-'}</span></div>
        <div class="detail-row"><span class="detail-label">状态</span><span class="detail-value">${statusBadge(order.status)}</span></div>
      </div>
    </div>
    <div class="detail-map" id="detail-map"></div>
    ${operationArea(order)}
  `;
  MapHelper.renderMap(document.getElementById('detail-map'), order);
}

function render() {
  renderList();
  renderDetail();
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

function handleAction(action, id) {
  const order = orders.find((o) => o.id === id);
  if (!order) return;

  if (action === 'select') {
    currentId = id;
    render();
    return;
  }
  if (action === 'dispatch' && order.status === '待调度') {
    dispatchOrder(order);
    saveOrders(orders);
    render();
    toast(`${order.id} 已匹配 ${order.droneModel}`);
    return;
  }
  if (action === 'pick' && order.status === '待拣货') {
    bindDrone(order);
    saveOrders(orders);
    render();
    toast(`${order.id} 已绑定 ${order.droneSerial}`);
    return;
  }
  if (action === 'takeoff' && order.status === '待起飞') {
    order.status = '飞行中';
    order.progress = 2;
    order.startedAt = Date.now();
    saveOrders(orders);
    render();
    toast(`${order.id} 已起飞`);
    return;
  }
  if (action === 'check-data' && order.status === '待校验') {
    order.checks.data = true;
    saveOrders(orders);
    render();
    return;
  }
  if (action === 'check-visual' && order.status === '待校验') {
    order.checks.visual = true;
    saveOrders(orders);
    render();
    return;
  }
  if (action === 'land' && order.status === '待校验' && order.checks?.data && order.checks?.visual) {
    order.status = '待交付';
    saveOrders(orders);
    render();
    toast(`${order.id} 降落许可已下达`);
    return;
  }
}

document.addEventListener('click', (e) => {
  const card = e.target.closest('.order-card');
  const actionEl = e.target.closest('[data-action]');
  if (card) currentId = card.dataset.id;
  if (actionEl) {
    handleAction(actionEl.dataset.action, actionEl.dataset.id || currentId);
    return;
  }
  if (card) render();
});

setInterval(() => {
  const fresh = loadOrders();
  const changed = reconcileOrders(fresh);
  if (changed) saveOrders(fresh);
  if (JSON.stringify(fresh) !== JSON.stringify(orders)) {
    orders = fresh;
    render();
  }
}, 1000);

render();
if (window.lucide) window.lucide.createIcons();
