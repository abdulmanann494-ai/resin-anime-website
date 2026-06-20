const http = require('http');

async function doFetch(url, options = {}) {
    return new Promise((resolve, reject) => {
        const req = http.request(url, options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({
                status: res.statusCode,
                headers: res.headers,
                data
            }));
        });
        req.on('error', reject);
        if (options.body) {
            req.write(options.body);
        }
        req.end();
    });
}

async function runTests() {
    console.log('\n--- SQL INJECTION EVIDENCE ---');
    const sqliRes = await doFetch('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: "admin' OR '1'='1", password: "password" })
    });
    console.log(`SQLi Login Status: ${sqliRes.status} (Body: ${sqliRes.data})`);

    // Let's create two users to test IDOR
    await doFetch('http://localhost:3000/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'userA1', email: 'a1@a.com', password: 'password123' })
    });
    await doFetch('http://localhost:3000/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'userB1', email: 'b1@b.com', password: 'password123' })
    });

    const loginA = await doFetch('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'userA1', password: 'password123' })
    });
    
    // Extract session cookie properly
    let cookieA = '';
    if (loginA.headers['set-cookie']) {
        cookieA = loginA.headers['set-cookie'][0].split(';')[0];
    } else {
        console.log('Failed to login user A', loginA.data);
        return;
    }
    
    console.log('\n--- IDOR EVIDENCE ---');
    // Try to delete a wallpaper as userA1 (standard user)
    const idorDelWall = await doFetch('http://localhost:3000/api/admin/wallpapers/1', {
        method: 'DELETE',
        headers: { 'Cookie': cookieA }
    });
    console.log(`IDOR Delete Wallpaper Status: ${idorDelWall.status} (Expected 403)`);

    // Try to update user B's profile
    const idorUpdateProfile = await doFetch('http://localhost:3000/api/admin/users/1', {
        method: 'PUT',
        headers: { 'Cookie': cookieA, 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'Hacked' })
    });
    console.log(`IDOR Update User Profile Status: ${idorUpdateProfile.status} (Expected 403)`);
}

runTests().catch(console.error);
