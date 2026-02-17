const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const express = require('express');
const axios = require('axios');
const mongoose = require('mongoose');
const passport = require('passport');
const { Strategy } = require('passport-discord');
const session = require('express-session');

// --- CONFIGURATION ---
const BOT_TOKEN = process.env.DISCORD_TOKEN; 
const MONGO_URI = process.env.MONGO_URI; 
const PROXYCHECK_API_KEY = 'e2brv7-y9y366-243469-435457';
const DOMAIN = process.env.DOMAIN; // np. https://icarus-system.pl
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

const AdminLog = mongoose.model('AdminLog', new mongoose.Schema({ 
    targetId: String, 
    messages: [{ adminId: String, messageId: String }] 
}));

// --- BOT CLIENT ---
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.DirectMessages] });

// --- EXPRESS & OAUTH2 SETUP ---
const app = express();
app.use(express.json());
app.use(session({ secret: 'icarus_global_key_2026', resave: false, saveUninitialized: false }));

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
                body { margin: 0; padding: 0; font-family: 'Inter', sans-serif; background-color: #0f111a; color: white; display: flex; justify-content: center; align-items: center; height: 100vh; }
                .container { text-align: center; background: #161926; padding: 60px; border-radius: 24px; border: 1px solid #2d334a; box-shadow: 0 20px 50px rgba(0,0,0,0.5); max-width: 500px; width: 90%; }
                h1 { font-size: 28px; letter-spacing: 4px; color: #5469d4; margin-bottom: 40px; }
                .btn { display: block; padding: 18px; margin: 15px 0; border-radius: 8px; text-decoration: none; font-weight: 600; transition: 0.3s; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; }
                .btn-verify { background: #5469d4; color: white; }
                .btn-dash { border: 1px solid #5469d4; color: #5469d4; }
                .btn:hover { transform: translateY(-3px); box-shadow: 0 10px 20px rgba(84, 105, 212, 0.2); }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>ICARUS SYSTEM</h1>
                <a href="/login" class="btn btn-verify">Autoryzuj Urządzenie</a>
                <a href="/login" class="btn btn-dash">Panel Zarządzania</a>
            </div>
        </body>
        </html>
    `);
});

// 2. OAUTH2 LOGIN
app.get('/login', passport.authenticate('discord'));
app.get('/auth/callback', passport.authenticate('discord', { failureRedirect: '/' }), (req, res) => {
    res.redirect('/dashboard');
});

// 3. DASHBOARD (LISTA SERWERÓW)
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
            <h2 style="text-align:center; margin-bottom:40px;">Witaj, ${req.user.username}#${req.user.discriminator}</h2>
            <div class="grid">${cardsHtml}</div>
        </body>
        </html>
    `);
});

// 4. TWOJA ORYGINALNA WERYFIKACJA (DESIGN)
app.get('/auth', (req, res) => {
    const userId = req.query.token;
    const guildId = req.query.guild;
    res.send(`
        <!DOCTYPE html>
        <html lang="pl">
        <head>
            <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Icarus System • Authorization</title>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
                body { margin: 0; padding: 0; font-family: 'Inter', sans-serif; background-color: #f6f9fc; color: #1a1f36; display: flex; justify-content: center; align-items: center; height: 100vh; }
                .card { background: #ffffff; padding: 48px; width: 100%; max-width: 420px; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.05); border: 1px solid #e3e8ee; text-align: center; }
                .brand { display: flex; align-items: center; justify-content: center; gap: 10px; margin-bottom: 30px; color: #5469d4; font-weight: 700; font-size: 20px; text-transform: uppercase; letter-spacing: 1px; }
                .brand-icon { width: 32px; height: 32px; background: #5469d4; border-radius: 6px; }
                h1 { font-size: 24px; color: #1a1f36; margin-bottom: 15px; font-weight: 600; }
                p { font-size: 15px; color: #4f566b; line-height: 1.6; margin-bottom: 30px; }
                .btn { background-color: #5469d4; color: #fff; border: none; padding: 14px 28px; font-size: 16px; font-weight: 500; border-radius: 4px; width: 100%; cursor: pointer; transition: background 0.2s; }
                .btn:hover { background-color: #243d8c; }
                .loader { display: none; width: 28px; height: 28px; border: 3px solid #e3e8ee; border-top: 3px solid #5469d4; border-radius: 50%; margin: 0 auto 20px; animation: spin 0.8s linear infinite; }
                #console { font-size: 14px; color: #5469d4; margin-top: 15px; font-weight: 500; }
                @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                .footer { margin-top: 40px; font-size: 12px; color: #a3acb9; border-top: 1px solid #e3e8ee; padding-top: 20px; }
            </style>
        </head>
        <body>
            <div class="card">
                <div class="brand"><div class="brand-icon"></div> ICARUS SYSTEM</div>
                <div id="content">
                    <h1>Weryfikacja tożsamości</h1>
                    <p>System Icarus wymaga autoryzacji urządzenia w celu przyznania dostępu do zasobów sieciowych.</p>
                    <div class="loader" id="loader"></div>
                    <div id="btn-container"><button class="btn" id="startBtn">KONTYNUUJ</button></div>
                    <div id="console"></div>
                </div>
                <div class="footer">&copy; 2026 Icarus Solutions Ltd. Security Division.</div>
            </div>
            <script>
                const userId = "${userId}";
                const guildId = "${guildId}";
                const btn = document.getElementById('startBtn');
                const loader = document.getElementById('loader');
                const con = document.getElementById('console');

                async function check() {
                    const r = await fetch('/status?userId=' + userId + '&guildId=' + guildId);
                    const s = await r.json();
                    if(s.status === 'success') {
                        document.getElementById('content').innerHTML = '<div style="color:#24b47e; font-size:50px; margin-bottom:15px;">✓</div><h1>Autoryzacja pomyślna</h1><p>Dostęp przyznany. Wróć na Discord.</p>';
                        return true;
                    } else if(s.status === 'rejected') {
                        document.getElementById('content').innerHTML = '<div style="color:#cd3d64; font-size:50px; margin-bottom:15px;">✕</div><h1>Odmowa</h1><p>Powód: ' + (s.reason || "Brak") + '</p>';
                        return true;
                    }
                    return false;
                }

                btn.onclick = async () => {
                    btn.style.display = 'none'; loader.style.display = 'block';
                    con.innerText = "Łączenie z bazą...";
                    await fetch('/complete', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({ userId, guildId })
                    });
                    setInterval(async () => { if(await check()) clearInterval(); }, 2000);
                };
            </script>
        </body>
        </html>
    `);
});

// --- API ENDPOINTS ---

app.get('/status', async (req, res) => {
    const doc = await RequestTracker.findOne({ userId: req.query.userId, guildId: req.query.guildId });
    res.json({ status: doc ? doc.status : 'pending', reason: doc ? doc.reason : '' });
});

app.post('/complete', async (req, res) => {
    const { userId, guildId } = req.body;
    const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress).split(',')[0].trim();
    const { data } = await axios.get(`https://proxycheck.io/v2/${ip}?key=${PROXYCHECK_API_KEY}&vpn=3`);
    
    await RequestTracker.findOneAndUpdate({ userId, guildId }, { status: 'pending' }, { upsert: true });
    
    // Log do administratorów (kanał na serwerze)
    const guild = client.guilds.cache.get(guildId);
    if (!guild) return res.json({ action: 'wait' });

    const embed = new EmbedBuilder()
        .setTitle('Icarus System • Nowa Weryfikacja')
        .setColor('#f5a623')
        .addFields(
            { name: 'Użytkownik', value: `<@${userId}>` },
            { name: 'IP / Kraj', value: `\`${ip}\` (${data[ip].isocode || '??'})` },
            { name: 'Dostawca', value: `\`${data[ip].asn || 'Unknown'}\`` }
        );

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`accept_${userId}_${guildId}`).setLabel('Autoryzuj').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`reject_${userId}_${guildId}`).setLabel('Odrzuć').setStyle(ButtonStyle.Danger)
    );

    // Szukamy kanału do logów na tym serwerze
    const config = await GuildConfig.findOne({ guildId });
    const logChan = guild.channels.cache.find(c => c.name === 'icarus-logs') || guild.channels.cache.filter(c => c.isTextBased()).first();
    
    if (logChan) logChan.send({ embeds: [embed], components: [row] });
    res.json({ action: 'wait' });
});

// --- BOT INTERACTIONS ---

client.on('interactionCreate', async (i) => {
    if (i.isButton()) {
        const [action, targetId, gId] = i.customId.split('_');
        if (action === 'accept') {
            const config = await GuildConfig.findOne({ guildId: gId });
            const guild = client.guilds.cache.get(gId);
            const member = await guild.members.fetch(targetId);
            const role = guild.roles.cache.find(r => r.name === 'Zweryfikowany') || guild.roles.cache.get(config?.verifyRoleId);
            
            if (role) await member.roles.add(role);
            await RequestTracker.findOneAndUpdate({ userId: targetId, guildId: gId }, { status: 'success' });
            await i.update({ content: `✅ Zaakceptowano przez <@${i.user.id}>`, embeds: [], components: [] });
        }
        if (action === 'reject') {
            await RequestTracker.findOneAndUpdate({ userId: targetId, guildId: gId }, { status: 'rejected', reason: 'Odmowa administratora' });
            await i.update({ content: `❌ Odrzucono przez <@${i.user.id}>`, embeds: [], components: [] });
        }
    }
});

client.on('guildMemberAdd', async (m) => {
    const embed = new EmbedBuilder()
        .setTitle('ICARUS SYSTEM • Weryfikacja')
        .setDescription('Wymagana autoryzacja urządzenia w celu uzyskania dostępu.')
        .setColor('#5469d4');
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setLabel('URUCHOM PORTAL').setURL(`${DOMAIN}/auth?token=${m.id}&guild=${m.guild.id}`).setStyle(ButtonStyle.Link)
    );
    m.send({ embeds: [embed], components: [row] }).catch(() => {});
});

client.login(BOT_TOKEN);
app.listen(process.env.PORT || 3000);
