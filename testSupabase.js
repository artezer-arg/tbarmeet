const url = 'https://uatvgstjiphqvqvndytn.supabase.co/rest/v1/bookings?select=*';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhdHZnc3RqaXBocXZxdm5keXRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0MTQ1MDMsImV4cCI6MjA4ODk5MDUwM30.OGfBq48kJ_gq_tgZSTq04ik1Y9XpmT6kztks9uroiNw';

async function test() {
    try {
        const res = await fetch(url, { headers: { 'apikey': key, 'Authorization': 'Bearer ' + key }});
        const data = await res.json();
        console.log(JSON.stringify(data, null, 2));
    } catch(e) {
        console.error(e);
    }
}
test();
