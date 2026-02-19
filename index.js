const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, InteractionType, PermissionsBitField } = require('discord.js');
const express = require('express');
const mongoose = require('mongoose');
const passport = require('passport');
const { Strategy } = require('passport-discord');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const path = require('path');

// --- KONFIGURACJA I MODELE ---
const OWNER_ID = "1131510639769178132";
const MASTER_PIN = "15052021";

const GuildSchema = new mongoose.Schema({
    guildId: String,
    verifyRoleId: String,
    logChannelId: String,
    lang: { type: String, default: 'en' },
    admins: { type: [String], default: [] },
    isBlocked: { type: Boolean, default: false },
    blockReason: String
});
const GuildConfig = mongoose.model('GuildConfig', GuildSchema);

const UserSchema = new mongoose.Schema({
    deviceId: String,
    attempts: { type: Number, default: 5 },
    isLocked: { type: Boolean, default: false },
    verifiedAccounts: [String]
});
const UserData = mongoose.model('UserData', UserSchema);

// --- SERWER I BOT ---
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.DirectMessages] });
const app = express();
app.set('trust proxy', true);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

mongoose.connect("TWÓJ_MONGO_URI");

app.use(session({
    secret: 'icarus_premium_secret_2026',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: "TWÓJ_MONGO_URI" })
}));

passport.use(new Strategy({
    clientID: "TWÓJ_CLIENT_ID",
    clientSecret: "TWÓJ_CLIENT_SECRET",
    callbackURL: "https://TWOJA-DOMENA.pl/auth/callback",
    scope: ['identify', 'guilds']
}, (at, rt, profile, done) => done(null, profile)));

passport.serializeUser((u, d) => d(null, u));
passport.deserializeUser((o, d) => d(null, o));
app.use(passport.initialize());
app.use(passport.session());

// --- TŁUMACZENIA ---
const translations = {
    pl: {
        verify: "Weryfikacja Konta", manage: "Panel Zarządzania", owner: "Panel Właściciela",
        save: "Zapisz Zmiany", unsaved: "Masz niezapisane zmiany!", pinErr: "PIN nieprawidłowy. Pozostało prób:",
        blocked: "Serwer Zablokowany", contact: "Kontakt: icarus.system.pl@gmail.com",
        success: "Zmiany zostały pomyślnie zapisane!", fail: "Wystąpił błąd podczas zapisu.",
        select: "Wybierz Serwer", status: "Status Systemu", blockBtn: "ZABLOKUJ", addBot: "DODAJ BOTA"
    },
    en: {
        verify: "Account Verification", manage: "Management Panel", owner: "Owner Panel",
        save: "Save Changes", unsaved: "You have unsaved changes!", pinErr: "Invalid PIN. Attempts left:",
        blocked: "Server Blocked", contact: "Contact: icarus.system.pl@gmail.com",
        success: "Changes saved successfully!", fail: "An error occurred while saving.",
        select: "Select Server", status: "System Status", blockBtn: "BLOCK", addBot: "ADD BOT"
    }
};

// --- FRONTEND ENGINE (APPLE/GOOGLE STYLE) ---
const UI = (content, lang = 'en', hasConfig = false) => `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Icarus System</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;600;700&display=swap');
        :root { --blue: #0071e3; --bg: #ffffff; --text: #1d1d1f; --neon: #00f2ff; --card: rgba(255, 255, 255, 0.8); }
        body.dark { --bg: #000000; --text: #f5f5f7; --neon: #7000ff; --card: rgba(28, 28, 30, 0.8); }
        body { background: var(--bg); color: var(--text); font-family: 'Plus Jakarta Sans', sans-serif; margin: 0; transition: 0.5s cubic-bezier(0.4, 0, 0.2, 1); overflow-x: hidden; }
        
        .nav { position: fixed; top: 0; width: 100%; padding: 20px 40px; display: flex; justify-content: space-between; align-items: center; box-sizing: border-box; z-index: 1000; backdrop-filter: blur(10px); }
        .lang-switch a { text-decoration: none; color: var(--text); margin-right: 15px; font-weight: 600; opacity: 0.5; transition: 0.3s; }
        .lang-switch a.active { opacity: 1; border-bottom: 2px solid var(--blue); }
        
        .theme-toggle { width: 45px; height: 45px; border-radius: 12px; display: flex; align-items: center; justify-content: center; cursor: pointer; border: 2px solid var(--neon); box-shadow: 0 0 15px var(--neon); font-size: 20px; transition: 0.3s; }
        .theme-toggle:hover { transform: rotate(15deg) scale(1.1); }

        .container { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 100px 20px; }
        .card { background: var(--card); backdrop-filter: blur(20px); border-radius: 30px; padding: 40px; width: 100%; max-width: 500px; border: 1px solid rgba(128,128,128,0.2); box-shadow: 0 20px 40px rgba(0,0,0,0.1); }
        
        h1 { font-size: 42px; font-weight: 800; letter-spacing: -1.5px; margin-bottom: 10px; }
        .btn { display: flex; align-items: center; justify-content: center; padding: 18px 30px; border-radius: 16px; background: var(--blue); color: white; text-decoration: none; font-weight: 600; margin: 10px 0; transition: 0.3s; border: none; cursor: pointer; width: 100%; box-sizing: border-box; }
        .btn:hover { transform: translateY(-2px); box-shadow: 0 10px 20px rgba(0,113,227,0.3); }
        
        .unsaved-bar { position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%); background: var(--blue); color: white; padding: 15px 40px; border-radius: 50px; display: none; align-items: center; gap: 20px; box-shadow: 0 15px 30px rgba(0,0,0,0.2); z-index: 2000; animation: slideUp 0.5s ease; }
        @keyframes slideUp { from { bottom: -100px; } to { bottom: 30px; } }
        
        .spinner { border: 3px solid rgba(255,255,255,0.3); border-top: 3px solid #fff; border-radius: 50%; width: 20px; height: 20px; animation: spin 1s linear infinite; display: none; margin-right: 10px; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        
        input, select { width: 100%; padding: 15px; border-radius: 12px; border: 1px solid rgba(128,128,128,0.3); background: transparent; color: var(--text); margin-bottom: 15px; font-size: 16px; outline: none; }
        .admin-item { display: flex; justify-content: space-between; align-items: center; padding: 10px; background: rgba(128,128,128,0.1); border-radius: 10px; margin-bottom: 5px; }
        .remove-btn { color: #ff3b30; cursor: pointer; font-weight: 800; text-decoration: none; }
    </style>
</head>
<body class="\${localStorage.getItem('theme') || ''}">
    <div class="nav">
        <div class="lang-switch">
            <a href="?lang=pl" class="\${lang === 'pl' ? 'active' : ''}">🇵🇱 Polski</a>
            <a href="?lang=en" class="\${lang === 'en' ? 'active' : ''}">🇬🇧 English</a>
        </div>
        <div class="theme-toggle" onclick="toggleTheme()">\${localStorage.getItem('theme') === 'dark' ? '🟣' : '☀️'}</div>
    </div>
    <div class="container">${content}</div>
    
    <div id="save-bar" class="unsaved-bar">
        <span>${translations[lang].unsaved}</span>
        <button class="btn" style="width:auto; margin:0; padding:10px 25px; background:white; color:black;" onclick="submitMainForm()">
            <div id="loader" class="spinner"></div> ${translations[lang].save}
        </button>
    </div>

    <script>
        function toggleTheme() {
            const body = document.body;
            body.classList.toggle('dark');
            localStorage.setItem('theme', body.classList.contains('dark') ? 'dark' : 'light');
            location.reload();
        }
        function showSaveBar() { document.getElementById('save-bar').style.display = 'flex'; }
        if(${hasConfig}) {
            document.querySelectorAll('input, select').forEach(el => el.addEventListener('input', showSaveBar));
        }
        function submitMainForm() {
            document.getElementById('loader').style.display = 'inline-block';
            setTimeout(() => document.getElementById('config-form').submit(), 1500);
        }
    </script>
</body>
</html>
`;

// --- ROUTY ---

app.get('/', (req, res) => {
    const l = req.query.lang || 'en';
    res.send(UI(`
        <div class="card">
            <h1 style="text-align:center;">Icarus</h1>
            <p style="text-align:center; opacity:0.6; margin-bottom:40px;">Professional Security & Verification</p>
            <a href="/login?target=verify&lang=${l}" class="btn">${translations[l].verify}</a>
            <a href="/login?target=dashboard&lang=${l}" class="btn" style="background:transparent; border:2px solid var(--blue); color:var(--text);">${translations[l].manage}</a>
            <a href="/owner-login?lang=${l}" class="btn" style="margin-top:50px; background:rgba(128,128,128,0.1); color:var(--text); font-size:12px;">${translations[l].owner}</a>
        </div>
    `, l));
});

app.get('/login', (req, res, next) => {
    const state = Buffer.from(JSON.stringify({ t: req.query.target, l: req.query.lang })).toString('base64');
    passport.authenticate('discord', { state })(req, res, next);
});

app.get('/auth/callback', passport.authenticate('discord', { failureRedirect: '/' }), (req, res) => {
    const state = JSON.parse(Buffer.from(req.query.state, 'base64').toString());
    res.redirect(`/${state.t}?lang=${state.l}`);
});

// --- WERYFIKACJA ---

app.get('/verify', async (req, res) => {
    if(!req.isAuthenticated()) return res.redirect('/');
    const l = req.query.lang || 'en';
    const guilds = req.user.guilds.filter(g => client.guilds.cache.has(g.id));
    const list = guilds.map(g => `<a href="/verify/${g.id}?lang=${l}" class="btn" style="justify-content:space-between; text-align:left;">${g.name} <span>→</span></a>`).join('');
    res.send(UI(`<div class="card"><h2>${translations[l].select}</h2>${list}</div>`, l));
});

app.get('/verify/:guildId', async (req, res) => {
    const l = req.query.lang || 'en';
    const config = await GuildConfig.findOne({ guildId: req.params.guildId });
    if(config?.isBlocked) {
        return res.send(UI(`<div class="card"><h1 style="color:#ff3b30;">${translations[l].blocked}</h1><p>${config.blockReason}</p><p style="font-size:12px; opacity:0.5;">${translations[l].contact}</p></div>`, l));
    }
    res.send(UI(`
        <div class="card">
            <h1>Verification</h1>
            <p style="opacity:0.6;">System Icarus sprawdzi Twoje urządzenie pod kątem multikont.</p>
            <form action="/do-verify/${req.params.guildId}?lang=${l}" method="POST">
                <button type="submit" class="btn">WERYFIKUJ</button>
            </form>
        </div>
    `, l));
});

app.post('/do-verify/:guildId', async (req, res) => {
    if(!req.isAuthenticated()) return res.redirect('/');
    const l = req.query.lang || 'en';
    const ip = req.ip;
    const guild = client.guilds.cache.get(req.params.guildId);
    const config = await GuildConfig.findOne({ guildId: req.params.guildId });

    // Logika Anty-Multi
    let isSus = false;
    let userData = await UserData.findOne({ deviceId: ip });
    if(userData && !userData.verifiedAccounts.includes(req.user.id)) isSus = true;

    // PV DO CIEBIE (WŁAŚCICIELA)
    const owner = await client.users.fetch(OWNER_ID);
    const ownerEmbed = new EmbedBuilder()
        .setTitle("🚨 Nowa próba weryfikacji")
        .setColor(isSus ? 0xff3b30 : 0x00f2ff)
        .addFields(
            { name: "Użytkownik", value: `${req.user.username} (${req.user.id})` },
            { name: "Serwer", value: `${guild.name}` },
            { name: "IP", value: ip },
            { name: "Link do serwera", value: `https://discord.com/channels/${guild.id}` }
        );
    const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`block_srv_${guild.id}`).setLabel("BLOKUJ SERWER").setStyle(ButtonStyle.Danger));
    await owner.send({ embeds: [ownerEmbed], components: [row] });

    // LOGI NA SERWER
    if(config?.logChannelId) {
        const chan = guild.channels.cache.get(config.logChannelId);
        if(chan) {
            const embed = new EmbedBuilder()
                .setTitle("System Log")
                .setDescription(isSus ? "⚠️ Wykryto potencjalne multikonto!" : "✅ Pomyślna weryfikacja.")
                .setColor(isSus ? 0xff9500 : 0x34c759);
            
            if(isSus) {
                const srvRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`approve_${req.user.id}`).setLabel("Zatwierdź").setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId(`reject_${req.user.id}`).setLabel("Odrzuć").setStyle(ButtonStyle.Danger)
                );
                await chan.send({ embeds: [embed], components: [srvRow] });
            } else {
                await chan.send({ embeds: [embed] });
                const member = await guild.members.fetch(req.user.id);
                if(config.verifyRoleId) await member.roles.add(config.verifyRoleId);
            }
        }
    }

    if(!userData) userData = new UserData({ deviceId: ip, verifiedAccounts: [req.user.id] });
    else if(!userData.verifiedAccounts.includes(req.user.id)) userData.verifiedAccounts.push(req.user.id);
    await userData.save();

    res.send(UI(`<div class="card"><h1>Sukces</h1><p>Weryfikacja zakończona. Sprawdź Discord.</p></div>`, l));
});

// --- DASHBOARD ---

app.get('/dashboard', async (req, res) => {
    if(!req.isAuthenticated()) return res.redirect('/login?target=dashboard');
    const l = req.query.lang || 'en';
    const guilds = req.user.guilds.filter(g => (g.permissions & 0x8) === 0x8);
    const list = guilds.map(g => {
        const hasBot = client.guilds.cache.has(g.id);
        return `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; padding:10px; border-bottom:1px solid rgba(128,128,128,0.1);">
                <span>${g.name}</span>
                ${hasBot ? `<a href="/config/${g.id}?lang=${l}" class="btn" style="width:auto; padding:8px 20px; font-size:12px;">${translations[l].manage}</a>` 
                         : `<a href="https://discord.com/api/oauth2/authorize?client_id=ID&permissions=8&scope=bot" class="btn" style="width:auto; padding:8px 20px; font-size:12px; background:var(--neon);">${translations[l].addBot}</a>`}
            </div>
        `;
    }).join('');
    res.send(UI(`<div class="card"><h2>Twoje Serwery</h2>${list}</div>`, l));
});

app.get('/config/:guildId', async (req, res) => {
    if(!req.isAuthenticated()) return res.redirect('/');
    const l = req.query.lang || 'en';
    const config = await GuildConfig.findOne({ guildId: req.params.guildId }) || new GuildConfig({ guildId: req.params.guildId });
    
    res.send(UI(`
        <div class="card" style="max-width:600px;">
            <h2>Konfiguracja</h2>
            <form id="config-form" action="/save-config/${req.params.guildId}" method="POST">
                <input type="hidden" name="l" value="${l}">
                <label>Język bota:</label>
                <select name="lang">
                    <option value="pl" ${config.lang==='pl'?'selected':''}>Polski</option>
                    <option value="en" ${config.lang==='en'?'selected':''}>English</option>
                    <option value="de">Deutsch</option><option value="fr">Français</option><option value="es">Español</option>
                </select>
                <label>ID Kanału Logów:</label>
                <input name="logId" value="${config.logChannelId||''}" placeholder="ID Kanału">
                <label>ID Roli Weryfikacyjnej:</label>
                <input name="roleId" value="${config.verifyRoleId||''}" placeholder="ID Roli">
                <label>Dodaj Administratora (ID):</label>
                <input name="newAdmin" placeholder="Discord ID">
                <div style="margin-top:20px;">
                    ${config.admins.map(a => `<div class="admin-item"><span>${a}</span><a href="/del-admin/${req.params.guildId}/${a}" class="remove-btn">✕</a></div>`).join('')}
                </div>
                <button type="submit" class="btn" style="margin-top:20px;">${translations[l].save}</button>
            </form>
        </div>
    `, l, true));
});

app.post('/save-config/:guildId', async (req, res) => {
    const { lang, logId, roleId, newAdmin, l } = req.body;
    let config = await GuildConfig.findOne({ guildId: req.params.guildId }) || new GuildConfig({ guildId: req.params.guildId });
    config.lang = lang; config.logChannelId = logId; config.verifyRoleId = roleId;
    if(newAdmin) config.admins.push(newAdmin);
    await config.save();
    res.redirect(`/config/${req.params.guildId}?lang=${l}&status=success`);
});

// --- PANEL WŁAŚCICIELA ---

app.get('/owner-login', async (req, res) => {
    const l = req.query.lang || 'en';
    const user = await UserData.findOne({ deviceId: req.ip });
    if(user?.isLocked) return res.send(UI(`<h1 style="color:red; text-align:center;">Dostęp Zablokowany</h1><p style="text-align:center;">Zatwierdź próbę na Discordzie PV.</p>`, l));
    
    res.send(UI(`
        <div class="card">
            <h2 style="text-align:center;">System Owner</h2>
            <form action="/owner-auth" method="POST">
                <input type="password" name="pin" style="text-align:center; font-size:24px; letter-spacing:8px;" placeholder="****">
                <button type="submit" class="btn">AUTORYZUJ</button>
            </form>
            <p style="text-align:center; color:#ff3b30; font-size:14px; margin-top:15px;">${translations[l].pinErr} ${user?user.attempts:5}</p>
        </div>
    `, l));
});

app.post('/owner-auth', async (req, res) => {
    const { pin } = req.body;
    const ip = req.ip;
    let user = await UserData.findOne({ deviceId: ip }) || new UserData({ deviceId: ip });

    if(pin === MASTER_PIN) {
        req.session.isOwner = true;
        user.attempts = 5;
        await user.save();
        res.redirect('/owner-panel');
    } else {
        user.attempts -= 1;
        if(user.attempts <= 0) {
            user.isLocked = true;
            const owner = await client.users.fetch(OWNER_ID);
            const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`unlock_dev_${ip.replace(/\./g, '_')}`).setLabel("ODBLOKUJ I POKAŻ PIN").setStyle(ButtonStyle.Success));
            await owner.send({ content: `🚨 **ALERT**: Próba włamania do Panelu Właściciela z IP: ${ip}. Urządzenie zablokowane.`, components: [row] });
        }
        await user.save();
        res.redirect('/owner-login');
    }
});

app.get('/owner-panel', async (req, res) => {
    if(!req.session.isOwner) return res.redirect('/owner-login');
    const l = req.query.lang || 'en';
    const guilds = client.guilds.cache.map(g => {
        return `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:15px; border-bottom:1px solid rgba(128,128,128,0.1);">
                <div>
                    <strong>${g.name}</strong><br>
                    <span style="font-size:10px; color:#34c759;">● ONLINE</span>
                </div>
                <div style="display:flex; gap:10px;">
                    <a href="/config/${g.id}" class="btn" style="width:auto; padding:5px 12px; font-size:10px; margin:0;">ZARZĄDZAJ</a>
                    <a href="/owner-block/${g.id}" class="btn" style="width:auto; padding:5px 12px; font-size:10px; margin:0; background:#ff3b30;">${translations[l].blockBtn}</a>
                </div>
            </div>
        `;
    }).join('');
    res.send(UI(`<div class="card" style="max-width:700px;"><h1>Zarządzanie Globalne</h1>${guilds}</div>`, l));
});

app.get('/owner-block/:guildId', (req, res) => {
    if(!req.session.isOwner) return res.redirect('/');
    res.send(UI(`
        <div class="card">
            <h2>Blokada Serwera</h2>
            <form action="/do-owner-block/${req.params.guildId}" method="POST">
                <input name="reason" placeholder="Powód blokady..." required>
                <button type="submit" class="btn" style="background:#ff3b30;">POTWIERDŹ BLOKADĘ</button>
            </form>
        </div>
    `));
});

app.post('/do-owner-block/:guildId', async (req, res) => {
    if(!req.session.isOwner) return res.status(403).send("Forbidden");
    const { reason } = req.body;
    await GuildConfig.findOneAndUpdate({ guildId: req.params.guildId }, { isBlocked: true, blockReason: reason }, { upsert: true });
    
    const guild = client.guilds.cache.get(req.params.guildId);
    const config = await GuildConfig.findOne({ guildId: req.params.guildId });
    if(config?.logChannelId) {
        const chan = guild.channels.cache.get(config.logChannelId);
        if(chan) await chan.send(`🚨 **SERWER ZOSTAŁ ZABLOKOWANY**\nPowód: ${reason}\nKontakt: icarus.system.pl@gmail.com`);
    }
    res.redirect('/owner-panel');
});

// --- INTERAKCJE DISCORD ---

client.on('interactionCreate', async i => {
    if(i.isButton()) {
        if(i.customId.startsWith('unlock_dev_')) {
            const ip = i.customId.split('_').slice(2).join('.').replace(/_/g, '.');
            await UserData.findOneAndUpdate({ deviceId: ip }, { isLocked: false, attempts: 1 });
            const msg = await i.reply({ content: `Urządzenie odblokowane. PIN to: **15052021**. (Zniknie za 10s)`, fetchReply: true });
            setTimeout(() => i.deleteReply(), 10000);
        }
        if(i.customId.startsWith('block_srv_')) {
            const gid = i.customId.split('_')[2];
            const modal = new ModalBuilder().setCustomId(`modal_block_${gid}`).setTitle('Blokada Serwera');
            const input = new TextInputBuilder().setCustomId('reason').setLabel('Powód blokady').setStyle(TextInputStyle.Paragraph).setRequired(true);
            modal.addComponents(new ActionRowBuilder().addComponents(input));
            await i.showModal(modal);
        }
    }
    if(i.type === InteractionType.ModalSubmit) {
        if(i.customId.startsWith('modal_block_')) {
            const gid = i.customId.split('_')[2];
            const reason = i.fields.getTextInputValue('reason');
            await GuildConfig.findOneAndUpdate({ guildId: gid }, { isBlocked: true, blockReason: reason }, { upsert: true });
            await i.reply(`Serwer ${gid} został zablokowany.`);
        }
    }
});

client.login("TWÓJ_TOKEN_BOTA");
app.listen(3000, () => console.log("Icarus System Online"));
