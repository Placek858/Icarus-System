const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, InteractionType, PermissionsBitField } = require('discord.js');
const express = require('express');
const mongoose = require('mongoose');
const passport = require('passport');
const { Strategy } = require('passport-discord');
const session = require('express-session');
const MongoStore = require('connect-mongo');

// --- SCHEMATY BAZY DANYCH ---
const GuildConfig = mongoose.model('GuildConfig', new mongoose.Schema({
    guildId: String, verifyRoleId: String, logChannelId: String, lang: { type: String, default: 'en' },
    admins: { type: [String], default: [] }, isBlocked: { type: Boolean, default: false }, blockReason: String
}));

const UserData = mongoose.model('UserData', new mongoose.Schema({
    deviceId: String, attempts: { type: Number, default: 5 }, isLocked: { type: Boolean, default: false }, verifiedAccounts: [String]
}));

// --- INICJALIZACJA ---
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.DirectMessages] });
const app = express();
app.set('trust proxy', true);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

mongoose.connect(process.env.MONGO_URI);

app.use(session({
    secret: 'icarus_ultra_premium_2026',
    resave: false, saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: process.env.MONGO_URI })
}));

passport.use(new Strategy({
    clientID: process.env.CLIENT_ID, clientSecret: process.env.CLIENT_SECRET,
    callbackURL: process.env.DOMAIN + '/auth/callback', scope: ['identify', 'guilds']
}, (at, rt, profile, done) => done(null, profile)));

passport.serializeUser((u, d) => d(null, u));
passport.deserializeUser((o, d) => d(null, o));
app.use(passport.initialize());
app.use(passport.session());

// --- LOKALIZACJA ---
const LOCALES = {
    pl: { v: "Weryfikacja Konta", m: "Panel Zarządzania", o: "Właściciel Systemu", save: "Zapisz", unsaved: "Masz niezapisane zmiany!", pinErr: "Błędny PIN. Pozostało prób:", blockMsg: "Serwer Zablokowany", contact: "Kontakt: icarus.system.pl@gmail.com", success: "Zapisano pomyślnie!", fail: "Błąd zapisu!" },
    en: { v: "Verify Account", m: "Management Panel", o: "System Owner", save: "Save", unsaved: "You have unsaved changes!", pinErr: "Invalid PIN. Attempts left:", blockMsg: "Server Blocked", contact: "Contact: icarus.system.pl@gmail.com", success: "Saved successfully!", fail: "Save failed!" }
};

// --- SYSTEM UI (APPLE/GOOGLE STYLE) ---
const UI_STYLE = `
    :root { --blue: #0071e3; --neon: #00f2ff; --bg: #ffffff; --text: #1d1d1f; --glass: rgba(255, 255, 255, 0.7); }
    body.dark-mode { --bg: #000000; --text: #f5f5f7; --glass: rgba(0, 0, 0, 0.7); }
    body { background: var(--bg); color: var(--text); font-family: 'Inter', -apple-system, sans-serif; transition: 0.5s cubic-bezier(0.2, 0.8, 0.2, 1); margin: 0; overflow-x: hidden; }
    .nav { position: fixed; top: 0; width: 100%; padding: 25px 50px; display: flex; justify-content: space-between; align-items: center; z-index: 1000; box-sizing: border-box; }
    .lang-switcher button { background: none; border: none; cursor: pointer; font-size: 16px; color: var(--text); opacity: 0.6; transition: 0.3s; margin-right: 15px; }
    .lang-switcher button.active { opacity: 1; font-weight: bold; }
    .theme-icon { font-size: 28px; cursor: pointer; transition: 0.3s; filter: drop-shadow(0 0 8px var(--neon)); }
    .container { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; background: radial-gradient(circle at center, rgba(0,242,255,0.05) 0%, transparent 70%); }
    .card { background: var(--glass); backdrop-filter: blur(30px); border: 1px solid rgba(128,128,128,0.2); border-radius: 30px; padding: 50px; width: 450px; text-align: center; box-shadow: 0 25px 50px rgba(0,0,0,0.1); }
    .btn {
        position: relative; padding: 16px 32px; border: none; background: transparent; color: var(--text); font-weight: 600; cursor: pointer; border-radius: 16px;
        text-decoration: none; display: flex; align-items: center; justify-content: center; transition: 0.3s; margin-bottom: 15px; overflow: hidden;
    }
    .btn::before {
        content: ''; position: absolute; inset: 0; border-radius: 16px; padding: 2px; 
        background: linear-gradient(90deg, var(--neon), var(--blue), var(--neon)); background-size: 200% auto;
        -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0); mask-composite: exclude; animation: flow 3s linear infinite;
    }
    @keyframes flow { 0% { background-position: 0% center; } 100% { background-position: 200% center; } }
    .save-bar { position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%); background: var(--blue); color: white; padding: 15px 40px; border-radius: 50px; display: none; align-items: center; gap: 20px; box-shadow: 0 15px 30px rgba(0,113,227,0.3); z-index: 2000; }
    .loader { border: 3px solid rgba(255,255,255,0.3); border-top: 3px solid #fff; border-radius: 50%; width: 20px; height: 20px; animation: spin 1s linear infinite; display: none; }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
`;

const getWrapper = (content, lang = 'en', config = false) => `
    <html>
    <head><style>${UI_STYLE}</style><link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;600&display=swap" rel="stylesheet"></head>
    <body class="\${localStorage.getItem('theme') || 'light-mode'}">
        <div class="nav">
            <div class="lang-switcher">
                <button class="\${'${lang}'==='pl'?'active':''}" onclick="setL('pl')">🇵🇱 Polski</button>
                <button class="\${'${lang}'==='en'?'active':''}" onclick="setL('en')">🇬🇧 English</button>
            </div>
            <div class="theme-icon" onclick="toggleT()">\${localStorage.getItem('theme')==='dark-mode'?'⚡':'🌙'}</div>
        </div>
        <div class="container">${content}</div>
        <div id="save-bar" class="save-bar">
            <span>${LOCALES[lang].unsaved}</span>
            <button class="btn" style="margin:0; padding:8px 20px; background:white; color:black;" onclick="submitForm()">
                <div id="load" class="loader"></div> <span id="btxt">${LOCALES[lang].save}</span>
            </button>
        </div>
        <script>
            function setL(l){ localStorage.setItem('lang', l); const u=new URL(window.location.href); u.searchParams.set('lang', l); window.location.href=u.toString(); }
            function toggleT(){
                const b=document.body; const m=b.classList.contains('dark-mode')?'light-mode':'dark-mode';
                b.className=m; localStorage.setItem('theme', m); location.reload();
            }
            if(${config}){ document.addEventListener('input', () => document.getElementById('save-bar').style.display='flex'); }
            function submitForm(){
                document.getElementById('load').style.display='block';
                document.getElementById('btxt').style.display='none';
                setTimeout(() => document.querySelector('form').submit(), 1500);
            }
        </script>
    </body>
    </html>
`;

// --- ROUTY ---

app.get('/', (req, res) => {
    const l = req.query.lang || 'en';
    res.send(getWrapper(`
        <div class="card">
            <h1 style="font-size: 48px; letter-spacing: -2px; margin: 0 0 10px 0;">Icarus</h1>
            <p style="opacity: 0.5; font-weight: 300; margin-bottom: 40px;">Professional Security Systems</p>
            <a href="/login?target=verify" class="btn">${LOCALES[l].v}</a>
            <a href="/login?target=dashboard" class="btn">${LOCALES[l].m}</a>
            <a href="/owner-login" class="btn" style="margin-top:40px; border:1px solid rgba(0,242,255,0.3); font-size:12px;">${LOCALES[l].o}</a>
        </div>
    `, l));
});

app.get('/login', (req, res, next) => {
    const state = Buffer.from(JSON.stringify({ t: req.query.target, l: req.query.lang || 'en' })).toString('base64');
    passport.authenticate('discord', { state })(req, res, next);
});

app.get('/auth/callback', passport.authenticate('discord', { failureRedirect: '/' }), (req, res) => {
    const state = JSON.parse(Buffer.from(req.query.state, 'base64').toString());
    res.redirect(`/${state.t}?lang=${state.l}`);
});

// --- WERYFIKACJA & MULTIKONTA ---

app.get('/verify', async (req, res) => {
    if(!req.isAuthenticated()) return res.redirect('/');
    const l = req.query.lang || 'en';
    const guilds = req.user.guilds.filter(g => client.guilds.cache.has(g.id));
    const list = guilds.map(g => `<a href="/verify/${g.id}" class="btn" style="justify-content:space-between;">${g.name} <span>→</span></a>`).join('');
    res.send(getWrapper(`<div class="card"><h2>Select Server</h2>${list}</div>`, l));
});

app.get('/verify/:guildId', async (req, res) => {
    const l = req.query.lang || 'en';
    const config = await GuildConfig.findOne({ guildId: req.params.guildId });
    if(config?.isBlocked) return res.send(getWrapper(`<div class="card"><h2 style="color:#ff3b30;">${LOCALES[l].blockMsg}</h2><p>${config.blockReason}</p><p style="font-size:12px;">${LOCALES[l].contact}</p></div>`, l));
    
    res.send(getWrapper(`
        <div class="card">
            <h2>Anti-Multi Verification</h2>
            <p style="opacity:0.6; font-size:14px; margin-bottom:30px;">System will analyze your device fingerprint for security.</p>
            <form action="/do-verify/${req.params.guildId}" method="POST">
                <button type="submit" class="btn" style="width:100%;">START VERIFICATION</button>
            </form>
        </div>
    `, l));
});

app.post('/do-verify/:guildId', async (req, res) => {
    if(!req.isAuthenticated()) return res.send("Auth Required");
    const guild = client.guilds.cache.get(req.params.guildId);
    const config = await GuildConfig.findOne({ guildId: req.params.guildId });
    const ip = req.ip;
    
    let isMulti = false;
    let userData = await UserData.findOne({ deviceId: ip });
    if(userData && !userData.verifiedAccounts.includes(req.user.id)) isMulti = true;

    // Logi dla Ciebie (Owner)
    const owner = await client.users.fetch(process.env.OWNER_ID);
    const ownerEmbed = new EmbedBuilder().setTitle("🛡️ New Verification Log").setColor(isMulti?0xFF3B30:0x00F2FF)
        .addFields({name:"User", value:`${req.user.username} (${req.user.id})`}, {name:"IP", value:ip}, {name:"Server", value:guild.name});
    const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`block_g_${guild.id}`).setLabel("BLOCK SERVER").setStyle(ButtonStyle.Danger));
    await owner.send({ embeds: [ownerEmbed], components: [row] });

    if(config?.logChannelId) {
        const chan = guild.channels.cache.get(config.logChannelId);
        if(chan) {
            const embed = new EmbedBuilder().setTitle("User Verification").setDescription(isMulti ? "⚠️ Multi-account detected!" : "✅ Secure verification completed.").setColor(isMulti?0xFF9500:0x34C759);
            if(isMulti) {
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`app_${req.user.id}`).setLabel("Approve").setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId(`rej_${req.user.id}`).setLabel("Reject").setStyle(ButtonStyle.Danger)
                );
                await chan.send({ embeds: [embed], components: [row] });
            } else {
                await chan.send({ embeds: [embed] });
                const member = await guild.members.fetch(req.user.id);
                if(config.verifyRoleId) member.roles.add(config.verifyRoleId);
            }
        }
    }

    if(!userData) userData = new UserData({ deviceId: ip, verifiedAccounts: [req.user.id] });
    else if(!userData.verifiedAccounts.includes(req.user.id)) userData.verifiedAccounts.push(req.user.id);
    await userData.save();

    res.send(getWrapper(`<div class="card"><h1>${isMulti?'Pending Review':'Success!'}</h1><p>Check Discord.</p></div>`));
});

// --- PANEL ZARZĄDZANIA ---

app.get('/dashboard', async (req, res) => {
    if(!req.isAuthenticated()) return res.redirect('/login?target=dashboard');
    const guilds = req.user.guilds.filter(g => (g.permissions & 0x8) === 0x8);
    const list = guilds.map(g => {
        const hasBot = client.guilds.cache.has(g.id);
        return `<div style="display:flex; justify-content:space-between; margin-bottom:15px; align-items:center;">
            <span>${g.name}</span>
            ${hasBot ? `<a href="/config/${g.id}" class="btn" style="margin:0; padding:5px 15px; font-size:12px;">MANAGE</a>` : `<a href="https://discord.com/api/oauth2/authorize?client_id=${process.env.CLIENT_ID}&permissions=8&scope=bot" class="btn" style="margin:0; padding:5px 15px; font-size:12px; color:var(--neon);">ADD BOT</a>`}
        </div>`;
    }).join('');
    res.send(getWrapper(`<div class="card"><h2>Manage Servers</h2>${list}</div>`, req.query.lang));
});

app.get('/config/:guildId', async (req, res) => {
    const l = req.query.lang || 'en';
    const config = await GuildConfig.findOne({ guildId: req.params.guildId }) || new GuildConfig({ guildId: req.params.guildId });
    res.send(getWrapper(`
        <div class="card" style="text-align:left;">
            <h3>Settings: ${req.params.guildId}</h3>
            <form action="/api/save-config/${req.params.guildId}" method="POST">
                <input type="hidden" name="l" value="${l}">
                <label style="font-size:11px; opacity:0.5;">BOT LANGUAGE</label>
                <select name="lang" class="btn" style="width:100%; background:transparent; margin-bottom:15px;">
                    <option value="pl" ${config.lang==='pl'?'selected':''}>Polski</option>
                    <option value="en" ${config.lang==='en'?'selected':''}>English</option>
                    <option value="de">Deutsch</option><option value="fr">Français</option><option value="es">Español</option>
                </select>
                <label style="font-size:11px; opacity:0.5;">LOGS CHANNEL ID</label>
                <input name="logId" value="${config.logChannelId||''}" class="btn" style="width:100%; text-align:left; background:transparent;">
                <label style="font-size:11px; opacity:0.5;">VERIFY ROLE ID</label>
                <input name="roleId" value="${config.verifyRoleId||''}" class="btn" style="width:100%; text-align:left; background:transparent;">
                <p style="font-size:11px; opacity:0.5; margin-top:20px;">ADMINS</p>
                ${config.admins.map(a => `<div style="display:flex; justify-content:space-between;"><span>${a}</span><a href="/del-admin/${req.params.guildId}/${a}" style="color:red;">X</a></div>`).join('')}
            </form>
        </div>
    `, l, true));
});

app.post('/api/save-config/:guildId', async (req, res) => {
    await GuildConfig.findOneAndUpdate({ guildId: req.params.guildId }, { lang: req.body.lang, logChannelId: req.body.logId, verifyRoleId: req.body.roleId }, { upsert: true });
    res.redirect(`/config/${req.params.guildId}?lang=${req.body.l}&saved=1`);
});

// --- PANEL WŁAŚCICIELA & PIN ---

app.get('/owner-login', async (req, res) => {
    const l = req.query.lang || 'en';
    const user = await UserData.findOne({ deviceId: req.ip });
    if(user?.isLocked) return res.send(getWrapper(`<h1 style="color:red;">DEVICE LOCKED</h1><p>Emergency unlock sent to your Discord PV.</p>`, l));
    res.send(getWrapper(`
        <div class="card">
            <h2>Enter Master PIN</h2>
            <form action="/owner-auth" method="POST">
                <input type="password" name="pin" class="btn" style="width:100%; text-align:center; font-size:24px; letter-spacing:8px;" placeholder="****">
                <button type="submit" class="btn" style="width:100%; margin-top:20px;">AUTHORIZE</button>
            </form>
            <p style="color:red;">${LOCALES[l].pinErr} ${user?user.attempts:5}</p>
        </div>
    `, l));
});

app.post('/owner-auth', async (req, res) => {
    const ip = req.ip;
    let user = await UserData.findOne({ deviceId: ip }) || new UserData({ deviceId: ip });
    if(req.body.pin === "15052021") {
        req.session.isOwner = true;
        user.attempts = 5; await user.save();
        res.redirect('/owner-panel');
    } else {
        user.attempts -= 1;
        if(user.attempts <= 0) {
            user.isLocked = true;
            const owner = await client.users.fetch(process.env.OWNER_ID);
            const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`emergency_${ip.replace(/\./g, '_')}`).setLabel("EMERGENCY UNLOCK").setStyle(ButtonStyle.Success));
            await owner.send({ content: `🚨 **SECURITY**: Device ${ip} blocked. Use button to grant 1 attempt & show PIN.`, components: [row] });
        }
        await user.save();
        res.redirect('/owner-login');
    }
});

app.get('/owner-panel', async (req, res) => {
    if(!req.session.isOwner) return res.redirect('/owner-login');
    const guilds = client.guilds.cache.map(g => `<div style="display:flex; justify-content:space-between; padding:10px; border-bottom:1px solid rgba(128,128,128,0.1);">
        <span>${g.name} <span style="color:#34C759; font-size:10px;">● ONLINE</span></span>
        <button class="btn" style="margin:0; padding:5px 10px; color:red; font-size:10px;">BLOCK</button>
    </div>`).join('');
    res.send(getWrapper(`<div class="card" style="width:600px;"><h1>System Master Control</h1>${guilds}</div>`));
});

// --- INTERAKCJE DISCORD ---

client.on('interactionCreate', async i => {
    if(i.isButton()) {
        if(i.customId.startsWith('emergency_')) {
            const ip = i.customId.split('_').slice(1).join('.').replace(/_/g, '.');
            await UserData.findOneAndUpdate({ deviceId: ip }, { isLocked: false, attempts: 1 });
            const msg = await i.reply({ content: `Unlock granted. PIN: **15052021**. Message expires in 10s.`, fetchReply: true });
            setTimeout(() => i.deleteReply(), 10000);
        }
        if(i.customId.startsWith('block_g_')) {
            const gid = i.customId.split('_')[2];
            const modal = new ModalBuilder().setCustomId(`block_modal_${gid}`).setTitle('Block Server');
            modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('reason').setLabel('Reason').setStyle(TextInputStyle.Paragraph)));
            await i.showModal(modal);
        }
    }
    if(i.type === InteractionType.ModalSubmit) {
        if(i.customId.startsWith('block_modal_')) {
            const gid = i.customId.split('_')[2];
            const reason = i.fields.getTextInputValue('reason');
            await GuildConfig.findOneAndUpdate({ guildId: gid }, { isBlocked: true, blockReason: reason }, { upsert: true });
            await i.reply(`Server ${gid} blocked for: ${reason}`);
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
app.listen(process.env.PORT || 3000);
