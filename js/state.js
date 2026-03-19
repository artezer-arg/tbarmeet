// state.js
// Manejo del estado centralizado de la aplicación

export const SUPABASE_URL = 'https://uatvgstjiphqvqvndytn.supabase.co';
export const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhdHZnc3RqaXBocXZxdm5keXRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0MTQ1MDMsImV4cCI6MjA4ODk5MDUwM30.OGfBq48kJ_gq_tgZSTq04ik1Y9XpmT6kztks9uroiNw';

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
