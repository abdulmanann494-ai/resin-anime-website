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
    console.log('--- NPM AUDIT ---');
    const { execSync } = require('child_process');
    try {
        const audit = execSync('npm audit', { encoding: 'utf-8' });
        console.log(audit);
    } catch (e) {
        console.log(e.stdout);
    }

    console.log('\n--- RATE LIMITING EVIDENCE ---');
    let lastStatus;
    for (let i = 0; i < 102; i++) {
        const res = await doFetch('http://localhost:3000/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'nonexistent', password: 'pwd' })
        });
        lastStatus = res.status;
    }
    console.log(`Request 101/102 Status: ${lastStatus}`);
    
    // We also need IDOR and SQLi. Let's create two users if they don't exist, and test.
    // For SQLi, we just pass in a payload.
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
        body: JSON.stringify({ username: 'userA', email: 'a@a.com', password: 'password123' })
    });
    await doFetch('http://localhost:3000/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'userB', email: 'b@b.com', password: 'password123' })
    });

    const loginA = await doFetch('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'userA', password: 'password123' })
    });
    const cookieA = loginA.headers['set-cookie'][0].split(';')[0];
    
    console.log('\n--- IDOR EVIDENCE ---');
    // Try to delete a wallpaper as userA (standard user)
    const idorDelWall = await doFetch('http://localhost:3000/api/admin/wallpapers/1', {
        method: 'DELETE',
        headers: { 'Cookie': cookieA }
    });
    console.log(`IDOR Delete Wallpaper Status: ${idorDelWall.status} (Expected 403)`);

    // Try to update settings as userA
    const idorUpdateSettings = await doFetch('http://localhost:3000/api/admin/settings', {
        method: 'PUT',
        headers: { 'Cookie': cookieA, 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteName: 'Hacked' })
    });
    console.log(`IDOR Update Settings Status: ${idorUpdateSettings.status} (Expected 403)`);
}

runTests().catch(console.error);
