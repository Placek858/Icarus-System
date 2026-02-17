const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, PermissionsBitField } = require('discord.js');
const express = require('express');
const mongoose = require('mongoose');
const passport = require('passport');
const { Strategy } = require('passport-discord');
const session = require('express-session');
const MongoStore = require('connect-mongo');

// --- KONFIGURACJA ---
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
    secret: 'icarus_apple_enterprise_2026',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: process.env.MONGO_URI })
}));

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));
passport.use(new Strategy({
    clientID: process.env.CLIENT_ID, clientSecret: process.env.CLIENT_SECRET,
    callbackURL: `${process.env.DOMAIN}/auth/callback`, scope: ['identify', 'guilds']
}, (at, rt, profile, done) => done(null, profile)));

app.use(passport.initialize());
app.use(passport.session());

// --- STYL APPLE / ENTERPRISE ---
const APPLE_CSS = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap');
    body { background: #f5f5f7; color: #1d1d1f; font-family: 'Inter', -apple-system, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; -webkit-font-smoothing: antialiased; }
    .card { background: rgba(255, 255, 255, 0.8); backdrop-filter: blur(20px); padding: 50px; border-radius: 30px; text-align: center; width: 420px; box-shadow: 0 20px 40px rgba(0,0,0,0.04); border: 1px solid rgba(255,255,255,0.3); }
    h1 { font-size: 26px; font-weight: 600; letter-spacing: -0.5px; margin-bottom: 10px; }
    p { color: #86868b; font-size: 15px; line-height: 1.5; margin-bottom: 35px; font-weight: 400; }
    .btn { display: block; width: 100%; padding: 14px; margin: 12px 0; border-radius: 12px; font-weight: 500; cursor: pointer; text-decoration: none; border: none; font-size: 15px; transition: all 0.3s cubic-bezier(0.25, 0.1, 0.25, 1); }
    .btn-blue { background: #0071e3; color: white; }
    .btn-blue:hover { background: #0077ed; transform: scale(1.02); }
    .btn-outline { background: transparent; border: 1px solid #d2d2d7; color: #1d1d1f; }
    .btn-outline:hover { background: #f5f5f7; }
    .loader { border: 3px solid #f3f3f3; border-top: 3px solid #0071e3; border-radius: 50%; width: 35px; height: 35px; animation: spin 0.8s linear infinite; margin: 25px auto; display: none; }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    input, select { width: 100%; padding: 12px; margin: 10px 0; background: white; border: 1px solid #d2d2d7; border-radius: 10px; font-size: 14px; box-sizing: border-box; }
`;

// --- ROUTES ---

app.get('/', (req, res) => {
    res.send(`<style>${APPLE_CSS}</style><div class="card"><h1>Icarus Cloud Service</h1><p>Zaloguj się do swojego konta firmowego, aby kontynuować proces autoryzacji urządzenia.</p><a href="/login?target=verify" class="btn btn-blue">Autoryzuj tożsamość</a><a href="/login?target=dashboard" class="btn btn-outline">Zarządzanie systemem</a></div>`);
});

app.get('/login', (req, res, next) => {
    const state = Buffer.from(JSON.stringify({ type: req.query.target || 'dashboard' })).toString('base64');
    passport.authenticate('discord', { state })(req, res, next);
});

app.get('/auth/callback', passport.authenticate('discord', { failureRedirect: '/' }), (req, res) => {
    const decoded = JSON.parse(Buffer.from(req.query.state, 'base64').toString());
    res.redirect(\`/\${decoded.type}\`);
});

// DASHBOARD - ZARZĄDZANIE
app.get('/dashboard', (req, res) => {
    if (!req.isAuthenticated()) return res.redirect('/login');
    const guilds = req.user.guilds.filter(g => (g.permissions & 0x8) === 0x8);
    let html = guilds.map(g => `
        <div style="padding:15px; border-bottom:1px solid #d2d2d7; display:flex; justify-content:space-between; align-items:center;">
            <span style="font-weight:500;">${g.name}</span>
            <a href="/manage/${g.id}" class="btn-blue" style="padding:6px 14px; font-size:12px; text-decoration:none; border-radius:8px; width:auto; margin:0;">Konfiguruj</a>
        </div>
    `).join('');
    res.send(`<style>${APPLE_CSS}</style><div class="card"><h1>Panel Administracyjny</h1><p>Wybierz jednostkę serwerową do modyfikacji.</p><div style="text-align:left;">${html || 'Brak aktywnych licencji administratora.'}</div></div>`);
});

app.get('/manage/:guildId', async (req, res) => {
    if (!req.isAuthenticated()) return res.redirect('/login');
    const config = await GuildConfig.findOne({ guildId: req.params.guildId }) || { verifyRoleId: '', logChannelId: '' };
    const guild = client.guilds.cache.get(req.params.guildId);
    const channels = guild.channels.cache.filter(c => c.type === 0); // Tylko tekstowe

    let chanOptions = channels.map(c => `<option value="${c.id}" ${config.logChannelId === c.id ? 'selected' : ''}>#${c.name}</option>`).join('');

    res.send(`<style>${APPLE_CSS}</style><div class="card"><h1>Konfiguracja Bezpieczeństwa</h1><p>Ustaw parametry weryfikacji dla serwera <b>${guild.name}</b>.</p>
        <form action="/save/${req.params.guildId}" method="POST">
            <label style="font-size:12px; color:#86868b; display:block; text-align:left;">ID Roli (Automatic Access):</label>
            <input type="text" name="roleId" value="${config.verifyRoleId}" placeholder="Wklej ID roli">
            <label style="font-size:12px; color:#86868b; display:block; text-align:left; margin-top:10px;">Kanał Logów (Dla przycisków):</label>
            <select name="logChanId">${chanOptions}</select>
            <button type="submit" class="btn btn-blue" style="margin-top:20px;">Zapisz zmiany w chmurze</button>
        </form></div>`);
});

app.post('/save/:guildId', async (req, res) => {
    await GuildConfig.findOneAndUpdate({ guildId: req.params.guildId }, { verifyRoleId: req.body.roleId, logChannelId: req.body.logChanId }, { upsert: true });
    res.redirect('/dashboard');
});

// WERYFIKACJA
app.get('/verify', (req, res) => {
    if (!req.isAuthenticated()) return res.redirect('/login');
    const guilds = req.user.guilds.filter(g => client.guilds.cache.has(g.id));
    let html = guilds.map(g => `<a href="/auth?token=${req.user.id}&guild=${g.id}" class="btn btn-outline">${g.name}</a>`).join('');
    res.send(`<style>${APPLE_CSS}</style><div class="card"><h1>System Weryfikacji</h1><p>Wybierz serwer, na którym chcesz autoryzować swoje konto.</p>${html}</div>`);
});

app.get('/auth', (req, res) => {
    res.send(`
        <style>${APPLE_CSS}</style>
        <div class="card">
            <h1 id="t">Weryfikacja Tożsamości</h1>
            <p id="d">Twoje urządzenie oczekuje na bezpieczne połączenie z serwerami Icarus. Kliknij przycisk poniżej, aby rozpocząć szyfrowany proces.</p>
            <div id="l" class="loader"></div>
            <button id="b" onclick="go()" class="btn btn-blue">Rozpocznij autoryzację</button>
        </div>
        <script>
            async function go() {
                document.getElementById('b').style.display='none';
                document.getElementById('l').style.display='block';
                document.getElementById('d').innerText = 'Nawiązywanie połączenia z serwerem logowania...';
                
                const response = await fetch('/complete', {
                    method: 'POST', headers: {'Content-Type':'application/json'},
                    body: JSON.stringify({ userId: '${req.query.token}', guildId: '${req.query.guild}' })
                });
                const data = await response.json();
                
                if(data.status === 'auto') {
                    document.body.innerHTML = '<div class="card"><h1>✅ Autoryzowano</h1><p>Dostęp został przyznany automatycznie. Twoja sesja jest bezpieczna.</p></div>';
                } else {
                    document.getElementById('d').innerText = 'Twoja prośba została przesłana do ręcznej weryfikacji przez administratora systemu. Proszę czekać...';
                    const i = setInterval(async () => {
                        const r = await fetch('/status?userId=${req.query.token}&guildId=${req.query.guild}');
                        const s = await r.json();
                        if(s.status === 'success') { clearInterval(i); document.body.innerHTML = '<div class="card"><h1>✅ Zweryfikowano</h1><p>Administrator zatwierdził Twój dostęp.</p></div>'; }
                        if(s.status === 'rejected') { clearInterval(i); document.body.innerHTML = '<div class="card"><h1 style="color:#ff3b30">❌ Odmowa</h1><p>Twój wniosek został odrzucony. Powód: '+s.reason+'</p></div>'; }
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
    
    // LOGIKA AUTOMATYCZNA
    if (config && config.verifyRoleId) {
        try {
            const member = await guild.members.fetch(userId);
            await member.roles.add(config.verifyRoleId);
            await RequestTracker.findOneAndUpdate({ userId, guildId }, { status: 'success' }, { upsert: true });
            return res.json({ status: 'auto' });
        } catch (e) { /* jeśli błąd, leci do ręcznej */ }
    }

    // LOGIKA RĘCZNA (PRZYCISKI)
    await RequestTracker.findOneAndUpdate({ userId, guildId }, { status: 'pending' }, { upsert: true });
    const logChan = guild.channels.cache.get(config?.logChannelId) || guild.channels.cache.find(c => c.name.includes('log'));
    
    if(logChan) {
        const embed = new EmbedBuilder()
            .setTitle('🛡️ SECURITY ALERT: MANUAL VERIFICATION')
            .setColor('#0071e3')
            .setDescription(`Zainicjowano nową prośbę o dostęp do systemu.\n\n**Użytkownik:** <@${userId}>\n**ID:** \`${userId}\``)
            .setFooter({ text: 'Icarus Enterprise Security Protocol' })
            .setTimestamp();
            
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`acc_${userId}_${guildId}`).setLabel('Zatwierdź dostęp').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`rej_${userId}_${guildId}`).setLabel('Odrzuć wniosek').setStyle(ButtonStyle.Danger)
        );
        logChan.send({ embeds: [embed], components: [row] });
    }
    res.json({ status: 'manual' });
});

client.on('interactionCreate', async (i) => {
    if (i.isButton()) {
        const [action, uid, gid] = i.customId.split('_');
        if (action === 'acc') {
            const config = await GuildConfig.findOne({ guildId: gid });
            const guild = client.guilds.cache.get(gid);
            const member = await guild.members.fetch(uid).catch(() => null);
            if (member && config?.verifyRoleId) await member.roles.add(config.verifyRoleId);
            await RequestTracker.findOneAndUpdate({ userId: uid, guildId: gid }, { status: 'success' });
            await i.update({ content: '✅ **Pomyślnie autoryzowano użytkownika.**', embeds: [], components: [] });
        }
        if (action === 'rej') {
            const modal = new ModalBuilder().setCustomId(`mod_${uid}_${gid}`).setTitle('Uzasadnienie odrzucenia');
            modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('r').setLabel('Powód odmowy:').setStyle(TextInputStyle.Short).setRequired(true)));
            await i.showModal(modal);
        }
    }
    if (i.isModalSubmit()) {
        const [,, uid, gid] = i.customId.split('_');
        const reason = i.fields.getTextInputValue('r');
        await RequestTracker.findOneAndUpdate({ userId: uid, guildId: gid }, { status: 'rejected', reason });
        await i.update({ content: `❌ **Wniosek odrzucony.** Powód: ${reason}`, embeds: [], components: [] });
    }
});

app.get('/status', async (req, res) => {
    const doc = await RequestTracker.findOne({ userId: req.query.userId, guildId: req.query.guildId });
    res.json({ status: doc ? doc.status : 'pending', reason: doc?.reason });
});

app.listen(process.env.PORT || 3000);
