import { WebSocketServer } from 'ws';

const PORT = process.env.PORT || 8080;

const WAREHOUSE = [118.778074, 32.057236];
const DESTINATIONS = [
  [118.840368, 32.041544],
  [118.806746, 32.079968],
  [118.728958, 32.050763],
  [118.898803, 32.026128]
];

const drones = [
  { id: 'FHA-101', battery: 78, payload: 4.8, wind: 4.2, temp: 27.1, humidity: 56, status: '正常', progress: 0.12 },
  { id: 'FHA-102', battery: 64, payload: 3.6, wind: 5.1, temp: 26.4, humidity: 58, status: '正常', progress: 0.28 },
  { id: 'FHC-201', battery: 82, payload: 11.2, wind: 3.8, temp: 28.2, humidity: 52, status: '正常', progress: 0.46 },
  { id: 'FHC-202', battery: 36, payload: 8.4, wind: 6.3, temp: 29.0, humidity: 60, status: '低电量', progress: 0.72 },
  { id: 'FHH-301', battery: 91, payload: 22.8, wind: 4.0, temp: 26.9, humidity: 49, status: '正常', progress: 0.2 },
  { id: 'FHH-302', battery: 58, payload: 16.2, wind: 7.2, temp: 30.1, humidity: 63, status: '偏离航线', progress: 0.88 }
];

let orders = [
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

const clients = new Set();
let metrics = {
  orders: 128,
  activeDrones: 6,
  avgDuration: 18.6,
  alerts: 2
};

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function telemetryPayload() {
  return drones.map((drone, index) => {
    const dest = DESTINATIONS[index % DESTINATIONS.length];
    return {
      ...drone,
      lat: lerp(WAREHOUSE[1], dest[1], drone.progress),
      lng: lerp(WAREHOUSE[0], dest[0], drone.progress)
    };
  });
}

function broadcast(type, payload) {
  const text = JSON.stringify({ type, ...payload });
  clients.forEach((client) => {
    if (client.readyState === 1) client.send(text);
  });
}

function broadcastOrders() {
  broadcast('orders', { orders });
}

function broadcastTelemetry() {
  broadcast('telemetry', { drones: telemetryPayload(), metrics });
}

const wss = new WebSocketServer({ port: PORT });

wss.on('connection', (ws) => {
  clients.add(ws);
  ws.send(JSON.stringify({ type: 'orders', orders }));
  ws.send(JSON.stringify({ type: 'telemetry', drones: telemetryPayload(), metrics }));

  ws.on('message', (raw) => {
    try {
      const message = JSON.parse(raw.toString());
      if (message.type === 'order:create' && message.order) {
        orders.unshift(message.order);
        broadcastOrders();
      }
      if (message.type === 'order:update' && message.order) {
        const index = orders.findIndex((order) => order.id === message.order.id);
        if (index >= 0) orders[index] = message.order;
        broadcastOrders();
      }
    } catch (err) {
      // Ignore malformed messages.
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
  });
});

setInterval(() => {
  drones.forEach((drone, index) => {
    drone.progress += 0.006 + (index % 3) * 0.0012;
    if (drone.progress > 1) drone.progress = 0.05;
    drone.battery = Math.max(18, Math.min(98, drone.battery + (Math.random() - 0.5) * 0.6));
    drone.wind = Math.max(2, Math.min(12, drone.wind + (Math.random() - 0.5) * 0.5));
    drone.temp = Math.round((drone.temp + (Math.random() - 0.5) * 0.4) * 10) / 10;
    drone.humidity = Math.max(35, Math.min(75, drone.humidity + (Math.random() - 0.5)));
  });
  metrics.orders = 128 + Math.round(Math.sin(Date.now() / 9000) * 4);
  metrics.activeDrones = drones.length;
  metrics.avgDuration = Math.round((18.6 + Math.sin(Date.now() / 7000) * 0.3) * 10) / 10;
  metrics.alerts = drones.filter((drone) => drone.status !== '正常').length;
  broadcastTelemetry();
}, 1000);

setInterval(broadcastOrders, 5000);

console.log(`WebSocket server listening on ws://localhost:${PORT}`);
