const API = '/api/admin';
let token = localStorage.getItem('hermes_token');
let user = null;

function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return fetch(`${API}${path}`, { ...options, headers })
    .then(r => { if (!r.ok) throw new Error(r.statusText); return r.json(); });
}

// ---- Auth ----
async function login(username, password) {
  const data = await api('/auth/login', {
    method: 'POST', body: JSON.stringify({ username, password }),
  });
  token = data.token;
  user = data.user;
  localStorage.setItem('hermes_token', token);
  renderApp();
}

function logout() {
  token = null;
  user = null;
  localStorage.removeItem('hermes_token');
  renderApp();
}

// ---- Router ----
function navigate(section) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.sidebar nav a').forEach(a => a.classList.remove('active'));
  const el = document.getElementById(`section-${section}`);
  if (el) el.classList.add('active');
  const navEl = document.querySelector(`.sidebar nav a[data-section="${section}"]`);
  if (navEl) navEl.classList.add('active');
  if (section === 'dashboard') loadDashboard();
  if (section === 'rooms') loadRooms();
  if (section === 'bookings') loadBookings();
  if (section === 'videos') loadVideos();
  if (section === 'promotions') loadPromotions();
  if (section === 'conversations') loadConversations();
}

// ---- Render ----
function renderApp() {
  const app = document.getElementById('app');
  if (!token) {
    app.innerHTML = `
      <div class="login-page">
        <div class="login-card">
          <h1>🏨 Hermes Agent</h1>
          <p class="subtitle">Panel de Administración</p>
          <input type="text" id="login-user" placeholder="Usuario" autocomplete="username">
          <input type="password" id="login-pass" placeholder="Contraseña" autocomplete="current-password">
          <button onclick="handleLogin()">Iniciar Sesión</button>
          <p class="error hidden" id="login-error">Credenciales inválidas</p>
        </div>
      </div>`;
    return;
  }
  app.innerHTML = `
    <div class="admin-layout">
      <aside class="sidebar">
        <h2>🏨 Hermes</h2>
        <nav>
          ${navItems.map(n => `<a data-section="${n.id}" onclick="navigate('${n.id}')" class="${n.id === 'dashboard' ? 'active' : ''}">${n.icon} ${n.label}</a>`).join('')}
        </nav>
      </aside>
      <main class="main-content">
        <div class="page-header">
          <h1 id="page-title">Dashboard</h1>
          <div class="user-info">
            <span>${user?.username || 'Admin'}</span>
            <button class="logout-btn" onclick="logout()">Cerrar Sesión</button>
          </div>
        </div>
        ${sections.map(s => `<div class="section ${s.id === 'dashboard' ? 'active' : ''}" id="section-${s.id}">${s.content}</div>`).join('')}
      </main>
    </div>`;
  navigate('dashboard');
}

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'rooms', label: 'Habitaciones', icon: '🏠' },
  { id: 'bookings', label: 'Reservas', icon: '📅' },
  { id: 'videos', label: 'Videos', icon: '🎬' },
  { id: 'promotions', label: 'Promociones', icon: '🏷️' },
  { id: 'conversations', label: 'Conversaciones', icon: '💬' },
  { id: 'agent', label: 'Hermes Chat', icon: '🤖' },
];

const sections = [
  { id: 'dashboard', content: '<div class="stats-grid" id="stats-grid"></div><div id="dashboard-charts"></div>' },
  { id: 'rooms', content: `<div class="tabs"><button class="tab active" onclick="loadRooms()">Todas</button><button class="tab" onclick="showAddRoom()">+ Añadir</button></div><div id="rooms-list"></div>` },
  { id: 'bookings', content: '<div id="bookings-list"></div>' },
  { id: 'videos', content: `<div class="tabs"><button class="tab active" onclick="loadVideos()">Todos</button><button class="tab" onclick="showUploadVideo()">+ Subir</button></div><div id="videos-list"></div>` },
  { id: 'promotions', content: `<div class="tabs"><button class="tab active" onclick="loadPromotions()">Todas</button><button class="tab" onclick="showAddPromotion()">+ Nueva</button></div><div id="promotions-list"></div>` },
  { id: 'conversations', content: '<div id="conversations-list"></div>' },
  { id: 'agent', content: `<div class="chat-container"><div class="chat-messages" id="chat-messages"></div><div class="chat-input-area"><input type="text" id="chat-input" placeholder="Escribe un mensaje a Hermes..." onkeydown="if(event.key==='Enter')sendAgentMessage()"><button onclick="sendAgentMessage()">Enviar</button></div></div>` },
];

// ---- Dashboard ----
async function loadDashboard() {
  document.getElementById('page-title').textContent = 'Dashboard';
  const data = await api('/dashboard');
  document.getElementById('stats-grid').innerHTML = `
    <div class="stat-card"><div class="value">${data.rooms}</div><div class="label">Habitaciones</div></div>
    <div class="stat-card"><div class="value">${data.bookings}</div><div class="label">Reservas</div></div>
    <div class="stat-card"><div class="value">$${data.revenue.toLocaleString()}</div><div class="label">Ingresos</div></div>
    <div class="stat-card"><div class="value">${data.videos}</div><div class="label">Videos</div></div>
    <div class="stat-card"><div class="value">${data.activeConversations}</div><div class="label">Conversaciones Activas</div></div>`;
}

// ---- Rooms ----
async function loadRooms() {
  document.getElementById('page-title').textContent = 'Habitaciones';
  const rooms = await api('/rooms');
  document.getElementById('rooms-list').innerHTML = `
    <table class="data-table">
      <thead><tr><th>ID</th><th>Nombre</th><th>Tipo</th><th>Capacidad</th><th>Precio/Noche</th><th>Marketplace</th><th>Acciones</th></tr></thead>
      <tbody>${rooms.map(r => `
        <tr>
          <td>${r.id}</td>
          <td><strong>${r.name}</strong></td>
          <td>${r.type}</td>
          <td>${r.capacity}</td>
          <td>$${r.pricePerNight}</td>
          <td>${r.marketplaceListingId ? '<span class="badge badge-success">Publicado</span>' : '<span class="badge badge-warning">No publicado</span>'}</td>
          <td>
            <button class="btn btn-primary btn-sm" onclick="publishMarketplace(${r.id})">Marketplace</button>
          </td>
        </tr>`).join('')}</tbody>
    </table>`;
}

async function publishMarketplace(roomId) {
  try {
    const data = await api(`/rooms/${roomId}/publish-marketplace`, { method: 'POST' });
    alert(`✅ ${data.message} (ID: ${data.listingId})`);
    loadRooms();
  } catch { alert('Error al publicar'); }
}

function showAddRoom() {
  document.getElementById('page-title').textContent = 'Añadir Habitación';
  document.getElementById('rooms-list').innerHTML = `
    <div class="modal-content" style="background:var(--card);max-width:500px;margin:0 auto;">
      <h2>Nueva Habitación</h2>
      <label>Nombre</label><input id="r-name">
      <label>Descripción</label><textarea id="r-desc"></textarea>
      <label>Tipo</label><input id="r-type" placeholder="suite / deluxe / standard / family">
      <label>Capacidad</label><input id="r-capacity" type="number">
      <label>Precio por Noche (MXN)</label><input id="r-price" type="number">
      <button class="btn btn-gold" onclick="saveRoom()">Guardar</button>
    </div>`;
}

async function saveRoom() {
  await api('/rooms', {
    method: 'POST',
    body: JSON.stringify({
      name: document.getElementById('r-name').value,
      description: document.getElementById('r-desc').value,
      type: document.getElementById('r-type').value,
      capacity: parseInt(document.getElementById('r-capacity').value),
      pricePerNight: document.getElementById('r-price').value,
    }),
  });
  loadRooms();
}

// ---- Bookings ----
async function loadBookings() {
  document.getElementById('page-title').textContent = 'Reservas';
  const bookings = await api('/bookings');
  document.getElementById('bookings-list').innerHTML = `
    <table class="data-table">
      <thead><tr><th>#</th><th>Huésped</th><th>Habitación</th><th>Check-in</th><th>Check-out</th><th>Total</th><th>Estado</th><th>Acciones</th></tr></thead>
      <tbody>${bookings.map(b => `
        <tr>
          <td>${b.id}</td>
          <td>${b.guestName}</td>
          <td>${b.roomId || '-'}</td>
          <td>${new Date(b.checkIn).toLocaleDateString()}</td>
          <td>${new Date(b.checkOut).toLocaleDateString()}</td>
          <td>$${b.totalAmount}</td>
          <td><span class="badge badge-${b.status === 'confirmed' ? 'success' : b.status === 'pending' ? 'warning' : 'danger'}">${b.status}</span></td>
          <td>
            <button class="btn btn-success btn-sm" onclick="updateBookingStatus(${b.id},'confirmed')">Confirmar</button>
            <button class="btn btn-danger btn-sm" onclick="updateBookingStatus(${b.id},'cancelled')">Cancelar</button>
          </td>
        </tr>`).join('')}</tbody>
    </table>`;
}

async function updateBookingStatus(id, status) {
  await api(`/bookings/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) });
  loadBookings();
}

// ---- Videos ----
async function loadVideos() {
  document.getElementById('page-title').textContent = 'Videos';
  const videos = await api('/videos');
  document.getElementById('videos-list').innerHTML = `
    <table class="data-table">
      <thead><tr><th>ID</th><th>Título</th><th>Duración</th><th>Estado</th><th>Plataformas</th><th>Publicado</th><th>Acciones</th></tr></thead>
      <tbody>${videos.map(v => `
        <tr>
          <td>${v.id}</td>
          <td>${v.title}</td>
          <td>${v.duration ? Math.floor(v.duration/60)+':'+String(v.duration%60).padStart(2,'0') : '-'}</td>
          <td><span class="badge badge-${v.status === 'published' ? 'success' : v.status === 'pending' ? 'warning' : 'info'}">${v.status}</span></td>
          <td>${(v.platforms || []).join(', ')}</td>
          <td>${v.publishedAt ? new Date(v.publishedAt).toLocaleDateString() : '-'}</td>
          <td>
            <button class="btn btn-primary btn-sm" onclick="showTrimVideo(${v.id})">Recortar</button>
            <button class="btn btn-success btn-sm" onclick="publishVideo(${v.id})">Publicar</button>
          </td>
        </tr>`).join('')}</tbody>
    </table>`;
}

function showUploadVideo() {
  document.getElementById('page-title').textContent = 'Subir Video';
  document.getElementById('videos-list').innerHTML = `
    <div class="modal-content" style="background:var(--card);max-width:500px;margin:0 auto;">
      <h2>Subir Video</h2>
      <label>Título</label><input id="v-title">
      <label>Descripción</label><textarea id="v-desc"></textarea>
      <label>Plataformas</label><select id="v-platforms"><option value="facebook">Facebook</option><option value="instagram">Instagram</option><option value="facebook,instagram">Ambos</option></select>
      <label>Programar publicación</label><input id="v-schedule" type="datetime-local">
      <label>Archivo (MP4, MOV)</label><input id="v-file" type="file" accept=".mp4,.mov">
      <button class="btn btn-gold" onclick="uploadVideo()">Subir</button>
      <div class="loading hidden" id="v-uploading">Subiendo...</div>
    </div>`;
}

async function uploadVideo() {
  const file = document.getElementById('v-file').files[0];
  if (!file) return alert('Selecciona un archivo');
  const form = new FormData();
  form.append('video', file);
  form.append('title', document.getElementById('v-title').value);
  form.append('description', document.getElementById('v-desc').value);
  form.append('platforms', document.getElementById('v-platforms').value);
  const schedule = document.getElementById('v-schedule').value;
  if (schedule) { form.append('scheduled', 'true'); form.append('publishAt', schedule); }
  document.getElementById('v-uploading').classList.remove('hidden');
  try {
    await fetch(`${API}/videos/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    loadVideos();
  } catch { alert('Error al subir'); }
}

function showTrimVideo(id) {
  document.getElementById('videos-list').innerHTML = `
    <div class="modal-content" style="background:var(--card);max-width:500px;margin:0 auto;">
      <h2>Recortar Video #${id}</h2>
      <label>Inicio (segundos)</label><input id="trim-start" type="number" value="0">
      <label>Fin (segundos, dejar vacío hasta el final)</label><input id="trim-end" type="number">
      <button class="btn btn-primary" onclick="trimVideo(${id})">Aplicar Recorte</button>
    </div>`;
}

async function trimVideo(id) {
  await api(`/videos/${id}/trim`, {
    method: 'POST',
    body: JSON.stringify({
      start: parseInt(document.getElementById('trim-start').value) || 0,
      end: parseInt(document.getElementById('trim-end').value) || undefined,
    }),
  });
  alert('✅ Video recortado');
  loadVideos();
}

async function publishVideo(id) {
  if (!confirm('¿Publicar este video en las plataformas configuradas?')) return;
  await api(`/videos/${id}/publish`, { method: 'POST' });
  alert('✅ Video publicado');
  loadVideos();
}

// ---- Promotions ----
async function loadPromotions() {
  document.getElementById('page-title').textContent = 'Promociones';
  const promos = await api('/promotions');
  document.getElementById('promotions-list').innerHTML = `
    <table class="data-table">
      <thead><tr><th>ID</th><th>Título</th><th>Descuento</th><th>Inicio</th><th>Fin</th><th>Estado</th></tr></thead>
      <tbody>${promos.map(p => `
        <tr>
          <td>${p.id}</td>
          <td>${p.title}</td>
          <td>${p.discountPercent ? p.discountPercent+'%' : '-'}</td>
          <td>${new Date(p.startDate).toLocaleDateString()}</td>
          <td>${new Date(p.endDate).toLocaleDateString()}</td>
          <td><span class="badge badge-${p.status === 'active' ? 'success' : 'warning'}">${p.status}</span></td>
        </tr>`).join('')}</tbody>
    </table>`;
}

function showAddPromotion() {
  document.getElementById('page-title').textContent = 'Nueva Promoción';
  document.getElementById('promotions-list').innerHTML = `
    <div class="modal-content" style="background:var(--card);max-width:500px;margin:0 auto;">
      <h2>Nueva Promoción</h2>
      <label>Título</label><input id="p-title">
      <label>Descripción</label><textarea id="p-desc"></textarea>
      <label>% Descuento</label><input id="p-discount" type="number">
      <label>Inicio</label><input id="p-start" type="date">
      <label>Fin</label><input id="p-end" type="date">
      <button class="btn btn-gold" onclick="savePromotion()">Guardar</button>
    </div>`;
}

async function savePromotion() {
  await api('/promotions', {
    method: 'POST',
    body: JSON.stringify({
      title: document.getElementById('p-title').value,
      description: document.getElementById('p-desc').value,
      discountPercent: document.getElementById('p-discount').value,
      startDate: new Date(document.getElementById('p-start').value).toISOString(),
      endDate: new Date(document.getElementById('p-end').value).toISOString(),
      status: 'active',
    }),
  });
  loadPromotions();
}

// ---- Conversations ----
async function loadConversations() {
  document.getElementById('page-title').textContent = 'Conversaciones';
  const convs = await api('/conversations');
  document.getElementById('conversations-list').innerHTML = `
    <table class="data-table">
      <thead><tr><th>ID</th><th>Cliente</th><th>Teléfono</th><th>Origen</th><th>Estado</th><th>Última actividad</th></tr></thead>
      <tbody>${convs.length ? convs.map(c => `
        <tr>
          <td>${c.id}</td>
          <td>${c.guestName || '-'}</td>
          <td>${c.guestPhone || '-'}</td>
          <td>${c.source}</td>
          <td><span class="badge badge-${c.status === 'active' ? 'success' : 'warning'}">${c.status}</span></td>
          <td>${c.updatedAt ? new Date(c.updatedAt).toLocaleString() : '-'}</td>
        </tr>`).join('') : '<tr><td colspan="6" style="text-align:center;padding:40px;color:#888">No hay conversaciones</td></tr>'}</tbody>
    </table>`;
}

// ---- Agent Chat ----
async function sendAgentMessage() {
  const input = document.getElementById('chat-input');
  const msg = input.value.trim();
  if (!msg) return;
  input.value = '';
  const container = document.getElementById('chat-messages');
  container.innerHTML += `<div class="chat-message user"><div class="sender">Tú</div><div class="bubble">${escapeHtml(msg)}</div></div>`;
  container.innerHTML += `<div class="chat-message"><div class="sender">Hermes</div><div class="bubble"><em>Escribiendo...</em></div></div>`;
  container.scrollTop = container.scrollHeight;

  try {
    const data = await api('/agent/chat', {
      method: 'POST',
      body: JSON.stringify({ message: msg }),
    });
    container.querySelector('.chat-message:last-child').outerHTML =
      `<div class="chat-message"><div class="sender">Hermes</div><div class="bubble">${escapeHtml(data.response)}</div></div>`;
  } catch {
    container.querySelector('.chat-message:last-child').outerHTML =
      `<div class="chat-message"><div class="sender">Hermes</div><div class="bubble">Error de conexión</div></div>`;
  }
  container.scrollTop = container.scrollHeight;
}

function escapeHtml(text) {
  return text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
}

// ---- Handlers ----
function handleLogin() {
  const user = document.getElementById('login-user').value;
  const pass = document.getElementById('login-pass').value;
  login(user, pass).catch(() => {
    document.getElementById('login-error').classList.remove('hidden');
  });
}

// ---- Init ----
renderApp();
