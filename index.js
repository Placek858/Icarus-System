const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
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
    secret: 'icarus_secret_2026',
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

// --- ROUTES ---

app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="pl">
        <head>
            <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Icarus System • Central</title>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
                body { margin: 0; padding: 0; font-family: 'Inter', sans-serif; background-color: #0f111a; color: white; display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100vh; }
                .container { text-align: center; background: #161926; padding: 60px; border-radius: 24px; border: 1px solid #2d334a; box-shadow: 0 20px 50px rgba(0,0,0,0.5); max-width: 500px; width: 90%; }
                h1 { font-size: 28px; letter-spacing: 4px; color: #5469d4; margin-bottom: 40px; }
                .btn { display: block; padding: 18px; margin: 15px 0; border-radius: 8px; text-decoration: none; font-weight: 600; transition: 0.3s; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; text-align: center; cursor: pointer; border: none; }
                .btn-verify { background: #5469d4; color: white; }
                .btn-dash { border: 1px solid #5469d4; color: #5469d4; background: transparent; }
                .btn:hover { transform: translateY(-3px); box-shadow: 0 10px 20px rgba(84, 105, 212, 0.2); }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>ICARUS SYSTEM</h1>
                <a href="/login?target=verify" class="btn btn-verify">Zweryfikuj się</a>
                <a href="/login?target=dashboard" class="btn btn-dash">Panel Zarządzania</a>
            </div>
        </body>
        </html>
    `);
});

app.get('/login', (req, res, next) => {
    const targetType = req.query.target || 'dashboard';
    const state = Buffer.from(JSON.stringify({ type: targetType })).toString('base64');
    passport.authenticate('discord', { state })(req, res, next);
});

app.get('/auth/callback', passport.authenticate('discord', { failureRedirect: '/' }), (req, res) => {
    const stateData = req.query.state;
    let target = 'dashboard';
    if (stateData) {
        try {
            const decoded = JSON.parse(Buffer.from(stateData, 'base64').toString());
            target = decoded.type;
        } catch (e) {}
    }
    res.redirect(`/${target}`);
});

app.get('/verify', (req, res) => {
    if (!req.isAuthenticated()) return res.redirect('/login?target=verify');
    const botGuilds = client.guilds.cache;
    const userGuilds = req.user.guilds;

    let cardsHtml = userGuilds.filter(g => botGuilds.has(g.id)).map(g => `
        <div class="card">
            <img src="${g.icon ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png` : 'https://discord.com/assets/1f0ac125a376cf482a442e9127e8eb.svg'}" width="50" style="border-radius:50%">
            <div class="name">${g.name}</div>
            <a href="/auth?token=${req.user.id}&guild=${g.id}" class="btn-go">Wybierz</a>
        </div>
    `).join('');

    res.send(dashboardTemplate("Wybierz serwer do weryfikacji", cardsHtml));
});

app.get('/dashboard', (req, res) => {
    if (!req.isAuthenticated()) return res.redirect('/login?target=dashboard');
    const botGuilds = client.guilds.cache;
    const userGuilds = req.user.guilds;

    let cardsHtml = userGuilds.filter(g => g.owner === true).map(g => {
        const hasBot = botGuilds.has(g.id);
        return `
            <div class="card">
                <img src="${g.icon ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png` : 'https://discord.com/assets/1f0ac125a376cf482a442e9127e8eb.svg'}" width="50" style="border-radius:50%">
                <div class="name">${g.name}</div>
                <a href="${hasBot ? `/manage/${g.id}` : `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&permissions=8&scope=bot`}" 
                   class="btn-go" style="background: ${hasBot ? '#5469d4' : '#24b47e'}">
                   ${hasBot ? 'Zarządzaj' : 'Dodaj Bota'}
                </a>
            </div>
        `;
    }).join('');

    res.send(dashboardTemplate("Twoje Serwery (Admin)", cardsHtml));
});

function dashboardTemplate(title, content) {
    return `
        <body style="background: #0f111a; color: white; font-family: sans-serif; padding: 50px;">
            <style>
                .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 20px; }
                .card { background: #161926; padding: 20px; border-radius: 12px; text-align: center; border: 1px solid #2d334a; }
                .btn-go { display: block; padding: 10px; margin-top: 15px; background: #5469d4; color: white; text-decoration: none; border-radius: 5px; font-size: 12px; font-weight: bold; }
                .name { margin-top: 10px; font-weight: 600; font-size: 14px; }
            </style>
            <div style="max-width: 1000px; margin: 0 auto;">
                <div style="display:flex; justify-content: space-between; align-items:center; margin-bottom: 30px;">
                    <h2>${title}</h2>
                    <a href="/" style="color: #a3acb9; text-decoration: none;">Powrót</a>
                </div>
                <div class="grid">${content || 'Brak serwerów do wyświetlenia.'}</div>
            </div>
        </body>
    `;
}

app.get('/manage/:guildId', async (req, res) => {
    if (!req.isAuthenticated()) return res.redirect('/login');
    const userGuild = req.user.guilds.find(g => g.id === req.params.guildId);
    if (!userGuild || !userGuild.owner) return res.send("Brak uprawnień.");

    const guild = client.guilds.cache.get(req.params.guildId);
    let config = await GuildConfig.findOne({ guildId: req.params.guildId }) || { verifyRoleId: '' };

    res.send(`
        <body style="background: #0f111a; color: white; font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh;">
            <div style="background: #161926; padding: 40px; border-radius: 15px; border: 1px solid #2d334a; width: 350px;">
                <h3>Ustawienia: ${guild.name}</h3>
                <form action="/save/${req.params.guildId}" method="POST">
                    <label>ID Roli Weryfikacyjnej:</label>
                    <input type="text" name="roleId" value="${config.verifyRoleId}" style="width: 100%; padding: 10px; margin: 10px 0; background: #0f111a; border: 1px solid #2d334a; color: white;">
                    <button type="submit" style="width: 100%; padding: 12px; background: #5469d4; border: none; color: white; cursor: pointer; border-radius: 5px;">ZAPISZ</button>
                </form>
            </div>
        </body>
    `);
});

app.post('/save/:guildId', async (req, res) => {
    await GuildConfig.findOneAndUpdate({ guildId: req.params.guildId }, { verifyRoleId: req.body.roleId }, { upsert: true });
    res.redirect('/dashboard');
});

app.get('/auth', (req, res) => {
    res.send(`
        <body style="background:#f0f2f5;font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;">
            <div style="background:white;padding:50px;border-radius:15px;box-shadow:0 10px 40px rgba(0,0,0,0.1);text-align:center;max-width:400px;">
                <h2 style="color:#5469d4;margin-bottom:10px;">Weryfikacja Icarus</h2>
                <p style="color:#6b7280;font-size:14px;">Kliknij przycisk poniżej, aby przesłać prośbę o autoryzację tożsamości.</p>
                <button id="btn" onclick="start()" style="margin-top:25px;width:100%;padding:15px;background:#5469d4;color:white;border:none;border-radius:8px;font-weight:bold;cursor:pointer;">POTWIERDZAM TOŻSAMOŚĆ</button>
            </div>
            <script>
                async function start() {
                    const b = document.getElementById('btn');
                    b.disabled = true; b.innerText = 'Przetwarzanie...';
                    await fetch('/complete', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({ userId: '${req.query.token}', guildId: '${req.query.guild}' })
                    });
                    const check = setInterval(async () => {
                        const r = await fetch('/status?userId=${req.query.token}&guildId=${req.query.guild}');
                        const s = await r.json();
                        if(s.status === 'success') { clearInterval(check); document.body.innerHTML = '<h1>✅ Sukces!</h1>'; }
                        if(s.status === 'rejected') { clearInterval(check); document.body.innerHTML = '<h1 style="color:red">❌ Odrzucono</h1><p>Powód: ' + (s.reason || 'Brak') + '</p>'; }
                    }, 3000);
                }
            </script>
        </body>
    `);
});

app.get('/status', async (req, res) => {
    const doc = await RequestTracker.findOne({ userId: req.query.userId, guildId: req.query.guildId });
    res.json({ status: doc ? doc.status : 'pending', reason: doc ? doc.reason : null });
});

app.post('/complete', async (req, res) => {
    const { userId, guildId } = req.body;
    const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress).split(',')[0].trim();
    const userAgent = req.headers['user-agent'];

    await RequestTracker.findOneAndUpdate({ userId, guildId }, { status: 'pending' }, { upsert: true });

    const guild = client.guilds.cache.get(guildId);
    if (guild) {
        const logChan = guild.channels.cache.find(c => c.name === 'icarus-logs') || guild.channels.cache.filter(c => c.isTextBased()).first();
        if (logChan) {
            const embed = new EmbedBuilder()
                .setTitle('🛡️ SYSTEM ICARUS: PROŚBA O WERYFIKACJĘ')
                .setColor('#5469d4')
                .addFields(
                    { name: '👤 Użytkownik', value: `<@${userId}> (\`${userId}\`)`, inline: true },
                    { name: '🌐 Adres IP', value: `\`${ip}\``, inline: true },
                    { name: '💻 Przeglądarka', value: `\`${userAgent.substring(0, 100)}...\`` },
                    { name: '🕒 Czas', value: `<t:${Math.floor(Date.now()/1000)}:F>` },
                    { name: '🤖 Analiza', value: '```diff\n+ Dane zebrane\n! Oczekiwanie na decyzję administratora```' }
                );

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`acc_${userId}_${guildId}`).setLabel('Autoryzuj').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId(`rej_${userId}_${guildId}`).setLabel('Odrzuć').setStyle(ButtonStyle.Danger)
            );
            logChan.send({ embeds: [embed], components: [row] });
        }
    }
    res.sendStatus(200);
});

client.on('interactionCreate', async (i) => {
    if (i.isButton()) {
        const [action, targetId, gId] = i.customId.split('_');
        
        if (action === 'acc') {
            const config = await GuildConfig.findOne({ guildId: gId });
            const guild = client.guilds.cache.get(gId);
            try {
                const member = await guild.members.fetch(targetId);
                if (member && config?.verifyRoleId) await member.roles.add(config.verifyRoleId);
                await RequestTracker.findOneAndUpdate({ userId: targetId, guildId: gId }, { status: 'success', adminId: i.user.id });
                
                const edited = EmbedBuilder.from(i.message.embeds[0])
                    .setTitle('✅ WERYFIKACJA ZAAKCEPTOWANA')
                    .setColor('#24b47e')
                    .addFields({ name: '👮 Administrator', value: `<@${i.user.id}>` });
                
                await i.update({ embeds: [edited], components: [] });
            } catch (e) { i.reply({ content: "Błąd.", ephemeral: true }); }
        }

        if (action === 'rej') {
            const modal = new ModalBuilder().setCustomId(`mod_rej_${targetId}_${gId}`).setTitle('Odrzucenie weryfikacji');
            const input = new TextInputBuilder().setCustomId('reason').setLabel('Powód:').setStyle(TextInputStyle.Paragraph).setRequired(true);
            modal.addComponents(new ActionRowBuilder().addComponents(input));
            await i.showModal(modal);
        }
    }

    if (i.isModalSubmit()) {
        const [,, targetId, gId] = i.customId.split('_');
        const reason = i.fields.getTextInputValue('reason');

        await RequestTracker.findOneAndUpdate({ userId: targetId, guildId: gId }, { status: 'rejected', adminId: i.user.id, reason });
        
        const edited = EmbedBuilder.from(i.message.embeds[0])
            .setTitle('❌ WERYFIKACJA ODRZUCONA')
            .setColor('#ed4245')
            .addFields(
                { name: '👮 Administrator', value: `<@${i.user.id}>` },
                { name: '📝 Powód', value: `\`\`\`${reason}\`\`\`` }
            );

        await i.update({ embeds: [edited], components: [] });
    }
});

app.listen(process.env.PORT || 3000);
