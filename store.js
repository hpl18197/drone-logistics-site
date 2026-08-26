'use strict';

const ORDER_STORE_KEY = 'drone-logistics-orders-v1';

const DEFAULT_ORDERS = [
  {
    id: 'DD-001',
    customer: '鼓楼区中心医院',
    phone: '025-83300001',
    address: '南京市鼓楼区中山北路 260 号',
    weightKg: 11.2,
    distanceKm: 12.4,
    cargoType: '医疗物资',
    status: '待调度',
    droneModel: null,
    droneSerial: null,
    batteryCount: null,
    items: [{ name: '医疗物资箱', count: 4, weightKg: 11.2 }],
    createdAt: '09:30',
    progress: 0,
    checks: { data: false, visual: false },
    startedAt: null,
    deliveredAt: null
  }
];

function cloneOrders(source) {
  return JSON.parse(JSON.stringify(source));
}

function loadOrders() {
  try {
    const raw = localStorage.getItem(ORDER_STORE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (Array.isArray(data)) return data;
    }
  } catch (err) {
    // Ignore storage errors and use defaults.
  }
  return cloneOrders(DEFAULT_ORDERS);
}

function saveOrders(orders) {
  try {
    localStorage.setItem(ORDER_STORE_KEY, JSON.stringify(orders));
  } catch (err) {
    // Ignore storage errors.
  }
}

function nextOrderId(orders) {
  const max = orders.reduce((memo, order) => {
    const num = Number(String(order.id).replace(/\D/g, ''));
    return Number.isFinite(num) && num > memo ? num : memo;
  }, 0);
  return `DD-${String(max + 1).padStart(3, '0')}`;
}

function reconcileOrders(orders) {
  let changed = false;
  orders.forEach((order) => {
    if (order.status === '飞行中' && order.startedAt) {
      const elapsed = Date.now() - order.startedAt;
      const progress = Math.min(100, 2 + elapsed / 250);
      if (progress >= 100 && order.status === '飞行中') {
        order.status = '待校验';
        order.progress = 100;
        changed = true;
      } else if (Math.round(progress) !== Math.round(order.progress || 0)) {
        order.progress = progress;
        changed = true;
      }
    }
  });
  return changed;
}

function buildItems(cargoType, weightKg) {
  const map = {
    '医疗物资': { name: '医疗物资箱', unitKg: 2.8 },
    '生鲜食材': { name: '生鲜保温箱', unitKg: 3.2 },
    '工业零件': { name: '工业零件箱', unitKg: 4.2 },
    '普通包裹': { name: '快递包裹', unitKg: 1.8 }
  };
  const def = map[cargoType] || map['普通包裹'];
  const count = Math.max(1, Math.ceil(weightKg / def.unitKg));
  return [{ name: def.name, count, weightKg: Math.round(count * def.unitKg * 10) / 10 }];
}

function dispatchOrder(order) {
  const models = [
    { name: '蜂翼 Air', payloadKg: 5, rangeKm: 16 },
    { name: '蜂翼 Cargo', payloadKg: 14, rangeKm: 24 },
    { name: '蜂翼 Heavy', payloadKg: 32, rangeKm: 34 }
  ];
  const model = models.find((item) => item.payloadKg >= order.weightKg) || models[2];
  const batteryCount = Math.max(2, Math.ceil((order.distanceKm * 2) / model.rangeKm) + 1);
  order.droneModel = model.name;
  order.batteryCount = batteryCount;
  order.status = '待拣货';
}

function bindDrone(order) {
  const serials = {
    '蜂翼 Air': 'FHA-101',
    '蜂翼 Cargo': 'FHC-201',
    '蜂翼 Heavy': 'FHH-301'
  };
  order.droneSerial = serials[order.droneModel] || 'FHC-201';
  order.status = '待起飞';
}
