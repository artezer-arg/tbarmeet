import { state, ROOM_TYPES, isRealAdmin, isRealManager, COMPUTER_USERNAME } from './state.js';

export function hideAllViews() {
    document.getElementById('roomsGrid').style.display = 'none';
    document.getElementById('calendarView').style.display = 'none';
    document.getElementById('approvalsView').style.display = 'none';
    document.getElementById('adminView').style.display = 'none';
    document.getElementById('configView').style.display = 'none';
    
    document.querySelectorAll('.view-btn').forEach(btn => btn.classList.remove('active'));
}

let toastTimeout;
export function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message; 
    
    // reset classes
    toast.className = 'toast';
    if (type === 'error') toast.classList.add('error');
    if (type === 'success') toast.classList.add('success');
    
    toast.classList.add('show');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => toast.classList.remove('show'), 3500);
}

export function canUserBook(room, role) {
    const isAdm = isRealAdmin();
    if (room.type === ROOM_TYPES.type1.id) return { allowed: true, buttonText: 'Reservar Sala' };
    if (room.type === ROOM_TYPES.type2.id) {
        if (isRealManager() || isAdm) return { allowed: true, buttonText: 'Reservar (Ejecutiva)' };
        return { allowed: false, buttonText: 'Exclusiva Gerencia' };
    }
    if (room.type === ROOM_TYPES.type3.id) {
        if (isAdm) return { allowed: true, buttonText: 'Aprobar Directamente' };
        return { allowed: true, buttonText: 'Solicitar Reserva' };
    }
    return { allowed: false, buttonText: 'No disponible' };
}

export function getDirectImageUrl(url) {
    if (!url) return 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&q=80&w=800';
    // Extraer ID de la URL formato /file/d/ID/view
    const match1 = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (match1) return `https://drive.google.com/uc?export=view&id=${match1[1]}`;
    // Extraer ID formato ?id=ID
    const match2 = url.match(/drive\.google\.com\/.*[?&]id=([a-zA-Z0-9_-]+)/);
    if (match2) return `https://drive.google.com/uc?export=view&id=${match2[1]}`;
    return url;
}

export function renderRooms() {
    const grid = document.getElementById('roomsGrid');
    grid.innerHTML = '';
    const filteredRooms = state.filter === 'all' ? state.rooms : state.rooms.filter(r => r.type === state.filter);
    
    if(filteredRooms.length === 0) {
        grid.innerHTML = '<div class="empty-state"><i data-lucide="inbox"></i><p>No hay salas disponibles en esta categoría.</p></div>';
        if (window.lucide) window.lucide.createIcons();
        return;
    }

    filteredRooms.forEach(room => {
        const typeInfo = ROOM_TYPES[room.type] || ROOM_TYPES.type1;
        const canBookResult = canUserBook(room, state.role);
        
        const card = document.createElement('div');
        card.className = 'room-card';
        card.innerHTML = `
            <div class="card-img-placeholder">
                <img src="${getDirectImageUrl(room.imageUrl)}" alt="${room.name}" class="room-card-image" loading="lazy">
                <span class="card-badge ${typeInfo.badgeClass}">${typeInfo.label}</span>
            </div>
            <div class="card-content">
                <h3 class="card-title">${room.name}</h3>
                <div class="card-info">
                    <span><i data-lucide="users" class="icon-small"></i> ${room.capacity} personas</span>
                </div>
                <div class="card-info" style="margin-top: -10px;">
                    <span><i data-lucide="monitor" class="icon-small"></i> ${room.equipment}</span>
                </div>
                <div class="card-actions">
                    <button class="btn ${canBookResult.allowed ? 'btn-primary' : 'btn-secondary'}" 
                            onclick="window.openBookingModal(${room.id})"
                            ${!canBookResult.allowed && room.type === 'type2' ? 'disabled' : ''}>
                        ${canBookResult.buttonText}
                    </button>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
    if (window.lucide) window.lucide.createIcons();
}

function generateNext7Days() {
    const dates = []; const today = new Date();
    for (let i = 0; i < 7; i++) {
        const d = new Date(today); d.setDate(today.getDate() + i); dates.push(d);
    }
    return dates;
}

export function renderCalendar() {
    const container = document.getElementById('calendarView');
    const dates = generateNext7Days();
    let html = '<div style="overflow-x: auto; padding-bottom: 2rem;"><div class="calendar-grid"><div class="cal-header" style="text-align:right;">Hora</div>';
    
    dates.forEach(d => html += `<div class="cal-header">${d.toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit', month: '2-digit' })}</div>`);

    const filteredRooms = state.filter === 'all' ? state.rooms : state.rooms.filter(r => r.type === state.filter);
    const confirmedBookings = state.bookings.filter(b => b.status !== 'pending');

    for (let h = 4; h <= 22; h++) {
        const hourStr = `${String(h).padStart(2, '0')}:00`;
        html += `<div class="cal-time">${hourStr}</div>`;
        
        dates.forEach(d => {
            const ts = new Date(d); ts.setHours(h, 0, 0, 0);
            const te = new Date(d); te.setHours(h + 1, 0, 0, 0);
            html += `<div class="cal-cell" onclick="window.handleCalendarCellClick(${ts.getTime()}, event)" style="cursor: cell;" title="Haz clic para reservar en este horario">`;
            
            filteredRooms.forEach(room => {
                const bookingsInHour = confirmedBookings.filter(b => b.roomId == room.id && b.start_time < te.getTime() && b.end_time > ts.getTime());
                
                bookingsInHour.forEach(booking => {
                     const isOwner = booking.requested_by === COMPUTER_USERNAME;
                     const canDelete = isRealAdmin() || isOwner;
                     const clickAttr = canDelete ? `onclick="window.cancelBooking(${booking.id})"` : '';
                     const tooltip = `Reservado por: ${booking.requested_by || 'Anónimo'} \nMotivo: ${booking.title}`;
                     const titleStr = canDelete ? `${tooltip} \n(Clic para liberar sala)` : tooltip;
                     let cursorStyle = canDelete ? 'cursor: pointer;' : 'cursor: default;';
                     
                     if (booking.status === 'confirmed') {
                         const colors = [
                             { bg: 'rgba(59, 130, 246, 0.15)', text: '#2563eb' }, // blue
                             { bg: 'rgba(16, 185, 129, 0.15)', text: '#059669' }, // emerald
                             { bg: 'rgba(239, 68, 68, 0.15)', text: '#dc2626' },   // red
                             { bg: 'rgba(139, 92, 246, 0.15)', text: '#7c3aed' }, // violet
                             { bg: 'rgba(236, 72, 153, 0.15)', text: '#db2777' }, // pink
                             { bg: 'rgba(6, 182, 212, 0.15)', text: '#0891b2' },  // cyan
                             { bg: 'rgba(132, 204, 22, 0.15)', text: '#65a30d' }, // lime
                             { bg: 'rgba(245, 158, 11, 0.15)', text: '#d97706' }  // amber
                         ];
                         const rc = colors[(parseInt(room.id) || 0) % colors.length];
                         cursorStyle += `background: ${rc.bg}; color: ${rc.text}; border-left-color: ${rc.text};`;
                     }
                     
                     html += `<div class="cal-booking ${booking.status}" title="${titleStr}" ${clickAttr} style="${cursorStyle}">
                                <strong>${room.name}</strong><br>
                                <span style="font-weight:400; font-size:10px; opacity:0.9">${booking.requested_by || 'Anónimo'}</span>
                              </div>`;
                });
            });
            html += `</div>`;
        });
    }
    html += '</div></div>';
    container.innerHTML = html;
}

export function renderApprovals() {
    const list = document.getElementById('approvalsList');
    list.innerHTML = '';
    if (state.approvals.length === 0) {
        list.innerHTML = '<div class="empty-state"><i data-lucide="check-circle"></i><p>Todo al día. No hay solicitudes pendientes.</p></div>'; 
        if (window.lucide) window.lucide.createIcons();
        return;
    }

    state.approvals.forEach(app => {
        const card = document.createElement('div');
        card.className = 'approval-card';
        card.innerHTML = `
            <div class="approval-info">
                <h4>${app.roomName}</h4>
                <div class="approval-details">
                    <p><i data-lucide="user" class="icon-small"></i> ${app.requestedBy}</p>
                    <p><i data-lucide="calendar" class="icon-small"></i> ${app.date}</p>
                    <p><i data-lucide="clock" class="icon-small"></i> ${app.time}</p>
                </div>
                <p class="approval-reason"><i data-lucide="file-text" class="icon-small"></i> ${app.reason}</p>
            </div>
            <div class="approval-actions">
                <button class="btn-reject" title="Rechazar" onclick="window.handleApproval(${app.id}, false)">Rechazar</button>
                <button class="btn-approve" title="Aprobar" onclick="window.handleApproval(${app.id}, true)">Aprobar</button>
            </div>
        `;
        list.appendChild(card);
    });
    if (window.lucide) window.lucide.createIcons();
}

export function renderAdminRooms() {
    const list = document.getElementById('adminRoomsList');
    let html = `
        <div style="overflow-x: auto;">
        <table class="admin-table">
            <thead><tr><th>Sala</th><th>Aforo</th><th>Acceso</th><th>Acciones</th></tr></thead>
            <tbody>
    `;

    state.rooms.forEach(room => {
        const typeInfo = ROOM_TYPES[room.type] || ROOM_TYPES.type1;
        html += `
            <tr>
                <td><strong>${room.name}</strong></td>
                <td>${room.capacity} px</td>
                <td><span class="card-badge ${typeInfo.badgeClass}" style="position:static; display:inline-block">${typeInfo.label}</span></td>
                <td>
                    <div class="admin-actions">
                        <button class="btn-icon" title="Editar" onclick="window.openRoomModal(${room.id})"><i data-lucide="edit-2"></i></button>
                        <button class="btn-icon delete" title="Eliminar" onclick="window.deleteRoom(${room.id})"><i data-lucide="trash-2"></i></button>
                    </div>
                </td>
            </tr>
        `;
    });
    html += `</tbody></table></div>`;
    list.innerHTML = html;
    if (window.lucide) window.lucide.createIcons();
}

export function renderConfigAdmins() {
    const list = document.getElementById('configAdminsList');
    let html = `
        <div style="overflow-x: auto;">
        <table class="admin-table">
            <thead><tr><th>Usuario</th><th>Rol</th><th>Acciones</th></tr></thead>
            <tbody>
    `;

    state.userRolesDb.forEach(user => {
        const isAdm = user.role === 'admin';
        const roleLabel = isAdm ? 'Admin Total' : 'Gerente';
        const icon = isAdm ? 'shield-check' : 'briefcase';
        
        html += `
            <tr>
                <td><i data-lucide="${icon}" style="color:var(--text-primary); margin-right:8px"></i> <strong>${user.username}</strong></td>
                <td>${roleLabel}</td>
                <td>
                    <div class="admin-actions">
                        <button class="btn-icon delete" title="Quitar" onclick="window.removeAdminUser(${user.id}, '${user.username}')"><i data-lucide="user-minus"></i></button>
                    </div>
                </td>
            </tr>
        `;
    });
    html += `</tbody></table></div>`;
    list.innerHTML = html;
    if (window.lucide) window.lucide.createIcons();
}

export function updateRoleUI() {
    const isAdmin = isRealAdmin();
    const viewApprovalsBtn = document.getElementById('viewApprovalsBtn');
    const viewAdminBtn = document.getElementById('viewAdminBtn');
    const viewConfigBtn = document.getElementById('viewConfigBtn');

    if (isAdmin) {
        viewApprovalsBtn.style.display = 'flex';
        viewAdminBtn.style.display = 'flex';
        viewConfigBtn.style.display = 'flex';
    } else {
        viewApprovalsBtn.style.display = 'none';
        viewAdminBtn.style.display = 'none';
        viewConfigBtn.style.display = 'none';
        // Go back to main view if a restricted view is open
        const activeRestricted = ['approvalsView', 'adminView', 'configView'].some(id => document.getElementById(id).style.display === 'block');
        if (activeRestricted) document.getElementById('viewCardsBtn').click();
    }
}
