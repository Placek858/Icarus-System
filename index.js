const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, Partials } = require('discord.js');
const express = require('express');
const mongoose = require('mongoose');
const passport = require('passport');
const { Strategy } = require('passport-discord');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const axios = require('axios');

// --- DATABASE MODELS ---
const GuildConfig = mongoose.model('GuildConfig', new mongoose.Schema({
    guildId: String,
    verifyRoleId: String,
    logChannelId: String,
    language: { type: String, default: 'pl' },
    isBanned: { type: Boolean, default: false },
    banReason: String
}));

const RequestTracker = mongoose.model('RequestTracker', new mongoose.Schema({ 
    userId: String, 
    guildId: String, 
    status: { type: String, default: 'pending' },
    ip: String,
    ua: String,
    isp: String,
    timestamp: { type: Date, default: Date.now }
}));

// --- BOT CLIENT ---
const client = new Client({ 
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.DirectMessages, GatewayIntentBits.MessageContent],
    partials: [Partials.Channel, Partials.Message]
});

let botOwner = null;
client.on('ready', async () => {
    const app = await client.application.fetch();
    botOwner = app.owner;
    console.log(`[ICARUS SYSTEM] Zalogowano: ${client.user.tag}`);
});

// --- SERVER SETUP ---
const app = express();
app.set('trust proxy', 1); // NIEZBĘDNE DLA RENDERA I TWOJEJ DOMENY
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

mongoose.connect(process.env.MONGO_URI);

app.use(session({
    secret: 'icarus_vault_2026_pro',
    resave: true,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: process.env.MONGO_URI }),
    cookie: { 
        secure: true, 
        sameSite: 'none', // Pozwala na działanie sesji między domenami
        maxAge: 3600000 
    }
}));

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));
passport.use(new Strategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: process.env.DOMAIN + '/auth/callback',
    scope: ['identify', 'guilds']
}, (at, rt, profile, done) => done(null, profile)));

app.use(passport.initialize());
app.use(passport.session());

// --- ENTERPRISE UI ---
const UI_STYLE = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap');
    body { background: #000; color: #fff; font-family: 'Inter', sans-serif; margin: 0; display: flex; align-items: center; justify-content: center; height: 100vh; overflow: hidden; }
    .container { background: rgba(255,255,255,0.03); backdrop-filter: blur(25px); border-radius: 30px; padding: 50px; width: 380px; text-align: center; border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 40px 80px rgba(0,0,0,0.8); }
    h1 { font-size: 32px; font-weight: 600; margin-bottom: 12px; letter-spacing: -1.5px; }
    p { color: #86868b; font-size: 15px; margin-bottom: 35px; }
    .btn { display: block; width: 100%; padding: 16px; border-radius: 14px; font-size: 16px; font-weight: 500; text-decoration: none; cursor: pointer; border: none; margin-bottom: 12px; transition: 0.3s; box-sizing: border-box; }
    .btn-blue { background: #0071e3; color: white; }
    .btn-gray { background: rgba(255,255,255,0.1); color: white; }
    .loader { width: 35px; height: 35px; border: 3px solid rgba(255,255,255,0.1); border-top: 3px solid #0071e3; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 25px auto; }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
`;

const getWrapper = (content) => `<html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>${UI_STYLE}</style></head><body>${content}</body></html>`;

// --- ROUTES ---

app.get('/', (req, res) => res.send(getWrapper(`
    <div class="container">
        <h1>Icarus Cloud</h1>
        <p>Zaawansowany system autoryzacji korporacyjnej.</p>
        <a href="/login?target=verify" class="btn btn-blue">Weryfikacja Konta</a>
        <a href="/login?target=dashboard" class="btn btn-gray">Panel Admina</a>
    </div>
`)));

app.get('/dashboard', async (req, res) => {
    if (!req.isAuthenticated()) return res.redirect('/login?target=dashboard');
    const guilds = req.user.guilds.filter(g => (g.permissions & 0x8) === 0x8);
    let list = guilds.map(g => {
        const inG = client.guilds.cache.has(g.id);
        return `<div style="display:flex;justify-content:space-between;padding:12px;border-bottom:1px solid #222;">
            <span style="font-size:14px;">${g.name}</span>
            <a href="${inG ? '/manage/'+g.id : 'https://discord.com/api/oauth2/authorize?client_id='+process.env.CLIENT_ID+'&permissions=8&scope=bot&guild_id='+g.id}" 
               style="color:#0071e3;text-decoration:none;font-weight:600;font-size:12px;">${inG ? 'ZARZĄDZAJ' : 'DODAJ'}</a>
        </div>`;
    }).join('');
    res.send(getWrapper(`<div class="container"><h1>Dashboard</h1><div style="text-align:left;max-height:250px;overflow-y:auto;">${list}</div></div>`));
});

app.get('/manage/:guildId', async (req, res) => {
    if (!req.isAuthenticated()) return res.redirect('/login');
    const config = await GuildConfig.findOne({ guildId: req.params.guildId }) || {};
    res.send(getWrapper(`
        <div class="container">
            <h1>Ustawienia</h1>
            <form action="/save/${req.params.guildId}" method="POST" style="text-align:left;">
                <label style="font-size:11px;color:#86868b">ID ROLI WERYFIKACYJNEJ</label>
                <input name="roleId" value="${config.verifyRoleId||''}" style="width:100%;padding:10px;margin:5px 0 15px 0;background:#111;border:1px solid #333;color:white;border-radius:8px;">
                <label style="font-size:11px;color:#86868b">ID KANAŁU LOGÓW</label>
                <input name="logChanId" value="${config.logChannelId||''}" style="width:100%;padding:10px;margin:5px 0 15px 0;background:#111;border:1px solid #333;color:white;border-radius:8px;">
                <button class="btn btn-blue">Zapisz konfigurację</button>
            </form>
            <a href="/dashboard" style="color:#86868b;font-size:12px;text-decoration:none;">← Powrót do listy</a>
        </div>`));
});

app.post('/save/:guildId', async (req, res) => {
    await GuildConfig.findOneAndUpdate({ guildId: req.params.guildId }, { verifyRoleId: req.body.roleId, logChannelId: req.body.logChanId }, { upsert: true });
    res.redirect('/dashboard');
});

app.get('/verify', (req, res) => {
    if (!req.isAuthenticated()) return res.redirect('/login?target=verify');
    const guilds = req.user.guilds.filter(g => client.guilds.cache.has(g.id));
    let list = guilds.map(g => `<a href="/auth?token=${req.user.id}&guild=${g.id}" class="btn btn-gray">${g.name}</a>`).join('');
    res.send(getWrapper(`<div class="container"><h1>Weryfikacja</h1><p>Wybierz serwer:</p>${list}</div>`));
});

app.get('/auth', async (req, res) => {
    const config = await GuildConfig.findOne({ guildId: req.query.guild });
    if (config?.isBanned) return res.send(getWrapper(`<div class="container"><h1 style="color:red">Banned</h1><p>${config.banReason}</p></div>`));
    res.send(getWrapper(`
        <div class="container" id="box">
            <h1>Icarus Cloud</h1>
            <p>Skanowanie systemu zabezpieczeń...</p>
            <div class="loader"></div>
            <script>
                async function s(){
                    await fetch("/process", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({userId:"${req.query.token}",guildId:"${req.query.guild}",ua:navigator.userAgent})});
                    setInterval(async ()=>{
                        const r = await fetch("/status?userId=${req.query.token}&guildId=${req.query.guild}");
                        const d = await r.json();
                        if(d.status==="success") document.getElementById('box').innerHTML='<h1>✅ Sukces</h1><p>Zweryfikowano pomyślnie.</p>';
                        if(d.status==="rejected") document.getElementById('box').innerHTML='<h1 style="color:red">❌ Odmowa</h1><p>VPN lub Multikonto.</p>';
                    }, 2500);
                } s();
            </script>
        </div>`));
});

app.post('/process', async (req, res) => {
    const { userId, guildId, ua } = req.body;
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const config = await GuildConfig.findOne({ guildId });
    const guild = client.guilds.cache.get(guildId);
    
    const ipData = await axios.get(`http://ip-api.com/json/${ip}?fields=status,country,isp,proxy,hosting`).catch(()=>({data:{}}));
    const multi = await RequestTracker.findOne({ ip, guildId, userId: { $ne: userId }, status: 'success' });

    const logPV = async (title, color) => {
        if (!botOwner) return;
        const embed = new EmbedBuilder().setTitle(title).setColor(color).addFields(
            { name: '👤 User', value: `<@${userId}> (\`${userId}\`)`, inline: true },
            { name: '🏰 Server', value: `${guild?.name || 'N/A'}`, inline: true },
            { name: '🌐 IP', value: `\`${ip}\``, inline: true },
            { name: '🔌 ISP', value: `${ipData.data.isp || 'N/A'}`, inline: true },
            { name: '🖥️ UA', value: `\`\`\`${ua}\`\`\`` }
        );
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`acc_${userId}_${guildId}`).setLabel('Wpuść').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`ban_${guildId}`).setLabel('Banuj Serwer').setStyle(ButtonStyle.Danger)
        );
        botOwner.send({ embeds: [embed], components: [row] });
    };

    if (multi) {
        await RequestTracker.findOneAndUpdate({ userId, guildId }, { status: 'rejected', ip, ua }, { upsert: true });
        await logPV('🚨 ALERT: MULTIKONTO', 'Red');
    } else if (ipData.data.proxy || ipData.data.hosting) {
        await RequestTracker.findOneAndUpdate({ userId, guildId }, { status: 'pending', ip, ua }, { upsert: true });
        await logPV('⚠️ ALERT: VPN/PROXY', 'Yellow');
    } else {
        const member = await guild?.members.fetch(userId).catch(()=>null);
        if (member && config?.verifyRoleId) await member.roles.add(config.verifyRoleId);
        await RequestTracker.findOneAndUpdate({ userId, guildId }, { status: 'success', ip, ua }, { upsert: true });
        await logPV('✅ WERYFIKACJA UDANA', 'Green');
    }
    res.json({ ok: true });
});

app.get('/login', (req, res, next) => {
    const state = Buffer.from(JSON.stringify({ t: req.query.target || 'dashboard' })).toString('base64');
    passport.authenticate('discord', { state })(req, res, next);
});

app.get('/auth/callback', passport.authenticate('discord', { failureRedirect: '/' }), (req, res) => {
    const d = JSON.parse(Buffer.from(req.query.state, 'base64').toString());
    res.redirect('/' + d.t);
});

app.get('/status', async (req, res) => {
    const doc = await RequestTracker.findOne({ userId: req.query.userId, guildId: req.query.guildId });
    res.json({ status: doc ? doc.status : 'pending' });
});

client.on('interactionCreate', async (i) => {
    if (!i.isButton()) return;
    const [action, uid, gid] = i.customId.split('_');
    if (action === 'acc') {
        const config = await GuildConfig.findOne({ guildId: gid });
        const member = await client.guilds.cache.get(gid)?.members.fetch(uid).catch(()=>null);
        if (member && config?.verifyRoleId) await member.roles.add(config.verifyRoleId);
        await RequestTracker.findOneAndUpdate({ userId: uid, guildId: gid }, { status: 'success' });
        i.reply({ content: 'Wpuszczono ręcznie.', ephemeral: true });
    }
});

app.listen(process.env.PORT || 3000);
client.login(process.env.DISCORD_TOKEN);
