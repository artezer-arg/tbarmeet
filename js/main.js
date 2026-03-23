import { state, COMPUTER_USERNAME, setComputerUsername, isRealAdmin } from './state.js';
import * as api from './api.js';
import * as ui from './ui.js';

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', async () => {
    // Show computer username
    document.getElementById('displayUsername').textContent = COMPUTER_USERNAME;
    
    // UI Event Listeners for Filters & Views
    const roleSelector = document.getElementById('role');
    const filterBtns = document.querySelectorAll('.filter-btn');
    const viewBtns = {
        cards: document.getElementById('viewCardsBtn'),
        calendar: document.getElementById('viewCalendarBtn'),
        approvals: document.getElementById('viewApprovalsBtn'),
        admin: document.getElementById('viewAdminBtn'),
        config: document.getElementById('viewConfigBtn')
    };

    const views = {
        cards: document.getElementById('roomsGrid'),
        calendar: document.getElementById('calendarView'),
        approvals: document.getElementById('approvalsView'),
        admin: document.getElementById('adminView'),
        config: document.getElementById('configView')
    };

    function switchView(viewName) {
        ui.hideAllViews();
        viewBtns[viewName].classList.add('active');
        views[viewName].style.display = viewName === 'cards' ? 'grid' : 'block';
        
        // Render specific content if needed
        if(viewName === 'calendar') ui.renderCalendar();
        if(viewName === 'approvals') ui.renderApprovals();
        if(viewName === 'admin') ui.renderAdminRooms();
        if(viewName === 'config') ui.renderConfigAdmins();
    }

    viewBtns.cards.addEventListener('click', () => switchView('cards'));
    viewBtns.calendar.addEventListener('click', () => switchView('calendar'));
    viewBtns.approvals.addEventListener('click', () => switchView('approvals'));
    viewBtns.admin.addEventListener('click', () => switchView('admin'));
    viewBtns.config.addEventListener('click', () => switchView('config'));

    roleSelector.addEventListener('change', (e) => {
        state.role = e.target.value;
        ui.updateRoleUI();
        ui.renderRooms(); 
        if (views.calendar.style.display !== 'none') ui.renderCalendar();
        ui.showToast(`Rol cambiado a: ${e.target.options[e.target.selectedIndex].text}`, 'success');
    });

    filterBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            filterBtns.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            state.filter = e.target.dataset.filter;
            ui.renderRooms();
            if (views.calendar.style.display !== 'none') ui.renderCalendar();
        });
    });

    // Modals
    document.getElementById('closeModalBtn').addEventListener('click', closeModal);
    document.getElementById('cancelBtn').addEventListener('click', closeModal);
    document.getElementById('modalOverlay').addEventListener('click', closeModal);
    document.getElementById('confirmBtn').addEventListener('click', handleConfirmBooking);

    // Initial load logic
    async function startApp() {
        document.getElementById('displayUsername').textContent = COMPUTER_USERNAME;
        ui.showToast('Cargando datos...', 'info');
        const res = await api.fetchAllData();
        if(res.success) {
            ui.updateRoleUI();
            ui.renderRooms();
            if (window.lucide) window.lucide.createIcons();
        } else {
            ui.showToast('Error cargando información', 'error');
        }
    }

    if (!COMPUTER_USERNAME) {
        const configModal = document.getElementById('deviceConfigModal');
        configModal.style.display = 'flex';
        setTimeout(() => configModal.classList.add('show'), 10);
        
        document.getElementById('saveDeviceUserBtn').addEventListener('click', () => {
             const input = document.getElementById('deviceUsernameInput').value.trim().toLowerCase();
             if (input) {
                 setComputerUsername(input);
                 configModal.classList.remove('show');
                 setTimeout(() => {
                     configModal.style.display = 'none';
                     startApp();
                 }, 300);
             } else {
                 ui.showToast('Debes ingresar un nombre válido', 'error');
             }
        });
    } else {
        await startApp();
    }
});

// --- GLOBAL EXPOSED FUNCTIONS (for onclick in HTML string templates) ---
function isOverlapping(roomId, newStart, newEnd) {
    return state.bookings.some(b => b.roomId == roomId && newStart < b.end_time && b.start_time < newEnd);
}

window.handleCalendarCellClick = (timeMs, event) => {
    // Evitar hacer click si estamos clickeando un bloque de reserva ocupado
    if (event.target.closest('.cal-booking')) return;
    window.openBookingModal(null, timeMs);
};

window.openBookingModal = (roomId = null, defaultStartMs = null) => {
    const modal = document.getElementById('bookingModal');
    const roomGroup = document.getElementById('bookingRoomSelectGroup');
    const roomSelect = document.getElementById('bookingRoomSelect');
    
    if (roomId) {
        const room = state.rooms.find(r => r.id === roomId);
        state.selectedRoom = room;
        document.getElementById('modalTitle').textContent = `Reservar: ${room.name}`;
        document.getElementById('modalDescription').textContent = `Aforo: ${room.capacity} pers. | Equip.: ${room.equipment}`;
        document.getElementById('modalDescription').style.display = 'block';
        roomGroup.style.display = 'none';
        
        const permission = ui.canUserBook(room, state.role);
        document.getElementById('confirmBtn').textContent = permission.buttonText;
        document.getElementById('confirmBtn').disabled = !permission.allowed;
    } else {
        state.selectedRoom = null;
        document.getElementById('modalTitle').textContent = `Nueva Reserva`;
        document.getElementById('modalDescription').style.display = 'none';
        roomGroup.style.display = 'block';
        
        roomSelect.innerHTML = '<option value="">Selecciona una sala...</option>';
        state.rooms.forEach(r => {
            roomSelect.innerHTML += `<option value="${r.id}">${r.name} (Aforo: ${r.capacity})</option>`;
        });
        document.getElementById('confirmBtn').textContent = 'Confirmar';
        document.getElementById('confirmBtn').disabled = true;
        
        roomSelect.onchange = (e) => {
            const rId = parseInt(e.target.value);
            if(!rId) {
                document.getElementById('confirmBtn').textContent = 'Confirmar';
                document.getElementById('confirmBtn').disabled = true;
                state.selectedRoom = null;
                return;
            }
            const selectedR = state.rooms.find(r => r.id === rId);
            state.selectedRoom = selectedR;
            const perm = ui.canUserBook(selectedR, state.role);
            document.getElementById('confirmBtn').textContent = perm.buttonText;
            document.getElementById('confirmBtn').disabled = !perm.allowed;
        };
    }

    document.getElementById('modalStatusMessage').style.display = 'none';
    
    if (defaultStartMs) {
        const tzOffset = new Date().getTimezoneOffset() * 60000;
        const dStr = new Date(defaultStartMs - tzOffset).toISOString().slice(0, 16);
        document.getElementById('bookingStart').value = dStr;
        const endDStr = new Date(defaultStartMs + 3600000 - tzOffset).toISOString().slice(0, 16);
        document.getElementById('bookingEnd').value = endDStr;
    } else {
        document.getElementById('bookingStart').value = '';
        document.getElementById('bookingEnd').value = '';
    }
    
    document.getElementById('bookingReason').value = '';
    modal.classList.add('show');
};

function closeModal() { 
    document.getElementById('bookingModal').classList.remove('show'); 
    state.selectedRoom = null; 
}
window.closeModal = closeModal;

async function handleConfirmBooking() {
    const startVal = document.getElementById('bookingStart').value;
    const endVal = document.getElementById('bookingEnd').value;
    const reason = document.getElementById('bookingReason').value || 'Reserva estándar';
    const statusMsg = document.getElementById('modalStatusMessage');

    if (!startVal || !endVal) {
        statusMsg.style.display = 'block'; statusMsg.className = 'status-message error'; statusMsg.textContent = 'Indica el horario de inicio y fin.'; return;
    }

    const start = new Date(startVal).getTime();
    const end = new Date(endVal).getTime();

    const room = state.selectedRoom;
    if (!room) {
        statusMsg.style.display = 'block'; statusMsg.className = 'status-message error'; statusMsg.textContent = 'Selecciona una sala.'; return;
    }

    if (end <= start) {
        statusMsg.style.display = 'block'; statusMsg.className = 'status-message error'; statusMsg.textContent = 'El fin debe ser posterior al inicio.'; return;
    }

    if (isOverlapping(room.id, start, end)) {
        statusMsg.style.display = 'block'; statusMsg.className = 'status-message error'; statusMsg.textContent = 'Este horario ya está ocupado.'; return;
    }

    const bookingStatus = (room.type === 'type3' && !isRealAdmin()) ? 'pending' : (room.type === 'type2' ? 'manager' : 'confirmed');
    
    const { error } = await api.createBooking(room.id, start, end, reason, bookingStatus);
    
    if (error) {
        statusMsg.style.display = 'block'; statusMsg.className = 'status-message error'; statusMsg.textContent = 'Error guardando reserva.'; return;
    }

    await api.fetchAllData();
    closeModal();
    if (document.getElementById('calendarView').style.display === 'block') ui.renderCalendar();
    
    if (bookingStatus === 'pending') {
        if (document.getElementById('approvalsView').style.display === 'block') ui.renderApprovals();
        ui.showToast('Solicitud enviada para aprobación.', 'success');
    } else {
        ui.showToast('¡Reserva confirmada!', 'success');
    }
}
window.handleConfirmBooking = handleConfirmBooking;

window.handleApproval = async (id, isApproved) => {
    await api.updateApprovalProcess(id, isApproved);
    await api.fetchAllData();
    if (document.getElementById('approvalsView').style.display !== 'none') ui.renderApprovals();
    if (document.getElementById('calendarView').style.display !== 'none') ui.renderCalendar();
    ui.showToast(isApproved ? 'Reserva aprobada.' : 'Solicitud rechazada.', isApproved ? 'success' : 'info');
};

let currentQuickApprovalId = null;

window.closeQuickApprovalModal = () => {
    document.getElementById('quickApprovalModal').classList.remove('show');
    currentQuickApprovalId = null;
};

window.quickCalendarApprove = (id, requesterName) => {
    currentQuickApprovalId = id;
    document.getElementById('quickApprovalInfo').textContent = `¿Aprobar la reserva solicitada por ${requesterName}?`;
    document.getElementById('quickApprovalModal').classList.add('show');
    if (window.lucide) window.lucide.createIcons();
};

document.getElementById('btnQuickApprove')?.addEventListener('click', async () => {
    if (currentQuickApprovalId) {
        const id = currentQuickApprovalId;
        window.closeQuickApprovalModal();
        await window.handleApproval(id, true);
    }
});

document.getElementById('btnQuickReject')?.addEventListener('click', async () => {
    if (currentQuickApprovalId) {
        const id = currentQuickApprovalId;
        window.closeQuickApprovalModal();
        await window.handleApproval(id, false);
    }
});

window.openRoomModal = (id = null) => {
    const modal = document.getElementById('roomModal');
    document.getElementById('roomIdInput').value = '';
    document.getElementById('roomNameInput').value = '';
    document.getElementById('roomCapacityInput').value = '';
    document.getElementById('roomTypeInput').value = 'type1';
    document.getElementById('roomEquipInput').value = '';
    document.getElementById('roomImageInput').value = '';
    if (document.getElementById('roomImageUpload')) document.getElementById('roomImageUpload').value = '';
    
    if (id) {
        document.getElementById('roomModalTitle').textContent = 'Editar Sala';
        const room = state.rooms.find(r => r.id === id);
        if (room) {
            document.getElementById('roomIdInput').value = room.id;
            document.getElementById('roomNameInput').value = room.name;
            document.getElementById('roomCapacityInput').value = room.capacity;
            document.getElementById('roomTypeInput').value = room.type;
            document.getElementById('roomEquipInput').value = room.equipment;
            document.getElementById('roomImageInput').value = (room.imageUrl && !room.imageUrl.startsWith('data:image')) ? room.imageUrl : '';
        }
    } else {
        document.getElementById('roomModalTitle').textContent = 'Nueva Sala';
    }
    modal.classList.add('show');
};

window.closeRoomModal = () => { document.getElementById('roomModal').classList.remove('show'); };

window.handleSaveRoom = async () => {
    const id = document.getElementById('roomIdInput').value;
    const name = document.getElementById('roomNameInput').value.trim();
    const capacity = parseInt(document.getElementById('roomCapacityInput').value);
    const type = document.getElementById('roomTypeInput').value;
    const equipment = document.getElementById('roomEquipInput').value.trim() || 'Estándar';
    let imageUrl = document.getElementById('roomImageInput').value.trim();
    const fileInput = document.getElementById('roomImageUpload');

    if (!name || isNaN(capacity) || capacity <= 0) { ui.showToast('Datos inválidos.', 'error'); return; }

    const processImage = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 800;
                    let width = img.width;
                    let height = img.height;
                    if (width > MAX_WIDTH) { height = Math.round(height * (MAX_WIDTH / width)); width = MAX_WIDTH; }
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);
                    resolve(canvas.toDataURL('image/jpeg', 0.8)); // Reduce quality intentionally to keep DB payload small
                };
                img.onerror = reject;
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        });
    };

    if (fileInput && fileInput.files && fileInput.files[0]) {
        ui.showToast('Procesando imagen local...', 'info');
        try {
            imageUrl = await processImage(fileInput.files[0]);
        } catch(e) {
            ui.showToast('Fallo al cargar la foto.', 'error');
            return;
        }
    }

    if (!imageUrl && id) {
        // Mantener imageUrl anterior si está editando y no aportó nueva info de imagen
        const existingRoom = state.rooms.find(r => r.id === parseInt(id));
        if (existingRoom) imageUrl = existingRoom.imageUrl;
    }

    const payload = { name, capacity, type, equipment, "imageUrl": imageUrl || 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&q=80&w=800' };

    await api.dbSaveRoom(id, payload);
    await api.fetchAllData();
    window.closeRoomModal();
    if(document.getElementById('adminView').style.display === 'block') ui.renderAdminRooms();
    ui.renderRooms();
    ui.showToast('Cambios guardados exitosamente.', 'success');
};

window.uiConfirm = (title, message, type = 'danger', confirmText = 'Aceptar') => {
    return new Promise((resolve) => {
        const modal = document.getElementById('confirmModal');
        const titleEl = document.getElementById('confirmModalTitle');
        const descEl = document.getElementById('confirmModalDesc');
        const iconContainer = document.getElementById('confirmModalIcon');
        const btnOk = document.getElementById('confirmModalOk');
        const btnCancel = document.getElementById('confirmModalCancel');
        
        titleEl.textContent = title;
        descEl.textContent = message;
        btnOk.textContent = confirmText;
        
        if (type === 'danger') {
            btnOk.className = 'btn btn-reject';
            iconContainer.innerHTML = '<i data-lucide="alert-triangle" style="width: 48px; height: 48px; color: var(--danger-color);"></i>';
        } else if (type === 'info') {
            btnOk.className = 'btn btn-primary';
            iconContainer.innerHTML = '<i data-lucide="info" style="width: 48px; height: 48px; color: var(--primary-color);"></i>';
        }
        
        if (window.lucide) window.lucide.createIcons();
        modal.classList.add('show');
        
        const cleanup = () => {
             btnOk.onclick = null;
             btnCancel.onclick = null;
             document.getElementById('confirmModalOverlay').onclick = null;
             modal.classList.remove('show');
        };
        
        btnOk.onclick = () => { cleanup(); resolve(true); };
        btnCancel.onclick = () => { cleanup(); resolve(false); };
        document.getElementById('confirmModalOverlay').onclick = () => { cleanup(); resolve(false); };
    });
};

window.deleteRoom = async (id) => {
    if (await window.uiConfirm('Eliminar Sala', '¿Eliminar sala definitivamente? Sus reservas también se borrarán.', 'danger', 'Eliminar')) {
        await api.dbDeleteRoom(id);
        await api.fetchAllData();
        ui.renderAdminRooms();
        ui.renderRooms();
        ui.showToast('Sala eliminada.', 'info');
    }
};

window.cancelBooking = async (id) => {
    const booking = state.bookings.find(b => b.id === id);
    if (!booking) return;

    const isOwner = booking.requested_by === COMPUTER_USERNAME;
    if (!isRealAdmin() && !isOwner) {
        ui.showToast('Solo puedes cancelar tus reservas.', 'error');
        return;
    }
    
    if (await window.uiConfirm('Liberar Sala', '¿Liberar la sala en este horario?', 'danger', 'Liberar')) {
        await api.dbCancelBooking(id);
        await api.fetchAllData();
        if (document.getElementById('calendarView').style.display !== 'none') ui.renderCalendar();
        ui.showToast('Horario liberado.', 'info');
    }
};

window.addAdminUser = async () => {
    const input = document.getElementById('newAdminUsername');
    const username = input.value.trim().toLowerCase();
    const role = document.getElementById('newUserRole').value;
    
    if(!username) { ui.showToast('Escribe un usuario.', 'error'); return; }
    
    const existing = state.userRolesDb.find(a => a.username === username);
    if(existing) {
        if(existing.role !== role) {
            await api.dbUpdateUserRole(existing.id, role);
            ui.showToast(`Rol actualizado.`, 'success');
        }
    } else {
        await api.dbAddUserRole(username, role);
        ui.showToast(`Usuario agregado.`, 'success');
    }
    
    input.value = '';
    await api.fetchAllData();
    ui.renderConfigAdmins();
    ui.updateRoleUI();
};

window.removeAdminUser = async (id, username) => {
    if (username === COMPUTER_USERNAME) {
        if (!(await window.uiConfirm('Quitar mis permisos', 'Peligro: Te quitarás tus permisos de administrador. ¿Seguro?', 'danger', 'Quitar mis accesos'))) return;
    } else {
        if (!(await window.uiConfirm('Quitar Accesos', `¿Quitar accesos a ${username}?`, 'danger', 'Quitar'))) return;
    }
    
    await api.dbRemoveUserRole(id);
    await api.fetchAllData();
    ui.renderConfigAdmins();
    ui.updateRoleUI();
    ui.showToast('Permisos revocados.', 'info');
};
