const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, InteractionType } = require('discord.js');
const express = require('express');
const mongoose = require('mongoose');
const passport = require('passport');
const { Strategy } = require('passport-discord');
const session = require('express-session');
const MongoStore = require('connect-mongo');

// --- DATABASE SCHEMAS ---
const GuildConfig = mongoose.model('GuildConfig', new mongoose.Schema({
    guildId: String,
    verifyRoleId: String,
    logChannelId: String,
    lang: { type: String, default: 'en' },
    admins: [String],
    isBlocked: { type: Boolean, default: false },
    blockReason: String
}));

const UserData = mongoose.model('UserData', new mongoose.Schema({
    userId: String,
    attempts: { type: Number, default: 5 },
    isLocked: { type: Boolean, default: false },
    deviceId: String
}));

// --- INITIALIZATION ---
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.DirectMessages] });
const app = express();
app.set('trust proxy', true);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

mongoose.connect(process.env.MONGO_URI);

// JEDNORAZOWY RESET DLA CIEBIE
async function resetSafety() {
    await UserData.updateMany({}, { isLocked: false, attempts: 5 });
    console.log("Misiu, system gotowy. Blokady zdjęte.");
}
resetSafety();

app.use(session({
    secret: 'icarus_neon_secret_2026',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: process.env.MONGO_URI })
}));

passport.use(new Strategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: process.env.DOMAIN + '/auth/callback',
    scope: ['identify', 'guilds']
}, (at, rt, profile, done) => done(null, profile)));

passport.serializeUser((u, d) => d(null, u));
passport.deserializeUser((o, d) => d(null, o));
app.use(passport.initialize());
app.use(passport.session());

// --- TRANSLATIONS ---
const LOCALES = {
    pl: { v: "Weryfikacja Konta", m: "Panel Zarządzania", o: "Panel Właściciela", save: "Zapisz", success: "Zapisano!", error: "Błąd!", unsaved: "Masz niezapisane zmiany!", blockMsg: "Serwer zablokowany.", contact: "Kontakt:", pinErr: "Nieprawidłowy PIN. Próby:" },
    en: { v: "Verify Account", m: "Management Panel", o: "Owner Portal", save: "Save", success: "Saved!", error: "Error!", unsaved: "You have unsaved changes!", blockMsg: "Server blocked.", contact: "Contact:", pinErr: "Invalid PIN. Attempts:" },
    de: { v: "Verifizieren", m: "Management", o: "Besitzer", save: "Speichern", success: "Gespeichert!", error: "Fehler!", unsaved: "Ungespeicherte Änderungen!", blockMsg: "Server blockiert.", contact: "Kontakt:", pinErr: "Ungültige PIN:" },
    fr: { v: "Vérifier", m: "Gestion", o: "Propriétaire", save: "Enregistrer", success: "Enregistré!", error: "Erreur!", unsaved: "Changements non enregistrés!", blockMsg: "Serveur bloqué.", contact: "Contact:", pinErr: "PIN invalide:" },
    es: { v: "Verificar", m: "Gestión", o: "Propietario", save: "Guardar", success: "¡Guardado!", error: "¡Error!", unsaved: "¡Cambios sin guardar!", blockMsg: "Servidor bloqueado.", contact: "Contacto:", pinErr: "PIN inválido:" }
};

// --- UI SYSTEM ---
const UI_STYLE = `
    :root { --blue: #0071e3; --neon: #00f2ff; --bg: #ffffff; --text: #1d1d1f; }
    body.dark-mode { --bg: #000000; --text: #f5f5f7; }
    body { background: var(--bg); color: var(--text); font-family: 'Inter', sans-serif; transition: 0.3s; margin: 0; }
    .top-bar { position: fixed; top: 0; width: 100%; padding: 20px; display: flex; justify-content: space-between; z-index: 1000; box-sizing: border-box; }
    .neon-btn {
        position: relative; padding: 12px 24px; border: none; background: transparent;
        color: var(--text); font-weight: 600; cursor: pointer; border-radius: 12px;
        text-decoration: none; display: inline-flex; align-items: center; justify-content: center; transition: 0.2s;
    }
    .neon-btn::before {
        content: ''; position: absolute; inset: 0; border-radius: 12px; padding: 2px; 
        background: linear-gradient(90deg, var(--neon), var(--blue), var(--neon));
        background-size: 200% auto; -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
        mask-composite: exclude; animation: flow 3s linear infinite;
    }
    @keyframes flow { 0% { background-position: 0% center; } 100% { background-position: 200% center; } }
    .container { min-height: 100vh; display: flex; align-items: center; justify-content: center; flex-direction: column; }
    .card { background: rgba(128,128,128,0.1); backdrop-filter: blur(25px); padding: 40px; border-radius: 24px; width: 420px; text-align: center; border: 1px solid rgba(128,128,128,0.2); }
    #unsaved-bar { position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); background: var(--blue); color: white; padding: 12px 25px; border-radius: 50px; display: none; align-items: center; gap: 15px; box-shadow: 0 10px 20px rgba(0,0,0,0.2); }
`;

const getWrapper = (content, lang = 'en', isConfigPage = false) => `
    <html>
    <head><style>${UI_STYLE}</style></head>
    <body class="\${localStorage.getItem('theme') || 'light-mode'}">
        <div class="top-bar">
            <div>
                <button class="neon-btn" onclick="updateParams('lang', 'pl')">🇵🇱 PL</button>
                <button class="neon-btn" onclick="updateParams('lang', 'en')">🇬🇧 EN</button>
            </div>
            <button class="neon-btn" onclick="toggleTheme()">🌓</button>
        </div>
        <div class="container">${content}</div>
        ${isConfigPage ? `<div id="unsaved-bar"><span>${LOCALES[lang].unsaved}</span><button class="neon-btn" style="background:white; color:black; padding:5px 15px;" onclick="document.querySelector('form').submit()">${LOCALES[lang].save}</button></div>` : ''}
        <script>
            function updateParams(key, val) {
                const url = new URL(window.location.href);
                url.searchParams.set(key, val);
                window.location.href = url.toString();
            }
            function toggleTheme() {
                const body = document.body;
                const newTheme = body.classList.contains('dark-mode') ? 'light-mode' : 'dark-mode';
                body.className = newTheme;
                localStorage.setItem('theme', newTheme);
            }
            if(${isConfigPage}) {
                document.addEventListener('input', () => { document.getElementById('unsaved-bar').style.display = 'flex'; });
            }
        </script>
    </body>
    </html>
`;

// --- ROUTES ---
app.get('/', (req, res) => {
    const l = req.query.lang || 'en';
    res.send(getWrapper(`
        <div class="card">
            <h1>Icarus</h1>
            <a href="/login?target=verify&lang=${l}" class="neon-btn" style="width:100%; margin-bottom:10px;">${LOCALES[l].v}</a>
            <a href="/login?target=dashboard&lang=${l}" class="neon-btn" style="width:100%; margin-bottom:10px;">${LOCALES[l].m}</a>
            <a href="/owner-login?lang=${l}" class="neon-btn" style="width:100%; margin-top:30px; color:var(--neon)">${LOCALES[l].o}</a>
        </div>
    `, l));
});

app.get('/login', (req, res, next) => {
    const state = Buffer.from(JSON.stringify({ t: req.query.target, l: req.query.lang })).toString('base64');
    passport.authenticate('discord', { state })(req, res, next);
});

app.get('/auth/callback', passport.authenticate('discord', { failureRedirect: '/' }), (req, res) => {
    const state = JSON.parse(Buffer.from(req.query.state, 'base64').toString());
    res.redirect(\`/\${state.t}?lang=\${state.l || 'en'}\`);
});

app.get('/dashboard', async (req, res) => {
    if(!req.isAuthenticated()) return res.redirect('/login?target=dashboard');
    const l = req.query.lang || 'en';
    const guilds = req.user.guilds.filter(g => (g.permissions & 0x8) === 0x8);
    const list = guilds.map(g => `<div style="display:flex; justify-content:space-between; margin-bottom:10px;"><span>${g.name}</span><a href="/config/${g.id}?lang=${l}" class="neon-btn" style="padding:5px 10px;">Manage</a></div>`).join('');
    res.send(getWrapper(`<div class="card"><h2>Servers</h2>${list}</div>`, l));
});

app.get('/config/:guildId', async (req, res) => {
    if(!req.isAuthenticated()) return res.redirect('/login');
    const l = req.query.lang || 'en';
    const config = await GuildConfig.findOne({ guildId: req.params.guildId }) || new GuildConfig({ guildId: req.params.guildId });
    res.send(getWrapper(`
        <div class="card" style="text-align:left;">
            <h3>Config</h3>
            <form action="/api/save-config/${req.params.guildId}?lang=${l}" method="POST">
                <input type="hidden" name="form_lang" value="${l}">
                <label>Logs ID:</label><input name="logChannelId" value="${config.logChannelId||''}" class="neon-btn" style="width:100%; margin-bottom:10px;">
                <label>Role ID:</label><input name="verifyRoleId" value="${config.verifyRoleId||''}" class="neon-btn" style="width:100%;">
                <button type="submit" class="neon-btn" style="width:100%; margin-top:20px;">${LOCALES[l].save}</button>
            </form>
        </div>
    `, l, true)); // true aktywuje baner zapisu
});

app.post('/api/save-config/:guildId', async (req, res) => {
    await GuildConfig.findOneAndUpdate({ guildId: req.params.guildId }, { logChannelId: req.body.logChannelId, verifyRoleId: req.body.verifyRoleId }, { upsert: true });
    res.redirect(`/config/${req.params.guildId}?lang=${req.body.form_lang || 'en'}`);
});

app.get('/owner-login', async (req, res) => {
    const l = req.query.lang || 'en';
    const user = await UserData.findOne({ deviceId: req.ip });
    if(user?.isLocked) return res.send(getWrapper(`<h1>LOCKED</h1>`, l));
    res.send(getWrapper(`
        <div class="card">
            <h2>PIN</h2>
            <form action="/owner-verify?lang=${l}" method="POST">
                <input type="password" name="pin" class="neon-btn" style="width:100%; margin-bottom:15px; text-align:center;">
                <button type="submit" class="neon-btn" style="width:100%;">Login</button>
            </form>
            <p style="color:red;">${LOCALES[l].pinErr} ${user ? user.attempts : 5}</p>
        </div>
    `, l));
});

app.post('/owner-verify', async (req, res) => {
    const l = req.query.lang || 'en';
    if(req.body.pin === "15052021") {
        req.session.isOwner = true;
        res.redirect(`/owner-panel?lang=${l}`);
    } else {
        let user = await UserData.findOne({ deviceId: req.ip }) || new UserData({ deviceId: req.ip });
        user.attempts -= 1; if(user.attempts <= 0) user.isLocked = true;
        await user.save();
        res.redirect(`/owner-login?lang=${l}`);
    }
});

app.get('/owner-panel', async (req, res) => {
    if(!req.session.isOwner) return res.redirect('/owner-login');
    const l = req.query.lang || 'en';
    const guilds = client.guilds.cache.map(g => `<div style="display:flex; justify-content:space-between; padding:5px;"><span>${g.name}</span><button class="neon-btn">X</button></div>`).join('');
    res.send(getWrapper(`<div class="card"><h1>Owner</h1>${guilds}</div>`, l));
});

app.listen(process.env.PORT || 3000, () => console.log("Icarus Online."));
client.login(process.env.DISCORD_TOKEN);
