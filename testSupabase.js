const url = 'https://znkqynnfwaiehywnlxuo.supabase.co/rest/v1/bookings?select=*';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpua3F5bm5md2FpZWh5d25seHVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMzA5NjksImV4cCI6MjA4OTYwNjk2OX0.LdNarCDU9sycfn_6wkGhS8-Osgob9rvTHIosModid_Y';

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
