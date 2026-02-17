const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const express = require('express');
const axios = require('axios');
const mongoose = require('mongoose');
const passport = require('passport');
const { Strategy } = require('passport-discord');
const session = require('express-session');
const MongoStore = require('connect-mongo');

// --- CONFIGURATION ---
const BOT_TOKEN = process.env.DISCORD_TOKEN; 
const MONGO_URI = process.env.MONGO_URI; 
const PROXYCHECK_API_KEY = 'e2brv7-y9y366-243469-435457';
const DOMAIN = process.env.DOMAIN; 
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;

// --- DATABASE MODELS ---
mongoose.connect(MONGO_URI).then(() => console.log("✅ ICARUS: System Core Online"));

const GuildConfig = mongoose.model('GuildConfig', new mongoose.Schema({
    guildId: String,
    verifyRoleId: String,
    adminChannelId: String
}));

const RequestTracker = mongoose.model('RequestTracker', new mongoose.Schema({ 
    userId: String, 
    guildId: String,
    status: { type: String, default: 'pending' }, 
    reason: String 
}));

// --- EXPRESS SETUP ---
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Sesja z zapisem w MongoDB (ważne, żeby nie wylogowywało)
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

// 1. STRONA STARTOWA
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
                .btn-verify { background: #5469d4; color: white; width: 100%; }
                .btn-dash { border: 1px solid #5469d4; color: #5469d4; background: transparent; width: 100%; }
                .btn:hover { transform: translateY(-3px); box-shadow: 0 10px 20px rgba(84, 105, 212, 0.2); }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>ICARUS SYSTEM</h1>
                <p style="color: #a3acb9; margin-bottom: 30px;">Security & Management Portal</p>
                <a href="/login" class="btn btn-verify">Autoryzuj Urządzenie</a>
                <a href="/dashboard" class="btn btn-dash">Panel Zarządzania</a>
            </div>
        </body>
        </html>
    `);
});

// 2. OAUTH2 LOGIN
app.get('/login', (req, res, next) => {
    // Jeśli użytkownik ma w sesji guildId z linku weryfikacyjnego, zapamiętujemy to
    if (req.query.guild) req.session.verifyGuild = req.query.guild;
    passport.authenticate('discord')(req, res, next);
});

app.get('/auth/callback', passport.authenticate('discord', { failureRedirect: '/' }), (req, res) => {
    // Jeśli użytkownik przyszedł z linku weryfikacyjnego (miał token/guild w sesji)
    if (req.session.verifyGuild) {
        const guildId = req.session.verifyGuild;
        delete req.session.verifyGuild;
        return res.redirect(`/auth?token=${req.user.id}&guild=${guildId}`);
    }
    res.redirect('/dashboard');
});

// 3. DASHBOARD (LISTA SERWERÓW)
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });
client.login(BOT_TOKEN);

app.get('/dashboard', async (req, res) => {
    if (!req.isAuthenticated()) return res.redirect('/login');
    
    const botGuilds = client.guilds.cache;
    const userGuilds = req.user.guilds;

    let cardsHtml = userGuilds.map(g => {
        const hasBot = botGuilds.has(g.id);
        const isAdmin = (parseInt(g.permissions) & 0x8) === 0x8;
        if (!isAdmin && !hasBot) return '';

        const btnClass = hasBot ? "btn-manage" : "btn-add";
        const btnText = hasBot ? "ZARZĄDZAJ" : "DODAJ ICARUSA";
        const link = hasBot ? `/manage/${g.id}` : `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&permissions=8&scope=bot`;

        return `
            <div class="card">
                <img src="${g.icon ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png` : 'https://discord.com/assets/1f0ac125a376cf482a442e9127e8eb.svg'}" width="60" style="border-radius: 50%">
                <div class="name">${g.name}</div>
                <a href="${link}" class="btn ${btnClass}">${btnText}</a>
            </div>
        `;
    }).join('');

    res.send(`
        <html>
        <head>
            <title>Icarus Dashboard</title>
            <style>
                body { background: #0f111a; color: white; font-family: sans-serif; padding: 40px; }
                .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 25px; max-width: 1200px; margin: 0 auto; }
                .card { background: #161926; padding: 30px; border-radius: 16px; text-align: center; border: 1px solid #2d334a; transition: 0.3s; }
                .card:hover { border-color: #5469d4; }
                .btn { display: block; padding: 12px; margin-top: 20px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 11px; letter-spacing: 1px; }
                .btn-manage { background: #5469d4; color: white; }
                .btn-add { background: #24b47e; color: white; }
                .name { margin-top: 15px; font-weight: 600; color: #e3e8ee; }
            </style>
        </head>
        <body>
            <div style="max-width: 1200px; margin: 0 auto; display: flex; justify-content: space-between; align-items: center;">
                <h2>Witaj, ${req.user.username}</h2>
                <a href="/" style="color: #a3acb9; text-decoration: none;">Powrót</a>
            </div>
            <div class="grid">${cardsHtml}</div>
        </body>
        </html>
    `);
});

// 4. PANEL ZARZĄDZANIA (NAPRAWA BŁĘDU CANNOT GET /MANAGE)
app.get('/manage/:guildId', async (req, res) => {
    if (!req.isAuthenticated()) return res.redirect('/login');
    const guild = client.guilds.cache.get(req.params.guildId);
    if (!guild) return res.send("Bot nie jest na tym serwerze.");

    let config = await GuildConfig.findOne({ guildId: guild.id }) || { verifyRoleId: '', adminChannelId: '' };

    res.send(`
        <html>
        <head>
            <style>
                body { background: #0f111a; color: white; font-family: sans-serif; display: flex; justify-content: center; padding: 50px; }
                .box { background: #161926; padding: 40px; border-radius: 15px; border: 1px solid #2d334a; width: 400px; }
                input { width: 100%; padding: 10px; margin: 10px 0 20px; background: #0f111a; border: 1px solid #2d334a; color: white; border-radius: 5px; }
                button { width: 100%; padding: 15px; background: #5469d4; border: none; color: white; font-weight: bold; border-radius: 5px; cursor: pointer; }
            </style>
        </head>
        <body>
            <div class="box">
                <h2>Ustawienia: ${guild.name}</h2>
                <form action="/save/${guild.id}" method="POST">
                    <label>ID Roli Weryfikacyjnej</label>
                    <input type="text" name="roleId" value="${config.verifyRoleId}">
                    <button type="submit">ZAPISZ</button>
                </form>
            </div>
        </body>
        </html>
    `);
});

app.post('/save/:guildId', async (req, res) => {
    await GuildConfig.findOneAndUpdate({ guildId: req.params.guildId }, { verifyRoleId: req.body.roleId }, { upsert: true });
    res.redirect('/dashboard');
});

// 5. WERYFIKACJA (DESIGN ORYGINALNY)
app.get('/auth', (req, res) => {
    const { token, guild } = req.query;
    if (!token || !guild) return res.redirect('/');
    
    res.send(`
        <!DOCTYPE html>
        <html lang="pl">
        <head>
            <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Icarus • Weryfikacja</title>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap');
                body { margin: 0; font-family: 'Inter', sans-serif; background: #f6f9fc; display: flex; justify-content: center; align-items: center; height: 100vh; }
                .card { background: white; padding: 50px; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.05); text-align: center; max-width: 400px; }
                h1 { color: #1a1f36; font-size: 24px; }
                .btn { background: #5469d4; color: white; padding: 15px 30px; border-radius: 5px; text-decoration: none; display: inline-block; margin-top: 20px; font-weight: 600; cursor: pointer; border: none; width: 100%; }
                .loader { display: none; border: 3px solid #f3f3f3; border-top: 3px solid #5469d4; border-radius: 50%; width: 30px; height: 30px; animation: spin 1s linear infinite; margin: 20px auto; }
                @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            </style>
        </head>
        <body>
            <div class="card" id="main">
                <div style="color: #5469d4; font-weight: 800; letter-spacing: 2px; margin-bottom: 20px;">ICARUS SYSTEM</div>
                <h1>Weryfikacja serwerowa</h1>
                <p>Kliknij przycisk poniżej, aby dokończyć autoryzację dla serwera <b>ID: ${guild}</b>.</p>
                <div class="loader" id="l"></div>
                <button class="btn" id="b" onclick="start()">KONTYNUUJ</button>
            </div>
            <script>
                async function start() {
                    document.getElementById('b').style.display = 'none';
                    document.getElementById('l').style.display = 'block';
                    await fetch('/complete', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({ userId: '${token}', guildId: '${guild}' })
                    });
                    
                    setInterval(async () => {
                        const r = await fetch('/status?userId=${token}&guildId=${guild}');
                        const s = await r.json();
                        if(s.status === 'success') {
                            document.getElementById('main').innerHTML = '<h1 style="color: #24b47e">✓ Sukces</h1><p>Możesz zamknąć to okno.</p>';
                        }
                    }, 3000);
                }
            </script>
        </body>
        </html>
    `);
});

// API ENDPOINTS (Zapis do bazy dla administratora)
app.get('/status', async (req, res) => {
    const doc = await RequestTracker.findOne({ userId: req.query.userId, guildId: req.query.guildId });
    res.json({ status: doc ? doc.status : 'pending' });
});

app.post('/complete', async (req, res) => {
    const { userId, guildId } = req.body;
    const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress).split(',')[0].trim();
    
    // Zapisujemy prośbę do bazy
    await RequestTracker.findOneAndUpdate({ userId, guildId }, { status: 'pending' }, { upsert: true });

    // Wysyłamy log do administratorów (na serwer)
    const guild = client.guilds.cache.get(guildId);
    if (guild) {
        const logChan = guild.channels.cache.find(c => c.name === 'icarus-logs') || guild.channels.cache.filter(c => c.isTextBased()).first();
        if (logChan) {
            const embed = new EmbedBuilder().setTitle('🛡️ Nowa weryfikacja').setColor('#5469d4').addFields({name:'User', value:`<@${userId}>`}, {name:'IP', value:ip});
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`accept_${userId}_${guildId}`).setLabel('Autoryzuj').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId(`reject_${userId}_${guildId}`).setLabel('Odrzuć').setStyle(ButtonStyle.Danger)
            );
            logChan.send({ embeds: [embed], components: [row] });
        }
    }
    res.sendStatus(200);
});

// Obsługa przycisków admina
client.on('interactionCreate', async (i) => {
    if (!i.isButton()) return;
    const [action, targetId, gId] = i.customId.split('_');
    if (action === 'accept') {
        const config = await GuildConfig.findOne({ guildId: gId });
        const guild = client.guilds.cache.get(gId);
        const member = await guild.members.fetch(targetId);
        if (member && config?.verifyRoleId) await member.roles.add(config.verifyRoleId);
        await RequestTracker.findOneAndUpdate({ userId: targetId, guildId: gId }, { status: 'success' });
        await i.update({ content: '✅ Zaakceptowano', embeds: [], components: [] });
    }
});

app.listen(process.env.PORT || 3000);
