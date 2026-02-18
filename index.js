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

// JEDNORAZOWY RESET PRÓB DLA CIEBIE (Przy starcie serwera)
async function resetSafety() {
    await UserData.updateMany({}, { isLocked: false, attempts: 5 });
    console.log("Misiu, Twoje próby logowania zostały zresetowane.");
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

// --- TRANSLATIONS (5 LANGUAGES) ---
const LOCALES = {
    pl: { v: "Weryfikacja Konta", m: "Panel Zarządzania", o: "Panel Właściciela", save: "Zapisz", success: "Zapisano pomyślnie!", error: "Błąd!", unsaved: "Masz niezapisane zmiany!", blockMsg: "Serwer zablokowany przez Administratora.", contact: "Kontakt:", pinErr: "Nieprawidłowy PIN. Pozostało prób:" },
    en: { v: "Verify Account", m: "Management Panel", o: "Owner Portal", save: "Save", success: "Saved successfully!", error: "Error!", unsaved: "You have unsaved changes!", blockMsg: "Server blocked by Administrator.", contact: "Contact:", pinErr: "Invalid PIN. Attempts left:" },
    de: { v: "Konto verifizieren", m: "Verwaltungspanel", o: "Besitzerportal", save: "Speichern", success: "Gespeichert!", error: "Fehler!", unsaved: "Ungespeicherte Änderungen!", blockMsg: "Server blockiert.", contact: "Kontakt:", pinErr: "Ungültige PIN. Versuche:" },
    fr: { v: "Vérifier le compte", m: "Panneau de gestion", o: "Portail propriétaire", save: "Enregistrer", success: "Enregistré!", error: "Erreur!", unsaved: "Changements non enregistrés!", blockMsg: "Serveur bloqué.", contact: "Contact:", pinErr: "PIN invalide. Tentatives:" },
    es: { v: "Verificar cuenta", m: "Panel de gestión", o: "Portal del propietario", save: "Guardar", success: "¡Guardado!", error: "¡Error!", unsaved: "¡Cambios sin guardar!", blockMsg: "Servidor bloqueado.", contact: "Contacto:", pinErr: "PIN inválido. Intentos:" }
};

// --- LUXURY NEON UI ---
const UI_STYLE = `
    :root { --blue: #0071e3; --neon: #00f2ff; --bg: #ffffff; --text: #1d1d1f; }
    body.dark-mode { --bg: #000000; --text: #f5f5f7; }
    body { background: var(--bg); color: var(--text); font-family: 'Inter', sans-serif; transition: 0.5s; margin: 0; overflow-x: hidden; }
    
    .top-bar { position: fixed; top: 0; width: 100%; padding: 20px 40px; display: flex; justify-content: space-between; z-index: 1000; box-sizing: border-box; }
    
    .neon-btn {
        position: relative; padding: 12px 24px; border: none; background: transparent;
        color: var(--text); font-weight: 600; cursor: pointer; border-radius: 12px;
        text-decoration: none; display: inline-flex; align-items: center; justify-content: center;
        transition: 0.3s;
    }
    .neon-btn::before {
        content: ''; position: absolute; inset: 0; border-radius: 12px; padding: 2px; 
        background: linear-gradient(90deg, var(--neon), var(--blue), var(--neon));
        background-size: 200% auto;
        -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
        mask-composite: exclude; animation: flow 3s linear infinite;
    }
    @keyframes flow { 0% { background-position: 0% center; } 100% { background-position: 200% center; } }
    .neon-btn:hover { transform: scale(1.05); }

    .container { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 80px 20px; box-sizing: border-box; }
    .card { background: rgba(128,128,128,0.1); backdrop-filter: blur(30px); padding: 40px; border-radius: 30px; width: 100%; max-width: 480px; text-align: center; border: 1px solid rgba(128,128,128,0.2); }
    
    #unsaved-bar { position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); background: var(--blue); color: white; padding: 15px 30px; border-radius: 50px; display: none; align-items: center; gap: 20px; z-index: 2000; box-shadow: 0 10px 30px rgba(0,0,0,0.3); }
    .loader { border: 3px solid #f3f3f3; border-top: 3px solid var(--neon); border-radius: 50%; width: 18px; height: 18px; animation: spin 1s linear infinite; display: none; margin-left: 10px; }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
`;

const getWrapper = (content, lang = 'en') => `
    <html>
    <head><style>${UI_STYLE}</style></head>
    <body class="light-mode">
        <div class="top-bar">
            <div><button class="neon-btn" onclick="setLang('pl')">🇵🇱 PL</button> <button class="neon-btn" onclick="setLang('en')">🇬🇧 EN</button></div>
            <button class="neon-btn" onclick="toggleTheme()">🌓</button>
        </div>
        <div class="container">${content}</div>
        <div id="unsaved-bar"><span>${LOCALES[lang]?.unsaved}</span><button class="neon-btn" style="background:white; color:black;" onclick="document.querySelector('form').submit()">Zapisz</button></div>
        <script>
            function setLang(l) { localStorage.setItem('lang', l); location.search = '?lang=' + l; }
            function toggleTheme() { document.body.classList.toggle('dark-mode'); }
            document.addEventListener('input', () => { if(document.querySelector('form')) document.getElementById('unsaved-bar').style.display = 'flex'; });
        </script>
    </body>
    </html>
`;

// --- ROUTES ---

app.get('/', (req, res) => {
    const l = req.query.lang || 'en';
    res.send(getWrapper(`
        <div class="card">
            <h1 style="font-size:48px; margin:0;">Icarus</h1>
            <p style="opacity:0.5; margin-bottom:40px;">Advanced Security System</p>
            <a href="/login?target=verify" class="neon-btn" style="width:100%; margin-bottom:15px;">${LOCALES[l].v}</a>
            <a href="/login?target=dashboard" class="neon-btn" style="width:100%; margin-bottom:15px;">${LOCALES[l].m}</a>
            <a href="/owner-login" class="neon-btn" style="width:100%; margin-top:40px; color:var(--neon)">${LOCALES[l].o}</a>
        </div>
    `, l));
});

// AUTH
app.get('/login', (req, res, next) => {
    const state = Buffer.from(JSON.stringify({ t: req.query.target })).toString('base64');
    passport.authenticate('discord', { state })(req, res, next);
});

app.get('/auth/callback', passport.authenticate('discord', { failureRedirect: '/' }), (req, res) => {
    const state = JSON.parse(Buffer.from(req.query.state, 'base64').toString());
    res.redirect('/' + state.t);
});

// OWNER PANEL
app.get('/owner-login', async (req, res) => {
    const l = req.query.lang || 'en';
    const user = await UserData.findOne({ deviceId: req.ip });
    if(user?.isLocked) return res.send(getWrapper(`<h1>LOCKED</h1>`, l));
    res.send(getWrapper(`
        <div class="card">
            <h2>PIN Required</h2>
            <form action="/owner-verify" method="POST">
                <input type="password" name="pin" class="neon-btn" style="width:100%; background:rgba(255,255,255,0.1); margin-bottom:20px; text-align:center;" placeholder="****">
                <button type="submit" class="neon-btn" style="width:100%;">Enter</button>
            </form>
            <p style="color:red; margin-top:15px;">${LOCALES[l].pinErr} ${user ? user.attempts : 5}</p>
        </div>
    `, l));
});

app.post('/owner-verify', async (req, res) => {
    const { pin } = req.body;
    let user = await UserData.findOne({ deviceId: req.ip }) || new UserData({ deviceId: req.ip });
    if(pin === "15052021") {
        user.attempts = 5; await user.save();
        req.session.isOwner = true;
        res.redirect('/owner-panel');
    } else {
        user.attempts -= 1;
        if(user.attempts <= 0) user.isLocked = true;
        await user.save();
        
        // Wyślij PV do Ciebie o blokadzie
        try {
            const owner = await client.users.fetch(process.env.OWNER_ID);
            owner.send(`🚨 **Próba włamania!** IP: ${req.ip}. Urządzenie zablokowane.`);
        } catch(e) {}
        
        res.redirect('/owner-login');
    }
});

app.get('/owner-panel', async (req, res) => {
    if(!req.session.isOwner) return res.redirect('/owner-login');
    const guilds = client.guilds.cache.map(g => `<div style="display:flex; justify-content:space-between; padding:10px; border-bottom:1px solid rgba(128,128,128,0.1);"><span>${g.name}</span> <button class="neon-btn" onclick="blockG('${g.id}')">X</button></div>`).join('');
    res.send(getWrapper(`<div class="card"><h1>Master Control</h1>${guilds}</div>`));
});

// DASHBOARD
app.get('/dashboard', async (req, res) => {
    if(!req.isAuthenticated()) return res.redirect('/login?target=dashboard');
    const guilds = req.user.guilds.filter(g => (g.permissions & 0x8) === 0x8);
    const list = guilds.map(g => `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:15px; border-bottom:1px solid rgba(128,128,128,0.1);">
            <span>${g.name}</span>
            <a href="/config/${g.id}" class="neon-btn" style="padding:5px 15px; font-size:12px;">Zarządzaj</a>
        </div>
    `).join('');
    res.send(getWrapper(`<div class="card"><h1>Twoje Serwery</h1>${list}</div>`));
});

app.get('/config/:guildId', async (req, res) => {
    if(!req.isAuthenticated()) return res.redirect('/login');
    const config = await GuildConfig.findOne({ guildId: req.params.guildId }) || new GuildConfig({ guildId: req.params.guildId });
    const t = LOCALES[config.lang || 'en'];
    res.send(getWrapper(`
        <div class="card" style="text-align:left;">
            <h3>Ustawienia Serwera</h3>
            <form action="/api/save-config/${req.params.guildId}" method="POST">
                <label>Język:</label>
                <select name="lang" class="neon-btn" style="width:100%; margin-bottom:15px; background:transparent;">
                    <option value="pl" ${config.lang==='pl'?'selected':''}>Polski</option>
                    <option value="en" ${config.lang==='en'?'selected':''}>English</option>
                </select>
                <label>ID Kanału Logów:</label>
                <input name="logChannelId" value="${config.logChannelId||''}" class="neon-btn" style="width:100%; margin-bottom:15px; background:transparent;">
                <label>ID Roli:</label>
                <input name="verifyRoleId" value="${config.verifyRoleId||''}" class="neon-btn" style="width:100%; background:transparent;">
                <button type="submit" class="neon-btn" style="width:100%; margin-top:20px;">${t.save}</button>
            </form>
        </div>
    `, config.lang));
});

app.post('/api/save-config/:guildId', async (req, res) => {
    const { lang, logChannelId, verifyRoleId } = req.body;
    await GuildConfig.findOneAndUpdate({ guildId: req.params.guildId }, { lang, logChannelId, verifyRoleId }, { upsert: true });
    res.redirect(`/config/${req.params.guildId}?success=1`);
});

// START
app.listen(process.env.PORT || 3000, () => console.log("Icarus Live."));
client.login(process.env.DISCORD_TOKEN);
