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

// --- BOT & SERVER SETUP ---
const client = new Client({ 
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.DirectMessages] 
});
const app = express();
app.set('trust proxy', true);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

mongoose.connect(process.env.MONGO_URI);

// --- DATABASE MODELS ---
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

// --- SESSION & AUTH ---
app.use(session({
    secret: 'icarus_secret_2026',
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

// --- TRANSLATIONS ---
const i18n = {
    pl: {
        verify: "Weryfikacja Konta", manage: "Panel Zarządzania", owner: "Panel Właściciela Systemu",
        save: "Zapisz Zmiany", unsaved: "Masz niezapisane zmiany!", success: "Zmiany zapisane pomyślnie!",
        fail: "Błąd zapisu: ", blocked: "SERWER ZABLOKOWANY", contact: "Kontakt: icarus.system.pl@gmail.com",
        pin_err: "Nieprawidłowy PIN. Pozostało prób: ", select_srv: "Wybierz serwer",
        add_bot: "Dodaj Bota", admin_list: "Uprawnieni do zarządzania", bot_lang: "Język wiadomości bota"
    },
    en: {
        verify: "Account Verification", manage: "Management Panel", owner: "System Owner Panel",
        save: "Save Changes", unsaved: "You have unsaved changes!", success: "Changes saved successfully!",
        fail: "Save error: ", blocked: "SERVER BLOCKED", contact: "Contact: icarus.system.pl@gmail.com",
        pin_err: "Invalid PIN. Attempts left: ", select_srv: "Select server",
        add_bot: "Add Bot", admin_list: "Authorized managers", bot_lang: "Bot message language"
    }
};

// --- UI RENDERER (Apple/Google Style) ---
const renderUI = (content, lang = 'en', state = { hasForm: false }) => {
    const t = i18n[lang] || i18n.en;
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;600;700&display=swap');
        :root { --blue: #0071e3; --bg: #ffffff; --text: #1d1d1f; --card: #f5f5f7; --neon: #00f2ff; }
        body.dark { --bg: #000000; --text: #f5f5f7; --card: #1c1c1e; --neon: #bf00ff; }
        body { background: var(--bg); color: var(--text); font-family: 'Plus Jakarta Sans', sans-serif; transition: 0.5s; margin: 0; }
        .nav { position: fixed; top: 0; width: 100%; padding: 25px 40px; display: flex; justify-content: space-between; z-index: 1000; box-sizing: border-box; }
        .lang-switch a { text-decoration: none; color: var(--text); font-weight: 700; margin-right: 15px; opacity: 0.3; font-size: 14px; }
        .lang-switch a.active { opacity: 1; border-bottom: 2px solid var(--blue); }
        .theme-toggle { font-size: 30px; cursor: pointer; filter: drop-shadow(0 0 10px var(--neon)); transition: 0.3s; }
        .container { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
        .card { background: var(--card); padding: 50px; border-radius: 35px; width: 100%; max-width: 500px; text-align: center; box-shadow: 0 30px 60px rgba(0,0,0,0.1); }
        .btn { display: flex; align-items: center; justify-content: center; padding: 18px; border-radius: 14px; background: var(--blue); color: white; text-decoration: none; font-weight: 700; border: none; cursor: pointer; margin: 10px 0; width: 100%; transition: 0.3s; }
        .btn-alt { background: transparent; border: 2px solid var(--blue); color: var(--text); }
        .input-box { width: 100%; padding: 16px; border-radius: 12px; border: 1px solid rgba(128,128,128,0.2); background: var(--bg); color: var(--text); margin-bottom: 15px; box-sizing: border-box; }
        .admin-item { display: flex; justify-content: space-between; background: rgba(128,128,128,0.05); padding: 10px 15px; border-radius: 10px; margin-top: 5px; }
        .remove-x { color: #ff3b30; text-decoration: none; font-weight: bold; cursor: pointer; }
        .unsaved-bar { position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%); background: var(--blue); color: white; padding: 15px 35px; border-radius: 50px; display: none; align-items: center; gap: 20px; box-shadow: 0 10px 30px rgba(0,113,227,0.4); z-index: 2000; }
        .loader { width: 20px; height: 20px; border: 3px solid #fff; border-top: 3px solid transparent; border-radius: 50%; animation: spin 0.8s linear infinite; display: none; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    </style>
</head>
<body class="\${localStorage.getItem('theme') || ''}">
    <div class="nav">
        <div class="lang-switch">
            <a href="?lang=pl" class="\${'${lang}'==='pl'?'active':''}">🇵🇱 Polski</a>
            <a href="?lang=en" class="\${'${lang}'==='en'?'active':''}">🇬🇧 English</a>
        </div>
        <div class="theme-toggle" onclick="tglTheme()">\${localStorage.getItem('theme')==='dark'?'🔮':'💡'}</div>
    </div>
    <div class="container">${content}</div>
    <div id="u-bar" class="unsaved-bar">
        <span>${t.unsaved}</span>
        <button class="btn" style="width:auto; padding:8px 25px; background:white; color:black; margin:0;" onclick="saveForm()">
            <div id="ldr" class="loader"></div> ${t.save}
        </button>
    </div>
    <script>
        function tglTheme() {
            const b = document.body;
            b.classList.toggle('dark');
            localStorage.setItem('theme', b.classList.contains('dark') ? 'dark' : 'light');
            location.reload();
        }
        function saveForm() {
            document.getElementById('ldr').style.display = 'inline-block';
            setTimeout(() => document.forms[0].submit(), 2000);
        }
        if(${state.hasForm}) {
            document.querySelectorAll('input, select').forEach(i => i.oninput = () => document.getElementById('u-bar').style.display = 'flex');
        }
    </script>
</body>
</html>`;
};

// --- [ROUTE] MAIN PAGE ---
app.get('/', (req, res) => {
    const l = req.query.lang || 'en';
    res.send(renderUI(`
        <div class="card">
            <h1 style="font-size: 55px; margin: 0; letter-spacing: -3px;">Icarus</h1>
            <p style="opacity: 0.5; margin-bottom: 40px;">Advanced Security System</p>
            <a href="/login?target=select-verify&lang=${l}" class="btn">${i18n[l].verify}</a>
            <a href="/login?target=dashboard&lang=${l}" class="btn btn-alt">${i18n[l].manage}</a>
            <a href="/owner-gate?lang=${l}" class="btn" style="background:none; font-size:12px; margin-top:50px; color:gray;">${i18n[l].owner}</a>
        </div>`, l));
});

// --- [AUTH] DISCORD ---
app.get('/login', (req, res, next) => {
    const state = Buffer.from(JSON.stringify({ t: req.query.target, l: req.query.lang })).toString('base64');
    passport.authenticate('discord', { state })(req, res, next);
});

app.get('/auth/callback', passport.authenticate('discord', { failureRedirect: '/' }), (req, res) => {
    const state = JSON.parse(Buffer.from(req.query.state, 'base64').toString());
    res.redirect(`/${state.t}?lang=${state.l || 'en'}`);
});

// --- [VERIFY] SELECT SERVER ---
app.get('/select-verify', async (req, res) => {
    if(!req.isAuthenticated()) return res.redirect('/');
    const l = req.query.lang || 'en';
    const guilds = req.user.guilds.filter(g => client.guilds.cache.has(g.id));
    const list = guilds.map(g => `<a href="/verify-screen/${g.id}?lang=${l}" class="btn btn-alt">${g.name}</a>`).join('');
    res.send(renderUI(`<div class="card"><h2>${i18n[l].select_srv}</h2>${list}</div>`, l));
});

app.get('/verify-screen/:guildId', async (req, res) => {
    const l = req.query.lang || 'en';
    const config = await GuildConfig.findOne({ guildId: req.params.guildId });
    if(config?.isBlocked) {
        return res.send(renderUI(`
            <div class="card" style="border-top: 5px solid #ff3b30;">
                <h1 style="color:#ff3b30;">${i18n[l].blocked}</h1>
                <p><strong>Powód:</strong> ${config.blockReason}</p>
                <p style="font-size:13px; opacity:0.6; margin-top:30px;">${i18n[l].contact}</p>
            </div>`, l));
    }
    res.send(renderUI(`
        <div class="card">
            <h2>Weryfikacja</h2>
            <p>Kliknij przycisk, aby system Icarus sprawdził Twoje urządzenie.</p>
            <form action="/do-verify/${req.params.guildId}?lang=${l}" method="POST">
                <button class="btn">WERYFIKUJ</button>
            </form>
        </div>`, l));
});

app.post('/do-verify/:guildId', async (req, res) => {
    if(!req.isAuthenticated()) return res.redirect('/');
    const user = req.user;
    const ip = req.ip;
    const guild = client.guilds.cache.get(req.params.guildId);
    
    let dbUser = await UserData.findOne({ deviceId: ip }) || new UserData({ deviceId: ip });
    const isMulti = dbUser.verifiedAccounts.length > 0 && !dbUser.verifiedAccounts.includes(user.id);

    // LOGI NA TWOJE PV (Enterprise)
    const owner = await client.users.fetch(process.env.OWNER_ID);
    const ownerEmbed = new EmbedBuilder()
        .setTitle("📡 NOWA WERYFIKACJA")
        .setColor(isMulti ? 0xff3b30 : 0x34c759)
        .addFields(
            { name: "Użytkownik", value: `${user.username} (${user.id})` },
            { name: "Serwer", value: `${guild.name}` },
            { name: "IP/Device", value: ip },
            { name: "Multi", value: isMulti ? "TAK" : "NIE" },
            { name: "Link", value: `https://discord.com/channels/${guild.id}` }
        );
    const ownerRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`block_srv_${guild.id}`).setLabel("ZABLOKUJ SERWER").setStyle(ButtonStyle.Danger)
    );
    owner.send({ embeds: [ownerEmbed], components: [ownerRow] });

    // LOGI NA SERWER
    const config = await GuildConfig.findOne({ guildId: guild.id });
    if(config?.logChannelId) {
        const chan = guild.channels.cache.get(config.logChannelId);
        if(chan) {
            const embed = new EmbedBuilder().setTitle("Icarus Protection").setDescription(isMulti ? "⚠️ Podejrzenie multikonta!" : "✅ Zweryfikowano pomyślnie.");
            if(isMulti) {
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`approve_${user.id}`).setLabel("Zatwierdź").setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId(`reject_modal_${user.id}`).setLabel("Odrzuć").setStyle(ButtonStyle.Danger)
                );
                chan.send({ embeds: [embed], components: [row] });
            } else {
                chan.send({ embeds: [embed] });
                const member = await guild.members.fetch(user.id);
                if(config.verifyRoleId) member.roles.add(config.verifyRoleId);
            }
        }
    }

    if(!dbUser.verifiedAccounts.includes(user.id)) dbUser.verifiedAccounts.push(user.id);
    await dbUser.save();
    res.send(renderUI(`<h1>Zweryfikowano!</h1>`, req.query.lang));
});

// --- [MANAGE] DASHBOARD ---
app.get('/dashboard', async (req, res) => {
    if(!req.isAuthenticated()) return res.redirect('/');
    const l = req.query.lang || 'en';
    const userGuilds = req.user.guilds.filter(g => (new PermissionsBitField(BigInt(g.permissions)).has(PermissionsBitField.Flags.Administrator)));
    
    const list = userGuilds.map(g => {
        const hasBot = client.guilds.cache.has(g.id);
        const btn = hasBot ? 
            `<a href="/manage-guild/${g.id}?lang=${l}" class="btn" style="width:120px;">Zarządzaj</a>` :
            `<a href="https://discord.com/api/oauth2/authorize?client_id=${process.env.CLIENT_ID}&permissions=8&scope=bot&guild_id=${g.id}" class="btn btn-alt" style="width:120px;">${i18n[l].add_bot}</a>`;
        return `<div class="admin-item" style="align-items:center;"><span>${g.name}</span>${btn}</div>`;
    }).join('');

    res.send(renderUI(`<div class="card"><h2>${i18n[l].manage}</h2>${list}</div>`, l));
});

app.get('/manage-guild/:guildId', async (req, res) => {
    if(!req.isAuthenticated()) return res.redirect('/');
    const l = req.query.lang || 'en';
    const gid = req.params.guildId;
    const config = await GuildConfig.findOne({ guildId: gid }) || new GuildConfig({ guildId: gid });
    
    const adminList = config.admins.map(id => `
        <div class="admin-item"><span>${id}</span><a href="/remove-adm/${gid}/${id}?lang=${l}" class="remove-x">X</a></div>
    `).join('');

    res.send(renderUI(`
        <div class="card" style="text-align:left;">
            <h3>Ustawienia Serwera</h3>
            <form action="/save-guild/${gid}?lang=${l}" method="POST">
                <label>${i18n[l].bot_lang}</label>
                <select name="lang" class="input-box">
                    <option value="pl" ${config.lang==='pl'?'selected':''}>Polski</option>
                    <option value="en" ${config.lang==='en'?'selected':''}>English</option>
                    <option value="de">Deutsch</option><option value="fr">Français</option><option value="es">Español</option>
                </select>
                <label>Kanał Logów (ID)</label><input name="logId" value="${config.logChannelId || ''}" class="input-box">
                <label>Rola Weryfikacji (ID)</label><input name="roleId" value="${config.verifyRoleId || ''}" class="input-box">
                <hr style="opacity:0.1; margin:20px 0;">
                <h4>${i18n[l].admin_list}</h4>
                ${adminList}
                <input name="newAdmin" placeholder="Dodaj ID użytkownika..." class="input-box" style="margin-top:10px;">
                <button class="btn">${i18n[l].save}</button>
            </form>
        </div>`, l, { hasForm: true }));
});

app.post('/save-guild/:guildId', async (req, res) => {
    const { lang, logId, roleId, newAdmin } = req.body;
    let config = await GuildConfig.findOne({ guildId: req.params.guildId }) || new GuildConfig({ guildId: req.params.guildId });
    config.lang = lang; config.logChannelId = logId; config.verifyRoleId = roleId;
    if(newAdmin && !config.admins.includes(newAdmin)) config.admins.push(newAdmin);
    await config.save();
    res.redirect(`/manage-guild/${req.params.guildId}?lang=${req.query.lang || 'en'}`);
});

app.get('/remove-adm/:guildId/:userId', async (req, res) => {
    await GuildConfig.updateOne({ guildId: req.params.guildId }, { $pull: { admins: req.params.userId } });
    res.redirect(`/manage-guild/${req.params.guildId}?lang=${req.query.lang || 'en'}`);
});

// --- [OWNER] MASTER PANEL ---
app.get('/owner-gate', async (req, res) => {
    const l = req.query.lang || 'en';
    const dev = await UserData.findOne({ deviceId: req.ip });
    if(dev?.isLocked) return res.send(renderUI(`<h1>ZABLOKOWANO</h1><p>Dostęp zablokowany z tego urządzenia.</p>`, l));
    res.send(renderUI(`
        <div class="card">
            <h2>PIN</h2>
            <form action="/owner-login" method="POST">
                <input type="password" name="pin" style="text-align:center; font-size:30px; letter-spacing:8px;" class="input-box">
                <button class="btn">ZALOGUJ</button>
            </form>
            <p style="color:#ff3b30">${dev ? i18n[l].pin_err + dev.attempts : ''}</p>
        </div>`, l));
});

app.post('/owner-login', async (req, res) => {
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
            const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`unlock_${req.ip.replace(/\./g,'_')}`).setLabel("ODBLOKUJ URZĄDZENIE").setStyle(ButtonStyle.Success));
            owner.send({ content: `🚨 **PRÓBA WŁAMANIA!** IP: ${req.ip}`, components: [row] });
        }
        await dev.save();
        res.redirect('/owner-gate');
    }
});

app.get('/owner-panel', async (req, res) => {
    if(!req.session.isOwner) return res.redirect('/owner-gate');
    const guilds = client.guilds.cache.map(g => `
        <div class="admin-row">
            <span><div style="width:10px; height:10px; border-radius:50%; background:#34c759; display:inline-block; margin-right:10px;"></div> ${g.name}</span>
            <a href="/manage-guild/${g.id}" class="btn" style="width:auto; padding:5px 15px; margin:0;">Ustawienia</a>
        </div>
    `).join('');
    res.send(renderUI(`<div class="card"><h2>Master Owner Panel</h2>${guilds}</div>`));
});

// --- DISCORD INTERACTIONS ---
client.on('interactionCreate', async i => {
    if(i.isButton()) {
        if(i.customId.startsWith('block_srv_')) {
            const gid = i.customId.split('_')[2];
            const modal = new ModalBuilder().setCustomId(`mod_block_${gid}`).setTitle('Blokada Serwera');
            modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('reason').setLabel('Powód Blokady').setStyle(TextInputStyle.Paragraph)));
            await i.showModal(modal);
        }
        if(i.customId.startsWith('unlock_')) {
            const ip = i.customId.split('_')[1].replace(/_/g,'.');
            await UserData.findOneAndUpdate({ deviceId: ip }, { isLocked: false, attempts: 1 });
            await i.reply({ content: `PIN: **15052021** (Zniknie za 10s)`, ephemeral: true });
        }
    }
    if(i.type === InteractionType.ModalSubmit) {
        if(i.customId.startsWith('mod_block_')) {
            const gid = i.customId.split('_')[2];
            const reason = i.fields.getTextInputValue('reason');
            await GuildConfig.findOneAndUpdate({ guildId: gid }, { isBlocked: true, blockReason: reason }, { upsert: true });
            
            const guild = client.guilds.cache.get(gid);
            const conf = await GuildConfig.findOne({ guildId: gid });
            if(guild && conf.logChannelId) {
                const chan = guild.channels.cache.get(conf.logChannelId);
                if(chan) chan.send(`⚠️ **SERWER ZABLOKOWANY**\nPowód: ${reason}\nKontakt: icarus.system.pl@gmail.com`);
            }
            await i.reply(`Zablokowano serwer ${gid}.`);
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
app.listen(process.env.PORT || 3000, () => console.log("Icarus System Online"));
