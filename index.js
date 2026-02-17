const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const express = require('express');
const mongoose = require('mongoose');
const passport = require('passport');
const { Strategy } = require('passport-discord');
const session = require('express-session');
const MongoStore = require('connect-mongo');

// --- INTEGRACJA INFRASTRUKTURY ---
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });
mongoose.connect(process.env.MONGO_URI);

const GuildConfig = mongoose.model('GuildConfig', new mongoose.Schema({
    guildId: String,
    verifyRoleId: String,
    logChannelId: String
}));

const RequestTracker = mongoose.model('RequestTracker', new mongoose.Schema({ 
    userId: String, guildId: String, status: { type: String, default: 'pending' }, reason: String 
}));

client.login(process.env.DISCORD_TOKEN);

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: 'icarus_global_security_2026',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: process.env.MONGO_URI })
}));

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));
passport.use(new Strategy({
    clientID: process.env.CLIENT_ID, clientSecret: process.env.CLIENT_SECRET,
    callbackURL: process.env.DOMAIN + '/auth/callback', scope: ['identify', 'guilds']
}, (at, rt, profile, done) => done(null, profile)));

app.use(passport.initialize());
app.use(passport.session());

// --- APPLE DESIGN LANGUAGE (CSS) ---
const LUXURY_STYLE = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap');
    body { background: #f5f5f7; color: #1d1d1f; font-family: 'Inter', sans-serif; margin: 0; display: flex; align-items: center; justify-content: center; height: 100vh; -webkit-font-smoothing: antialiased; }
    .glass-card { background: rgba(255, 255, 255, 0.72); backdrop-filter: saturate(180%) blur(20px); border-radius: 24px; padding: 60px; width: 100%; max-width: 440px; box-shadow: 0 10px 40px rgba(0,0,0,0.04); border: 1px solid rgba(255,255,255,0.4); text-align: center; }
    h1 { font-size: 32px; font-weight: 600; letter-spacing: -1.2px; margin-bottom: 12px; }
    p { color: #86868b; font-size: 17px; line-height: 1.47; margin-bottom: 40px; }
    .btn { display: inline-flex; align-items: center; justify-content: center; width: 100%; padding: 16px 20px; border-radius: 12px; font-size: 17px; font-weight: 500; text-decoration: none; transition: all 0.2s ease; cursor: pointer; border: none; margin-bottom: 12px; box-sizing: border-box; }
    .btn-primary { background: #0071e3; color: white; }
    .btn-primary:hover { background: #0077ed; transform: scale(1.01); }
    .btn-secondary { background: #e8e8ed; color: #1d1d1f; }
    .btn-secondary:hover { background: #d2d2d7; }
    .loader { width: 32px; height: 32px; border: 3px solid #d2d2d7; border-top: 3px solid #0071e3; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 20px auto; }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    .input-field { width: 100%; padding: 14px; background: white; border: 1px solid #d2d2d7; border-radius: 12px; margin: 8px 0; font-size: 15px; outline: none; }
    .input-field:focus { border-color: #0071e3; box-shadow: 0 0 0 4px rgba(0,113,227,0.1); }
    .server-row { display: flex; align-items: center; justify-content: space-between; padding: 16px; border-bottom: 1px solid #e5e5e7; }
`;

// --- ROUTING ---

app.get('/', (req, res) => {
    res.send('<style>' + LUXURY_STYLE + '</style><div class="glass-card"><h1>Icarus Enterprise</h1><p>System bezpiecznej autoryzacji zasobów sieciowych.</p><a href="/login?target=verify" class="btn btn-primary">Autoryzuj tożsamość</a><a href="/login?target=dashboard" class="btn btn-secondary">Panel administracyjny</a></div>');
});

app.get('/login', (req, res, next) => {
    const state = Buffer.from(JSON.stringify({ type: req.query.target || 'dashboard' })).toString('base64');
    passport.authenticate('discord', { state })(req, res, next);
});

app.get('/auth/callback', passport.authenticate('discord', { failureRedirect: '/' }), (req, res) => {
    const decoded = JSON.parse(Buffer.from(req.query.state, 'base64').toString());
    res.redirect('/' + decoded.type);
});

// --- DASHBOARD (CENTRALNE ZARZĄDZANIE) ---
app.get('/dashboard', (req, res) => {
    if (!req.isAuthenticated()) return res.redirect('/login');
    const guilds = req.user.guilds.filter(g => (g.permissions & 0x8) === 0x8);
    let list = guilds.map(g => '<div class="server-row"><span>' + g.name + '</span><a href="/manage/' + g.id + '" class="btn-primary" style="padding:8px 16px; font-size:13px; width:auto; border-radius:8px;">Zarządzaj</a></div>').join('');
    res.send('<style>' + LUXURY_STYLE + '</style><div class="glass-card"><h1>Twoje serwery</h1><p>Wybierz jednostkę do konfiguracji.</p>' + list + '</div>');
});

app.get('/manage/:guildId', async (req, res) => {
    if (!req.isAuthenticated()) return res.redirect('/login');
    const guild = client.guilds.cache.get(req.params.guildId);
    if (!guild) return res.send('Błąd: Bot nie jest obecny na serwerze.');
    const config = await GuildConfig.findOne({ guildId: req.params.guildId }) || { verifyRoleId: '', logChannelId: '' };
    const channels = guild.channels.cache.filter(c => c.type === 0).map(c => '<option value="' + c.id + '"' + (config.logChannelId === c.id ? ' selected' : '') + '>#' + c.name + '</option>').join('');
    
    res.send('<style>' + LUXURY_STYLE + '</style><div class="glass-card"><h1>Konfiguracja ' + guild.name + '</h1><form action="/save/' + req.params.guildId + '" method="POST"><label style="display:block; text-align:left; font-size:12px; color:#86868b; margin-top:10px;">IDENTYFIKATOR ROLI (ID)</label><input class="input-field" name="roleId" value="' + config.verifyRoleId + '"><label style="display:block; text-align:left; font-size:12px; color:#86868b; margin-top:10px;">KANAŁ DECYZYJNY (LOGI)</label><select class="input-field" name="logChanId">' + channels + '</select><button class="btn btn-primary" style="margin-top:20px;">Zaktualizuj bazę danych</button></form></div>');
});

app.post('/save/:guildId', async (req, res) => {
    await GuildConfig.findOneAndUpdate({ guildId: req.params.guildId }, { verifyRoleId: req.body.roleId, logChannelId: req.body.logChanId }, { upsert: true });
    res.redirect('/dashboard');
});

// --- WERYFIKACJA (PROCES DLA UŻYTKOWNIKA) ---
app.get('/verify', (req, res) => {
    if (!req.isAuthenticated()) return res.redirect('/login');
    const guilds = req.user.guilds.filter(g => client.guilds.cache.has(g.id));
    let list = guilds.map(g => '<a href="/auth?token=' + req.user.id + '&guild=' + g.id + '" class="btn btn-secondary">' + g.name + '</a>').join('');
    res.send('<style>' + LUXURY_STYLE + '</style><div class="glass-card"><h1>Autoryzacja</h1><p>Wybierz serwer docelowy.</p>' + list + '</div>');
});

app.get('/auth', (req, res) => {
    res.send('<style>' + LUXURY_STYLE + '</style><div class="glass-card"><h1>Inicjowanie...</h1><p id="msg">Łączenie z systemem Icarus Enterprise Cloud. Proszę czekać...</p><div class="loader"></div><script>' +
        'const init = async () => {' +
        '  await fetch("/complete", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ userId: "' + req.query.token + '", guildId: "' + req.query.guild + '" }) });' +
        '  setInterval(async () => {' +
        '    const r = await fetch("/status?userId=' + req.query.token + '&guildId=' + req.query.guild + '");' +
        '    const d = await r.json();' +
        '    if(d.status === "success") document.body.innerHTML = "<div class=\'glass-card\'><h1>✅ Sukces</h1><p>Autoryzacja zakończona. Witamy w systemie.</p></div>";' +
        '    if(d.status === "rejected") document.body.innerHTML = "<div class=\'glass-card\'><h1 style=\'color:#ff3b30\'>❌ Odmowa</h1><p>Dostęp został zablokowany przez administratora.</p></div>";' +
        '  }, 3000);' +
        '}; init();' +
        '</script></div>');
});

app.post('/complete', async (req, res) => {
    const { userId, guildId } = req.body;
    const config = await GuildConfig.findOne({ guildId });
    const guild = client.guilds.cache.get(guildId);
    
    await RequestTracker.findOneAndUpdate({ userId, guildId }, { status: 'pending' }, { upsert: true });
    const logChan = guild.channels.cache.get(config?.logChannelId);
    
    if(logChan) {
        const embed = new EmbedBuilder()
            .setTitle('🛡️ SECURITY HUB: NOWY WNIOSEK')
            .setColor('#0071e3')
            .setDescription('Użytkownik: <@' + userId + '>\nStatus: **Oczekiwanie na weryfikację ręczną**')
            .setFooter({ text: 'Icarus Enterprise Security' });
            
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('acc_' + userId + '_' + guildId).setLabel('Zezwól na dostęp').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('rej_' + userId + '_' + guildId).setLabel('Zablokuj dostęp').setStyle(ButtonStyle.Danger)
        );
        logChan.send({ embeds: [embed], components: [row] });
    }
    res.json({ ok: true });
});

// --- LOGIKA PRZYCISKÓW DISCORD ---
client.on('interactionCreate', async (i) => {
    if (i.isButton()) {
        const [action, uid, gid] = i.customId.split('_');
        if (action === 'acc') {
            const config = await GuildConfig.findOne({ guildId: gid });
            const guild = client.guilds.cache.get(gid);
            try {
                const member = await guild.members.fetch(uid);
                if (config?.verifyRoleId) await member.roles.add(config.verifyRoleId);
                await RequestTracker.findOneAndUpdate({ userId: uid, guildId: gid }, { status: 'success' });
                await i.update({ content: '✅ **Autoryzacja przyznana.**', embeds: [], components: [] });
            } catch (e) { i.reply({ content: 'Błąd roli!', ephemeral: true }); }
        }
        if (action === 'rej') {
            await RequestTracker.findOneAndUpdate({ userId: uid, guildId: gid }, { status: 'rejected' });
            await i.update({ content: '❌ **Dostęp odrzucony.**', embeds: [], components: [] });
        }
    }
});

app.get('/status', async (req, res) => {
    const doc = await RequestTracker.findOne({ userId: req.query.userId, guildId: req.query.guildId });
    res.json({ status: doc ? doc.status : 'pending' });
});

app.listen(process.env.PORT || 3000);
