const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
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
    logChannelId: String
}));

const RequestTracker = mongoose.model('RequestTracker', new mongoose.Schema({ 
    userId: String, 
    guildId: String, 
    status: { type: String, default: 'pending' },
    fingerprint: String,
    ip: String,
    details: Object
}));

// --- BOT CLIENT ---
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });

client.on('ready', () => console.log(`System Icarus aktywny jako ${client.user.tag}`));

// --- SERVER SETUP ---
const app = express();
app.set('trust proxy', true);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

mongoose.connect(process.env.MONGO_URI).then(() => console.log("Połączono z bazą danych Icarus Cloud."));

app.use(session({
    secret: 'apple_enterprise_secret_2026',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: process.env.MONGO_URI })
}));

// --- PASSPORT (AUTH) ---
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

// --- LUXURY UI (APPLE STYLE) ---
const UI_STYLE = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap');
    body { background: #f5f5f7; color: #1d1d1f; font-family: 'Inter', -apple-system, sans-serif; margin: 0; display: flex; align-items: center; justify-content: center; height: 100vh; -webkit-font-smoothing: antialiased; }
    .card { background: rgba(255, 255, 255, 0.8); backdrop-filter: saturate(180%) blur(20px); border-radius: 28px; padding: 60px; width: 440px; box-shadow: 0 20px 40px rgba(0,0,0,0.04); border: 1px solid rgba(255,255,255,0.3); text-align: center; }
    h1 { font-size: 30px; font-weight: 600; letter-spacing: -1px; margin-bottom: 12px; }
    p { color: #86868b; font-size: 16px; line-height: 1.5; margin-bottom: 35px; }
    .btn { display: block; width: 100%; padding: 16px; border-radius: 14px; font-size: 17px; font-weight: 500; text-decoration: none; cursor: pointer; border: none; margin-bottom: 12px; transition: all 0.3s cubic-bezier(0.25, 0.1, 0.25, 1); box-sizing: border-box; }
    .btn-primary { background: #0071e3; color: white; }
    .btn-primary:hover { background: #0077ed; transform: scale(1.02); }
    .btn-secondary { background: #e8e8ed; color: #1d1d1f; }
    .btn-secondary:hover { background: #d2d2d7; }
    .loader { width: 35px; height: 35px; border: 3px solid #f3f3f3; border-top: 3px solid #0071e3; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 25px auto; }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    input, select { width: 100%; padding: 14px; background: white; border: 1px solid #d2d2d7; border-radius: 12px; margin: 10px 0; font-size: 15px; box-sizing: border-box; outline: none; }
`;

// --- WEB ROUTES ---

app.get('/', (req, res) => {
    res.send('<style>' + UI_STYLE + '</style><div class="card"><h1>Icarus Cloud</h1><p>System bezpiecznej autoryzacji korporacyjnej.</p><a href="/login?target=verify" class="btn btn-primary">Autoryzuj tożsamość</a><a href="/login?target=dashboard" class="btn btn-secondary">Zarządzanie systemem</a></div>');
});

app.get('/login', (req, res, next) => {
    const state = Buffer.from(JSON.stringify({ type: req.query.target || 'dashboard' })).toString('base64');
    passport.authenticate('discord', { state })(req, res, next);
});

app.get('/auth/callback', passport.authenticate('discord', { failureRedirect: '/' }), (req, res) => {
    const decoded = JSON.parse(Buffer.from(req.query.state, 'base64').toString());
    res.redirect('/' + decoded.type);
});

// DASHBOARD
app.get('/dashboard', (req, res) => {
    if (!req.isAuthenticated()) return res.redirect('/login');
    const guilds = req.user.guilds.filter(g => (g.permissions & 0x8) === 0x8);
    let list = guilds.map(g => '<div style="display:flex; justify-content:space-between; align-items:center; padding:15px; border-bottom:1px solid #eee;"><span>'+g.name+'</span><a href="/manage/'+g.id+'" class="btn-primary" style="width:auto; padding:8px 15px; font-size:12px; border-radius:8px; text-decoration:none;">Konfiguruj</a></div>').join('');
    res.send('<style>' + UI_STYLE + '</style><div class="card"><h1>Twoje serwery</h1><p>Wybierz infrastrukturę do zarządzania.</p>' + list + '</div>');
});

app.get('/manage/:guildId', async (req, res) => {
    const guild = client.guilds.cache.get(req.params.guildId);
    if (!guild) return res.send('Błąd: Bot nie jest obecny na serwerze.');
    const config = await GuildConfig.findOne({ guildId: req.params.guildId }) || {};
    const channels = guild.channels.cache.filter(c => c.type === 0).map(c => '<option value="'+c.id+'" '+(config.logChannelId===c.id?'selected':'')+'>#'+c.name+'</option>').join('');
    res.send('<style>' + UI_STYLE + '</style><div class="card"><h1>Ustawienia: '+guild.name+'</h1><form action="/save/'+req.params.guildId+'" method="POST"><label style="font-size:11px; color:#86868b; display:block; text-align:left;">ID ROLI WERYFIKACYJNEJ</label><input name="roleId" value="'+(config.verifyRoleId||'')+'"><label style="font-size:11px; color:#86868b; display:block; text-align:left; margin-top:10px;">KANAŁ LOGÓW/DECYZJI</label><select name="logChanId">'+channels+'</select><button class="btn btn-primary" style="margin-top:20px;">Zapisz w chmurze</button></form></div>');
});

app.post('/save/:guildId', async (req, res) => {
    await GuildConfig.findOneAndUpdate({ guildId: req.params.guildId }, { verifyRoleId: req.body.roleId, logChannelId: req.body.logChanId }, { upsert: true });
    res.redirect('/dashboard');
});

// VERIFICATION PROCESS
app.get('/verify', (req, res) => {
    if (!req.isAuthenticated()) return res.redirect('/login');
    const guilds = req.user.guilds.filter(g => client.guilds.cache.has(g.id));
    let list = guilds.map(g => '<a href="/auth?token=' + req.user.id + '&guild=' + g.id + '" class="btn btn-secondary">' + g.name + '</a>').join('');
    res.send('<style>' + UI_STYLE + '</style><div class="card"><h1>Wybierz serwer</h1><p>Wybierz miejsce docelowe autoryzacji.</p>' + list + '</div>');
});

app.get('/auth', (req, res) => {
    res.send('<style>' + UI_STYLE + '</style><div class="card"><h1>Analiza bezpieczeństwa</h1><p id="msg">Skanowanie parametrów urządzenia...</p><div class="loader"></div>' +
        '<canvas id="cf" width="200" height="40" style="display:none"></canvas>' +
        '<script>' +
        'const run = async () => {' +
        '  const canvas = document.getElementById("cf"); const ctx = canvas.getContext("2d");' +
        '  ctx.textBaseline = "top"; ctx.font = "14px Arial"; ctx.fillText("icarus_check_v2", 2, 2);' +
        '  const canvasFp = canvas.toDataURL().slice(-50);' + 
        '  const fpData = { ' +
        '    sw: window.screen.width, sh: window.screen.height, cd: window.screen.colorDepth, ' +
        '    l: navigator.language, c: navigator.hardwareConcurrency, p: navigator.platform, ' +
        '    tz: Intl.DateTimeFormat().resolvedOptions().timeZone, ' +
        '    m: navigator.maxTouchPoints, cfp: canvasFp ' +
        '  };' +
        '  await fetch("/complete", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ userId: "' + req.query.token + '", guildId: "' + req.query.guild + '", fp: JSON.stringify(fpData) }) });' +
        '  setInterval(async () => {' +
        '    const r = await fetch("/status?userId=' + req.query.token + '&guildId=' + req.query.guild + '");' +
        '    const d = await r.json();' +
        '    if(d.status === "success") document.body.innerHTML = "<div class=\'card\'><h1>✅ Zweryfikowano</h1><p>Dostęp przyznany.</p></div>";' +
        '    if(d.status === "rejected") document.body.innerHTML = "<div class=\'card\'><h1 style=\'color:#ff3b30\'>❌ Odmowa</h1><p>Wykryto powiązanie z innym kontem lub VPN.</p></div>";' +
        '  }, 3000);' +
        '}; run();' +
        '</script></div>');
});

app.post('/complete', async (req, res) => {
    const { userId, guildId, fp } = req.body;
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const config = await GuildConfig.findOne({ guildId });
    const guild = client.guilds.cache.get(guildId);
    const parsedFp = JSON.parse(fp);

    let manualReason = null;
    
    // --- KLUCZOWA POPRAWKA LOGIKI ---
    // Szukamy po unikalnym skrócie GPU (cfp), nie po całym stringu fingerprintu
    const duplicateFP = await RequestTracker.findOne({ 
        "details.cfp": parsedFp.cfp, 
        guildId: guildId, 
        userId: { $ne: userId } 
    });
    
    const duplicateIP = await RequestTracker.findOne({ 
        ip: ip, 
        guildId: guildId, 
        userId: { $ne: userId },
        status: 'success'
    });
    
    if(duplicateFP) manualReason = `⚠️ MULTI-ACCOUNT: Ten sam sprzęt co u <@${duplicateFP.userId}>`;
    else if(duplicateIP) manualReason = `🌐 MULTI-ACCOUNT: To samo IP co u <@${duplicateIP.userId}>`;

    // VPN Check
    const ipData = await axios.get(`http://ip-api.com/json/${ip}?fields=status,proxy,hosting,country,city,isp`).catch(() => ({data:{}}));
    if(ipData.data.proxy || ipData.data.hosting) manualReason = "🛡️ WYKRYTO VPN / PROXY / HOSTING";

    await RequestTracker.findOneAndUpdate({ userId, guildId }, { status: 'pending', fingerprint: fp, ip: ip, details: parsedFp }, { upsert: true });

    const logChan = guild.channels.cache.get(config?.logChannelId);
    if(logChan) {
        const embed = new EmbedBuilder()
            .setTitle(manualReason ? '🚨 ALERT BEZPIECZEŃSTWA' : '✅ LOG WERYFIKACJI')
            .setColor(manualReason ? '#ff3b30' : '#34c759')
            .addFields(
                { name: '👤 Użytkownik', value: `<@${userId}> (\`${userId}\`)` },
                { name: '🌐 Sieć', value: `IP: \`${ip}\` (${ipData.data.country || 'N/A'})`, inline: true },
                { name: '💻 GPU Hash', value: `\`${parsedFp.cfp}\``, inline: true }
            );

        if(manualReason) {
            embed.addFields({ name: '🚩 POWÓD', value: `**${manualReason}**` });
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`acc_${userId}_${guildId}`).setLabel('Autoryzuj ręcznie').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId(`rej_${userId}_${guildId}`).setLabel('Zablokuj').setStyle(ButtonStyle.Danger)
            );
            logChan.send({ embeds: [embed], components: [row] });
        } else {
            try {
                const member = await guild.members.fetch(userId);
                if (config?.verifyRoleId) await member.roles.add(config.verifyRoleId);
                await RequestTracker.findOneAndUpdate({ userId, guildId }, { status: 'success' });
                embed.setDescription('System automatycznie zatwierdził profil. Brak powiązań.');
                logChan.send({ embeds: [embed] });
            } catch (e) {
                logChan.send({ content: `⚠️ Błąd ról dla <@${userId}>` });
            }
        }
    }
    res.json({ ok: true });
});

// DISCORD BUTTONS LOGIC
client.on('interactionCreate', async (i) => {
    if (!i.isButton()) return;
    const [action, uid, gid] = i.customId.split('_');
    const config = await GuildConfig.findOne({ guildId: gid });

    if (action === 'acc') {
        const guild = client.guilds.cache.get(gid);
        const member = await guild.members.fetch(uid).catch(() => null);
        if (member && config?.verifyRoleId) await member.roles.add(config.verifyRoleId);
        await RequestTracker.findOneAndUpdate({ userId: uid, guildId: gid }, { status: 'success' });
        i.update({ content: '✅ Zaakceptowano przez admina.', embeds: [], components: [] });
    } else if (action === 'rej') {
        await RequestTracker.findOneAndUpdate({ userId: uid, guildId: gid }, { status: 'rejected' });
        i.update({ content: '❌ Odrzucono przez admina.', embeds: [], components: [] });
    }
});

app.get('/status', async (req, res) => {
    const doc = await RequestTracker.findOne({ userId: req.query.userId, guildId: req.query.guildId });
    res.json({ status: doc ? doc.status : 'pending' });
});

app.listen(process.env.PORT || 3000, () => console.log("Icarus Online."));
client.login(process.env.DISCORD_TOKEN);
