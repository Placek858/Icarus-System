// ==========================================
//    ICARUS SYSTEM - KOD GŁÓWNY (index.js)
// ==========================================
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

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.DirectMessages] });
const app = express();
app.set('trust proxy', true);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// POŁĄCZENIE Z BAZĄ (KORZYSTA Z TWOICH ZMIENNYCH)
mongoose.connect(process.env.MONGO_URI);

// SCHEMATY BAZY DANYCH
const GuildConfig = mongoose.model('GuildConfig', new mongoose.Schema({
    guildId: String, verifyRoleId: String, logChannelId: String, 
    lang: { type: String, default: 'en' }, admins: { type: [String], default: [] },
    isBlocked: { type: Boolean, default: false }, blockReason: String
}));

const UserData = mongoose.model('UserData', new mongoose.Schema({
    deviceId: String, attempts: { type: Number, default: 5 }, 
    isLocked: { type: Boolean, default: false }, verifiedAccounts: { type: [String], default: [] }
}));

// SESJA I PASSPORT
app.use(session({
    secret: 'icarus_ultra_safe_2026',
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

// TŁUMACZENIA (DLA KAŻDEGO SZCZEGÓŁU)
const translations = {
    pl: {
        verify: "Weryfikacja", manage: "Zarządzanie", owner: "System Admin",
        save: "Zapisz", unsaved: "Masz niezapisane zmiany!", blocked: "SERWER ZABLOKOWANY",
        reason: "Powód", contact: "Kontakt: icarus.system.pl@gmail.com",
        pin_err: "Nieprawidłowy PIN. Próby:", status: "Status", select_srv: "Wybierz Serwer"
    },
    en: {
        verify: "Verification", manage: "Management", owner: "System Admin",
        save: "Save", unsaved: "You have unsaved changes!", blocked: "SERVER BLOCKED",
        reason: "Reason", contact: "Contact: icarus.system.pl@gmail.com",
        pin_err: "Invalid PIN. Attempts:", status: "Status", select_srv: "Select Server"
    }
};

// SILNIK UI (APPLE STYLE)
const UI = (content, lang = 'en', hasConfig = false) => {
    const t = translations[lang] || translations.en;
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700&display=swap');
        :root { --blue: #0071e3; --bg: #ffffff; --text: #1d1d1f; --card: #f5f5f7; --neon: #00f2ff; }
        body.dark { --bg: #000000; --text: #f5f5f7; --card: #1c1c1e; --neon: #7000ff; }
        body { background: var(--bg); color: var(--text); font-family: 'Plus Jakarta Sans', sans-serif; transition: 0.5s; margin: 0; }
        .nav { position: fixed; top: 0; width: 100%; padding: 20px 40px; display: flex; justify-content: space-between; z-index: 1000; box-sizing: border-box; }
        .theme-toggle { font-size: 28px; cursor: pointer; filter: drop-shadow(0 0 10px var(--neon)); transition: 0.3s; }
        .lang-link { text-decoration: none; color: var(--text); font-weight: bold; margin-right: 15px; opacity: 0.5; }
        .lang-link.active { opacity: 1; border-bottom: 2px solid var(--blue); }
        .container { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
        .card { background: var(--card); padding: 40px; border-radius: 30px; width: 100%; max-width: 450px; text-align: center; box-shadow: 0 20px 40px rgba(0,0,0,0.1); }
        .btn { display: flex; align-items: center; justify-content: center; padding: 16px; border-radius: 12px; background: var(--blue); color: white; text-decoration: none; font-weight: 600; border: none; cursor: pointer; margin: 10px 0; width: 100%; transition: 0.3s; }
        .btn:hover { transform: scale(1.02); }
        input { width: 100%; padding: 15px; border-radius: 10px; border: 1px solid rgba(128,128,128,0.2); background: var(--bg); color: var(--text); box-sizing: border-box; }
        .unsaved-bar { position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%); background: var(--blue); color: white; padding: 15px 30px; border-radius: 50px; display: none; align-items: center; gap: 20px; box-shadow: 0 10px 30px rgba(0,113,227,0.4); z-index: 2000; }
        .loader { border: 3px solid #f3f3f3; border-top: 3px solid var(--blue); border-radius: 50%; width: 20px; height: 20px; animation: spin 1s linear infinite; display: none; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    </style>
</head>
<body class="\${localStorage.getItem('theme') || ''}">
    <div class="nav">
        <div>
            <a href="?lang=pl" class="lang-link \${'${lang}' === 'pl' ? 'active' : ''}">🇵🇱 Polski</a>
            <a href="?lang=en" class="lang-link \${'${lang}' === 'en' ? 'active' : ''}">🇬🇧 English</a>
        </div>
        <div class="theme-toggle" onclick="toggleT()">\${localStorage.getItem('theme') === 'dark' ? '🔮' : '💡'}</div>
    </div>
    <div class="container">${content}</div>
    <div id="u-bar" class="unsaved-bar">
        <span>${t.unsaved}</span>
        <button class="btn" style="width:auto; padding:8px 20px; background:white; color:black;" onclick="saveF()">Save</button>
    </div>
    <script>
        function toggleT() {
            const b = document.body;
            b.classList.toggle('dark');
            localStorage.setItem('theme', b.classList.contains('dark') ? 'dark' : 'light');
            location.reload();
        }
        if(${hasConfig}) {
            document.querySelectorAll('input, select').forEach(i => i.oninput = () => document.getElementById('u-bar').style.display = 'flex');
        }
        function saveF() { document.forms[0].submit(); }
    </script>
</body>
</html>`;
};

// --- ROUTY STRONY GŁÓWNEJ ---
app.get('/', (req, res) => {
    const l = req.query.lang || 'en';
    res.send(UI(`
        <div class="card">
            <h1 style="font-size: 50px; margin: 0;">Icarus</h1>
            <p style="opacity:0.5; margin-bottom: 40px;">Professional Protection</p>
            <a href="/login?target=verify&lang=${l}" class="btn">${translations[l].verify}</a>
            <a href="/login?target=dashboard&lang=${l}" class="btn" style="background:transparent; border:2px solid var(--blue); color:var(--text);">${translations[l].manage}</a>
            <a href="/owner-gate?lang=${l}" class="btn" style="background:none; font-size:11px; margin-top:50px;">${translations[l].owner}</a>
        </div>`, l));
});

// --- PANEL WŁAŚCICIELA (PIN & BLOKADA URZĄDZENIA) ---
app.get('/owner-gate', async (req, res) => {
    const l = req.query.lang || 'en';
    const dev = await UserData.findOne({ deviceId: req.ip });
    if(dev?.isLocked) return res.send(UI(`<h1>ZABLOKOWANO</h1><p>Urządzenie zablokowane. Oczekuj na odblokowanie na PV.</p>`, l));
    
    res.send(UI(`
        <div class="card">
            <h2>Wprowadź PIN</h2>
            <form action="/owner-auth" method="POST">
                <input type="password" name="pin" maxlength="8" style="text-align:center; font-size:24px; letter-spacing:5px;">
                <button class="btn">AUTORYZUJ</button>
            </form>
            <p style="color:red">${translations[l].pin_err} ${dev ? dev.attempts : 5}</p>
        </div>`, l));
});

app.post('/owner-auth', async (req, res) => {
    const { pin } = req.body;
    let dev = await UserData.findOne({ deviceId: req.ip }) || new UserData({ deviceId: req.ip });

    if(pin === "15052021") {
        dev.attempts = 5; await dev.save();
        req.session.isSystemAdmin = true;
        res.redirect('/system-dashboard');
    } else {
        dev.attempts -= 1;
        if(dev.attempts <= 0) {
            dev.isLocked = true;
            const owner = await client.users.fetch(process.env.OWNER_ID);
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`unlock_dev_${req.ip.replace(/\./g, '_')}`).setLabel("ODBLOKUJ").setStyle(ButtonStyle.Success)
            );
            owner.send({ content: `🚨 **WŁAMANIE!** IP: ${req.ip}. Zablokowano dostęp.`, components: [row] });
        }
        await dev.save();
        res.redirect('/owner-gate');
    }
});

// --- LOGIKA WERYFIKACJI (ANTY-MULTI & LOGI PV) ---
app.post('/verify-final/:guildId', async (req, res) => {
    if(!req.isAuthenticated()) return res.redirect('/');
    const user = req.user;
    const ip = req.ip;
    const guild = client.guilds.cache.get(req.params.guildId);
    
    let dbUser = await UserData.findOne({ deviceId: ip }) || new UserData({ deviceId: ip });
    const isMulti = dbUser.verifiedAccounts.length > 0 && !dbUser.verifiedAccounts.includes(user.id);

    // PEŁNE LOGI NA TWOJE PV
    const owner = await client.users.fetch(process.env.OWNER_ID);
    const logEmbed = new EmbedBuilder()
        .setTitle("🔎 RAPORT WERYFIKACJI")
        .setColor(isMulti ? 0xFF0000 : 0x00FF00)
        .addFields(
            { name: "User", value: `${user.username} (${user.id})` },
            { name: "Serwer", value: `${guild.name}` },
            { name: "IP/Urządzenie", value: ip },
            { name: "Multi-Account", value: isMulti ? "TAK ⚠️" : "NIE ✅" },
            { name: "Link", value: `https://discord.com/channels/${guild.id}` }
        );
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`block_srv_${guild.id}`).setLabel("ZABLOKUJ SERWER").setStyle(ButtonStyle.Danger)
    );
    owner.send({ embeds: [logEmbed], components: [row] });

    if(!dbUser.verifiedAccounts.includes(user.id)) dbUser.verifiedAccounts.push(user.id);
    await dbUser.save();

    res.send(UI(`<h1>Gotowe!</h1>`, req.query.lang));
});

// --- PASSPORT CALLBACK ---
app.get('/login', (req, res, next) => {
    const state = Buffer.from(JSON.stringify({ t: req.query.target, l: req.query.lang })).toString('base64');
    passport.authenticate('discord', { state })(req, res, next);
});

app.get('/auth/callback', passport.authenticate('discord', { failureRedirect: '/' }), (req, res) => {
    const state = JSON.parse(Buffer.from(req.query.state, 'base64').toString());
    res.redirect(`/${state.t}?lang=${state.l || 'en'}`);
});

// --- OBSŁUGA DISCORDA ---
client.on('interactionCreate', async i => {
    if(i.isButton()) {
        if(i.customId.startsWith('unlock_dev_')) {
            const ip = i.customId.split('_').slice(2).join('.').replace(/_/g, '.');
            await UserData.findOneAndUpdate({ deviceId: ip }, { isLocked: false, attempts: 1 });
            const rep = await i.reply({ content: `PIN: **15052021** (Zniknie za 10s)`, fetchReply: true });
            setTimeout(() => i.deleteReply(), 10000);
        }
        if(i.customId.startsWith('block_srv_')) {
            const gid = i.customId.split('_')[2];
            const modal = new ModalBuilder().setCustomId(`modal_block_${gid}`).setTitle('Blokada');
            const reason = new TextInputBuilder().setCustomId('reason').setLabel('Podaj powód').setStyle(TextInputStyle.Paragraph);
            modal.addComponents(new ActionRowBuilder().addComponents(reason));
            await i.showModal(modal);
        }
    }
    if(i.type === InteractionType.ModalSubmit && i.customId.startsWith('modal_block_')) {
        const gid = i.customId.split('_')[2];
        const reason = i.fields.getTextInputValue('reason');
        await GuildConfig.findOneAndUpdate({ guildId: gid }, { isBlocked: true, blockReason: reason }, { upsert: true });
        await i.reply(`Zablokowano serwer ${gid}.`);
    }
});

client.login(process.env.DISCORD_TOKEN);
app.listen(3000, () => console.log("Icarus Ready"));
