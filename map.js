'use strict';

const MAP_CONFIG_KEY = 'amap-map-config-v1';
const WAREHOUSE_POSITION = [118.778074, 32.057236];
const DESTINATION_POSITION = [118.840368, 32.041544];

let activeMap = null;
let amapLoadPromise = null;

function getAmapConfig() {
  try {
    const raw = localStorage.getItem(MAP_CONFIG_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      return {
        key: String(data.key || ''),
        securityJsCode: String(data.securityJsCode || '')
      };
    }
  } catch (err) {
    // Ignore storage errors.
  }
  return { key: '', securityJsCode: '' };
}

function saveAmapConfig(config) {
  try {
    localStorage.setItem(MAP_CONFIG_KEY, JSON.stringify({
      key: String(config.key || ''),
      securityJsCode: String(config.securityJsCode || '')
    }));
  } catch (err) {
    // Ignore storage errors.
  }
}

function mapRatio(order) {
  if (order.status === '飞行中') return Math.max(0, Math.min(1, (order.progress || 0) / 100));
  if (order.status === '待校验' || order.status === '待交付') return 1;
  if (order.status === '已完成') return 0;
  return 0;
}

function fallbackMap(order) {
  return `
    <div class="track-map">
      <svg viewBox="0 0 800 300" role="img" aria-label="配送路线">
        <rect width="800" height="300" fill="#e8efed"/>
        <path d="M-20 196 C150 160, 360 210, 560 174 S720 120, 830 134" fill="none" stroke="#c8d3cf" stroke-width="22"/>
        <path id="amap-fallback-route" class="map-track" d="M90 232 C170 206, 250 110, 430 140 S680 82, 720 62"/>
        <path class="map-route" d="M90 232 C170 206, 250 110, 430 140 S680 82, 720 62"/>
        <g transform="translate(70,218)">
          <circle class="map-pin" cx="0" cy="0" r="7" fill="#0e7c86"/>
          <text x="14" y="4" class="map-label">仓库</text>
        </g>
        <g transform="translate(700,50)">
          <circle class="map-pin" cx="0" cy="0" r="7" fill="#e58b2f"/>
          <text x="14" y="4" class="map-label">目的地</text>
        </g>
        <g id="amap-fallback-marker" transform="translate(90,232)">
          <circle class="drone-ring" r="18"></circle>
          <circle class="drone-dot" r="8"></circle>
        </g>
      </svg>
    </div>
  `;
}

function updateFallbackMarker(container, order) {
  const route = container.querySelector('#amap-fallback-route');
  const marker = container.querySelector('#amap-fallback-marker');
  if (!route || !marker) return;
  const ratio = mapRatio(order);
  const length = route.getTotalLength();
  const point = route.getPointAtLength(ratio * length);
  marker.setAttribute('transform', `translate(${point.x.toFixed(1)}, ${point.y.toFixed(1)})`);
}

function loadAmap(config) {
  if (window.AMap) return Promise.resolve(window.AMap);
  if (amapLoadPromise) return amapLoadPromise;
  if (config.securityJsCode) {
    window._AMapSecurityConfig = { securityJsCode: config.securityJsCode };
  }
  amapLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${encodeURIComponent(config.key)}`;
    script.async = true;
    script.onload = () => {
      if (window.AMap) resolve(window.AMap);
      else reject(new Error('高德地图加载失败'));
    };
    script.onerror = () => reject(new Error('高德地图脚本加载失败'));
    document.head.appendChild(script);
  });
  return amapLoadPromise;
}

function updateAmapMarker(order) {
  if (!activeMap || activeMap.orderId !== order.id) return;
  const ratio = mapRatio(order);
  if (Math.abs(ratio - activeMap.ratio) < 0.002) return;
  const position = [
    WAREHOUSE_POSITION[0] + (DESTINATION_POSITION[0] - WAREHOUSE_POSITION[0]) * ratio,
    WAREHOUSE_POSITION[1] + (DESTINATION_POSITION[1] - WAREHOUSE_POSITION[1]) * ratio
  ];
  activeMap.marker.setPosition(position);
  activeMap.ratio = ratio;
}

function destroyAmapMap() {
  if (activeMap && activeMap.map) {
    activeMap.map.destroy();
  }
  activeMap = null;
}

function renderMap(container, order) {
  if (!container || !order) return;

  if (activeMap && activeMap.container === container && activeMap.orderId === order.id) {
    updateAmapMarker(order);
    return;
  }
  if (container.querySelector('#amap-fallback-route')) {
    updateFallbackMarker(container, order);
    return;
  }

  const config = getAmapConfig();
  if (!config.key) {
    container.innerHTML = fallbackMap(order);
    updateFallbackMarker(container, order);
    return;
  }

  destroyAmapMap();
  loadAmap(config)
    .then((AMap) => {
      if (!container.isConnected) return;
      container.innerHTML = '<div class="amap-canvas" id="amap-canvas"></div>';
      const map = new AMap.Map('amap-canvas', {
        zoom: 13,
        center: WAREHOUSE_POSITION,
        resizeEnable: true
      });
      const startMarker = new AMap.Marker({
        position: WAREHOUSE_POSITION,
        title: '仓库',
        label: { content: '仓库', direction: 'top' }
      });
      const endMarker = new AMap.Marker({
        position: DESTINATION_POSITION,
        title: '目的地',
        label: { content: '目的地', direction: 'top' }
      });
      const route = new AMap.Polyline({
        path: [WAREHOUSE_POSITION, DESTINATION_POSITION],
        strokeColor: '#e58b2f',
        strokeWeight: 5,
        strokeStyle: 'dashed',
        lineDash: [8, 8]
      });
      const droneMarker = new AMap.Marker({
        position: WAREHOUSE_POSITION,
        title: '无人机'
      });
      map.add([startMarker, endMarker, route, droneMarker]);
      map.setFitView([startMarker, endMarker]);
      activeMap = {
        map,
        marker: droneMarker,
        container,
        orderId: order.id,
        ratio: -1
      };
      updateAmapMarker(order);
    })
    .catch(() => {
      if (!container.isConnected) return;
      container.innerHTML = fallbackMap(order);
      updateFallbackMarker(container, order);
    });
}

document.addEventListener('click', (e) => {
  if (e.target.closest('[data-map-config-open]')) {
    const modal = document.getElementById('map-config-modal');
    const config = getAmapConfig();
    const form = document.getElementById('map-config-form');
    if (!modal || !form) return;
    form.querySelector('[name="amapKey"]').value = config.key;
    form.querySelector('[name="securityCode"]').value = config.securityJsCode;
    modal.classList.remove('hidden');
    return;
  }
  if (e.target.closest('[data-map-config-close]') || e.target.id === 'map-config-modal') {
    const modal = document.getElementById('map-config-modal');
    if (modal) modal.classList.add('hidden');
  }
});

document.addEventListener('submit', (e) => {
  if (e.target.id !== 'map-config-form') return;
  e.preventDefault();
  const data = new FormData(e.target);
  saveAmapConfig({
    key: String(data.get('amapKey') || '').trim(),
    securityJsCode: String(data.get('securityCode') || '').trim()
  });
  location.reload();
});

window.MapHelper = {
  getConfig: getAmapConfig,
  saveConfig: saveAmapConfig,
  renderMap,
  destroyMap: destroyAmapMap
};
