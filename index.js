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
    logChannelId: String,
    language: { type: String, default: 'pl' },
    isBanned: { type: Boolean, default: false },
    banReason: String
}));

const RequestTracker = mongoose.model('RequestTracker', new mongoose.Schema({ 
    userId: String, 
    guildId: String, 
    status: { type: String, default: 'pending' },
    ip: String,
    ua: String,
    isp: String,
    location: String,
    timestamp: { type: Date, default: Date.now }
}));

// --- BOT CLIENT ---
const client = new Client({ 
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.DirectMessages, GatewayIntentBits.MessageContent],
    partials: [Partials.Channel, Partials.Message]
});

let botOwner = null;
client.on('ready', async () => {
    const app = await client.application.fetch();
    botOwner = app.owner;
    console.log(`[SYSTEM ICARUS] Autoryzacja korporacyjna aktywna. Właściciel: ${botOwner.tag}`);
});

// --- SERVER SETUP ---
const app = express();
app.set('trust proxy', true);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

mongoose.connect(process.env.MONGO_URI);

app.use(session({
    secret: 'icarus_ultra_secure_vault_2026',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: process.env.MONGO_URI }),
    cookie: { maxAge: 1000 * 60 * 60 } // 1 godzina sesji
}));

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

// --- LUXURY GLASSMORPHISM UI ---
const UI_STYLE = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap');
    :root { --accent: #0071e3; --bg: #000; --card: rgba(255, 255, 255, 0.04); --border: rgba(255, 255, 255, 0.1); }
    body { background: var(--bg); color: #fff; font-family: 'Inter', sans-serif; margin: 0; display: flex; align-items: center; justify-content: center; height: 100vh; overflow: hidden; }
    .card { background: var(--card); backdrop-filter: blur(40px) saturate(180%); border-radius: 35px; padding: 60px 45px; width: 420px; text-align: center; border: 1px solid var(--border); box-shadow: 0 40px 100px rgba(0,0,0,0.8); }
    h1 { font-size: 36px; font-weight: 600; margin-bottom: 12px; letter-spacing: -1.5px; }
    p { color: #86868b; font-size: 17px; margin-bottom: 40px; line-height: 1.6; }
    .btn { display: block; width: 100%; padding: 18px; border-radius: 16px; font-size: 17px; font-weight: 500; text-decoration: none; cursor: pointer; border: none; margin-bottom: 12px; transition: 0.3s cubic-bezier(0.4, 0, 0.2, 1); box-sizing: border-box; }
    .btn-primary { background: var(--accent); color: white; }
    .btn-primary:hover { background: #0077ed; transform: scale(1.02); }
    .btn-secondary { background: rgba(255,255,255,0.08); color: white; }
    .btn-secondary:hover { background: rgba(255,255,255,0.15); }
    .loader { width: 45px; height: 45px; border: 3px solid rgba(255,255,255,0.05); border-top: 3px solid var(--accent); border-radius: 50%; animation: spin 1s linear infinite; margin: 30px auto; }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    input, select { width: 100%; padding: 15px; background: rgba(255,255,255,0.05); border: 1px solid var(--border); border-radius: 12px; color: white; margin-top: 5px; outline: none; }
`;

const getWrapper = (content) => `<html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>${UI_STYLE}</style></head><body>${content}</body></html>`;

// --- CORE ROUTES ---

app.get('/', (req, res) => {
    res.send(getWrapper(`
        <div class="card">
            <h1>Icarus Cloud</h1>
            <p>Zabezpiecz swój serwer najwyższym standardem weryfikacji tożsamości.</p>
            <a href="/login?target=verify" class="btn btn-primary">Autoryzuj tożsamość</a>
            <a href="/login?target=dashboard" class="btn btn-secondary">System Management</a>
        </div>
    `));
});

app.get('/dashboard', async (req, res) => {
    if (!req.isAuthenticated()) return res.redirect('/login?target=dashboard');
    const guilds = req.user.guilds.filter(g => (g.permissions & 0x8) === 0x8);
    let list = guilds.map(g => {
        const inG = client.guilds.cache.has(g.id);
        return `<div style="display:flex; justify-content:space-between; align-items:center; padding:18px; background:rgba(255,255,255,0.03); border-radius:18px; margin-bottom:12px; border:1px solid var(--border);">
            <span style="font-weight:500;">${g.name}</span>
            <a href="${inG ? '/manage/'+g.id : 'https://discord.com/api/oauth2/authorize?client_id='+process.env.CLIENT_ID+'&permissions=8&scope=bot&guild_id='+g.id}" 
               style="color:${inG ? '#0071e3' : '#86868b'}; text-decoration:none; font-weight:600; font-size:12px;">
               ${inG ? 'ZARZĄDZAJ →' : 'DODAJ SYSTEM +'}
            </a>
        </div>`;
    }).join('');
    res.send(getWrapper(`<div class="card"><h1>Dashboard</h1><p>Wybierz jednostkę do konfiguracji</p><div style="text-align:left;">${list}</div></div>`));
});

app.get('/manage/:guildId', async (req, res) => {
    if (!req.isAuthenticated()) return res.redirect('/login');
    const config = await GuildConfig.findOne({ guildId: req.params.guildId }) || {};
    res.send(getWrapper(`
        <div class="card">
            <h1>Konfiguracja</h1>
            <form action="/save/${req.params.guildId}" method="POST" style="text-align:left;">
                <label style="font-size:11px; color:#86868b; margin-left:5px;">JĘZYK</label>
                <select name="lang"><option value="pl" ${config.language==='pl'?'selected':''}>Polski</option><option value="en" ${config.language==='en'?'selected':''}>English</option></select>
                <div style="margin-top:15px;">
                    <label style="font-size:11px; color:#86868b; margin-left:5px;">ID ROLI WERYFIKACYJNEJ</label>
                    <input name="roleId" value="${config.verifyRoleId||''}" placeholder="Wklej ID roli">
                </div>
                <div style="margin-top:15px;">
                    <label style="font-size:11px; color:#86868b; margin-left:5px;">ID KANAŁU LOGÓW</label>
                    <input name="logChanId" value="${config.logChannelId||''}" placeholder="Wklej ID kanału">
                </div>
                <button class="btn btn-primary" style="margin-top:30px;">Zapisz zmiany</button>
            </form>
            <a href="/dashboard" style="color:#86868b; font-size:12px; text-decoration:none;">← Powrót do listy</a>
        </div>
    `));
});

app.post('/save/:guildId', async (req, res) => {
    await GuildConfig.findOneAndUpdate({ guildId: req.params.guildId }, { verifyRoleId: req.body.roleId, logChannelId: req.body.logChanId, language: req.body.lang }, { upsert: true });
    res.redirect('/dashboard');
});

app.get('/verify', (req, res) => {
    if (!req.isAuthenticated()) return res.redirect('/login?target=verify');
    const guilds = req.user.guilds.filter(g => client.guilds.cache.has(g.id));
    let list = guilds.map(g => `<a href="/auth?token=${req.user.id}&guild=${g.id}" class="btn btn-secondary">${g.name}</a>`).join('');
    res.send(getWrapper(`<div class="card"><h1>Weryfikacja</h1><p>Wybierz serwer docelowy</p>${list}</div>`));
});

app.get('/auth', async (req, res) => {
    const config = await GuildConfig.findOne({ guildId: req.query.guild });
    if (config?.isBanned) return res.send(getWrapper(`<div class="card"><h1 style="color:#ff3b30">Banned</h1><p>${config.banReason}</p></div>`));
    
    res.send(getWrapper(`
        <div class="card" id="box">
            <h1>Icarus Cloud</h1>
            <p>Skanowanie środowiska w celu zapewnienia bezpieczeństwa...</p>
            <div class="loader"></div>
            <script>
                async function init() {
                    await fetch("/process", { 
                        method: "POST", 
                        headers: {"Content-Type":"application/json"}, 
                        body: JSON.stringify({ userId: "${req.query.token}", guildId: "${req.query.guild}", ua: navigator.userAgent }) 
                    });
                    const check = setInterval(async () => {
                        const r = await fetch("/status?userId=${req.query.token}&guildId=${req.query.guild}");
                        const d = await r.json();
                        if(d.status === "success") {
                            clearInterval(check);
                            document.getElementById('box').innerHTML = '<h1>Success</h1><p>Weryfikacja udana. Możesz zamknąć to okno.</p>';
                        } else if(d.status === "rejected") {
                            clearInterval(check);
                            document.getElementById('box').innerHTML = '<h1 style="color:#ff3b30">Denied</h1><p>Dostęp został odrzucony przez system bezpieczeństwa.</p>';
                        }
                    }, 2500);
                } init();
            </script>
        </div>`));
});

// --- BACKEND LOGIC ---

app.post('/process', async (req, res) => {
    const { userId, guildId, ua } = req.body;
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const config = await GuildConfig.findOne({ guildId });
    const guild = client.guilds.cache.get(guildId);
    
    const ipData = await axios.get(`http://ip-api.com/json/${ip}?fields=status,country,city,isp,proxy,hosting`).catch(() => ({data:{}}));
    const isSus = ipData.data.proxy || ipData.data.hosting;
    
    // Blokada Multikonta
    const existing = await RequestTracker.findOne({ ip: ip, guildId: guildId, userId: { $ne: userId }, status: 'success' });

    const sendReport = async (type, color) => {
        if (!botOwner) return;
        const embed = new EmbedBuilder()
            .setTitle(`🛡️ RAPORT ICARUS: ${type}`)
            .setColor(color)
            .addFields(
                { name: '👤 Użytkownik', value: `<@${userId}> (\`${userId}\`)`, inline: true },
                { name: '🏰 Serwer', value: `${guild?.name || 'Unknown'}`, inline: true },
                { name: '🌐 Adres IP', value: `\`${ip}\``, inline: true },
                { name: '📍 Lokalizacja', value: `${ipData.data.city || 'N/A'}, ${ipData.data.country || 'N/A'}`, inline: true },
                { name: '🔌 ISP', value: `${ipData.data.isp || 'N/A'}`, inline: true },
                { name: '🖥️ Browser', value: `\`\`\`${ua}\`\`\`` }
            ).setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`acc_${userId}_${guildId}`).setLabel('Dopuść ręcznie').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`rej_${userId}_${guildId}`).setLabel('Odrzuć').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId(`ban_${guildId}`).setLabel('Zablokuj Serwer').setStyle(ButtonStyle.Secondary)
        );
        botOwner.send({ embeds: [embed], components: [row] });
    };

    if (existing) {
        await RequestTracker.findOneAndUpdate({ userId, guildId }, { status: 'rejected', ip, ua }, { upsert: true });
        await sendReport('ALERT: MULTIKONTO', 'Red');
    } else if (isSus) {
        await RequestTracker.findOneAndUpdate({ userId, guildId }, { status: 'pending', ip, ua }, { upsert: true });
        await sendReport('PODEJRZENIE VPN/PROXY', 'Yellow');
    } else {
        const member = await guild?.members.fetch(userId).catch(() => null);
        if (member && config?.verifyRoleId) await member.roles.add(config.verifyRoleId);
        await RequestTracker.findOneAndUpdate({ userId, guildId }, { status: 'success', ip, ua }, { upsert: true });
        await sendReport('WERYFIKACJA POMYŚLNA', 'Green');
    }
    res.json({ ok: true });
});

// --- SYSTEM HANDLERS ---

app.get('/login', (req, res, next) => {
    const state = Buffer.from(JSON.stringify({ target: req.query.target || 'dashboard' })).toString('base64');
    passport.authenticate('discord', { state })(req, res, next);
});

app.get('/auth/callback', passport.authenticate('discord', { failureRedirect: '/' }), (req, res) => {
    const decoded = JSON.parse(Buffer.from(req.query.state, 'base64').toString());
    res.redirect('/' + decoded.target);
});

app.get('/status', async (req, res) => {
    const doc = await RequestTracker.findOne({ userId: req.query.userId, guildId: req.query.guildId });
    res.json({ status: doc ? doc.status : 'pending' });
});

client.on('interactionCreate', async (i) => {
    if (!i.isButton()) return;
    const [action, uid, gid] = i.customId.split('_');
    if (action === 'acc') {
        const config = await GuildConfig.findOne({ guildId: gid });
        const member = await client.guilds.cache.get(gid)?.members.fetch(uid).catch(() => null);
        if (member && config?.verifyRoleId) await member.roles.add(config.verifyRoleId);
        await RequestTracker.findOneAndUpdate({ userId: uid, guildId: gid }, { status: 'success' });
        i.reply({ content: '✅ Zaakceptowano dostęp.', ephemeral: true });
    } else if (action === 'rej') {
        await RequestTracker.findOneAndUpdate({ userId: uid, guildId: gid }, { status: 'rejected' });
        i.reply({ content: '❌ Odrzucono dostęp.', ephemeral: true });
    }
});

// --- KOMENDY DLA CIEBIE (PV) ---
client.on('messageCreate', async (m) => {
    if (m.author.id !== botOwner?.id || m.channel.type !== 1) return;
    const args = m.content.split(' ');
    if (args[0] === 'banuj') {
        const gid = args[1];
        const reason = args.slice(2).join(' ') || "Naruszenie bezpieczeństwa.";
        await GuildConfig.findOneAndUpdate({ guildId: gid }, { isBanned: true, banReason: reason }, { upsert: true });
        m.reply(`🚫 Serwer ${gid} został zablokowany.`);
    }
});

app.listen(process.env.PORT || 3000);
client.login(process.env.DISCORD_TOKEN);
