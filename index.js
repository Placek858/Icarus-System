const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, InteractionType, PermissionsBitField } = require('discord.js');
const express = require('express');
const mongoose = require('mongoose');
const passport = require('passport');
const { Strategy } = require('passport-discord');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const axios = require('axios');

// --- DATABASE SCHEMAS ---
const GuildConfig = mongoose.model('GuildConfig', new mongoose.Schema({
    guildId: String, verifyRoleId: String, logChannelId: String, lang: { type: String, default: 'en' },
    admins: { type: [String], default: [] }, isBlocked: { type: Boolean, default: false }, blockReason: String
}));

const UserData = mongoose.model('UserData', new mongoose.Schema({
    deviceId: String, attempts: { type: Number, default: 5 }, isLocked: { type: Boolean, default: false }, verifiedAccounts: [String]
}));

// --- INITIALIZATION ---
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.DirectMessages, GatewayIntentBits.MessageContent] });
const app = express();
app.set('trust proxy', true);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

mongoose.connect(process.env.MONGO_URI);

// JEDNORAZOWY RESET PRÓB DLA CIEBIE PRZY STARCIE
async function startupReset() {
    await UserData.updateMany({}, { isLocked: false, attempts: 5 });
    console.log("Misiu, system odblokowany i gotowy.");
}
startupReset();

app.use(session({
    secret: 'icarus_system_2026_secret',
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

// --- TRANSLATIONS (5 LANGUAGES) ---
const LOCALES = {
    pl: { v: "Weryfikacja", m: "Panel Zarządzania", o: "Panel Właściciela", save: "Zapisz zmiany", unsaved: "Masz niezapisane zmiany!", pinErr: "Błędny PIN. Pozostało prób:", blockMsg: "Serwer zablokowany!", contact: "Kontakt:", success: "Sukces!", error: "Błąd!" },
    en: { v: "Verification", m: "Management", o: "Owner Portal", save: "Save Changes", unsaved: "Unsaved changes!", pinErr: "Wrong PIN. Attempts left:", blockMsg: "Server blocked!", contact: "Contact:", success: "Success!", error: "Error!" },
    de: { v: "Verifizierung", m: "Verwaltung", o: "Besitzer", save: "Speichern", unsaved: "Ungespeicherte Änderungen!", pinErr: "Falsche PIN:", blockMsg: "Server blockiert!", contact: "Kontakt:", success: "Erfolg!", error: "Fehler!" },
    fr: { v: "Vérification", m: "Gestion", o: "Propriétaire", save: "Enregistrer", unsaved: "Changements non enregistrés!", pinErr: "PIN incorrect:", blockMsg: "Serveur bloqué!", contact: "Contact:", success: "Succès!", error: "Erreur!" },
    es: { v: "Verificación", m: "Gestión", o: "Propietario", save: "Guardar", unsaved: "Cambios sin guardar!", pinErr: "PIN incorrecto:", blockMsg: "Servidor bloqueado!", contact: "Contacto:", success: "¡Éxito!", error: "¡Error!" }
};

// --- LUXURY UI ---
const UI_STYLE = `
    :root { --blue: #0071e3; --neon: #00f2ff; --bg: #ffffff; --text: #1d1d1f; }
    body.dark-mode { --bg: #000000; --text: #f5f5f7; }
    body { background: var(--bg); color: var(--text); font-family: 'Inter', sans-serif; transition: 0.4s cubic-bezier(0.4, 0, 0.2, 1); margin: 0; overflow-x: hidden; }
    .top-bar { position: fixed; top: 0; width: 100%; padding: 20px 40px; display: flex; justify-content: space-between; z-index: 1000; box-sizing: border-box; backdrop-filter: blur(10px); }
    .neon-btn {
        position: relative; padding: 12px 28px; border: none; background: transparent; color: var(--text); font-weight: 600; cursor: pointer; border-radius: 14px;
        text-decoration: none; display: inline-flex; align-items: center; justify-content: center; transition: 0.3s;
    }
    .neon-btn::before {
        content: ''; position: absolute; inset: 0; border-radius: 14px; padding: 2px; 
        background: linear-gradient(90deg, #ff00ff, var(--neon), #ff00ff); background-size: 200% auto;
        -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0); mask-composite: exclude; animation: flow 4s linear infinite;
    }
    @keyframes flow { 0% { background-position: 0% center; } 100% { background-position: 200% center; } }
    .theme-toggle { font-size: 24px; cursor: pointer; filter: drop-shadow(0 0 5px var(--neon)); }
    .container { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding-top: 80px; }
    .card { background: rgba(128,128,128,0.08); backdrop-filter: blur(40px); padding: 50px; border-radius: 35px; width: 450px; text-align: center; border: 1px solid rgba(128,128,128,0.15); box-shadow: 0 20px 40px rgba(0,0,0,0.1); }
    #unsaved-bar { position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%); background: var(--blue); color: white; padding: 15px 35px; border-radius: 60px; display: none; align-items: center; gap: 20px; z-index: 2000; box-shadow: 0 10px 30px rgba(0,71,227,0.4); }
    .loader { border: 4px solid #f3f3f3; border-top: 4px solid var(--neon); border-radius: 50%; width: 30px; height: 30px; animation: spin 1s linear infinite; display: none; margin: 20px auto; }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
`;

const getWrapper = (content, lang = 'en', showUnsaved = false) => `
    <html>
    <head><title>Icarus System</title><style>${UI_STYLE}</style></head>
    <body class="\${localStorage.getItem('theme') || 'light-mode'}">
        <div class="top-bar">
            <div>
                <button class="neon-btn" onclick="setLang('pl')">🇵🇱 Polski</button>
                <button class="neon-btn" onclick="setLang('en')">🇬🇧 English</button>
            </div>
            <div class="theme-toggle" onclick="toggleT()">⚡</div>
        </div>
        <div class="container">${content}</div>
        <div id="unsaved-bar"><span>${LOCALES[lang].unsaved}</span><button class="neon-btn" style="background:white; color:black; padding:8px 20px;" onclick="saveForm()">${LOCALES[lang].save}</button></div>
        <script>
            function setLang(l) { localStorage.setItem('lang', l); updateUrl('lang', l); }
            function toggleT() { 
                const b = document.body; const nt = b.classList.contains('dark-mode') ? 'light-mode' : 'dark-mode';
                b.className = nt; localStorage.setItem('theme', nt);
            }
            function updateUrl(key, val) { const u = new URL(window.location.href); u.searchParams.set(key, val); window.location.href = u.toString(); }
            if(${showUnsaved}) { document.addEventListener('input', () => { document.getElementById('unsaved-bar').style.display = 'flex'; }); }
            function saveForm() { 
                document.getElementById('loader').style.display = 'block';
                const form = document.querySelector('form');
                if(form) form.submit();
            }
            // Trzymanie języka i motywu w linkach
            document.querySelectorAll('a').forEach(a => {
                const u = new URL(a.href, window.location.origin);
                u.searchParams.set('lang', localStorage.getItem('lang') || 'en');
                a.href = u.toString();
            });
        </script>
    </body>
    </html>
`;

// --- CORE ROUTES ---

app.get('/', (req, res) => {
    const l = req.query.lang || 'en';
    res.send(getWrapper(`
        <div class="card">
            <h1 style="font-size: 56px; margin: 0; background: linear-gradient(to right, #00f2ff, #0071e3); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">Icarus</h1>
            <p style="opacity: 0.6; margin-bottom: 40px; font-weight: 300;">Ultimate Verification System</p>
            <a href="/login?target=verify" class="neon-btn" style="width:100%; margin-bottom:15px;">${LOCALES[l].v}</a>
            <a href="/login?target=dashboard" class="neon-btn" style="width:100%; margin-bottom:15px;">${LOCALES[l].m}</a>
            <a href="/owner-login" class="neon-btn" style="width:100%; margin-top:50px; color:var(--neon); font-size: 13px;">${LOCALES[l].o}</a>
        </div>
    `, l));
});

// AUTH
app.get('/login', (req, res, next) => {
    const state = Buffer.from(JSON.stringify({ t: req.query.target, l: req.query.lang || 'en' })).toString('base64');
    passport.authenticate('discord', { state })(req, res, next);
});

app.get('/auth/callback', passport.authenticate('discord', { failureRedirect: '/' }), (req, res) => {
    const state = JSON.parse(Buffer.from(req.query.state, 'base64').toString());
    res.redirect(`/${state.t}?lang=${state.l}`);
});

// --- VERIFICATION SYSTEM ---

app.get('/verify', async (req, res) => {
    if(!req.isAuthenticated()) return res.redirect('/');
    const l = req.query.lang || 'en';
    const guildsWithBot = req.user.guilds.filter(g => client.guilds.cache.has(g.id));
    
    let list = guildsWithBot.map(g => `
        <a href="/verify/${g.id}" class="neon-btn" style="width:90%; margin-bottom:10px; justify-content: space-between;">
            <span>${g.name}</span> <span style="font-size: 10px; opacity: 0.5;">SELECT</span>
        </a>
    `).join('');

    res.send(getWrapper(`<div class="card"><h2>Select Server</h2>${list}</div>`, l));
});

app.get('/verify/:guildId', async (req, res) => {
    if(!req.isAuthenticated()) return res.redirect('/');
    const l = req.query.lang || 'en';
    const config = await GuildConfig.findOne({ guildId: req.params.guildId });
    
    if(config?.isBlocked) {
        return res.send(getWrapper(`
            <div class="card">
                <h2 style="color: #ff3b30;">${LOCALES[l].blockMsg}</h2>
                <p>${config.blockReason || 'No reason provided.'}</p>
                <p style="font-size: 12px; opacity: 0.6;">Contact: icarus.system.pl@gmail.com</p>
            </div>
        `, l));
    }

    res.send(getWrapper(`
        <div class="card">
            <h2>Account Verification</h2>
            <p style="font-size: 14px; opacity: 0.7;">Click the button below to complete security check.</p>
            <form action="/do-verify/${req.params.guildId}" method="POST">
                <button type="submit" class="neon-btn" style="width:100%; padding: 20px;">VERIFY IDENTITY</button>
            </form>
            <div id="loader" class="loader"></div>
        </div>
    `, l));
});

app.post('/do-verify/:guildId', async (req, res) => {
    if(!req.isAuthenticated()) return res.redirect('/');
    const guild = client.guilds.cache.get(req.params.guildId);
    const config = await GuildConfig.findOne({ guildId: req.params.guildId });
    const userIp = req.ip;
    
    // Anty-VPN & Multikonto check
    let isSus = false;
    const userData = await UserData.findOne({ deviceId: userIp });
    if(userData && userData.verifiedAccounts.length > 0 && !userData.verifiedAccounts.includes(req.user.id)) isSus = true;
    
    // Log do Ciebie (Owner)
    const owner = await client.users.fetch(process.env.OWNER_ID);
    const ownerEmbed = new EmbedBuilder()
        .setTitle("🚨 New Verification Attempt")
        .setColor(isSus ? 0xFF3B30 : 0x00F2FF)
        .addFields(
            { name: "User", value: `${req.user.username} (${req.user.id})`, inline: true },
            { name: "IP", value: userIp, inline: true },
            { name: "Server", value: `${guild.name}`, inline: true },
            { name: "Suspicious?", value: isSus ? "YES" : "NO" }
        );

    const ownerRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`block_guild_${guild.id}`).setLabel("BLOCK SERVER").setStyle(ButtonStyle.Danger)
    );
    await owner.send({ embeds: [ownerEmbed], components: [ownerRow] });

    // Log na serwer
    if(config?.logChannelId) {
        const logChan = guild.channels.cache.get(config.logChannelId);
        if(logChan) {
            const serverEmbed = new EmbedBuilder()
                .setTitle("Verification System")
                .setDescription(isSus ? "⚠️ Potential multi-account detected. Manual approval required." : "✅ User verified successfully.")
                .setColor(isSus ? 0xFFAA00 : 0x34C759)
                .setTimestamp();
            
            if(isSus) {
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`approve_${req.user.id}`).setLabel("Approve").setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId(`reject_${req.user.id}`).setLabel("Reject").setStyle(ButtonStyle.Danger)
                );
                await logChan.send({ embeds: [serverEmbed], components: [row] });
            } else {
                await logChan.send({ embeds: [serverEmbed] });
                // Nadaj rolę
                const member = await guild.members.fetch(req.user.id);
                if(config.verifyRoleId) member.roles.add(config.verifyRoleId);
            }
        }
    }

    // Save user data
    if(!userData) {
        await new UserData({ deviceId: userIp, verifiedAccounts: [req.user.id] }).save();
    } else if(!userData.verifiedAccounts.includes(req.user.id)) {
        userData.verifiedAccounts.push(req.user.id);
        await userData.save();
    }

    res.send(getWrapper(`<div class="card"><h1>${isSus ? 'Pending Review' : 'Verified!'}</h1><p>You can close this window now.</p></div>`));
});

// --- MANAGEMENT PANEL ---

app.get('/dashboard', async (req, res) => {
    if(!req.isAuthenticated()) return res.redirect('/login?target=dashboard');
    const l = req.query.lang || 'en';
    const guilds = req.user.guilds.filter(g => (g.permissions & 0x8) === 0x8 || g.owner);

    const list = guilds.map(g => {
        const hasBot = client.guilds.cache.has(g.id);
        return `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:15px; border-bottom:1px solid rgba(128,128,128,0.1);">
                <span>${g.name}</span>
                ${hasBot ? `<a href="/config/${g.id}" class="neon-btn" style="padding:5px 15px; font-size:12px;">MANAGE</a>` 
                         : `<a href="https://discord.com/api/oauth2/authorize?client_id=${process.env.CLIENT_ID}&permissions=8&scope=bot" class="neon-btn" style="padding:5px 15px; font-size:12px; color:var(--neon);">ADD BOT</a>`}
            </div>
        `;
    }).join('');

    res.send(getWrapper(`<div class="card"><h2>Your Servers</h2><div style="text-align:left;">${list}</div></div>`, l));
});

app.get('/config/:guildId', async (req, res) => {
    if(!req.isAuthenticated()) return res.redirect('/');
    const l = req.query.lang || 'en';
    const config = await GuildConfig.findOne({ guildId: req.params.guildId }) || new GuildConfig({ guildId: req.params.guildId });
    
    res.send(getWrapper(`
        <div class="card" style="text-align:left;">
            <h3>Configuration</h3>
            <form action="/api/save/${req.params.guildId}" method="POST">
                <label style="font-size:12px; opacity:0.5;">SYSTEM LANGUAGE</label>
                <select name="lang" class="neon-btn" style="width:100%; background:transparent; margin-bottom:15px;">
                    <option value="pl" ${config.lang==='pl'?'selected':''}>Polski</option>
                    <option value="en" ${config.lang==='en'?'selected':''}>English</option>
                    <option value="de" ${config.lang==='de'?'selected':''}>Deutsch</option>
                    <option value="fr" ${config.lang==='fr'?'selected':''}>Français</option>
                    <option value="es" ${config.lang==='es'?'selected':''}>Español</option>
                </select>

                <label style="font-size:12px; opacity:0.5;">LOG CHANNEL ID</label>
                <input name="logId" value="${config.logChannelId||''}" class="neon-btn" style="width:100%; background:transparent; margin-bottom:15px; text-align:left;">

                <label style="font-size:12px; opacity:0.5;">VERIFY ROLE ID</label>
                <input name="roleId" value="${config.verifyRoleId||''}" class="neon-btn" style="width:100%; background:transparent; margin-bottom:15px; text-align:left;">

                <button type="button" onclick="saveForm()" class="neon-btn" style="width:100%; margin-top:10px;">SAVE CONFIG</button>
            </form>
            <div id="loader" class="loader"></div>
        </div>
    `, l, true));
});

app.post('/api/save/:guildId', async (req, res) => {
    const { lang, logId, roleId } = req.body;
    await GuildConfig.findOneAndUpdate({ guildId: req.params.guildId }, { lang, logChannelId: logId, verifyRoleId: roleId }, { upsert: true });
    setTimeout(() => res.redirect(`/config/${req.params.guildId}?lang=${lang}`), 2000);
});

// --- OWNER SYSTEM & PIN ---

app.get('/owner-login', async (req, res) => {
    const l = req.query.lang || 'en';
    const user = await UserData.findOne({ deviceId: req.ip });
    if(user?.isLocked) return res.send(getWrapper(`<h1>DEVICE LOCKED</h1><p>Check your Discord DM for unlock.</p>`, l));

    res.send(getWrapper(`
        <div class="card">
            <h2>System PIN</h2>
            <form action="/owner-verify" method="POST">
                <input type="password" name="pin" class="neon-btn" style="width:100%; background:transparent; text-align:center; font-size: 24px; letter-spacing: 10px;" placeholder="****">
                <button type="submit" class="neon-btn" style="width:100%; margin-top:20px;">ACCESS</button>
            </form>
            <p style="color:red; margin-top:20px;">${LOCALES[l].pinErr} ${user ? user.attempts : 5}</p>
        </div>
    `, l));
});

app.post('/owner-verify', async (req, res) => {
    const { pin } = req.body;
    const ip = req.ip;
    let user = await UserData.findOne({ deviceId: ip }) || new UserData({ deviceId: ip });

    if(pin === "15052021") {
        user.attempts = 5; await user.save();
        req.session.isOwner = true;
        res.redirect('/owner-panel');
    } else {
        user.attempts -= 1;
        if(user.attempts <= 0) {
            user.isLocked = true;
            const owner = await client.users.fetch(process.env.OWNER_ID);
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`unlock_ip_${ip.replace(/\./g, '_')}`).setLabel("UNLOCK DEVICE").setStyle(ButtonStyle.Success)
            );
            await owner.send({ content: `🚨 **SECURITY ALERT**: Device blocked (IP: ${ip}).`, components: [row] });
        }
        await user.save();
        res.redirect('/owner-login?error=1');
    }
});

app.get('/owner-panel', async (req, res) => {
    if(!req.session.isOwner) return res.redirect('/owner-login');
    const guilds = client.guilds.cache.map(g => `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:15px; border-bottom:1px solid rgba(128,128,128,0.1);">
            <span>${g.name} <span style="color:#34c759;">●</span></span>
            <button onclick="blockG('${g.id}')" class="neon-btn" style="padding:5px 15px; color:#ff3b30;">BLOCK</button>
        </div>
    `).join('');
    res.send(getWrapper(`<div class="card"><h1>Master Panel</h1>${guilds}</div>`));
});

// --- DISCORD INTERACTIONS (MODALS & BUTTONS) ---

client.on('interactionCreate', async (i) => {
    if(i.isButton()) {
        if(i.customId.startsWith('block_guild_')) {
            const gid = i.customId.split('_')[2];
            const modal = new ModalBuilder().setCustomId(`modal_block_${gid}`).setTitle('Block Server');
            const reason = new TextInputBuilder().setCustomId('reason').setLabel('Reason').setStyle(TextInputStyle.Paragraph);
            modal.addComponents(new ActionRowBuilder().addComponents(reason));
            await i.showModal(modal);
        }
        if(i.customId.startsWith('unlock_ip_')) {
            const ip = i.customId.split('_')[2].replace(/_/g, '.');
            await UserData.findOneAndUpdate({ deviceId: ip }, { isLocked: false, attempts: 1 });
            await i.reply({ content: `Device ${ip} unlocked with 1 attempt. PIN: **15052021** (Deletes in 10s)`, ephemeral: true });
            setTimeout(() => i.deleteReply(), 10000);
        }
    }

    if(i.type === InteractionType.ModalSubmit) {
        if(i.customId.startsWith('modal_block_')) {
            const gid = i.customId.split('_')[2];
            const reason = i.fields.getTextInputValue('reason');
            await GuildConfig.findOneAndUpdate({ guildId: gid }, { isBlocked: true, blockReason: reason }, { upsert: true });
            
            const config = await GuildConfig.findOne({ guildId: gid });
            if(config?.logChannelId) {
                const guild = client.guilds.cache.get(gid);
                const chan = guild.channels.cache.get(config.logChannelId);
                if(chan) chan.send(`🚨 **SYSTEM ALERT**: This server has been blocked. Reason: ${reason}\nContact: icarus.system.pl@gmail.com`);
            }
            await i.reply(`Server ${gid} blocked.`);
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
app.listen(process.env.PORT || 3000);
