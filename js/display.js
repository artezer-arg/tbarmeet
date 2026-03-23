import { fetchAllData } from './api.js';
import { state } from './state.js';

// Elements
const timeEl = document.getElementById('currentTime');
const dateEl = document.getElementById('currentDate');
const pendingList = document.getElementById('pendingList');
const weekGrid = document.getElementById('weekGrid');

// Update Clock
function updateClock() {
    const now = new Date();
    timeEl.textContent = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    dateEl.textContent = now.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

// Initial Data Fetch
async function loadDashboardData() {
    console.log("Fetching dashboard data from Supabase...");
    const res = await fetchAllData();
    if(res.success) {
        renderDashboard();
    } else {
        weekGrid.innerHTML = `<div class="empty-day" style="color:#ef4444;"><i data-lucide="alert-triangle"></i> Error de conexión a la base de datos</div>`;
        lucide.createIcons();
    }
}

function renderDashboard() {
    // 1. Render Pending Approvals
    if (state.approvals.length === 0) {
        pendingList.innerHTML = `
            <div class="empty-day" style="background: rgba(255,255,255,0.02); border: none; padding: 2.5rem;">
                <i data-lucide="check-circle" style="opacity: 0.5; color: #10b981; width: 48px; height: 48px; margin-bottom: 1rem;"></i>
                <p style="font-size: 1.1rem; color: #94a3b8; font-style: normal;">No hay aprobaciones pendientes</p>
            </div>
        `;
    } else {
        pendingList.innerHTML = state.approvals.map(app => `
            <div class="pending-card">
                <h4>${app.roomName}</h4>
                <p><i data-lucide="calendar"></i> ${app.date}</p>
                <p><i data-lucide="clock"></i> ${app.time}</p>
                <p><i data-lucide="user"></i> ${app.requestedBy}</p>
            </div>
        `).join('');
    }

    // 2. Render Week Grid (Upcoming confirmed meetings)
    const now = new Date();
    const rooms = [...state.rooms];
    
    // Only future or current day meetings that are confirmed
    const upcomingBookings = state.bookings.filter(b => {
        const endDate = new Date(b.end_time);
        return endDate >= now && b.status === 'confirmed';
    });

    if (rooms.length === 0) {
        weekGrid.innerHTML = `<div class="empty-day">No hay salas configuradas en el sistema.</div>`;
    } else {
        let gridHtml = '';
        rooms.forEach(room => {
            // Get up to 6 next upcoming meetings for this room
            const roomBookings = upcomingBookings.filter(b => b.roomId == room.id).slice(0, 6);
            
            gridHtml += `
                <div class="room-timeline">
                    <div class="room-timeline-header">
                        <span class="badge ${room.type === 'type1' ? 'badge-free' : room.type === 'type2' ? 'badge-exec' : 'badge-approval'}">${room.capacity} Pax</span>
                        <h3>${room.name}</h3>
                    </div>
                    <div class="timeline-events">
            `;

            if (roomBookings.length === 0) {
                gridHtml += `<div class="empty-day">Libre. Sin reservas próximas programadas.</div>`;
            } else {
                roomBookings.forEach(b => {
                    const start = new Date(b.start_time);
                    const end = new Date(b.end_time);
                    
                    const isToday = start.toDateString() === now.toDateString();
                    const dayStr = isToday ? 'Hoy' : start.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' });
                    const timeStr = `${start.getHours().toString().padStart(2,'0')}:${start.getMinutes().toString().padStart(2,'0')} - ${end.getHours().toString().padStart(2,'0')}:${end.getMinutes().toString().padStart(2,'0')}`;

                    gridHtml += `
                        <div class="event-card ${isToday ? 'today' : ''}">
                            <div class="event-time">
                                <span class="day">${dayStr}</span>
                                <span class="time">${timeStr}</span>
                            </div>
                            <div class="event-title">${b.title || 'Reunión Programada'}</div>
                            <div class="event-user"><i data-lucide="user" style="width:14px;height:14px;"></i> ${b.requested_by || 'Usuario'}</div>
                        </div>
                    `;
                });
            }

            gridHtml += `
                    </div>
                </div>
            `;
        });
        weekGrid.innerHTML = gridHtml;
    }

    // Initialize Lucide icons for new dynamic DOM elements
    lucide.createIcons();
}

// Start Date/Time Loop
setInterval(updateClock, 1000);
updateClock();

// Start Initial Fetch
loadDashboardData();

// Auto-refresh data every 30 seconds
setInterval(loadDashboardData, 30000);
