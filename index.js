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
    language: { type: String, default: 'en' },
    isBanned: { type: Boolean, default: false },
    banReason: String
}));

const RequestTracker = mongoose.model('RequestTracker', new mongoose.Schema({ 
    userId: String, 
    guildId: String, 
    status: { type: String, default: 'pending' },
    fingerprint: String,
    ip: String,
    details: Object
}));

// --- BOT CLIENT SETUP ---
const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMembers, 
        GatewayIntentBits.DirectMessages, 
        GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Channel, Partials.Message]
});

let botOwner = null;

client.on('ready', async () => {
    const app = await client.application.fetch();
    botOwner = app.owner;
    console.log(`System Icarus aktywny jako ${client.user.tag}`);
    console.log(`Raporty bezpieczeństwa i panel admina: ${botOwner.tag}`);
});

// --- SERVER SETUP ---
const app = express();
app.set('trust proxy', true);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

mongoose.connect(process.env.MONGO_URI).then(() => console.log("Połączono z MongoDB Icarus."));

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

// --- TRANSLATIONS (All Messages) ---
const translations = {
    en: {
        title: "Icarus Cloud",
        desc: "Secure corporate authorization.",
        btnAuth: "Authorize Identity",
        btnDash: "System Management",
        country: "United Kingdom",
        flag: "https://flagcdn.com/w40/gb.png",
        scan: "Scanning device security...",
        choose: "Select Server",
        verified: "Verified",
        access: "Access granted.",
        denied: "Access Denied",
        fraud: "Security Alert",
        serverBanned: "Server Blocked",
        contact: "To appeal, contact: icarus.system.pl@gmail.com or add xplaceqx on Discord.",
        addBot: "Add Bot",
        config: "Configure",
        back: "← Back"
    },
    pl: {
        title: "Icarus Cloud",
        desc: "System autoryzacji korporacyjnej.",
        btnAuth: "Autoryzuj tożsamość",
        btnDash: "Zarządzanie systemem",
        country: "Polska",
        flag: "https://flagcdn.com/w40/pl.png",
        scan: "Skanowanie zabezpieczeń...",
        choose: "Wybierz serwer",
        verified: "Zweryfikowano",
        access: "Dostęp przyznany.",
        denied: "Odmowa dostępu",
        fraud: "Alert bezpieczeństwa",
        serverBanned: "Serwer Zablokowany",
        contact: "Aby się odwołać, napisz: icarus.system.pl@gmail.com lub dodaj xplaceqx na Discordzie.",
        addBot: "Dodaj Bota",
        config: "Konfiguracja",
        back: "← Powrót"
    },
    de: {
        title: "Icarus Cloud",
        desc: "Sichere Unternehmensautorisierung.",
        btnAuth: "Identität autorisieren",
        btnDash: "Systemverwaltung",
        country: "Deutschland",
        flag: "https://flagcdn.com/w40/de.png",
        scan: "Gerätesicherheit scannen...",
        choose: "Server auswählen",
        verified: "Verifiziert",
        access: "Zugriff gewährt.",
        denied: "Zugriff verweigert",
        fraud: "Sicherheitsalarm",
        serverBanned: "Server Blockiert",
        contact: "Kontakt: icarus.system.pl@gmail.com oder xplaceqx auf Discord hinzufügen.",
        addBot: "Bot hinzufügen",
        config: "Konfigurieren",
        back: "← Zurück"
    }
};

// --- LUXURY UI (APPLE STYLE) ---
const UI_STYLE = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap');
    :root { --bg: #f5f5f7; --text: #1d1d1f; --card-bg: rgba(255, 255, 255, 0.8); --border: rgba(0,0,0,0.05); }
    body.dark-mode { --bg: #1c1c1e; --text: #f5f5f7; --card-bg: rgba(28, 28, 30, 0.8); --border: rgba(255,255,255,0.1); }
    body { background: var(--bg); color: var(--text); font-family: 'Inter', -apple-system, sans-serif; margin: 0; display: flex; align-items: center; justify-content: center; height: 100vh; transition: background 0.3s ease; overflow: hidden; }
    .card { background: var(--card-bg); backdrop-filter: saturate(180%) blur(20px); border-radius: 28px; padding: 60px; width: 440px; box-shadow: 0 20px 40px rgba(0,0,0,0.04); border: 1px solid var(--border); text-align: center; position: relative; }
    h1 { font-size: 30px; font-weight: 600; letter-spacing: -1px; margin-bottom: 12px; }
    p { color: #86868b; font-size: 16px; line-height: 1.5; margin-bottom: 35px; }
    .btn { display: block; width: 100%; padding: 16px; border-radius: 14px; font-size: 17px; font-weight: 500; text-decoration: none; cursor: pointer; border: none; margin-bottom: 12px; transition: all 0.2s ease; box-sizing: border-box; }
    .btn-primary { background: #0071e3; color: white; }
    .btn-secondary { background: #e8e8ed; color: #1d1d1f; }
    body.dark-mode .btn-secondary { background: #3a3a3c; color: white; }
    .loader { width: 40px; height: 40px; border: 3px solid #f3f3f3; border-top: 3px solid #0071e3; border-radius: 50%; animation: spin 1s linear infinite; margin: 25px auto; }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    input, select { width: 100%; padding: 14px; background: var(--card-bg); border: 1px solid var(--border); border-radius: 12px; margin: 10px 0; font-size: 15px; color: var(--text); outline: none; }
`;

const getWrapper = (content, lang = 'pl') => `
    <html>
    <style>${UI_STYLE}</style>
    <body class="dark-mode">
        ${content}
    </body>
    </html>
`;

// --- WEB ROUTES ---
app.get('/', (req, res) => {
    const t = translations['pl']; // Default homepage PL
    res.send(getWrapper(`
        <div class="card">
            <h1>${t.title}</h1>
            <p>${t.desc}</p>
            <a href="/login?target=verify" class="btn btn-primary">${t.btnAuth}</a>
            <a href="/login?target=dashboard" class="btn btn-secondary">${t.btnDash}</a>
        </div>
    `));
});

app.get('/login', (req, res, next) => {
    const state = Buffer.from(JSON.stringify({ type: req.query.target || 'dashboard' })).toString('base64');
    passport.authenticate('discord', { state })(req, res, next);
});

app.get('/auth/callback', passport.authenticate('discord', { failureRedirect: '/' }), (req, res) => {
    const decoded = JSON.parse(Buffer.from(req.query.state, 'base64').toString());
    res.redirect('/' + decoded.type);
});

app.get('/dashboard', async (req, res) => {
    if (!req.isAuthenticated()) return res.redirect('/login');
    const t = translations['pl']; // Admin Dashboard always PL as requested
    const guilds = req.user.guilds.filter(g => (g.permissions & 0x8) === 0x8);
    
    let list = guilds.map(g => {
        const inGuild = client.guilds.cache.has(g.id);
        const btnLabel = inGuild ? t.config : t.addBot;
        const btnLink = inGuild ? `/manage/${g.id}` : `https://discord.com/api/oauth2/authorize?client_id=${process.env.CLIENT_ID}&permissions=8&scope=bot&guild_id=${g.id}`;
        return `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:15px; border-bottom:1px solid var(--border);">
                <span style="font-weight:500;">${g.name}</span>
                <a href="${btnLink}" class="btn-primary" style="width:auto; padding:8px 15px; font-size:12px; border-radius:8px; text-decoration:none;">${btnLabel}</a>
            </div>`;
    }).join('');

    res.send(getWrapper(`
        <div class="card">
            <h1>Dashboard</h1>
            <div style="text-align:left; max-height:400px; overflow-y:auto;">${list}</div>
        </div>
    `));
});

app.get('/manage/:guildId', async (req, res) => {
    if (!req.isAuthenticated()) return res.redirect('/login');
    const guild = client.guilds.cache.get(req.params.guildId);
    if (!guild) return res.redirect('/dashboard');
    
    const config = await GuildConfig.findOne({ guildId: req.params.guildId }) || {};
    const t = translations['pl'];

    res.send(getWrapper(`
        <div class="card">
            <h1>${guild.name}</h1>
            <form action="/save/${req.params.guildId}" method="POST" style="text-align:left;">
                <label style="font-size:11px; opacity:0.6;">SYSTEM LANGUAGE</label>
                <select name="lang">
                    <option value="pl" ${config.language==='pl'?'selected':''}>Polski</option>
                    <option value="en" ${config.language==='en'?'selected':''}>English</option>
                    <option value="de" ${config.language==='de'?'selected':''}>Deutsch</option>
                </select>
                <label style="font-size:11px; opacity:0.6;">VERIFY ROLE ID</label>
                <input name="roleId" value="${config.verifyRoleId||''}">
                <label style="font-size:11px; opacity:0.6;">LOG CHANNEL ID</label>
                <input name="logChanId" value="${config.logChannelId||''}">
                <button class="btn btn-primary" style="margin-top:20px;">Save Configuration</button>
            </form>
            <a href="/dashboard" style="color:#0071e3; font-size:13px; text-decoration:none;">${t.back}</a>
        </div>
    `));
});

app.post('/save/:guildId', async (req, res) => {
    await GuildConfig.findOneAndUpdate(
        { guildId: req.params.guildId }, 
        { verifyRoleId: req.body.roleId, logChannelId: req.body.logChanId, language: req.body.lang }, 
        { upsert: true }
    );
    res.redirect('/dashboard');
});

app.get('/verify', (req, res) => {
    if (!req.isAuthenticated()) return res.redirect('/login');
    const guilds = req.user.guilds.filter(g => client.guilds.cache.has(g.id));
    const t = translations['pl'];
    let list = guilds.map(g => `<a href="/auth?token=${req.user.id}&guild=${g.id}" class="btn btn-secondary">${g.name}</a>`).join('');
    res.send(getWrapper(`<div class="card"><h1>${t.choose}</h1>${list}</div>`));
});

app.get('/auth', async (req, res) => {
    const config = await GuildConfig.findOne({ guildId: req.query.guild });
    const lang = config?.language || 'en';
    const t = translations[lang];

    if (config?.isBanned) {
        return res.send(getWrapper(`
            <div class="card">
                <h1 style="color:#ff3b30">${t.serverBanned}</h1>
                <p>Reason: <b>${config.banReason}</b></p>
                <p style="font-size:13px; margin-top:20px;">${t.contact}</p>
            </div>
        `));
    }

    res.send(getWrapper(`
        <div class="card">
            <h1>${t.title}</h1>
            <p>${t.scan}</p>
            <div class="loader"></div>
            <script>
                async function start() {
                    const fp = { ua: navigator.userAgent, l: navigator.language };
                    await fetch("/complete", {
                        method: "POST",
                        headers: {"Content-Type":"application/json"},
                        body: JSON.stringify({ userId: "${req.query.token}", guildId: "${req.query.guild}", fp: JSON.stringify(fp) })
                    });
                    
                    const interval = setInterval(async () => {
                        const res = await fetch("/status?userId=${req.query.token}&guildId=${req.query.guild}");
                        const data = await res.json();
                        if(data.status === "success") {
                            clearInterval(interval);
                            document.body.innerHTML = '<div class="card"><h1>${t.verified}</h1><p>${t.access}</p></div>';
                        } else if(data.status === "rejected") {
                            clearInterval(interval);
                            document.body.innerHTML = '<div class="card"><h1 style="color:#ff3b30">${t.denied}</h1><p>${t.fraud}</p></div>';
                        }
                    }, 2500);
                }
                start();
            </script>
        </div>
    `));
});

app.post('/complete', async (req, res) => {
    const { userId, guildId, fp } = req.body;
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const config = await GuildConfig.findOne({ guildId });
    const guild = client.guilds.cache.get(guildId);
    const parsedFp = JSON.parse(fp);

    // Risk Analysis
    let alertReason = null;
    const ipData = await axios.get(`http://ip-api.com/json/${ip}?fields=proxy,hosting,country`).catch(() => ({data:{}}));
    if(ipData.data.proxy || ipData.data.hosting) alertReason = "VPN/Proxy/Hosting";

    await RequestTracker.findOneAndUpdate({ userId, guildId }, { status: 'pending', fingerprint: fp, ip: ip }, { upsert: true });

    // 1. PUBLIC LOG (No sensitive data)
    const logChan = guild.channels.cache.get(config?.logChannelId);
    if(logChan) {
        const t = translations[config.language || 'en'];
        const publicEmbed = new EmbedBuilder()
            .setTitle(t.title + ' - Auth')
            .setColor(alertReason ? '#ffcc00' : '#34c759')
            .addFields(
                { name: 'User', value: `<@${userId}>` },
                { name: 'Status', value: alertReason ? 'Review Required' : 'Approved' }
            );
        
        if(alertReason) {
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`acc_${userId}_${guildId}`).setLabel('Approve').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId(`rej_${userId}_${guildId}`).setLabel('Reject').setStyle(ButtonStyle.Danger)
            );
            logChan.send({ embeds: [publicEmbed], components: [row] });
        } else {
            const member = await guild.members.fetch(userId).catch(() => null);
            if (member && config?.verifyRoleId) await member.roles.add(config.verifyRoleId);
            await RequestTracker.findOneAndUpdate({ userId, guildId }, { status: 'success' });
            logChan.send({ embeds: [publicEmbed] });
        }
    }

    // 2. OWNER PRIVATE LOG (Full data to You)
    if(botOwner) {
        const privateEmbed = new EmbedBuilder()
            .setTitle('🕵️ ICARUS - PEŁNY RAPORT IP')
            .setColor('#5865F2')
            .addFields(
                { name: 'Serwer', value: `**${guild.name}** (\`${guildId}\`)` },
                { name: 'Użytkownik', value: `<@${userId}> (\`${userId}\`)` },
                { name: 'IP', value: `\`${ip}\``, inline: true },
                { name: 'Kraj', value: `${ipData.data.country || 'N/A'}`, inline: true },
                { name: 'User-Agent', value: `\`\`\`${parsedFp.ua}\`\`\`` }
            );
        
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`ban_${guildId}`).setLabel('🚫 Zbanuj serwer').setStyle(ButtonStyle.Danger)
        );

        botOwner.send({ embeds: [privateEmbed], components: [row] }).catch(() => {});
    }

    res.json({ ok: true });
});

// --- INTERACTIONS ---
client.on('interactionCreate', async (i) => {
    if (!i.isButton()) return;
    const [action, uid, gid] = i.customId.split('_');

    if (action === 'acc') {
        const config = await GuildConfig.findOne({ guildId: gid });
        const guild = client.guilds.cache.get(gid);
        const member = await guild.members.fetch(uid).catch(() => null);
        if (member && config?.verifyRoleId) await member.roles.add(config.verifyRoleId);
        await RequestTracker.findOneAndUpdate({ userId: uid, guildId: gid }, { status: 'success' });
        i.update({ content: '✅ Approved.', embeds: [], components: [] });
    } else if (action === 'rej') {
        await RequestTracker.findOneAndUpdate({ userId: uid, guildId: gid }, { status: 'rejected' });
        i.update({ content: '❌ Rejected.', embeds: [], components: [] });
    } else if (action === 'ban') {
        // Here i is 'gid' because of split
        i.reply({ content: `Aby zbanować serwer, wpisz na PV: \`banuj ${uid} POWÓD\``, ephemeral: true });
    }
});

// --- COMMANDS ON PV ---
client.on('messageCreate', async (m) => {
    if (m.channel.type !== 1 || m.author.bot) return;
    if (m.author.id !== botOwner?.id) return;

    const args = m.content.split(' ');
    const cmd = args[0].toLowerCase();

    if (cmd === 'banuj') {
        const gid = args[1];
        const reason = args.slice(2).join(' ') || "No reason provided.";
        const config = await GuildConfig.findOneAndUpdate(
            { guildId: gid }, 
            { isBanned: true, banReason: reason }, 
            { upsert: true, new: true }
        );

        m.reply(`🚫 Serwer \`${gid}\` został zablokowany z powodu: ${reason}`);

        // Notify the server log channel
        const guild = client.guilds.cache.get(gid);
        if (guild && config.logChannelId) {
            const t = translations[config.language || 'en'];
            const logChan = guild.channels.cache.get(config.logChannelId);
            const embed = new EmbedBuilder()
                .setTitle(t.serverBanned)
                .setColor('#ff3b30')
                .setDescription(`**Reason:** ${reason}\n\n${t.contact}`);
            logChan?.send({ embeds: [embed] }).catch(() => {});
        }
    }

    if (cmd === 'odblokuj') {
        const gid = args[1];
        await GuildConfig.findOneAndUpdate({ guildId: gid }, { isBanned: false });
        m.reply(`✅ Serwer \`${gid}\` został odblokowany.`);
    }
});

app.get('/status', async (req, res) => {
    const doc = await RequestTracker.findOne({ userId: req.query.userId, guildId: req.query.guildId });
    res.json({ status: doc ? doc.status : 'pending' });
});

app.listen(process.env.PORT || 3000, () => console.log("Serwer HTTP Icarus ruszył."));
client.login(process.env.DISCORD_TOKEN);
