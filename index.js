const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, PermissionsBitField } = require('discord.js');
const express = require('express');
const mongoose = require('mongoose');
const passport = require('passport');
const { Strategy } = require('passport-discord');
const session = require('express-session');
const MongoStore = require('connect-mongo');

// --- CONFIGURATION ---
const BOT_TOKEN = process.env.DISCORD_TOKEN;
const MONGO_URI = process.env.MONGO_URI;
const DOMAIN = process.env.DOMAIN;
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;

// --- DATABASE MODELS ---
mongoose.connect(MONGO_URI).then(() => console.log("✅ ICARUS: System Core Online"));

const GuildConfig = mongoose.model('GuildConfig', new mongoose.Schema({
    guildId: String,
    verifyRoleId: String
}));

const RequestTracker = mongoose.model('RequestTracker', new mongoose.Schema({ 
    userId: String, 
    guildId: String,
    status: { type: String, default: 'pending' },
    reason: String
}));

// --- BOT CLIENT ---
const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMembers, 
        GatewayIntentBits.GuildMessages
    ] 
});
client.login(BOT_TOKEN);

// --- EXPRESS SETUP ---
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
    secret: 'icarus_secret_2026_full',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: MONGO_URI })
}));

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

passport.use(new Strategy({
    clientID: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
    callbackURL: `${DOMAIN}/auth/callback`,
    scope: ['identify', 'guilds']
}, (accessToken, refreshToken, profile, done) => {
    process.nextTick(() => done(null, profile));
}));

app.use(passport.initialize());
app.use(passport.session());

// --- STYLES ---
const UI_STYLE = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
    body { margin: 0; padding: 0; font-family: 'Inter', sans-serif; background-color: #0f111a; color: white; display: flex; justify-content: center; align-items: center; height: 100vh; }
    .container { text-align: center; background: #161926; padding: 60px; border-radius: 24px; border: 1px solid #2d334a; box-shadow: 0 20px 50px rgba(0,0,0,0.5); width: 450px; }
    h1 { font-size: 28px; letter-spacing: 4px; color: #5469d4; margin-bottom: 40px; }
    .btn { display: block; padding: 18px; margin: 15px 0; border-radius: 8px; text-decoration: none; font-weight: 600; transition: 0.3s; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; text-align: center; cursor: pointer; border: none; width: 100%; box-sizing: border-box; }
    .btn-verify { background: #5469d4; color: white; }
    .btn-dash { border: 1px solid #5469d4; color: #5469d4; background: transparent; }
    .btn:hover { transform: translateY(-3px); box-shadow: 0 10px 20px rgba(84, 105, 212, 0.2); }
    .loader { border: 4px solid #1c2030; border-top: 4px solid #5469d4; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 20px auto; display: none; }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    input { width: 100%; padding: 12px; margin: 10px 0; background: #0f111a; border: 1px solid #2d334a; color: white; border-radius: 6px; }
`;

// --- ROUTES ---

app.get('/', (req, res) => {
    res.send(`<style>${UI_STYLE}</style><div class="container"><h1>ICARUS SYSTEM</h1><a href="/login?target=verify" class="btn btn-verify">Zweryfikuj się</a><a href="/login?target=dashboard" class="btn btn-dash">Panel Zarządzania</a></div>`);
});

app.get('/login', (req, res, next) => {
    const targetType = req.query.target || 'dashboard';
    const state = Buffer.from(JSON.stringify({ type: targetType })).toString('base64');
    passport.authenticate('discord', { state })(req, res, next);
});

app.get('/auth/callback', passport.authenticate('discord', { failureRedirect: '/' }), (req, res) => {
    const decoded = JSON.parse(Buffer.from(req.query.state, 'base64').toString());
    res.redirect(`/${decoded.type}`);
});

app.get('/dashboard', (req, res) => {
    if (!req.isAuthenticated()) return res.redirect('/login?target=dashboard');
    const adminGuilds = req.user.guilds.filter(g => (g.permissions & 0x8) === 0x8);
    let cards = adminGuilds.map(g => `
        <div style="padding:15px; border-bottom:1px solid #2d334a; display:flex; justify-content:space-between; align-items:center;">
            <span>${g.name}</span>
            <a href="/manage/${g.id}" class="btn-verify" style="padding:8px 15px; font-size:11px; width:auto; margin:0; text-decoration:none; border-radius:5px;">Konfiguruj</a>
        </div>
    `).join('');
    res.send(`<style>${UI_STYLE}</style><div class="container"><h2>Twoje Serwery</h2><div style="text-align:left;">${cards || 'Brak uprawnień admina.'}</div><a href="/" class="btn-dash" style="text-decoration:none; display:block; margin-top:20px;">Powrót</a></div>`);
});

app.get('/manage/:guildId', async (req, res) => {
    if (!req.isAuthenticated()) return res.redirect('/login');
    const config = await GuildConfig.findOne({ guildId: req.params.guildId }) || { verifyRoleId: '' };
    res.send(`<style>${UI_STYLE}</style><div class="container"><h3>Ustawienia</h3><form action="/save/${req.params.guildId}" method="POST"><label>ID Roli Weryfikacyjnej:</label><input type="text" name="roleId" value="${config.verifyRoleId}"><button type="submit" class="btn btn-verify">ZAPISZ USTAWIENIA</button></form></div>`);
});

app.post('/save/:guildId', async (req, res) => {
    await GuildConfig.findOneAndUpdate({ guildId: req.params.guildId }, { verifyRoleId: req.body.roleId }, { upsert: true });
    res.redirect('/dashboard');
});

app.get('/verify', (req, res) => {
    if (!req.isAuthenticated()) return res.redirect('/login?target=verify');
    const guilds = req.user.guilds.filter(g => client.guilds.cache.has(g.id));
    let cards = guilds.map(g => `<a href="/auth?token=${req.user.id}&guild=${g.id}" class="btn btn-dash" style="text-decoration:none;">${g.name}</a>`).join('');
    res.send(`<style>${UI_STYLE}</style><div class="container"><h2>Wybierz Serwer</h2>${cards}</div>`);
});

app.get('/auth', (req, res) => {
    res.send(`
        <style>${UI_STYLE}</style>
        <div class="container">
            <h2 id="t">Weryfikacja</h2>
            <p id="d">Kliknij START, aby system rozpoczął proces weryfikacji tożsamości.</p>
            <div id="l" class="loader"></div>
            <button id="b" onclick="start()" class="btn btn-verify">Rozpocznij (START)</button>
        </div>
        <script>
            async function start() {
                document.getElementById('b').style.display = 'none';
                document.getElementById('l').style.display = 'block';
                document.getElementById('d').innerText = 'Inicjowanie połączenia...';

                const r = await fetch('/complete', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ userId: '${req.query.token}', guildId: '${req.query.guild}' })
                });
                const res = await r.json();

                if(res.instant) {
                    document.body.innerHTML = '<div class="container"><h1>✅ SUKCES</h1><p>Weryfikacja automatyczna zakończona pomyślnie!</p></div>';
                } else {
                    document.getElementById('d').innerText = 'Oczekiwanie na akceptację przez administrację...';
                    const check = setInterval(async () => {
                        const st = await fetch('/status?userId=${req.query.token}&guildId=${req.query.guild}');
                        const s = await st.json();
                        if(s.status === 'success') { clearInterval(check); document.body.innerHTML = '<h1>✅ ZWERYFIKOWANO</h1>'; }
                        if(s.status === 'rejected') { clearInterval(check); document.body.innerHTML = '<h1>❌ ODRZUCONO</h1><p>Powód: '+s.reason+'</p>'; }
                    }, 3000);
                }
            }
        </script>
    `);
});

app.post('/complete', async (req, res) => {
    const { userId, guildId } = req.body;
    const config = await GuildConfig.findOne({ guildId });
    const guild = client.guilds.cache.get(guildId);

    if (config && config.verifyRoleId && guild) {
        try {
            const member = await guild.members.fetch(userId);
            await member.roles.add(config.verifyRoleId);
            await RequestTracker.findOneAndUpdate({ userId, guildId }, { status: 'success' }, { upsert: true });
            return res.json({ instant: true });
        } catch (e) { /* Kontynuuj do ręcznej jeśli automatyczna zawiedzie */ }
    }

    await RequestTracker.findOneAndUpdate({ userId, guildId }, { status: 'pending' }, { upsert: true });
    const logChan = guild.channels.cache.find(c => c.name === 'icarus-logs') || guild.channels.cache.filter(c => c.isTextBased()).first();
    
    if (logChan) {
        const embed = new EmbedBuilder().setTitle('🛡️ Prośba o weryfikację').setColor('#5469d4').setDescription(`Użytkownik: <@${userId}>`);
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`acc_${userId}_${guildId}`).setLabel('AKCEPTUJ').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`rej_${userId}_${guildId}`).setLabel('ODRZUĆ').setStyle(ButtonStyle.Danger)
        );
        logChan.send({ embeds: [embed], components: [row] });
    }
    res.json({ instant: false });
});

app.get('/status', async (req, res) => {
    const doc = await RequestTracker.findOne({ userId: req.query.userId, guildId: req.query.guildId });
    res.json({ status: doc ? doc.status : 'pending', reason: doc?.reason || 'Brak' });
});

// --- BOT INTERACTIONS ---
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
                await i.update({ content: '✅ Zaakceptowano', embeds: [], components: [] });
            } catch (e) { i.reply({ content: 'Błąd nadawania roli!', ephemeral: true }); }
        }
        if (action === 'rej') {
            const modal = new ModalBuilder().setCustomId(`mod_${uid}_${gid}`).setTitle('Powód odrzucenia');
            modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('r').setLabel('Dlaczego?').setStyle(TextInputStyle.Short)));
            await i.showModal(modal);
        }
    }
    if (i.isModalSubmit()) {
        const [,, uid, gid] = i.customId.split('_');
        const reason = i.fields.getTextInputValue('r');
        await RequestTracker.findOneAndUpdate({ userId: uid, guildId: gid }, { status: 'rejected', reason });
        await i.update({ content: `❌ Odrzucono: ${reason}`, embeds: [], components: [] });
    }
});

app.listen(process.env.PORT || 3000, () => console.log("🚀 Server is running."));
