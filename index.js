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

// --- BOT CLIENT SETUP ---
// Dodano DirectMessages i Partials, aby bot mógł wysyłać Ci wiadomości prywatne
const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMembers, 
        GatewayIntentBits.DirectMessages
    ],
    partials: [Partials.Channel] 
});

let botOwner = null;

client.on('ready', async () => {
    console.log(`System Icarus aktywny jako ${client.user.tag}`);
    // Pobieramy dane właściciela bota (Ciebie), aby móc wysyłać raporty na PV
    const app = await client.application.fetch();
    botOwner = app.owner;
    console.log(`Raporty bezpieczeństwa będą wysyłane do: ${botOwner.tag}`);
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

// --- PASSPORT (AUTH) ---
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

// --- UI HELPERS ---
const UI_STYLE = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap');
    :root { --bg: #f5f5f7; --text: #1d1d1f; --card-bg: rgba(255, 255, 255, 0.8); --border: rgba(0,0,0,0.05); }
    body.dark-mode { --bg: #1c1c1e; --text: #f5f5f7; --card-bg: rgba(28, 28, 30, 0.8); --border: rgba(255,255,255,0.1); }
    body { background: var(--bg); color: var(--text); font-family: 'Inter', sans-serif; margin: 0; display: flex; align-items: center; justify-content: center; height: 100vh; }
    .card { background: var(--card-bg); backdrop-filter: saturate(180%) blur(20px); border-radius: 28px; padding: 60px; width: 440px; box-shadow: 0 20px 40px rgba(0,0,0,0.04); border: 1px solid var(--border); text-align: center; }
    .btn { display: block; width: 100%; padding: 16px; border-radius: 14px; text-decoration: none; margin-bottom: 12px; transition: 0.2s; font-weight: 500; }
    .btn-primary { background: #0071e3; color: white; }
    .btn-secondary { background: #e8e8ed; color: #1d1d1f; }
`;

const SHARED_JS = `
    const translations = {
        en: { title: "Icarus Cloud", desc: "Secure authorization.", btnAuth: "Authorize Identity", verified: "Verified", fraud: "Security Alert" },
        pl: { title: "Icarus Cloud", desc: "Bezpieczna autoryzacja.", btnAuth: "Autoryzuj tożsamość", verified: "Zweryfikowano", fraud: "Alert bezpieczeństwa" }
    };
    function updateLang(l) { document.querySelectorAll('[data-t]').forEach(el => { const k = el.getAttribute('data-t'); if(translations[l][k]) el.innerText = translations[l][k]; }); }
    document.addEventListener('DOMContentLoaded', () => updateLang('pl'));
`;

const getWrapper = (content) => `
    <style>${UI_STYLE}</style>
    <body>${content}<script>${SHARED_JS}</script></body>
`;

// --- WEB ROUTES ---
app.get('/', (req, res) => res.send(getWrapper('<div class="card"><h1 data-t="title"></h1><a href="/login?target=verify" class="btn btn-primary" data-t="btnAuth"></a></div>')));

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
    let list = guilds.map(g => `<div style="padding:10px; border-bottom:1px solid #eee;">${g.name} <a href="/manage/${g.id}">Config</a></div>`).join('');
    res.send(getWrapper('<div class="card"><h1>Dashboard</h1>' + list + '</div>'));
});

app.get('/manage/:guildId', async (req, res) => {
    const guild = client.guilds.cache.get(req.params.guildId);
    if (!guild) return res.send('Bot not in guild.');
    const config = await GuildConfig.findOne({ guildId: req.params.guildId }) || {};
    res.send(getWrapper(`<div class="card"><h1>Settings: ${guild.name}</h1><form action="/save/${req.params.guildId}" method="POST">Role ID: <input name="roleId" value="${config.verifyRoleId||''}"> Log Chan ID: <input name="logChanId" value="${config.logChannelId||''}"> <button class="btn btn-primary">Save</button></form></div>`));
});

app.post('/save/:guildId', async (req, res) => {
    await GuildConfig.findOneAndUpdate({ guildId: req.params.guildId }, { verifyRoleId: req.body.roleId, logChannelId: req.body.logChanId }, { upsert: true });
    res.redirect('/dashboard');
});

app.get('/verify', (req, res) => {
    if (!req.isAuthenticated()) return res.redirect('/login');
    const guilds = req.user.guilds.filter(g => client.guilds.cache.has(g.id));
    let list = guilds.map(g => `<a href="/auth?token=${req.user.id}&guild=${g.id}" class="btn btn-secondary">${g.name}</a>`).join('');
    res.send(getWrapper('<div class="card"><h1>Select Server</h1>' + list + '</div>'));
});

app.get('/auth', (req, res) => {
    res.send(getWrapper(`<div class="card"><h1>Icarus Scanning...</h1><script>
        const run = async () => {
            const fpData = { sw: screen.width, sh: screen.height, l: navigator.language, ua: navigator.userAgent };
            await fetch("/complete", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ userId: "${req.query.token}", guildId: "${req.query.guild}", fp: JSON.stringify(fpData) }) });
            setInterval(async () => {
                const r = await fetch("/status?userId=${req.query.token}&guildId=${req.query.guild}");
                const d = await r.json();
                if(d.status === "success") document.body.innerHTML = "<h1>Success</h1>";
                if(d.status === "rejected") document.body.innerHTML = "<h1>Security Denied</h1>";
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

    // ANALIZA RYZYKA
    let alertReason = null;
    const duplicateIP = await RequestTracker.findOne({ ip: ip, guildId: guildId, userId: { $ne: userId }, status: 'success' });
    const ipData = await axios.get(`http://ip-api.com/json/${ip}?fields=status,proxy,hosting,country`).catch(() => ({data:{}}));
    
    if(duplicateIP) alertReason = "Multi-Account (Same IP)";
    if(ipData.data.proxy || ipData.data.hosting) alertReason = "VPN/Proxy/Hosting Connection";

    await RequestTracker.findOneAndUpdate({ userId, guildId }, { status: 'pending', fingerprint: fp, ip: ip, details: parsedFp }, { upsert: true });

    // 1. LOG PUBLICZNY (Dla administratorów serwera)
    const logChan = guild.channels.cache.get(config?.logChannelId);
    if(logChan) {
        const publicEmbed = new EmbedBuilder()
            .setTitle('Weryfikacja Użytkownika')
            .setColor(alertReason ? '#ffcc00' : '#34c759')
            .addFields(
                { name: 'Użytkownik', value: `<@${userId}>` },
                { name: 'Status', value: alertReason ? 'Oczekiwanie na manualną akcję' : 'Automatycznie zatwierdzono' }
            );
        
        if(alertReason) {
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`acc_${userId}_${guildId}`).setLabel('Zatwierdź').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId(`rej_${userId}_${guildId}`).setLabel('Odrzuć').setStyle(ButtonStyle.Danger)
            );
            logChan.send({ embeds: [publicEmbed], components: [row] });
        } else {
            const member = await guild.members.fetch(userId).catch(() => null);
            if (member && config?.verifyRoleId) await member.roles.add(config.verifyRoleId);
            await RequestTracker.findOneAndUpdate({ userId, guildId }, { status: 'success' });
            logChan.send({ embeds: [publicEmbed] });
        }
    }

    // 2. RAPORT PRYWATNY (Tylko dla Ciebie na PV)
    if(botOwner) {
        const privateEmbed = new EmbedBuilder()
            .setTitle('🕵️ PEŁNY RAPORT ICARUS')
            .setColor('#5865F2')
            .setDescription(`Nowa weryfikacja na serwerze: **${guild.name}**`)
            .addFields(
                { name: '👤 Użytkownik', value: `<@${userId}> (ID: ${userId})`, inline: true },
                { name: '🌐 Adres IP', value: `\`${ip}\``, inline: true },
                { name: '🌍 Kraj', value: `${ipData.data.country || 'N/A'}`, inline: true },
                { name: '💻 System/Urządzenie', value: `\`\`\`${parsedFp.ua}\`\`\`` },
                { name: '🔗 Link do serwera', value: `[Otwórz serwer](https://discord.com/channels/${guildId})` }
            )
            .setTimestamp();
        
        if(alertReason) privateEmbed.addFields({ name: '⚠️ Alert', value: `**${alertReason}**` });

        botOwner.send({ embeds: [privateEmbed] }).catch(err => console.log("Nie można wysłać PV do właściciela: ", err));
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
        i.update({ content: '✅ Zaakceptowano.', embeds: [], components: [] });
    } else if (action === 'rej') {
        await RequestTracker.findOneAndUpdate({ userId: uid, guildId: gid }, { status: 'rejected' });
        i.update({ content: '❌ Odrzucono.', embeds: [], components: [] });
    }
});

app.get('/status', async (req, res) => {
    const doc = await RequestTracker.findOne({ userId: req.query.userId, guildId: req.query.guildId });
    res.json({ status: doc ? doc.status : 'pending' });
});

app.listen(process.env.PORT || 3000);
client.login(process.env.DISCORD_TOKEN);
