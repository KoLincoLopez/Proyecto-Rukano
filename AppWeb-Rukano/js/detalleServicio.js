// ─── SESSION SIMULATION ───
let isLoggedIn = false;

function toggleLogin() {
  isLoggedIn = !isLoggedIn;
  applyLoginState();
}

function simulateLogin(e) {
  e.preventDefault();
  isLoggedIn = true;
  applyLoginState();
}

function applyLoginState() {
  document.body.classList.toggle('logged-in', isLoggedIn);
  document.getElementById('demo-track').classList.toggle('on', isLoggedIn);
  document.getElementById('demo-label').textContent = isLoggedIn ? 'Con sesión' : 'Sin sesión';
  // Enable/disable report button based on login state
  const reportBtn = document.querySelector('.btn-report');
  if (reportBtn) {
    reportBtn.disabled = !isLoggedIn;
    reportBtn.classList.toggle('disabled', !isLoggedIn);
    reportBtn.setAttribute('aria-disabled', (!isLoggedIn).toString());
  }
}

// ─── MODAL ───
function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
  document.body.style.overflow = '';
  // reset after close
  setTimeout(() => {
    document.getElementById('modal-form-content').classList.remove('hidden');
    document.getElementById('modal-success').classList.remove('show');
  }, 300);
}

function closeModalOutside(e) {
  if (e.target === document.getElementById('modal-overlay')) closeModal();
}

// ─── BOOL BUTTONS ───
function selectBool(qId, val, btn) {
  const group = btn.parentElement;
  group.querySelectorAll('.fq-bool-btn').forEach(b => {
    b.classList.remove('selected-yes', 'selected-no');
  });
  document.getElementById(qId).value = val;
  btn.classList.add(val === 'si' ? 'selected-yes' : 'selected-no');
}

// ─── SCHEDULE CALENDAR ───
const availableTimes = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'];
const occupiedScheduleOffsets = [
  { offset: 1, busy: ['09:00', '10:00', '14:00'] },
  { offset: 3, busy: ['08:00', '12:00', '15:00', '16:00'] },
  { offset: 5, busy: ['11:00', '13:00', '17:00'] }
];

let scheduleDays = [];

function formatDate(date) {
  return date.toLocaleDateString('es-CL', { weekday: 'short', day: '2-digit', month: 'short' });
}

function toISODate(date) {
  return date.toISOString().split('T')[0];
}

function initSchedule() {
  const today = new Date();
  scheduleDays = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const iso = toISODate(d);
    const config = occupiedScheduleOffsets.find(item => item.offset === i);
    const busy = config ? config.busy : [];
    scheduleDays.push({ date: d, iso, busy, fullBusy: busy.length >= availableTimes.length });
  }
  renderCalendar();
  renderTimeSlots();
}

function renderCalendar() {
  const calendar = document.getElementById('schedule-calendar');
  calendar.innerHTML = '';
  scheduleDays.forEach(day => {
    const dayBtn = document.createElement('button');
    dayBtn.type = 'button';
    dayBtn.className = 'calendar-day';
    dayBtn.textContent = `${formatDate(day.date)}`;
    dayBtn.dataset.iso = day.iso;
    if (day.fullBusy) {
      dayBtn.classList.add('full-busy');
      dayBtn.disabled = true;
    } else if (day.busy.length) {
      dayBtn.classList.add('busy');
    }
    dayBtn.addEventListener('click', () => selectScheduleDate(day.iso));
    calendar.appendChild(dayBtn);
  });
}

function selectScheduleDate(dateIso) {
  const selected = scheduleDays.find(day => day.iso === dateIso);
  if (!selected || selected.fullBusy) return;

  document.getElementById('selectedDate').value = dateIso;
  document.getElementById('selected-date-label').textContent = selected.date.toLocaleDateString('es-CL', { weekday: 'long', day: '2-digit', month: 'long' });
  document.getElementById('schedule-warning').classList.remove('visible');
  document.getElementById('selectedTime').value = '';
  clearSelectedTime();
  renderTimeSlots(selected);
  highlightSelectedDay(dateIso);
}

function highlightSelectedDay(dateIso) {
  document.querySelectorAll('.calendar-day').forEach(btn => {
    btn.classList.toggle('selected', btn.dataset.iso === dateIso);
  });
}

function clearSelectedTime() {
  document.querySelectorAll('.timeslot-btn').forEach(btn => btn.classList.remove('selected'));
}

function renderTimeSlots(selectedDay = null) {
  const grid = document.getElementById('timeslot-grid');
  grid.innerHTML = '';
  const dateKey = selectedDay ? selectedDay.iso : null;
  const busyTimes = selectedDay ? selectedDay.busy : [];

  availableTimes.forEach(time => {
    const timeBtn = document.createElement('button');
    timeBtn.type = 'button';
    timeBtn.className = 'timeslot-btn';
    timeBtn.textContent = time;
    if (!dateKey) {
      timeBtn.disabled = true;
      timeBtn.style.cursor = 'not-allowed';
      timeBtn.style.opacity = '0.4';
    } else if (busyTimes.includes(time)) {
      timeBtn.classList.add('busy');
      timeBtn.disabled = true;
    } else {
      timeBtn.addEventListener('click', () => {
        document.getElementById('selectedTime').value = time;
        clearSelectedTime();
        timeBtn.classList.add('selected');
        document.getElementById('schedule-warning').classList.remove('visible');
      });
    }
    grid.appendChild(timeBtn);
  });
}

function validateSchedule() {
  const selectedDate = document.getElementById('selectedDate').value;
  const selectedTime = document.getElementById('selectedTime').value;
  if (!selectedDate || !selectedTime) {
    document.getElementById('schedule-warning').classList.add('visible');
    return false;
  }
  return true;
}

function resetSchedule() {
  document.getElementById('selectedDate').value = '';
  document.getElementById('selectedTime').value = '';
  document.getElementById('selected-date-label').textContent = 'Ninguna';
  document.getElementById('schedule-warning').classList.remove('visible');
  renderCalendar();
  renderTimeSlots();
}

function openModal() {
  resetSchedule();
  document.getElementById('modal-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

// ─── SUBMIT ───
function submitForm() {
  if (!validateSchedule()) return;

  // Validate required fields
  const q1 = document.getElementById('q1').value.trim();
  const q2 = document.getElementById('q2').value;

  let ok = true;

  if (!q1) {
    document.getElementById('q1').style.borderColor = 'var(--c-mahogany)';
    ok = false;
  } else {
    document.getElementById('q1').style.borderColor = '';
  }

  if (!q2) {
    document.getElementById('q2-bool').style.outline = '2px solid var(--c-mahogany)';
    ok = false;
  } else {
    document.getElementById('q2-bool').style.outline = '';
  }

  if (!ok) return;

  // Show success
  const selectedDate = document.getElementById('selectedDate').value;
  const selectedTime = document.getElementById('selectedTime').value;
  const successDesc = document.querySelector('.ms-desc');
  successDesc.textContent = `Solicitud enviada para el ${new Date(selectedDate).toLocaleDateString('es-CL', { weekday: 'long', day: '2-digit', month: 'long' })} a las ${selectedTime}. Juan Rojas se pondrá en contacto.`;

  document.getElementById('modal-form-content').classList.add('hidden');
  document.getElementById('modal-success').classList.add('show');
}

let reportImageData = '';

// MOCK: reseñas de prueba para visualización
const MOCK_REPORT_REVIEWS = [
  { user: 'Camila P.', avatar: '', body: 'Reporté este servicio porque el profesional nunca llegó y dejaron el trabajo a medias.' },
  { user: 'Andrés L.', avatar: '', body: 'Precio muy por encima del mercado para un trabajo tan simple. Cuidado.' },
  { user: 'Lucía R.', avatar: '', body: 'Atención rápida, pero falló en la limpieza final. No recomiendo totalmente.' }
];

// MOCK: reseñas del técnico (no son reportes)
const MOCK_TECH_REVIEWS = [
  { user: 'María S.', avatar: '', rating: 5, title: 'Excelente servicio', body: 'Juan fue puntual, muy profesional y dejó todo impecable. Lo recomiendo 100%.' },
  { user: 'Roberto G.', avatar: '', rating: 4, title: 'Buen trabajo', body: 'Trabajo rápido y con buena mano. Hubo detalles menores pero satisfecho.' },
  { user: 'Ana P.', avatar: '', rating: 3, title: 'Aceptable', body: 'El trabajo quedó bien pero tardó más de lo acordado.' }
];

function openReportModal() {
  document.getElementById('report-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
  document.getElementById('report-motivo').value = '';
  document.getElementById('report-cuerpo').value = '';
  document.getElementById('report-char-count').textContent = '0 / 300';
  document.getElementById('report-imagen').value = '';
  document.getElementById('report-image-preview').classList.add('hidden');
  document.getElementById('report-image-preview').innerHTML = '';
  document.getElementById('report-warning').classList.remove('visible');
  document.getElementById('report-form-content').classList.remove('hidden');
  document.getElementById('report-success').classList.remove('show');
  reportImageData = '';
  // Render mock reviews for visual testing
  renderReportReviews(MOCK_REPORT_REVIEWS);
}

function closeReportModal() {
  document.getElementById('report-overlay').classList.remove('open');
  document.body.style.overflow = '';
  setTimeout(() => {
    document.getElementById('report-form-content').classList.remove('hidden');
    document.getElementById('report-success').classList.remove('show');
  }, 300);
}

function closeReportModalOutside(e) {
  if (e.target === document.getElementById('report-overlay')) closeReportModal();
}

function updateReportCharCount() {
  const count = document.getElementById('report-cuerpo').value.length;
  document.getElementById('report-char-count').textContent = `${count} / 300`;
}

function handleReportImage(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    document.getElementById('report-warning').textContent = 'Sólo se permiten imágenes.';
    document.getElementById('report-warning').classList.add('visible');
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    reportImageData = reader.result;
    const preview = document.getElementById('report-image-preview');
    preview.innerHTML = `<img src="${reportImageData}" alt="Vista previa de imagen" />`;
    preview.classList.remove('hidden');
  };
  reader.readAsDataURL(file);
}

async function submitReport() {
  const motivo = document.getElementById('report-motivo').value;
  const cuerpo = document.getElementById('report-cuerpo').value.trim();
  const serviceId = document.getElementById('report-service-id').value;
  const warning = document.getElementById('report-warning');

  warning.classList.remove('visible');
  warning.textContent = 'Completa todos los campos obligatorios antes de enviar.';

  if (!motivo || cuerpo.length < 30 || cuerpo.length > 300) {
    warning.classList.add('visible');
    if (!motivo) {
      warning.textContent = 'Selecciona un motivo de reporte.';
    } else if (cuerpo.length < 30) {
      warning.textContent = 'El cuerpo del reporte debe tener al menos 30 caracteres.';
    } else if (cuerpo.length > 300) {
      warning.textContent = 'El cuerpo del reporte no puede exceder 300 caracteres.';
    }
    return;
  }

  const payload = {
    idServicio: serviceId,
    motivo,
    cuerpo,
    imagen: reportImageData || ''
  };

  try {
    const response = await fetch('/reports/reportar_servicio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    let data = {};
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      try {
        data = await response.json();
      } catch (e) {
        data = {};
      }
    } else {
      const text = await response.text();
      try { data = text ? JSON.parse(text) : {}; } catch (e) { data = {}; }
    }

    if (!response.ok) {
      throw new Error((data && (data.detail || data.message)) || 'Error al enviar el reporte.');
    }

    document.getElementById('report-form-content').classList.add('hidden');
    document.getElementById('report-success').classList.add('show');
    // If server returned an idReporte, try to load its reviews
    const reportId = data && data.idReporte ? data.idReporte : null;
    if (reportId) fetchReportReviews(reportId);
  } catch (error) {
    warning.textContent = error.message;
    warning.classList.add('visible');
  }
}

// Render reviews into the read-only list
function renderReportReviews(reviews) {
  const list = document.getElementById('reviews-list');
  list.innerHTML = '';
  if (!reviews || !reviews.length) {
    list.innerHTML = '<div class="reviews-empty">Aún no hay reseñas para este reporte.</div>';
    return;
  }
  reviews.forEach(r => {
    const item = document.createElement('div');
    item.className = 'review-item';
    const avatar = document.createElement('div');
    avatar.className = 'review-avatar';
    if (r.avatar) {
      const img = document.createElement('img');
      img.src = r.avatar;
      img.alt = r.user || 'avatar';
      img.style.width = '100%'; img.style.height = '100%'; img.style.borderRadius = '50%';
      avatar.innerHTML = '';
      avatar.appendChild(img);
    } else {
      avatar.textContent = (r.user ? r.user.charAt(0).toUpperCase() : '?');
    }

    const content = document.createElement('div');
    content.className = 'review-content';
    const user = document.createElement('div');
    user.className = 'review-user';
    user.textContent = r.user || 'Usuario anónimo';
    const body = document.createElement('div');
    body.className = 'review-body';
    body.textContent = r.body || '';

    content.appendChild(user);
    content.appendChild(body);
    item.appendChild(avatar);
    item.appendChild(content);
    list.appendChild(item);
  });
}

// Render larger technician reviews (title, body, stars, photo)
function renderTechReviews(reviews) {
  const container = document.getElementById('tech-reviews-list');
  if (!container) return;
  container.innerHTML = '';
  if (!reviews || reviews.length === 0) {
    container.innerHTML = '<div class="reviews-empty">Aún no hay reseñas del técnico.</div>';
    return;
  }
  reviews.forEach(r => {
    const card = document.createElement('div');
    card.className = 'review-card';

    const left = document.createElement('div');
    left.className = 'review-card-left';
    const avatar = document.createElement('div');
    avatar.className = 'review-card-avatar';
    if (r.avatar) {
      const img = document.createElement('img'); img.src = r.avatar; img.alt = r.user || 'avatar';
      avatar.appendChild(img);
    } else {
      avatar.textContent = (r.user ? r.user.charAt(0).toUpperCase() : '?');
    }
    left.appendChild(avatar);

    const right = document.createElement('div');
    right.className = 'review-card-right';
    const header = document.createElement('div'); header.className = 'review-card-header';
    const name = document.createElement('div'); name.className = 'review-card-user'; name.textContent = r.user || 'Anonimo';
    const title = document.createElement('div'); title.className = 'review-card-title'; title.textContent = r.title || '';
    header.appendChild(name); header.appendChild(title);

    const stars = document.createElement('div'); stars.className = 'review-card-stars';
    const rating = Math.max(0, Math.min(5, Math.round(r.rating || 0)));
    for (let i=1;i<=5;i++){
      const s = document.createElement('i'); s.className = 'ti ti-star-filled star';
      if (i<=rating) s.classList.add('filled'); else s.classList.remove('filled');
      stars.appendChild(s);
    }
    const ratingNum = document.createElement('span'); ratingNum.className='review-card-rating-num'; ratingNum.textContent = (r.rating||0).toString();
    stars.appendChild(ratingNum);

    const body = document.createElement('div'); body.className = 'review-card-body'; body.textContent = r.body || '';

    right.appendChild(header);
    right.appendChild(stars);
    right.appendChild(body);

    card.appendChild(left);
    card.appendChild(right);
    container.appendChild(card);
  });
}

// Try to fetch reviews for a report id; if endpoint missing, handle gracefully
async function fetchReportReviews(reportId) {
  try {
    const res = await fetch(`/reports/${reportId}/reviews`);
    if (!res.ok) {
      renderReportReviews([]);
      return;
    }
    const json = await res.json();
    renderReportReviews(Array.isArray(json) ? json : []);
  } catch (e) {
    // Endpoint may not exist yet — keep UI quiet
    renderReportReviews([]);
  }
}



initSchedule();
// Ensure UI reflects login state on first load
applyLoginState();
// Render technician reviews in the dedicated block
renderTechReviews(MOCK_TECH_REVIEWS);
