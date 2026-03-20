// state.js
// Manejo del estado centralizado de la aplicación

export const SUPABASE_URL = 'https://znkqynnfwaiehywnlxuo.supabase.co';
export const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpua3F5bm5md2FpZWh5d25seHVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMzA5NjksImV4cCI6MjA4OTYwNjk2OX0.LdNarCDU9sycfn_6wkGhS8-Osgob9rvTHIosModid_Y';

// El cliente de Supabase asume que el CDN está cargado en el index.html
export const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

export let COMPUTER_USERNAME = localStorage.getItem('tbar_meet_username');

export function setComputerUsername(name) {
    COMPUTER_USERNAME = name;
    localStorage.setItem('tbar_meet_username', name);
}

export const ROOM_TYPES = {
    type1: { id: 'type1', label: 'Reserva Libre', badgeClass: 'badge-free' },
    type2: { id: 'type2', label: 'Ejecutiva', badgeClass: 'badge-exec' },
    type3: { id: 'type3', label: 'Con Aprobación', badgeClass: 'badge-approval' }
};

export const state = {
    role: 'user', // roles: user, manager, admin
    filter: 'all',
    selectedRoom: null,
    rooms: [],
    bookings: [],
    approvals: [],
    userRolesDb: []
};

// Funciones de validación de roles reales
export function isRealAdmin() {
    return state.role === 'admin' || state.userRolesDb.some(a => a.username === COMPUTER_USERNAME && a.role === 'admin');
}

export function isRealManager() {
    return state.role === 'manager' || state.userRolesDb.some(a => a.username === COMPUTER_USERNAME && (a.role === 'manager' || a.role === 'admin'));
}
