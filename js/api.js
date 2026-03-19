import { db, state, COMPUTER_USERNAME, isRealAdmin } from './state.js';

export async function fetchAllData() {
    try {
        const { data: roomsData, error: roomsErr } = await db.from('rooms').select('*').order('id', { ascending: true });
        if (roomsErr) throw roomsErr;
        state.rooms = roomsData || [];

        const { data: bookingsData, error: bookErr } = await db.from('bookings').select('*').order('start_time', { ascending: true });
        if (bookErr) throw bookErr;
        state.bookings = bookingsData || [];

        try {
            const { data: adData } = await db.from('user_roles').select('*').order('username');
            state.userRolesDb = adData || [];
        } catch(e) {
            console.warn("Could not fetch user_roles", e);
        }

        state.approvals = [];
        state.bookings.forEach(b => {
             if (b.status === 'pending') {
                 const r = state.rooms.find(rm => rm.id == b.roomId); // == para flexibilizar string/int
                 if (r) {
                     state.approvals.push({
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
        return { success: true };
    } catch(e) {
        console.error('Error fetching Supabase data:', e);
        return { success: false, error: e.message };
    }
}

export async function createBooking(roomId, start, end, reason, bookingStatus) {
    const newBooking = { 
        roomId: parseInt(roomId), 
        title: reason, 
        start_time: start, 
        end_time: end, 
        status: bookingStatus, 
        requested_by: COMPUTER_USERNAME 
    };
    
    const { error } = await db.from('bookings').insert([newBooking]);
    return { error };
}

export async function updateApprovalProcess(id, isApproved) {
    if (isApproved) {
        const { error } = await db.from('bookings').update({ status: 'confirmed' }).eq('id', id);
        return { error };
    } else {
        const { error } = await db.from('bookings').delete().eq('id', id);
        return { error };
    }
}

export async function dbSaveRoom(id, payload) {
    if (id) {
        const { error } = await db.from('rooms').update(payload).eq('id', parseInt(id));
        return { error };
    } else {
        const { error } = await db.from('rooms').insert([payload]);
        return { error };
    }
}

export async function dbDeleteRoom(id) {
    const { error } = await db.from('rooms').delete().eq('id', parseInt(id));
    return { error };
}

export async function dbCancelBooking(id) {
    const { error } = await db.from('bookings').delete().eq('id', id);
    return { error };
}

export async function dbUpdateUserRole(id, role) {
    const { error } = await db.from('user_roles').update({ role }).eq('id', id);
    return { error };
}

export async function dbAddUserRole(username, role) {
    const { error } = await db.from('user_roles').insert([{ username, role }]);
    return { error };
}

export async function dbRemoveUserRole(id) {
    const { error } = await db.from('user_roles').delete().eq('id', id);
    return { error };
}
