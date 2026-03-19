const SUPABASE_URL = 'https://uatvgstjiphqvqvndytn.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhdHZnc3RqaXBocXZxdm5keXRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0MTQ1MDMsImV4cCI6MjA4ODk5MDUwM30.OGfBq48kJ_gq_tgZSTq04ik1Y9XpmT6kztks9uroiNw';
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Identidad inyectada localmente para todo el sistema
const COMPUTER_USERNAME = "artez";

const ROOM_TYPES = {
    type1: { id: 'type1', label: 'Autogestión', badgeClass: 'badge-type1' },
    type2: { id: 'type2', label: 'Solo Gerentes', badgeClass: 'badge-type2' },
    type3: { id: 'type3', label: 'Requiere Aprobación', badgeClass: 'badge-type3' }
};

let mockRooms = [];
let globalBookings = [];
let mockApprovals = [];
let userRolesDb = [];

const state = {
    role: 'user', // user, manager, admin
    filter: 'all',
    selectedRoom: null
};

// --- DATA FETCHING (Supabase) ---
async function fetchAllData() {
    try {
        const { data: roomsData, error: roomsErr } = await db.from('rooms').select('*').order('id', { ascending: true });
        if (roomsErr) throw roomsErr;
        mockRooms = roomsData || [];

        const { data: bookingsData, error: bookErr } = await db.from('bookings').select('*').order('start_time', { ascending: true });
        if (bookErr) throw bookErr;
        globalBookings = bookingsData || [];

        try {
            const { data: adData } = await db.from('user_roles').select('*').order('username');
            userRolesDb = adData || [];
        } catch(e) {}

        mockApprovals = [];
        globalBookings.forEach(b => {
             if (b.status === 'pending') {
                 const r = mockRooms.find(rm => rm.id == b.roomId); // == para flexibilizar string/int
                 if (r) {
                     mockApprovals.push({
                         id: b.id,
                         roomId: b.roomId,
                         roomName: r.name,
                         requestedBy: b.requested_by || 'Usuario Local',
                         date: new Date(b.start_time).toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
                         time: `${new Date(b.start_time).getHours()}:${String(new Date(b.start_time).getMinutes()).padStart(2,"0")} - ${new Date(b.end_time).getHours()}:${String(new Date(b.end_time).getMinutes()).padStart(2,"0")}`,
                         reason: b.title
                     });
                 }
             }
        });
    } catch(e) {
        console.error('Error fetching Supabase data:', e);
        showToast('Error de conexión a la Base de Datos Remota.');
    }
}

// --- INIT ---
document.addEventListener('DOMContentLoaded', async () => {
    // Referencias
    const roleSelector = document.getElementById('role');
    const filterBtns = document.querySelectorAll('.filter-btn');
    const viewCardsBtn = document.getElementById('viewCardsBtn');
    const viewCalendarBtn = document.getElementById('viewCalendarBtn');
    const viewApprovalsBtn = document.getElementById('viewApprovalsBtn');
    const viewAdminBtn = document.getElementById('viewAdminBtn');
    const viewConfigBtn = document.getElementById('viewConfigBtn');

    const roomsGrid = document.getElementById('roomsGrid');
    const calendarView = document.getElementById('calendarView');
    const approvalsView = document.getElementById('approvalsView');
    const adminView = document.getElementById('adminView');
    const configView = document.getElementById('configView');

    function hideAllViews() {
        roomsGrid.style.display = 'none';
        calendarView.style.display = 'none';
        approvalsView.style.display = 'none';
        adminView.style.display = 'none';
        configView.style.display = 'none';
        viewCardsBtn.classList.remove('active');
        viewCalendarBtn.classList.remove('active');
        viewApprovalsBtn.classList.remove('active');
        viewAdminBtn.classList.remove('active');
        viewConfigBtn.classList.remove('active');
    }

    // Toggles
    viewCardsBtn.addEventListener('click', () => {
        hideAllViews(); viewCardsBtn.classList.add('active'); roomsGrid.style.display = 'grid';
    });
    viewCalendarBtn.addEventListener('click', () => {
        hideAllViews(); viewCalendarBtn.classList.add('active'); calendarView.style.display = 'block'; renderCalendar();
    });
    viewApprovalsBtn.addEventListener('click', () => {
        hideAllViews(); viewApprovalsBtn.classList.add('active'); approvalsView.style.display = 'block'; renderApprovals();
    });
    viewAdminBtn.addEventListener('click', () => {
        hideAllViews(); viewAdminBtn.classList.add('active'); adminView.style.display = 'block'; renderAdminRooms();
    });
    viewConfigBtn.addEventListener('click', () => {
        hideAllViews(); viewConfigBtn.classList.add('active'); configView.style.display = 'block'; renderConfigAdmins();
    });
    
    window.updateRoleUI = function() {
        const isAdmin = isRealAdmin();
        if (isAdmin) {
            viewApprovalsBtn.style.display = 'flex';
            viewAdminBtn.style.display = 'flex';
            viewConfigBtn.style.display = 'flex';
        } else {
            viewApprovalsBtn.style.display = 'none';
            viewAdminBtn.style.display = 'none';
            viewConfigBtn.style.display = 'none';
            if (approvalsView.style.display === 'block' || adminView.style.display === 'block' || configView.style.display === 'block') viewCardsBtn.click();
        }
    };

    roleSelector.addEventListener('change', (e) => {
        state.role = e.target.value;
        updateRoleUI();
        renderRooms(); 
        if (calendarView.style.display !== 'none') renderCalendar();
        showToast(`Sesión de Rol cambiada a: ${e.target.options[e.target.selectedIndex].text}`);
    });

    filterBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            filterBtns.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            state.filter = e.target.dataset.filter;
            renderRooms();
            if (calendarView.style.display !== 'none') renderCalendar();
        });
    });

    // Eventos del Modal de Reserva
    const closeBtns = [document.getElementById('closeModalBtn'), document.getElementById('cancelBtn'), document.getElementById('modalOverlay')];
    closeBtns.forEach(btn => {
        if(btn) btn.addEventListener('click', closeModal);
    });
    if(confirmBtn) confirmBtn.addEventListener('click', handleConfirmBooking);

    // Cargar datos sincronizados iniciales
    await fetchAllData();
    if(window.updateRoleUI) window.updateRoleUI();
    renderRooms();
    lucide.createIcons();
});

// --- HELPERS ADMINISTRATIVOS REALES ---
function isRealAdmin() {
    return state.role === 'admin' || userRolesDb.some(a => a.username === COMPUTER_USERNAME && a.role === 'admin');
}
function isRealManager() {
    // Si estás forzado en el simulador a manager, o tu usuario DB tiene rol manager/admin.
    return state.role === 'manager' || userRolesDb.some(a => a.username === COMPUTER_USERNAME && (a.role === 'manager' || a.role === 'admin'));
}

// --- RENDERING MAIN ---
function renderRooms() {
    const grid = document.getElementById('roomsGrid');
    grid.innerHTML = '';
    const filteredRooms = state.filter === 'all' ? mockRooms : mockRooms.filter(r => r.type === state.filter);
    
    if(filteredRooms.length === 0) {
        grid.innerHTML = '<p style="grid-column: 1/-1; text-align:center; color: var(--text-secondary); padding: 40px; background:var(--controls-bg); border-radius:18px;">No hay datos encontrados en la Base de Datos Remota.</p>';
        return;
    }

    filteredRooms.forEach(room => {
        const typeInfo = ROOM_TYPES[room.type] || ROOM_TYPES.type1;
        const canBookResult = canUserBook(room, state.role);
        
        const card = document.createElement('div');
        card.className = 'room-card';
        card.innerHTML = `
            <div class="card-img-placeholder">
                <img src="${room.imageUrl}" alt="${room.name}" class="room-card-image">
                <span class="card-badge ${typeInfo.badgeClass}">${typeInfo.label}</span>
            </div>
            <div class="card-content">
                <h3 class="card-title">${room.name}</h3>
                <div class="card-info">
                    <span><i data-lucide="users" class="icon-small"></i> ${room.capacity} pax</span>
                </div>
                <div class="card-info" style="margin-top: -10px;">
                    <span><i data-lucide="monitor" class="icon-small"></i> ${room.equipment}</span>
                </div>
                <div class="card-actions">
                    <button class="btn ${canBookResult.allowed ? 'btn-primary' : 'btn-secondary'}" 
                            onclick="openBookingModal(${room.id})"
                            ${!canBookResult.allowed && room.type === 'type2' ? 'disabled' : ''}>
                        ${canBookResult.buttonText}
                    </button>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
    lucide.createIcons();
}

function canUserBook(room, role) {
    const isAdm = isRealAdmin();
    if (room.type === ROOM_TYPES.type1.id) return { allowed: true, buttonText: 'Reservar (Inmediata)' };
    if (room.type === ROOM_TYPES.type2.id) {
        if (isRealManager() || isAdm) return { allowed: true, buttonText: 'Reservar (Ejecutiva)' };
        return { allowed: false, buttonText: 'Solo Gerentes' };
    }
    if (room.type === ROOM_TYPES.type3.id) {
        if (isAdm) return { allowed: true, buttonText: 'Aprobar Reserva Directa' };
        return { allowed: true, buttonText: 'Solicitar Aprobación' };
    }
    return { allowed: false, buttonText: 'No disponible' };
}

// --- BOOKING LOGIC ---
function isOverlapping(roomId, newStart, newEnd) {
    return globalBookings.some(b => b.roomId == roomId && newStart < b.end_time && b.start_time < newEnd);
}

function openBookingModal(roomId) {
    const room = mockRooms.find(r => r.id === roomId);
    state.selectedRoom = room;

    const modal = document.getElementById('bookingModal');
    document.getElementById('modalTitle').textContent = `Reservar: ${room.name}`;
    document.getElementById('modalDescription').textContent = `Aforo: ${room.capacity} personas | Equipo: ${room.equipment}`;
    
    document.getElementById('modalStatusMessage').style.display = 'none';
    document.getElementById('bookingStart').value = '';
    document.getElementById('bookingEnd').value = '';
    document.getElementById('bookingReason').value = '';
    
    const permission = canUserBook(room, state.role);
    document.getElementById('confirmBtn').textContent = permission.buttonText;
    modal.classList.add('show');
}
function closeModal() { document.getElementById('bookingModal').classList.remove('show'); state.selectedRoom = null; }

async function handleConfirmBooking() {
    const startVal = document.getElementById('bookingStart').value;
    const endVal = document.getElementById('bookingEnd').value;
    const reason = document.getElementById('bookingReason').value || 'Reserva general';
    const statusMsg = document.getElementById('modalStatusMessage');

    if (!startVal || !endVal) {
        statusMsg.style.display = 'block'; statusMsg.className = 'status-message error'; statusMsg.textContent = 'Selecciona la fecha de inicio y fin.'; return;
    }

    const start = new Date(startVal).getTime();
    const end = new Date(endVal).getTime();

    if (end <= start) {
        statusMsg.style.display = 'block'; statusMsg.className = 'status-message error'; statusMsg.textContent = 'La hora de fin debe ser posterior al inicio.'; return;
    }

    const room = state.selectedRoom;
    if (isOverlapping(room.id, start, end)) {
        statusMsg.style.display = 'block'; statusMsg.className = 'status-message error'; statusMsg.textContent = 'Este horario entra en conflicto con una reserva existente o pendiente validada en la DB.'; return;
    }

    const bookingStatus = (room.type === 'type3' && !isRealAdmin()) ? 'pending' : (room.type === 'type2' ? 'manager' : 'confirmed');
    
    const newBooking = { "roomId": parseInt(room.id), title: reason, start_time: start, end_time: end, status: bookingStatus, requested_by: COMPUTER_USERNAME };
    
    const { error } = await db.from('bookings').insert([newBooking]);
    
    if (error) {
        console.error(error);
        statusMsg.style.display = 'block'; statusMsg.className = 'status-message error'; statusMsg.textContent = 'Error al grabar en la base de datos de Supabase.'; return;
    }

    await fetchAllData();
    closeModal();
    if (document.getElementById('calendarView').style.display === 'block') renderCalendar();
    
    if (bookingStatus === 'pending') {
        if (document.getElementById('approvalsView').style.display === 'block') renderApprovals();
        showToast('Solicitud enviada e ingresada en Supabase. Pendiente de aprobación.');
    } else {
        showToast('¡Reserva remota confirmada con éxito!');
    }
}

// --- CALENDAR ---
function generateNext7Days() {
    const dates = []; const today = new Date();
    for (let i = 0; i < 7; i++) {
        const d = new Date(today); d.setDate(today.getDate() + i); dates.push(d);
    }
    return dates;
}

function renderCalendar() {
    const container = document.getElementById('calendarView');
    const dates = generateNext7Days();
    let html = '<div style="overflow-x: auto; padding-bottom: 2rem;"><div class="calendar-grid"><div class="cal-header" style="text-align:right;">Hora</div>';
    
    dates.forEach(d => html += `<div class="cal-header">${d.toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit', month: '2-digit' })}</div>`);

    const filteredRooms = state.filter === 'all' ? mockRooms : mockRooms.filter(r => r.type === state.filter);
    
    // 1. Filtrar las reuniones pendientes (ya no aparecerán en el calendario hasta que se aprueben)
    const confirmedBookings = globalBookings.filter(b => b.status !== 'pending');

    // 2. Grilla Horaria (de 00:00 a 23:00 para visibilidad completa nocturna)
    for (let h = 0; h <= 23; h++) {
        const hourStr = `${String(h).padStart(2, '0')}:00`;
        html += `<div class="cal-time">${hourStr}</div>`;
        
        dates.forEach(d => {
            html += `<div class="cal-cell">`;
            
            const timeStart = new Date(d); timeStart.setHours(h, 0, 0, 0);
            const timeEnd = new Date(d); timeEnd.setHours(h + 1, 0, 0, 0);
            const ts = timeStart.getTime();
            const te = timeEnd.getTime();
            
            filteredRooms.forEach(room => {
                const bookingsInHour = confirmedBookings.filter(b => 
                    b.roomId == room.id && 
                    b.start_time < te && 
                    b.end_time > ts
                );
                
                bookingsInHour.forEach(hasBooking => {
                     const isOwner = hasBooking.requested_by === COMPUTER_USERNAME;
                     const canDelete = isRealAdmin() || isOwner;
                     
                     const clickAttr = canDelete ? `onclick="cancelBooking(${hasBooking.id})"` : '';
                     const tooltip = `Reservado por: ${hasBooking.requested_by || 'Anónimo'} \nMotivo: ${hasBooking.title}`;
                     const titleStr = canDelete ? `${tooltip} \n(¡Clic para eliminar tu reserva!)` : tooltip;
                     const cursorStyle = canDelete ? 'cursor: pointer;' : 'cursor: default;';
                     
                     html += `<div class="cal-booking ${hasBooking.status}" title="${titleStr}" ${clickAttr} style="${cursorStyle}">
                                <strong>${room.name} - ${hasBooking.requested_by || 'Anónimo'}</strong><br>
                                <span style="font-weight:400; font-size:10px;">${hasBooking.title}</span>
                              </div>`;
                });
            });
            
            html += `</div>`;
        });
    }
    
    html += '</div></div>';
    container.innerHTML = html;
}

// --- APPROVALS ---
function renderApprovals() {
    const list = document.getElementById('approvalsList');
    list.innerHTML = '';
    if (mockApprovals.length === 0) {
        list.innerHTML = '<p style="color: var(--text-secondary); padding: 3rem; background: var(--controls-bg); border-radius: 18px; text-align: center;">No hay solicitudes pendientes en la nube.</p>'; return;
    }

    mockApprovals.forEach(app => {
        const card = document.createElement('div');
        card.className = 'approval-card';
        card.innerHTML = `
            <div class="approval-info">
                <h4>${app.roomName}</h4>
                <p><i data-lucide="user" class="icon-small"></i> <strong>Solicitante:</strong>&nbsp; ${app.requestedBy}</p>
                <p><i data-lucide="calendar" class="icon-small"></i> <strong>Fecha:</strong>&nbsp; ${app.date}</p>
                <p><i data-lucide="clock" class="icon-small"></i> <strong>Horario:</strong>&nbsp; ${app.time}</p>
                <p><i data-lucide="file-text" class="icon-small"></i> <strong>Motivo:</strong>&nbsp; ${app.reason}</p>
            </div>
            <div class="approval-actions">
                <button class="btn-reject" title="Rechazar" onclick="handleApproval(${app.id}, false)"><i data-lucide="x"></i> Rechazar</button>
                <button class="btn-approve" title="Aprobar" onclick="handleApproval(${app.id}, true)"><i data-lucide="check"></i> Aprobar</button>
            </div>
        `;
        list.appendChild(card);
    });
    lucide.createIcons();
}

async function handleApproval(id, isApproved) {
    if (isApproved) {
        const { error } = await db.from('bookings').update({ status: 'confirmed' }).eq('id', id);
        if(error) { showToast('Error DB al aprobar'); return; }
    } else {
        const { error } = await db.from('bookings').delete().eq('id', id);
        if(error) { showToast('Error DB al rechazar'); return; }
    }
    
    await fetchAllData();
    if (document.getElementById('approvalsView').style.display !== 'none') renderApprovals();
    if (document.getElementById('calendarView').style.display !== 'none') renderCalendar();
    
    showToast(isApproved ? '✅ Reserva aprobada. Horario asegurado en calendario.' : '❌ Solicitud rechazada. El horario ha sido liberado de la matriz.');
}

// --- ADMIN ROOMS ABM ---
function renderAdminRooms() {
    const list = document.getElementById('adminRoomsList');
    let html = `
        <div style="overflow-x: auto;">
        <table class="admin-table">
            <thead><tr><th>Nombre de Sala</th><th>Capacidad (Aforo)</th><th>Nivel Acceso</th><th>Acciones</th></tr></thead>
            <tbody>
    `;

    mockRooms.forEach(room => {
        const typeInfo = ROOM_TYPES[room.type] || ROOM_TYPES.type1;
        html += `
            <tr>
                <td><strong>${room.name}</strong></td>
                <td><i data-lucide="users" class="icon-small"></i> ${room.capacity} pax</td>
                <td><span class="card-badge ${typeInfo.badgeClass}" style="position:static; display:inline-block">${typeInfo.label}</span></td>
                <td>
                    <div class="admin-actions">
                        <button class="btn-icon" title="Editar Remotamente" onclick="openRoomModal(${room.id})"><i data-lucide="edit-2"></i></button>
                        <button class="btn-icon delete" title="Eliminar de BD" onclick="deleteRoom(${room.id})"><i data-lucide="trash-2"></i></button>
                    </div>
                </td>
            </tr>
        `;
    });
    html += `</tbody></table></div>`;
    list.innerHTML = html;
    lucide.createIcons();
}

function openRoomModal(id = null) {
    const modal = document.getElementById('roomModal');
    document.getElementById('roomIdInput').value = '';
    document.getElementById('roomNameInput').value = '';
    document.getElementById('roomCapacityInput').value = '';
    document.getElementById('roomTypeInput').value = 'type1';
    document.getElementById('roomEquipInput').value = '';
    document.getElementById('roomImageInput').value = '';
    
    if (id) {
        document.getElementById('roomModalTitle').textContent = 'Editar Sala (Remoto)';
        const room = mockRooms.find(r => r.id === id);
        if (room) {
            document.getElementById('roomIdInput').value = room.id;
            document.getElementById('roomNameInput').value = room.name;
            document.getElementById('roomCapacityInput').value = room.capacity;
            document.getElementById('roomTypeInput').value = room.type;
            document.getElementById('roomEquipInput').value = room.equipment;
            document.getElementById('roomImageInput').value = room.imageUrl;
        }
    } else {
        document.getElementById('roomModalTitle').textContent = 'Nueva Sala en DB';
    }
    modal.classList.add('show');
}
function closeRoomModal() { document.getElementById('roomModal').classList.remove('show'); }

async function handleSaveRoom() {
    const id = document.getElementById('roomIdInput').value;
    const name = document.getElementById('roomNameInput').value.trim();
    const capacity = parseInt(document.getElementById('roomCapacityInput').value);
    const type = document.getElementById('roomTypeInput').value;
    const equipment = document.getElementById('roomEquipInput').value.trim() || 'Equipamiento estándar';
    const imageUrl = document.getElementById('roomImageInput').value.trim();

    if (!name || isNaN(capacity) || capacity <= 0) { showToast('❌ Nombre o capacidad inválidos.'); return; }

    const payload = { name, capacity, type, equipment, "imageUrl": imageUrl || 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&q=80&w=800' };

    if (id) {
        const { error } = await db.from('rooms').update(payload).eq('id', parseInt(id));
        if (error) { showToast('Error al actualizar en la nube'); return; }
        showToast('✅ Cambios impactados con éxito en Supabase.');
    } else {
        const { error } = await db.from('rooms').insert([payload]);
        if (error) { showToast('Error al crear la sala'); return; }
        showToast('✅ ¡Nueva sala insertada remota en el sistema!');
    }
    
    await fetchAllData();
    closeRoomModal();
    if(document.getElementById('adminView').style.display === 'block') renderAdminRooms();
    renderRooms();
}

async function deleteRoom(id) {
    if (confirm('¿Estás seguro de retirar permanentemente esta sala de la BBDD? Todas las reservas atadas se eliminarán.')) {
        const { error } = await db.from('rooms').delete().eq('id', parseInt(id));
        if (error) { showToast('Error de Base de Datos al intentar borrar.'); return; }
        
        await fetchAllData();
        renderAdminRooms();
        renderRooms();
        showToast('🗑️ La sala ha sido removida completamente de la interfaz y la BD.');
    }
}

// --- UI HELPERS ---
let toastTimeout;
function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message; toast.classList.add('show');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => toast.classList.remove('show'), 3000);
}

async function cancelBooking(id) {
    const booking = globalBookings.find(b => b.id === id);
    if (!booking) return;

    const isOwner = booking.requested_by === COMPUTER_USERNAME;
    if (!isRealAdmin() && !isOwner) {
        showToast('❌ Solo puedes cancelar tus propias reservas (o ser Administrador).');
        return;
    }
    
    if (confirm('¿Confirmas que quieres deshacer y cancelar definitivamente esta reunión liberando la sala?')) {
        const { error } = await db.from('bookings').delete().eq('id', id);
        if (error) { 
            showToast('❌ Error de Base de Datos al intentar borrar.'); 
            return; 
        }
        
        await fetchAllData();
        if (document.getElementById('calendarView').style.display !== 'none') renderCalendar();
        showToast('🗑️ Reunión cancelada. El horario está libre nuevamente.');
    }
}

// --- CONFIGURACION DE ADMINISTRADORES ---
function renderConfigAdmins() {
    const list = document.getElementById('configAdminsList');
    let html = `
        <div style="overflow-x: auto;">
        <table class="admin-table">
            <thead><tr><th>Usuario con Privilegios</th><th>Nivel de Rol</th><th>Acciones</th></tr></thead>
            <tbody>
    `;

    userRolesDb.forEach(user => {
        const isAdm = user.role === 'admin';
        const roleLabel = isAdm ? 'Administrador (Total)' : 'Gerente (Ejecutivas)';
        const icon = isAdm ? 'shield-check' : 'briefcase';
        const color = isAdm ? 'var(--primary-color)' : 'var(--text-primary)';
        
        html += `
            <tr>
                <td><i data-lucide="${icon}" style="color:${color};"></i> <strong>${user.username}</strong></td>
                <td>${roleLabel}</td>
                <td>
                    <div class="admin-actions">
                        <button class="btn-icon delete" title="Revocar Permisos" onclick="removeAdminUser(${user.id}, '${user.username}')"><i data-lucide="user-minus"></i></button>
                    </div>
                </td>
            </tr>
        `;
    });
    html += `</tbody></table></div>`;
    list.innerHTML = html;
    lucide.createIcons();
}

async function addAdminUser() {
    const input = document.getElementById('newAdminUsername');
    const roleSelect = document.getElementById('newUserRole');
    const username = input.value.trim().toLowerCase();
    const role = roleSelect.value;
    
    if(!username) { showToast('Escribe un nombre de usuario válido.'); return; }
    
    // Si ya existe el usuario, evitar duplicidad
    const existing = userRolesDb.find(a => a.username === username);
    if(existing) {
        if(existing.role === role) {
            showToast('Ese usuario ya posee el rol especificado.'); return;
        } else {
            // Actualizar su rol existente
            const { error } = await db.from('user_roles').update({ role }).eq('id', existing.id);
            if (error) { showToast('❌ Error al actualizar el rol.'); return; }
            showToast(`✅ Rol de ${username} actualizado exitosamente a ${role}.`);
        }
    } else {
        // Insertar nuevo usuario por primera vez
        const { error } = await db.from('user_roles').insert([{ username, role }]);
        if (error) { showToast('❌ Error DB al asignar rol'); return; }
        showToast(`✅ ${username} añadido exitosamente como ${role}.`);
    }
    
    input.value = '';
    await fetchAllData();
    renderConfigAdmins();
    if (window.updateRoleUI) window.updateRoleUI();
}

async function removeAdminUser(id, username) {
    if (username === COMPUTER_USERNAME) {
        if (!confirm('Peligro: Te estás quitando tus propios permisos a ti mismo. ¿Estás seguro?')) return;
    } else {
        if (!confirm(`¿Estás seguro de quitar todo acceso a ${username}?`)) return;
    }
    
    const { error } = await db.from('user_roles').delete().eq('id', id);
    if (error) { showToast('❌ Error BD al remover administrador'); return; }
    
    await fetchAllData();
    renderConfigAdmins();
    if (window.updateRoleUI) window.updateRoleUI();
    showToast(`🗑️ Ya no quedan permisos para ${username}.`);
}

// Asignamos globales para que el HTML los pueda llamar desde onclick
window.openBookingModal = openBookingModal;
window.closeModal = closeModal;
window.handleConfirmBooking = handleConfirmBooking;
window.handleApproval = handleApproval;
window.openRoomModal = openRoomModal;
window.closeRoomModal = closeRoomModal;
window.handleSaveRoom = handleSaveRoom;
window.deleteRoom = deleteRoom;
window.cancelBooking = cancelBooking;
window.addAdminUser = addAdminUser;
window.removeAdminUser = removeAdminUser;
