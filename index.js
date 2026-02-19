const { 
    Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, 
    ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, 
    TextInputStyle, InteractionType, PermissionsBitField 
} = require('discord.js');
const express = require('express');
const mongoose = require('mongoose');
const passport = require('passport');
const { Strategy } = require('passport-discord');
const session = require('express-session');
const MongoStore = require('connect-mongo');

// --- INICJALIZACJA SYSTEMU ---
const client = new Client({ 
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.DirectMessages, GatewayIntentBits.GuildPresences] 
});
const app = express();
app.set('trust proxy', true);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

mongoose.connect(process.env.MONGO_URI);

// --- MODELE DANYCH ---
const GuildConfig = mongoose.model('GuildConfig', new mongoose.Schema({
    guildId: String,
    verifyRoleId: String,
    logChannelId: String,
    lang: { type: String, default: 'en' },
    admins: { type: [String], default: [] },
    isBlocked: { type: Boolean, default: false },
    blockReason: String
}));

const UserData = mongoose.model('UserData', new mongoose.Schema({
    deviceId: String,
    attempts: { type: Number, default: 5 },
    isLocked: { type: Boolean, default: false },
    verifiedAccounts: { type: [String], default: [] }
}));

// --- PASSPORT & SESSION ---
app.use(session({
    secret: 'icarus_enterprise_core_2026',
    resave: false, saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: process.env.MONGO_URI })
}));

passport.use(new Strategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: `${process.env.DOMAIN}/auth/callback`,
    scope: ['identify', 'guilds']
}, (at, rt, profile, done) => done(null, profile)));

passport.serializeUser((u, d) => d(null, u));
passport.deserializeUser((o, d) => d(null, o));
app.use(passport.initialize());
app.use(passport.session());

// --- TŁUMACZENIA ---
const i18n = {
    pl: {
        v: "Weryfikacja", m: "Panel Zarządzania", o: "System Owner",
        save: "Zapisz Zmiany", unsaved: "Masz niezapisane zmiany!", 
        add_bot: "Dodaj Bota", manage: "Zarządzaj", 
        online: "Działa", offline: "Wyłączony",
        block: "Zablokuj", contact: "Kontakt: icarus.system.pl@gmail.com"
    },
    en: {
        v: "Verification", m: "Management Panel", o: "System Owner",
        save: "Save Changes", unsaved: "Unsaved changes detected!", 
        add_bot: "Add Bot", manage: "Manage", 
        online: "Online", offline: "Offline",
        block: "Block", contact: "Contact: icarus.system.pl@gmail.com"
    }
};

// --- APPLE UI ENGINE ---
const renderPage = (content, lang = 'en', state = { hasConfig: false }) => {
    const t = i18n[lang] || i18n.en;
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Icarus System</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;600;700&display=swap');
        :root { --blue: #0071e3; --bg: #ffffff; --text: #1d1d1f; --card: #f5f5f7; --neon: #00f2ff; --red: #ff3b30; }
        body.dark { --bg: #000000; --text: #f5f5f7; --card: #1c1c1e; --neon: #bc00ff; }
        body { background: var(--bg); color: var(--text); font-family: 'Plus Jakarta Sans', sans-serif; transition: 0.5s; margin: 0; }
        .nav { position: fixed; top: 0; width: 100%; padding: 25px 50px; display: flex; justify-content: space-between; align-items: center; z-index: 1000; backdrop-filter: blur(20px); }
        .lang-switch a { text-decoration: none; color: var(--text); font-weight: 700; margin-right: 15px; opacity: 0.3; }
        .lang-switch a.active { opacity: 1; border-bottom: 2px solid var(--blue); }
        .theme-btn { font-size: 30px; cursor: pointer; filter: drop-shadow(0 0 10px var(--neon)); transition: 0.3s; }
        .container { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 100px 20px 40px; }
        .card { background: var(--card); padding: 50px; border-radius: 40px; width: 100%; max-width: 600px; text-align: center; box-shadow: 0 40px 100px rgba(0,0,0,0.1); }
        .btn { display: flex; align-items: center; justify-content: center; padding: 16px; border-radius: 16px; background: var(--blue); color: white; text-decoration: none; font-weight: 700; border: none; cursor: pointer; margin: 10px 0; width: 100%; transition: 0.3s; }
        .btn-alt { background: transparent; border: 2px solid var(--blue); color: var(--text); }
        .input-box { width: 100%; padding: 16px; border-radius: 14px; border: 1px solid rgba(128,128,128,0.2); background: var(--bg); color: var(--text); margin-bottom: 15px; }
        .admin-item { display: flex; justify-content: space-between; background: rgba(128,128,128,0.1); padding: 10px 20px; border-radius: 10px; margin: 5px 0; }
        .remove-x { color: var(--red); cursor: pointer; font-weight: bold; text-decoration: none; }
        .u-bar { position: fixed; bottom: 40px; left: 50%; transform: translateX(-50%); background: var(--blue); color: white; padding: 15px 35px; border-radius: 50px; display: none; align-items: center; gap: 20px; box-shadow: 0 20px 40px rgba(0,113,227,0.3); }
        .loader { border: 3px solid #f3f3f3; border-top: 3px solid var(--blue); border-radius: 50%; width: 20px; height: 20px; animation: spin 1s linear infinite; display: none; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    </style>
</head>
<body class="\${localStorage.getItem('t') || ''}">
    <div class="nav">
        <div class="lang-switch">
            <a href="?lang=pl" class="\${'${lang}'==='pl'?'active':''}">🇵🇱 Polski</a>
            <a href="?lang=en" class="\${'${lang}'==='en'?'active':''}">🇬🇧 English</a>
        </div>
        <div class="theme-btn" onclick="togg()">\${localStorage.getItem('t') === 'dark' ? '🔮' : '💡'}</div>
    </div>
    <div class="container">${content}</div>
    <div id="u-bar" class="u-bar">
        <span>${t.unsaved}</span>
        <button class="btn" style="width:auto; padding:8px 25px; background:white; color:black;" onclick="save()">
            <div id="ld" class="loader"></div> ${t.save}
        </button>
    </div>
    <script>
        function togg() {
            const b = document.body;
            b.classList.toggle('dark');
            localStorage.setItem('t', b.classList.contains('dark') ? 'dark' : 'light');
            location.reload();
        }
        function save() {
            document.getElementById('ld').style.display = 'inline-block';
            setTimeout(() => document.forms[0].submit(), 2000);
        }
        if(${state.hasConfig}) {
            document.querySelectorAll('input, select').forEach(i => i.oninput = () => document.getElementById('u-bar').style.display = 'flex');
        }
    </script>
</body>
</html>`;
};

// --- [1] STRONA GŁÓWNA ---
app.get('/', (req, res) => {
    const l = req.query.lang || 'en';
    res.send(renderPage(`
        <div class="card">
            <h1 style="font-size: 65px; margin: 0; letter-spacing: -3px;">Icarus</h1>
            <p style="opacity:0.4; margin-bottom: 50px;">Corporate Grade Security</p>
            <a href="/login?target=select-guild&lang=${l}" class="btn">${i18n[l].v}</a>
            <a href="/login?target=dashboard&lang=${l}" class="btn btn-alt">${i18n[l].m}</a>
            <a href="/owner-auth?lang=${l}" class="btn" style="background:none; color:gray; font-size:12px; margin-top:40px;">${i18n[l].o}</a>
        </div>`, l));
});

// --- [2] PANEL ZARZĄDZANIA (DLA WŁAŚCICIELI SERWERÓW) ---
app.get('/dashboard', async (req, res) => {
    if(!req.isAuthenticated()) return res.redirect('/');
    const l = req.query.lang || 'en';
    const userGuilds = req.user.guilds.filter(g => (new PermissionsBitField(BigInt(g.permissions)).has(PermissionsBitField.Flags.Administrator)));
    
    let listHtml = userGuilds.map(g => {
        const hasBot = client.guilds.cache.has(g.id);
        const actionBtn = hasBot ? 
            `<a href="/manage/${g.id}?lang=${l}" class="btn" style="width:120px; font-size:13px;">${i18n[l].manage}</a>` :
            `<a href="https://discord.com/api/oauth2/authorize?client_id=${process.env.CLIENT_ID}&permissions=8&scope=bot%20applications.commands&guild_id=${g.id}" class="btn btn-alt" style="width:120px; font-size:13px;">${i18n[l].add_bot}</a>`;
        return `<div class="admin-item" style="align-items:center;"><span>${g.name}</span>${actionBtn}</div>`;
    }).join('');

    res.send(renderPage(`<div class="card"><h2>${i18n[l].m}</h2>${listHtml}</div>`, l));
});

// --- [3] KONFIGURACJA SERWERA (Z PRZYCISKIEM X I KOŁEM) ---
app.get('/manage/:guildId', async (req, res) => {
    if(!req.isAuthenticated()) return res.redirect('/');
    const l = req.query.lang || 'en';
    const gid = req.params.guildId;
    const config = await GuildConfig.findOne({ guildId: gid }) || new GuildConfig({ guildId: gid });
    
    const adminList = config.admins.map(id => `
        <div class="admin-item">
            <span>${id}</span>
            <a href="/remove-admin/${gid}/${id}?lang=${l}" class="remove-x">X</a>
        </div>`).join('');

    res.send(renderPage(`
        <div class="card" style="text-align:left;">
            <h3>Konfiguracja: ${client.guilds.cache.get(gid)?.name}</h3>
            <form action="/save-config/${gid}?lang=${l}" method="POST">
                <label>Język bota</label>
                <select name="lang" class="input-box">
                    <option value="pl" ${config.lang==='pl'?'selected':''}>Polski</option>
                    <option value="en" ${config.lang==='en'?'selected':''}>English</option>
                    <option value="de" ${config.lang==='de'?'selected':''}>Deutsch</option>
                    <option value="fr" ${config.lang==='fr'?'selected':''}>Français</option>
                    <option value="es" ${config.lang==='es'?'selected':''}>Español</option>
                </select>
                <label>Kanał logów (ID)</label>
                <input name="logChannelId" class="input-box" value="${config.logChannelId || ''}">
                <label>Rola po weryfikacji (ID)</label>
                <input name="verifyRoleId" class="input-box" value="${config.verifyRoleId || ''}">
                <hr style="opacity:0.1; margin:20px 0;">
                <h4>${i18n[l].admin_list}</h4>
                ${adminList}
                <input name="newAdmin" placeholder="Dodaj ID użytkownika..." class="input-box" style="margin-top:10px;">
                <button class="btn">${i18n[l].save}</button>
            </form>
        </div>`, l, { hasConfig: true }));
});

app.post('/save-config/:guildId', async (req, res) => {
    const { lang, logChannelId, verifyRoleId, newAdmin } = req.body;
    let config = await GuildConfig.findOne({ guildId: req.params.guildId });
    config.lang = lang;
    config.logChannelId = logChannelId;
    config.verifyRoleId = verifyRoleId;
    if(newAdmin && !config.admins.includes(newAdmin)) config.admins.push(newAdmin);
    await config.save();
    res.redirect(`/manage/${req.params.guildId}?lang=${req.query.lang || 'en'}`);
});

app.get('/remove-admin/:guildId/:userId', async (req, res) => {
    await GuildConfig.updateOne({ guildId: req.params.guildId }, { $pull: { admins: req.params.userId } });
    res.redirect(`/manage/${req.params.guildId}?lang=${req.query.lang || 'en'}`);
});

// --- [4] PANEL WŁAŚCICIELA SYSTEMU (SYSTEM OWNER) ---
app.get('/owner-auth', async (req, res) => {
    const l = req.query.lang || 'en';
    const dev = await UserData.findOne({ deviceId: req.ip });
    if(dev?.isLocked) return res.send(renderPage(`<h1>LOCKED</h1><p>Access denied. Unlock via Discord PV.</p>`, l));
    res.send(renderPage(`
        <div class="card">
            <h2>PIN Required</h2>
            <form action="/owner-verify" method="POST">
                <input type="password" name="pin" style="text-align:center; font-size:30px; letter-spacing:10px;" class="input-box">
                <button class="btn">LOGIN</button>
            </form>
            <p style="color:red">Pozostało prób: ${dev ? dev.attempts : 5}</p>
        </div>`, l));
});

app.post('/owner-verify', async (req, res) => {
    const { pin } = req.body;
    let dev = await UserData.findOne({ deviceId: req.ip }) || new UserData({ deviceId: req.ip });
    if(pin === "15052021") {
        dev.attempts = 5; await dev.save();
        req.session.isOwner = true;
        res.redirect('/owner-panel');
    } else {
        dev.attempts -= 1;
        if(dev.attempts <= 0) {
            dev.isLocked = true;
            const owner = await client.users.fetch(process.env.OWNER_ID);
            const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`unlock_${req.ip.replace(/\./g,'_')}`).setLabel("ODBLOKUJ").setStyle(ButtonStyle.Success));
            owner.send({ content: `🚨 **WŁAMANIE!** IP: ${req.ip}`, components: [row] });
        }
        await dev.save();
        res.redirect('/owner-auth');
    }
});

app.get('/owner-panel', async (req, res) => {
    if(!req.session.isOwner) return res.redirect('/owner-auth');
    const l = req.query.lang || 'en';
    const guilds = client.guilds.cache.map(g => {
        const isOnline = client.guilds.cache.has(g.id);
        return `
            <div class="admin-item">
                <span><div class="srv-status" style="background:${isOnline?'#34c759':'#ff3b30'}"></div> ${g.name}</span>
                <a href="/manage/${g.id}?lang=${l}" class="btn" style="width:auto; padding:5px 15px; margin:0;">Ustawienia</a>
            </div>`;
    }).join('');
    res.send(renderPage(`<div class="card"><h2>Owner Master Panel</h2>${guilds}</div>`, l));
});

// --- WSPARCIE LOGOWANIA ---
app.get('/login', (req, res, next) => {
    const state = Buffer.from(JSON.stringify({ t: req.query.target, l: req.query.lang })).toString('base64');
    passport.authenticate('discord', { state })(req, res, next);
});

app.get('/auth/callback', passport.authenticate('discord', { failureRedirect: '/' }), (req, res) => {
    const state = JSON.parse(Buffer.from(req.query.state, 'base64').toString());
    res.redirect(`/${state.t}?lang=${state.l || 'en'}`);
});

// --- WERYFIKACJA URZĄDZEŃ ---
app.get('/select-guild', async (req, res) => {
    if(!req.isAuthenticated()) return res.redirect('/');
    const l = req.query.lang || 'en';
    const guilds = req.user.guilds.filter(g => client.guilds.cache.has(g.id));
    const list = guilds.map(g => `<a href="/verify-final/${g.id}?lang=${l}" class="btn btn-alt">${g.name}</a>`).join('');
    res.send(renderPage(`<div class="card"><h2>Wybierz Serwer</h2>${list}</div>`, l));
});

client.login(process.env.DISCORD_TOKEN);
app.listen(3000, () => console.log("Icarus Enterprise Online"));
