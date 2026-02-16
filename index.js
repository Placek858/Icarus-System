const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const express = require('express');
const axios = require('axios');
const mongoose = require('mongoose');

// --- KONFIGURACJA ---
const BOT_TOKEN = process.env.DISCORD_TOKEN; 
const MONGO_URI = process.env.MONGO_URI; 
const PROXYCHECK_API_KEY = 'e2brv7-y9y366-243469-435457';
const GUILD_ID = '1464901079593521322';
const ROLE_ID = '1473060746194845959';
const MY_ID = '1131510639769178132'; 
const ALL_ADMINS = [MY_ID, '1276586330847051780', '1210653947061080175'];

mongoose.connect(MONGO_URI).then(() => console.log("✅ Połączono z bazą danych"));

// Schemat bazy danych z Fingerprintem
const UserIP = mongoose.model('UserIP', new mongoose.Schema({ 
    userId: String, 
    ip: String, 
    fingerprint: String,
    country: String, 
    operator: String 
}));

const RequestTracker = mongoose.model('RequestTracker', new mongoose.Schema({ 
    userId: String, 
    status: { type: String, default: 'pending' } 
}));

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });
const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// --- STRONA INTERNETOWA (PREMIUM DESIGN) ---
app.get('/auth', (req, res) => {
    const userId = req.query.token;
    res.send(`
        <!DOCTYPE html>
        <html lang="pl">
        <head>
            <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Night RP | Security</title>
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap" rel="stylesheet">
            <style>
                :root { --discord: #5865f2; --bg: #0d0d12; --card: rgba(255, 255, 255, 0.03); }
                body { margin: 0; padding: 0; font-family: 'Inter', sans-serif; background: var(--bg); color: white; display: flex; justify-content: center; align-items: center; min-height: 100vh; overflow: hidden; }
                .glow { position: absolute; width: 400px; height: 400px; background: radial-gradient(circle, rgba(88,101,242,0.15) 0%, transparent 70%); z-index: -1; }
                .card { background: var(--card); backdrop-filter: blur(25px); border: 1px solid rgba(255,255,255,0.08); padding: 50px; border-radius: 32px; text-align: center; max-width: 420px; width: 90%; box-shadow: 0 40px 100px rgba(0,0,0,0.6); }
                .icon-box { width: 80px; height: 80px; background: rgba(88,101,242,0.1); border-radius: 20px; display: flex; align-items: center; justify-content: center; margin: 0 auto 25px; color: var(--discord); font-size: 35px; border: 1px solid rgba(88,101,242,0.2); }
                h1 { font-size: 26px; margin: 0 0 10px; font-weight: 700; letter-spacing: -0.5px; }
                p { color: #8e8e9e; line-height: 1.6; margin-bottom: 35px; font-size: 15px; }
                .btn { background: var(--discord); color: white; padding: 16px 32px; border: none; border-radius: 14px; cursor: pointer; font-size: 15px; font-weight: 700; width: 100%; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); box-shadow: 0 10px 20px rgba(88,101,242,0.2); }
                .btn:hover { transform: translateY(-3px); box-shadow: 0 15px 30px rgba(88,101,242,0.4); filter: brightness(1.1); }
                .spinner { width: 50px; height: 50px; border: 4px solid rgba(255,255,255,0.05); border-top: 4px solid var(--discord); border-radius: 50%; animation: spin 0.8s cubic-bezier(0.5, 0.1, 0.4, 0.9) infinite; margin: 20px auto; }
                @keyframes spin { to { transform: rotate(360deg); } }
                .success-icon { color: #43b581; font-size: 60px; margin-bottom: 20px; }
            </style>
        </head>
        <body>
            <div class="glow"></div>
            <div class="card" id="box">
                <div class="icon-box">🛡️</div>
                <h1>System Weryfikacji</h1>
                <p>Potwierdź swoje połączenie, aby uzyskać dostęp do serwera Night RP. System sprawdza integralność Twojego urządzenia.</p>
                <button class="btn" id="go">AUTORYZUJ DOSTĘP</button>
            </div>

            <script>
                async function getFP() {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    ctx.fillText('NightRP-Shield', 10, 10);
                    return btoa(canvas.toDataURL()); // Prosty fingerprint urządzenia
                }

                document.getElementById('go').onclick = async () => {
                    const box = document.getElementById('box');
                    const fp = await getFP();
                    box.innerHTML = '<div class="spinner"></div><h1>Analiza Systemu...</h1><p>Weryfikujemy Twoje urządzenie oraz adres IP.</p>';
                    
                    const r = await fetch('/complete', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({ userId: '${userId}', fp: fp })
                    });
                    const d = await r.json();

                    if (d.action === 'wait') {
                        box.innerHTML = '<div class="icon-box" style="color:#faa61a">⏳</div><h1>Oczekiwanie</h1><p>Twoje połączenie wymaga ręcznej autoryzacji przez Zarząd. Strona odświeży się automatycznie po decyzji.</p>';
                        const check = setInterval(async () => {
                            const res = await fetch('/status?userId=${userId}');
                            const s = await res.json();
                            if (s.status === 'allowed') { clearInterval(check); location.reload(); }
                        }, 3000);
                    } else if (d.action === 'success') {
                        box.innerHTML = '<div class="success-icon">✅</div><h1>Zweryfikowano</h1><p>Twoja ranga została nadana. Możesz już wrócić na Discorda.</p>';
                    } else {
                        box.innerHTML = '<div class="icon-box" style="color:#f04747">❌</div><h1>Odmowa</h1><p>' + d.msg + '</p>';
                    }
                };
            </script>
        </body>
        </html>
    `);
});

app.post('/complete', async (req, res) => {
    const { userId, fp } = req.body;
    const cleanIP = (req.headers['x-forwarded-for'] || req.socket.remoteAddress).split(',')[0].trim();

    try {
        const response = await axios.get(`https://proxycheck.io/v2/${cleanIP}?key=${PROXYCHECK_API_KEY}&vpn=3&asn=1`);
        const result = response.data[cleanIP];
        const country = result.isocode || '??';
        const operator = result.asn || 'Nieznany';

        // --- ZASTRZEŻENIE PRZECIW RESTARTOWI ROUTERA (FINGERPRINT) ---
        const duplicateFP = await UserIP.findOne({ fingerprint: fp, userId: { $ne: userId } });
        if (duplicateFP) {
            return res.json({ action: 'error', msg: 'Wykryto próbę użycia tego samego urządzenia na wielu kontach.' });
        }

        // --- LOGIKA PODEJRZANEGO IP ---
        const existingIP = await UserIP.findOne({ ip: cleanIP });
        if (country !== 'PL' || (existingIP && existingIP.userId !== userId)) {
            await RequestTracker.findOneAndUpdate({ userId }, { status: 'pending' }, { upsert: true });
            // Tu wysyłanie panelu do adminów (tak jak w poprzednim kodzie)...
            return res.json({ action: 'wait' });
        }

        await new UserIP({ userId, ip: cleanIP, fingerprint: fp, country, operator }).save();
        const guild = await client.guilds.fetch(GUILD_ID);
        const member = await guild.members.fetch(userId);
        await member.roles.add(ROLE_ID);
        res.json({ action: 'success' });
    } catch (e) { res.json({ action: 'error', msg: 'Błąd połączenia z bazą.' }); }
});

// ... (reszta eventów i komenda status z poprzedniego kodu)
client.login(BOT_TOKEN);
app.listen(process.env.PORT || 3000);
