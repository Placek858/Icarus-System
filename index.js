const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const express = require('express');
const mongoose = require('mongoose');
const passport = require('passport');
const { Strategy } = require('passport-discord');
const session = require('express-session');
const MongoStore = require('connect-mongo');

// --- KONFIGURACJA ---
const BOT_TOKEN = process.env.DISCORD_TOKEN; 
const MONGO_URI = process.env.MONGO_URI; 
const DOMAIN = process.env.DOMAIN; 
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;

// --- MODELE BAZY DANYCH ---
mongoose.connect(MONGO_URI).then(() => console.log("✅ SYSTEM ONLINE"));

const GuildConfig = mongoose.model('GuildConfig', new mongoose.Schema({
    guildId: String,
    verifyRoleId: String
}));

const RequestTracker = mongoose.model('RequestTracker', new mongoose.Schema({ 
    userId: String, 
    guildId: String,
    status: { type: String, default: 'pending' },
    adminId: String,
    reason: String
}));

// --- BOT CLIENT ---
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });
client.login(BOT_TOKEN);

// --- EXPRESS SETUP ---
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
    secret: 'icarus_professional_secret',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: MONGO_URI })
}));

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

passport.use(new Strategy({
    clientID: CLIENT_ID, clientSecret: CLIENT_SECRET,
    callbackURL: `${DOMAIN}/auth/callback`, scope: ['identify', 'guilds']
}, (at, rt, profile, done) => done(null, profile)));

app.use(passport.initialize());
app.use(passport.session());

// --- STYLE CSS (PROFESJONALNY WYGLĄD) ---
const UI_STYLE = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
    body { margin: 0; padding: 0; font-family: 'Inter', sans-serif; background: #0f111a; color: white; display: flex; justify-content: center; align-items: center; height: 100vh; }
    .container { text-align: center; background: #161926; padding: 60px; border-radius: 24px; border: 1px solid #2d334a; box-shadow: 0 20px 50px rgba(0,0,0,0.5); width: 90%; max-width: 450px; }
    h1 { font-size: 24px; letter-spacing: 3px; color: #5469d4; margin-bottom: 30px; text-transform: uppercase; }
    .btn { display: block; padding: 16px; margin: 12px 0; border-radius: 8px; text-decoration: none; font-weight: 600; transition: 0.3s; font-size: 14px; cursor: pointer; border: none; text-align: center; }
    .btn-blue { background: #5469d4; color: white; }
    .btn-outline { border: 1px solid #5469d4; color: #5469d4; background: transparent; }
    .btn:hover { transform: translateY(-2px); box-shadow: 0 5px 15px rgba(84, 105, 212, 0.3); }
    .card-grid { display: grid; grid-template-columns: 1fr; gap: 15px; margin-top: 20px; }
    .server-card { background: #1c2030; padding: 15px; border-radius: 10px; border: 1px solid #2d334a; display: flex; align-items: center; gap: 15px; }
    .server-card img { width: 40px; height: 40px; border-radius: 50%; }
`;

// --- TRASY HTTP ---

// 1. STRONA GŁÓWNA - WYBÓR
app.get('/', (req, res) => {
    res.send(`
        <style>${UI_STYLE}</style>
        <div class="container">
            <h1>ICARUS SYSTEM</h1>
            <a href="/login?target=verify" class="btn btn-blue">Panel Weryfikacji</a>
            <a href="/login?target=dashboard" class="btn btn-outline">Zarządzanie Serwerami</a>
        </div>
    `);
});

app.get('/login', (req, res, next) => {
    const state = Buffer.from(JSON.stringify({ type: req.query.target || 'dashboard' })).toString('base64');
    passport.authenticate('discord', { state })(req, res, next);
});

app.get('/auth/callback', passport.authenticate('discord', { failureRedirect: '/' }), (req, res) => {
    const decoded = JSON.parse(Buffer.from(req.query.state, 'base64').toString());
    res.redirect(`/${decoded.type}`);
});

// 2. WYBÓR SERWERA DO WERYFIKACJI
app.get('/verify', (req, res) => {
    if (!req.isAuthenticated()) return res.redirect('/login?target=verify');
    const guilds = req.user.guilds.filter(g => client.guilds.cache.has(g.id));
    
    let html = guilds.map(g => `
        <div class="server-card">
            <img src="${g.icon ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png` : 'https://discord.com/assets/1f0ac125a376cf482a442e9127e8eb.svg'}">
            <div style="flex:1; text-align:left;">${g.name}</div>
            <a href="/auth?token=${req.user.id}&guild=${g.id}" class="btn btn-blue" style="margin:0; padding:8px 15px; font-size:12px;">Wybierz</a>
        </div>
    `).join('');

    res.send(`<style>${UI_STYLE}</style><div class="container"><h1>Wybierz serwer</h1><div class="card-grid">${html || 'Brak serwerów'}</div></div>`);
});

// 3. FINALNA STRONA WERYFIKACJI (PO KLIKNIĘCIU "WYBIERZ")
app.get('/auth', (req, res) => {
    res.send(`
        <style>
            ${UI_STYLE}
            body { background: #f4f7f9; color: #1a1d23; }
            .container { background: white; border: none; box-shadow: 0 10px 30px rgba(0,0,0,0.05); }
        </style>
        <div class="container">
            <h2 style="color:#5469d4">Autoryzacja Icarus</h2>
            <p style="color:#64748b; font-size:14px;">Kliknij przycisk poniżej, aby przesłać wniosek o weryfikację do administracji serwera.</p>
            <button id="vBtn" onclick="start()" class="btn btn-blue" style="width:100%">Potwierdzam Tożsamość</button>
        </div>
        <script>
            async function start() {
                const btn = document.getElementById('vBtn');
                btn.disabled = true; btn.innerText = 'Przetwarzanie...';
                await fetch('/complete', {
                    method: 'POST', headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ userId: '${req.query.token}', guildId: '${req.query.guild}' })
                });
                const check = setInterval(async () => {
                    const r = await fetch('/status?userId=${req.query.token}&guildId=${req.query.guild}');
                    const s = await r.json();
                    if(s.status === 'success') { clearInterval(check); document.body.innerHTML = '<h1>✅ Zweryfikowano</h1>'; }
                    if(s.status === 'rejected') { clearInterval(check); document.body.innerHTML = '<h1 style="color:red">❌ Odrzucono</h1><p>Powód: ' + s.reason + '</p>'; }
                }, 3000);
            }
        </script>
    `);
});

// 4. LOGIKA BACKENDOWA LOGÓW I STATUSU
app.post('/complete', async (req, res) => {
    const { userId, guildId } = req.body;
    const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress).split(',')[0].trim();
    const userAgent = req.headers['user-agent'];

    await RequestTracker.findOneAndUpdate({ userId, guildId }, { status: 'pending' }, { upsert: true });

    const guild = client.guilds.cache.get(guildId);
    if (guild) {
        const logChan = guild.channels.cache.find(c => c.name === 'icarus-logs') || guild.channels.cache.filter(c => c.isTextBased()).first();
        const embed = new EmbedBuilder()
            .setTitle('🛡️ NOWA PROŚBA O WERYFIKACJĘ')
            .setColor('#5469d4')
            .addFields(
                { name: '👤 Użytkownik', value: `<@${userId}> (\`${userId}\`)`, inline: true },
                { name: '🌐 Adres IP', value: `\`${ip}\``, inline: true },
                { name: '💻 System', value: `\`${userAgent.substring(0, 60)}...\`` },
                { name: '🕒 Czas', value: `<t:${Math.floor(Date.now()/1000)}:F>` }
            )
            .setFooter({ text: 'Icarus Pro Logs' });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`acc_${userId}_${guildId}`).setLabel('Zatwierdź').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`rej_${userId}_${guildId}`).setLabel('Odrzuć').setStyle(ButtonStyle.Danger)
        );
        logChan.send({ embeds: [embed], components: [row] });
    }
    res.sendStatus(200);
});

// --- OBSŁUGA PRZYCISKÓW ADMINA ---
client.on('interactionCreate', async (i) => {
    if (i.isButton()) {
        const [action, uid, gid] = i.customId.split('_');
        if (action === 'acc') {
            const config = await GuildConfig.findOne({ guildId: gid });
            const guild = client.guilds.cache.get(gid);
            const member = await guild.members.fetch(uid).catch(() => null);
            if (member && config?.verifyRoleId) await member.roles.add(config.verifyRoleId);
            await RequestTracker.findOneAndUpdate({ userId: uid, guildId: gid }, { status: 'success', adminId: i.user.id });
            
            const edited = EmbedBuilder.from(i.message.embeds[0]).setTitle('✅ ZAAKCEPTOWANO').setColor('#24b47e').addFields({name:'👮 Admin', value:`<@${i.user.id}>`});
            await i.update({ embeds: [edited], components: [] });
        }
        if (action === 'rej') {
            const modal = new ModalBuilder().setCustomId(`mod_rej_${uid}_${gid}`).setTitle('Powód odrzucenia');
            const input = new TextInputBuilder().setCustomId('reason').setLabel('Dlaczego odrzucasz?').setStyle(TextInputStyle.Paragraph).setRequired(true);
            modal.addComponents(new ActionRowBuilder().addComponents(input));
            await i.showModal(modal);
        }
    }
    if (i.isModalSubmit()) {
        const [,, uid, gid] = i.customId.split('_');
        const reason = i.fields.getTextInputValue('reason');
        await RequestTracker.findOneAndUpdate({ userId: uid, guildId: gid }, { status: 'rejected', adminId: i.user.id, reason });
        const edited = EmbedBuilder.from(i.message.embeds[0]).setTitle('❌ ODRZUCONO').setColor('#ed4245').addFields({name:'👮 Admin', value:`<@${i.user.id}>`}, {name:'📝 Powód', value:reason});
        await i.update({ embeds: [edited], components: [] });
    }
});

app.get('/status', async (req, res) => {
    const doc = await RequestTracker.findOne({ userId: req.query.userId, guildId: req.query.guildId });
    res.json({ status: doc ? doc.status : 'pending', reason: doc?.reason || 'Brak' });
});

app.listen(process.env.PORT || 3000);
