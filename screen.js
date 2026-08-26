'use strict';

const WAREHOUSE = [118.778074, 32.057236];
const DESTINATIONS = [
  [118.840368, 32.041544],
  [118.806746, 32.079968],
  [118.728958, 32.050763],
  [118.898803, 32.026128]
];

const DRONES = [
  { id: 'FHA-101', battery: 78, payload: 4.8, wind: 4.2, temp: 27.1, humidity: 56, status: '正常', progress: 0.12 },
  { id: 'FHA-102', battery: 64, payload: 3.6, wind: 5.1, temp: 26.4, humidity: 58, status: '正常', progress: 0.28 },
  { id: 'FHC-201', battery: 82, payload: 11.2, wind: 3.8, temp: 28.2, humidity: 52, status: '正常', progress: 0.46 },
  { id: 'FHC-202', battery: 36, payload: 8.4, wind: 6.3, temp: 29.0, humidity: 60, status: '低电量', progress: 0.72 },
  { id: 'FHH-301', battery: 91, payload: 22.8, wind: 4.0, temp: 26.9, humidity: 49, status: '正常', progress: 0.2 },
  { id: 'FHH-302', battery: 58, payload: 16.2, wind: 7.2, temp: 30.1, humidity: 63, status: '偏离航线', progress: 0.88 }
];

const STATIONS = [
  { name: '智慧仓库', pos: WAREHOUSE },
  { name: '起降点 A', pos: [118.822068, 32.068661] },
  { name: '起降点 B', pos: [118.752394, 32.044528] }
];

const FALLBACK_ROUTES = [
  'M120 440 C240 390, 340 230, 650 150',
  'M120 440 C220 420, 300 180, 520 80',
  'M120 440 C190 350, 250 500, 420 430',
  'M120 440 C280 420, 470 280, 680 180'
];

const PAD_POSITIONS = [
  { x: 2.6, z: 2.6 },
  { x: 2.6, z: -2.6 },
  { x: 0, z: 4.1 },
  { x: -2.6, z: 2.6 },
  { x: 0, z: -4.1 },
  { x: -2.6, z: -2.6 }
];

let map = null;
let mapMarkers = [];
let fallbackPaths = [];
let fallbackMarkers = [];
let chart = null;
let threeState = null;
const telemetry = { battery: [], wind: [], humidity: [] };

function nowClock() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}

function updateClock() {
  const el = document.getElementById('screen-clock');
  if (el) el.textContent = nowClock();
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function positionAt(index, progress) {
  const dest = DESTINATIONS[index % DESTINATIONS.length];
  return [
    lerp(WAREHOUSE[0], dest[0], progress),
    lerp(WAREHOUSE[1], dest[1], progress)
  ];
}

const legendHtml = `
  <div class="map-legend">
    <div class="map-legend-row"><span class="map-legend-dot drone"></span>无人机</div>
    <div class="map-legend-row"><span class="map-legend-dot station"></span>起降点</div>
    <div class="map-legend-row"><span class="map-legend-dot fence"></span>电子围栏</div>
  </div>
`;

function fallbackMapHtml() {
  const lons = [WAREHOUSE[0], ...DESTINATIONS.map((d) => d[0])];
  const lats = [WAREHOUSE[1], ...DESTINATIONS.map((d) => d[1])];
  const minLon = Math.min(...lons) - 0.006;
  const maxLon = Math.max(...lons) + 0.006;
  const minLat = Math.min(...lats) - 0.006;
  const maxLat = Math.max(...lats) + 0.006;
  const mapX = (lon) => 70 + ((lon - minLon) / (maxLon - minLon)) * 660;
  const mapY = (lat) => 70 + ((maxLat - lat) / (maxLat - minLat)) * 420;
  return `
    <svg class="screen-map-fallback" viewBox="0 0 800 560" role="img" aria-label="无人机实时态势示意地图">
      <rect width="800" height="560" fill="#0d171f"/>
      <path d="M-20 360 C180 330, 420 380, 640 340 S780 280, 830 300" fill="none" stroke="#1d3342" stroke-width="26"/>
      <path d="M120 520 C260 420, 420 390, 640 300" fill="none" stroke="#162b38" stroke-width="18"/>
      <path d="M70 190 C260 180, 520 210, 740 170" fill="none" stroke="#1b3040" stroke-width="14"/>
      <rect x="90" y="70" width="620" height="410" rx="12" fill="rgba(244,180,92,0.04)" stroke="#f4b45c" stroke-dasharray="8 8"/>
      ${DRONES.map((d, i) => {
        const dest = DESTINATIONS[i % DESTINATIONS.length];
        const x1 = mapX(dest[0]);
        const y1 = mapY(dest[1]);
        return `
          <path id="fallback-route-${i}" class="screen-fallback-route" d="${FALLBACK_ROUTES[i % FALLBACK_ROUTES.length]}" fill="none" stroke="rgba(44,197,194,0.35)" stroke-width="3" stroke-dasharray="6 8"/>
          <g transform="translate(${x1}, ${y1})">
            <circle r="7" fill="#e58b2f" stroke="#ffffff" stroke-width="2"/>
          </g>
        `;
      }).join('')}
      ${STATIONS.map((s) => {
        const x = mapX(s.pos[0]);
        const y = mapY(s.pos[1]);
        return `
          <g transform="translate(${x}, ${y})">
            <circle r="8" fill="#9b8cff" stroke="#ffffff" stroke-width="2"/>
            <text x="14" y="4" fill="#aebfd0" font-size="12">${s.name}</text>
          </g>
        `;
      }).join('')}
      ${DRONES.map((d, i) => `
        <g id="fallback-drone-${i}" transform="translate(120,440)">
          <circle r="12" fill="rgba(44,197,194,0.18)"/>
          <circle r="6" fill="#2cc5c2" stroke="#ffffff" stroke-width="2"/>
        </g>
      `).join('')}
    </svg>
    ${legendHtml}
  `;
}

function renderFallbackMap() {
  const container = document.getElementById('screen-map');
  if (!container) return;
  container.innerHTML = fallbackMapHtml();
  fallbackPaths = DRONES.map((d, i) => document.getElementById(`fallback-route-${i}`));
  fallbackMarkers = DRONES.map((d, i) => document.getElementById(`fallback-drone-${i}`));
  document.getElementById('map-status-badge').textContent = '示意地图';
  updateFallbackDrones();
}

function updateFallbackDrones() {
  DRONES.forEach((d, i) => {
    const path = fallbackPaths[i];
    const marker = fallbackMarkers[i];
    if (!path || !marker) return;
    const length = path.getTotalLength();
    const point = path.getPointAtLength(Math.max(0, Math.min(1, d.progress)) * length);
    marker.setAttribute('transform', `translate(${point.x.toFixed(1)}, ${point.y.toFixed(1)})`);
  });
}

async function initScreenMap() {
  const config = MapHelper.getConfig();
  const container = document.getElementById('screen-map');
  const badge = document.getElementById('map-status-badge');
  if (!container || !badge) return;
  if (!config.key) {
    badge.textContent = '示意地图';
    renderFallbackMap();
    return;
  }
  try {
    const AMap = await MapHelper.loadAmap(config);
    container.innerHTML = '<div id="screen-amap" class="amap-canvas"></div>';
    container.insertAdjacentHTML('beforeend', legendHtml);
    badge.textContent = '高德地图在线';
    map = new AMap.Map('screen-amap', {
      zoom: 12,
      center: WAREHOUSE,
      resizeEnable: true
    });
    map.addControl(new AMap.Scale());
    map.addControl(new AMap.ToolBar({ position: 'RB' }));

    const fence = new AMap.Polygon({
      path: [
        [118.742, 32.026],
        [118.872, 32.026],
        [118.872, 32.082],
        [118.742, 32.082]
      ],
      strokeColor: '#f4b45c',
      strokeWeight: 1,
      strokeStyle: 'dashed',
      fillColor: '#f4b45c',
      fillOpacity: 0.05
    });
    map.add(fence);

    STATIONS.forEach((s) => {
      const marker = new AMap.Marker({
        position: s.pos,
        content: '<div class="station-marker"></div>',
        offset: new AMap.Pixel(-7, -7),
        title: s.name
      });
      map.add(marker);
    });

    DRONES.forEach((d, i) => {
      const dest = DESTINATIONS[i % DESTINATIONS.length];
      const route = new AMap.Polyline({
        path: [WAREHOUSE, dest],
        strokeColor: 'rgba(44,197,194,0.35)',
        strokeWeight: 3,
        strokeStyle: 'dashed',
        lineDash: [6, 8]
      });
      map.add(route);
      const marker = new AMap.Marker({
        position: positionAt(i, d.progress),
        content: `<div class="drone-marker">${d.id.slice(-2)}</div>`,
        offset: new AMap.Pixel(-13, -13),
        title: d.id
      });
      map.add(marker);
      mapMarkers.push(marker);
    });

    map.setFitView([fence]);
    updateAmapDrones();
  } catch (err) {
    badge.textContent = '示意地图';
    renderFallbackMap();
  }
}

function updateAmapDrones() {
  if (!map || !mapMarkers.length) return;
  DRONES.forEach((d, i) => {
    mapMarkers[i].setPosition(positionAt(i, d.progress));
  });
}

function updateDrones() {
  DRONES.forEach((d, i) => {
    d.progress += 0.006 + (i % 3) * 0.0012;
    if (d.progress > 1) d.progress = 0.05;
    d.battery = Math.max(18, Math.min(98, d.battery + (Math.random() - 0.5) * 0.6));
    d.wind = Math.max(2, Math.min(12, d.wind + (Math.random() - 0.5) * 0.5));
    d.temp = Math.round((d.temp + (Math.random() - 0.5) * 0.4) * 10) / 10;
    d.humidity = Math.max(35, Math.min(75, d.humidity + (Math.random() - 0.5)));
  });
  if (map && mapMarkers.length) updateAmapDrones();
  else updateFallbackDrones();
}

function renderDevices() {
  const rows = DRONES.map((d) => {
    const cls = d.status === '偏离航线' ? 'alert' : d.status === '低电量' ? 'warning' : '';
    return `
      <tr>
        <td>${d.id}</td>
        <td>${Math.round(d.battery)}%</td>
        <td>${d.payload} kg</td>
        <td>${d.wind.toFixed(1)} m/s</td>
        <td>${d.temp.toFixed(1)}°C</td>
        <td>${Math.round(d.humidity)}%</td>
        <td><span class="device-status ${cls}">${d.status}</span></td>
      </tr>
    `;
  }).join('');
  document.getElementById('device-rows').innerHTML = rows;
}

function updateMetrics() {
  const orders = 128 + Math.round(Math.sin(Date.now() / 9000) * 4);
  const drones = DRONES.filter((d) => d.status !== '待命').length;
  const duration = (18.6 + Math.sin(Date.now() / 7000) * 0.3).toFixed(1);
  document.getElementById('metric-orders').textContent = orders;
  document.getElementById('metric-drones').textContent = drones;
  document.getElementById('metric-duration').textContent = `${duration} 分钟`;
}

function initChart() {
  if (!window.echarts) return;
  const el = document.getElementById('telemetry-chart');
  chart = echarts.init(el);
  for (let i = 0; i < 20; i += 1) {
    telemetry.battery.push(70 + Math.sin(i / 2.4) * 8);
    telemetry.wind.push(4.5 + Math.cos(i / 2.1) * 1.4);
    telemetry.humidity.push(54 + Math.sin(i / 2.8) * 6);
  }
  chart.setOption({
    backgroundColor: 'transparent',
    color: ['#2cc5c2', '#f4b45c', '#9b8cff'],
    tooltip: { trigger: 'axis' },
    legend: { textStyle: { color: '#8ba2b0' }, top: 4 },
    grid: { left: 46, right: 18, top: 38, bottom: 30 },
    xAxis: {
      type: 'category',
      data: telemetry.battery.map((v, i) => `${i * 3}s`),
      axisLine: { lineStyle: { color: 'rgba(145,186,205,0.25)' } },
      axisLabel: { color: '#8ba2b0' }
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: '#8ba2b0' },
      splitLine: { lineStyle: { color: 'rgba(145,186,205,0.12)' } }
    },
    series: [
      { name: '电量', type: 'line', smooth: true, data: telemetry.battery, symbol: 'none' },
      { name: '风速', type: 'line', smooth: true, data: telemetry.wind, symbol: 'none' },
      { name: '湿度', type: 'line', smooth: true, data: telemetry.humidity, symbol: 'none' }
    ]
  });
}

function updateChart() {
  if (!chart) return;
  telemetry.battery.push(62 + Math.random() * 28);
  telemetry.wind.push(3.5 + Math.random() * 4.5);
  telemetry.humidity.push(45 + Math.random() * 20);
  telemetry.battery.shift();
  telemetry.wind.shift();
  telemetry.humidity.shift();
  chart.setOption({
    xAxis: { data: telemetry.battery.map((v, i) => `${i * 3}s`) },
    series: [
      { data: telemetry.battery },
      { data: telemetry.wind },
      { data: telemetry.humidity }
    ]
  });
}

function drawFpv(t) {
  const canvas = document.getElementById('fpv-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#17323f');
  sky.addColorStop(0.48, '#315a62');
  sky.addColorStop(0.52, '#3f6448');
  sky.addColorStop(1, '#233c2a');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  const scroll = (t * 0.018) % 220;
  for (let i = -1; i < 6; i += 1) {
    const x = i * 120 - scroll * 0.34;
    ctx.fillStyle = i % 2 ? '#466c52' : '#527c5b';
    ctx.beginPath();
    ctx.moveTo(x, h * 0.5);
    ctx.lineTo(x + 120, h * 0.5);
    ctx.lineTo(x + 200, h);
    ctx.lineTo(x - 80, h);
    ctx.fill();
  }

  ctx.strokeStyle = 'rgba(220,220,220,0.28)';
  ctx.lineWidth = 18;
  ctx.beginPath();
  ctx.moveTo(0, h);
  ctx.lineTo(w * 0.74, h * 0.55);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(240,230,190,0.7)';
  ctx.lineWidth = 2;
  ctx.setLineDash([14, 12]);
  ctx.beginPath();
  ctx.moveTo(0, h - 6);
  ctx.lineTo(w * 0.74, h * 0.55);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(w / 2, 0);
  ctx.lineTo(w / 2, h);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, h / 2);
  ctx.lineTo(w, h / 2);
  ctx.stroke();

  requestAnimationFrame(drawFpv);
}

function initThree() {
  const container = document.getElementById('three-view');
  const statusEl = document.getElementById('three-status');
  if (!container || !statusEl || !window.THREE) {
    if (statusEl) statusEl.textContent = 'Three.js 未加载';
    return;
  }
  try {
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0d171f);
    const camera = new THREE.PerspectiveCamera(46, container.clientWidth / container.clientHeight, 0.1, 200);
    camera.position.set(13, 10, 13);
    camera.lookAt(0, 0.6, 0);

    scene.add(new THREE.AmbientLight(0x9fc3d3, 0.9));
    const sun = new THREE.DirectionalLight(0xffffff, 1.3);
    sun.position.set(8, 14, 6);
    scene.add(sun);

    const grid = new THREE.GridHelper(24, 24, 0x2cc5c2, 0x1a3342);
    grid.position.y = 0.01;
    scene.add(grid);

    const warehouse = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 1.5, 2),
      new THREE.MeshStandardMaterial({ color: 0x2f8f8f, roughness: 0.55 })
    );
    warehouse.position.set(-3.4, 0.75, 0);
    warehouse.castShadow = true;
    scene.add(warehouse);

    const roofBeacon = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.18, 0.12, 16),
      new THREE.MeshBasicMaterial({ color: 0xf4b45c })
    );
    roofBeacon.position.set(-3.4, 1.62, 0);
    scene.add(roofBeacon);

    const fence = new THREE.Mesh(
      new THREE.RingGeometry(6.8, 6.95, 64),
      new THREE.MeshBasicMaterial({ color: 0xf4b45c, transparent: true, opacity: 0.55, side: THREE.DoubleSide })
    );
    fence.rotation.x = -Math.PI / 2;
    fence.position.y = 0.02;
    scene.add(fence);

    PAD_POSITIONS.forEach((pos) => {
      const pad = new THREE.Mesh(
        new THREE.CylinderGeometry(0.62, 0.72, 0.08, 24),
        new THREE.MeshStandardMaterial({ color: 0x9b8cff, roughness: 0.8 })
      );
      pad.position.set(pos.x, 0.04, pos.z);
      scene.add(pad);
    });

    const droneEntries = DRONES.map((d, i) => {
      const group = new THREE.Group();
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(0.52, 0.14, 0.52),
        new THREE.MeshStandardMaterial({ color: 0x2cc5c2, roughness: 0.45 })
      );
      body.position.y = 0.08;
      const rotorGroup = new THREE.Group();
      const rotorMat = new THREE.MeshBasicMaterial({ color: 0xbfe9e6, transparent: true, opacity: 0.8 });
      const positions = [
        [0.34, 0.34],
        [0.34, -0.34],
        [-0.34, 0.34],
        [-0.34, -0.34]
      ];
      positions.forEach(([px, pz]) => {
        const arm = new THREE.Mesh(
          new THREE.BoxGeometry(0.08, 0.03, 0.42),
          new THREE.MeshStandardMaterial({ color: 0x173742 })
        );
        arm.position.set(px * 0.55, 0.18, pz * 0.55);
        arm.rotation.y = Math.atan2(px, pz);
        rotorGroup.add(arm);
        const rotor = new THREE.Mesh(
          new THREE.CylinderGeometry(0.2, 0.2, 0.02, 16),
          rotorMat
        );
        rotor.rotation.x = Math.PI / 2;
        rotor.position.set(px, 0.24, pz);
        rotorGroup.add(rotor);
      });
      group.add(body, rotorGroup);
      group.position.set(-3.4, 1.25, 0);
      scene.add(group);
      return { group, rotorGroup, data: d };
    });

    DRONES.forEach((d, i) => {
      const dest = PAD_POSITIONS[i % PAD_POSITIONS.length];
      const points = [
        new THREE.Vector3(-3.4, 0.55, 0),
        new THREE.Vector3(dest.x, 0.55, dest.z)
      ];
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      scene.add(new THREE.Line(
        geometry,
        new THREE.LineBasicMaterial({ color: 0x2cc5c2, transparent: true, opacity: 0.3 })
      ));
    });

    threeState = {
      renderer,
      scene,
      camera,
      drones: droneEntries,
      clock: new THREE.Clock()
    };
    statusEl.textContent = 'Three.js / WebGL 已启用';
    animateThree();
  } catch (err) {
    statusEl.textContent = 'WebGL 不可用';
  }
}

function updateThreeDrones() {
  if (!threeState) return;
  const elapsed = threeState.clock.getElapsedTime();
  threeState.drones.forEach((entry, i) => {
    const dest = PAD_POSITIONS[i % PAD_POSITIONS.length];
    const progress = entry.data.progress;
    entry.group.position.x = lerp(-3.4, dest.x, progress);
    entry.group.position.z = lerp(0, dest.z, progress);
    entry.group.position.y = 1.25 + Math.sin(elapsed * 1.8 + i) * 0.06;
    entry.group.rotation.y = Math.atan2(dest.x + 3.4, dest.z);
    entry.rotorGroup.rotation.y += 0.32;
  });
}

function animateThree() {
  if (!threeState) return;
  requestAnimationFrame(animateThree);
  updateThreeDrones();
  const elapsed = threeState.clock.getElapsedTime();
  threeState.camera.position.x = 13 * Math.cos(elapsed * 0.045);
  threeState.camera.position.z = 13 * Math.sin(elapsed * 0.045);
  threeState.camera.lookAt(0, 0.7, 0);
  threeState.renderer.render(threeState.scene, threeState.camera);
}

function resizeThree() {
  if (!threeState) return;
  const container = document.getElementById('three-view');
  if (!container || container.clientWidth === 0) return;
  threeState.renderer.setSize(container.clientWidth, container.clientHeight);
  threeState.camera.aspect = container.clientWidth / container.clientHeight;
  threeState.camera.updateProjectionMatrix();
}

function initFullscreen() {
  document.getElementById('fullscreen-btn').addEventListener('click', () => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen();
    }
  });
}

updateClock();
initFullscreen();
renderDevices();
updateMetrics();
initChart();
initScreenMap();
initThree();
requestAnimationFrame(drawFpv);
if (window.lucide) window.lucide.createIcons();

setInterval(() => {
  updateClock();
  updateDrones();
  updateMetrics();
  renderDevices();
  updateChart();
}, 1000);

window.addEventListener('resize', () => {
  if (chart) chart.resize();
  resizeThree();
});
