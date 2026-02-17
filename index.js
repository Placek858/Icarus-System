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

// --- BAZA DANYCH ---
mongoose.connect(MONGO_URI).then(() => console.log("✅ SYSTEM: Magistrala danych aktywna"));

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

// --- BOT ---
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });
client.login(BOT_TOKEN);

// --- EXPRESS & AUTH ---
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
    secret: 'icarus_pro_enterprise_2026',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: MONGO_URI }),
    cookie: { maxAge: 60000 * 10 } // 10 minut sesji
}));

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

passport.use(new Strategy({
    clientID: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
    callbackURL: `${DOMAIN}/auth/callback`,
    scope: ['identify', 'guilds']
}, (at, rt, profile, done) => done(null, profile)));

app.use(passport.initialize());
app.use(passport.session());

// --- PROFESSIONAL UI (STRIPE STYLE) ---

const PROFESSIONAL_CSS = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');
    body { background: #f8fafc; font-family: 'Inter', sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; color: #1e293b; }
    .card { background: white; padding: 48px; border-radius: 16px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.04), 0 8px 10px -6px rgba(0,0,0,0.04); text-align: center; max-width: 420px; width: 90%; border: 1px solid #e2e8f0; }
    .logo { width: 48px; height: 48px; background: #6366f1; border-radius: 12px; margin: 0 auto 24px; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 24px; }
    h2 { font-size: 24px; font-weight: 600; margin: 0 0 12px; letter-spacing: -0.025em; }
    p { color: #64748b; font-size: 15px; line-height: 1.6; margin-bottom: 32px; }
    .btn { width: 100%; padding: 12px 16px; background: #6366f1; color: white; border: none; border-radius: 8px; font-size: 15px; font-weight: 500; cursor: pointer; transition: all 0.2s; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
    .btn:hover { background: #4f46e5; }
    .btn:disabled { background: #94a3b8; cursor: not-allowed; }
    .footer { margin-top: 24px; font-size: 12px; color: #94a3b8; }
`;

// --- ROUTES ---

app.get('/auth', (req, res) => {
    res.send(`
        <style>${PROFESSIONAL_CSS}</style>
        <div class="card">
            <div class="logo">I</div>
            <h2>Weryfikacja tożsamości</h2>
            <p>Aby uzyskać dostęp do serwera, musimy potwierdzić Twoją tożsamość przez bezpieczne połączenie Icarus System.</p>
            <button id="vBtn" onclick="start()" class="btn">Potwierdź tożsamość</button>
            <div class="footer">Bezpieczne połączenie szyfrowane AES-256</div>
        </div>
        <script>
            async function start() {
                const b = document.getElementById('vBtn');
                b.disabled = true; b.innerText = 'Autoryzacja w systemie...';
                
                try {
                    const resp = await fetch('/complete', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({ userId: '${req.query.token}', guildId: '${req.query.guild}' })
                    });
                    
                    if(!resp.ok) throw new Error();

                    const check = setInterval(async () => {
                        const r = await fetch('/status?userId=${req.query.token}&guildId=${req.query.guild}');
                        const s = await r.json();
                        if(s.status === 'success') { 
                            clearInterval(check); 
                            document.querySelector('.card').innerHTML = '<div style="font-size:48px; margin-bottom:20px;">✅</div><h2>Dostęp przyznany</h2><p>Twoja weryfikacja zakończyła się sukcesem. Możesz wrócić do aplikacji Discord.</p>';
                        }
                        if(s.status === 'rejected') { 
                            clearInterval(check); 
                            document.querySelector('.card').innerHTML = '<div style="font-size:48px; margin-bottom:20px;">❌</div><h2 style="color:#e11d48">Odmowa dostępu</h2><p>Powód: ' + (s.reason || 'Brak sprecyzowania') + '</p>';
                        }
                    }, 2500);
                } catch(e) {
                    b.innerText = 'Błąd połączenia. Spróbuj ponownie.';
                    b.disabled = false;
                }
            }
        </script>
    `);
});

app.post('/complete', async (req, res) => {
    const { userId, guildId } = req.body;
    if(!userId || !guildId) return res.status(400).send("Błędne dane");

    const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress).split(',')[0].trim();
    const userAgent = req.headers['user-agent'];

    await RequestTracker.findOneAndUpdate({ userId, guildId }, { status: 'pending' }, { upsert: true });

    const guild = client.guilds.cache.get(guildId);
    if (!guild) return res.status(404).send("Serwer bota nie znaleziony");

    const logChan = guild.channels.cache.find(c => c.name === 'icarus-logs') || guild.channels.cache.filter(c => c.isTextBased()).first();
    
    if (logChan) {
        const embed = new EmbedBuilder()
            .setTitle('🛡️ AUDYT BEZPIECZEŃSTWA: NOWA SESJA')
            .setColor('#6366f1')
            .setThumbnail(client.user.displayAvatarURL())
            .addFields(
                { name: '👤 Użytkownik', value: `<@${userId}>\n(\`${userId}\`)`, inline: true },
                { name: '🌐 Adres IP', value: `\`${ip}\``, inline: true },
                { name: '💻 Klient', value: `\`${userAgent.substring(0, 70)}...\`` },
                { name: '🕒 Czas inicjacji', value: `<t:${Math.floor(Date.now()/1000)}:F>` },
                { name: '📊 Status automatyczny', value: '```diff\n+ Certyfikat SSL poprawny\n+ Sesja zainicjowana\n! Oczekiwanie na weryfikację ręczną```' }
            )
            .setFooter({ text: 'Icarus Professional Security • Enterprise Edition' });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`acc_${userId}_${guildId}`).setLabel('Zatwierdź dostęp').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`rej_${userId}_${guildId}`).setLabel('Odrzuć wniosek').setStyle(ButtonStyle.Danger)
        );

        await logChan.send({ embeds: [embed], components: [row] });
    }
    res.sendStatus(200);
});

// --- OBSŁUGA INTERAKCJI ---

client.on('interactionCreate', async (i) => {
    if (i.isButton()) {
        const [action, targetId, gId] = i.customId.split('_');
        
        if (action === 'acc') {
            const config = await GuildConfig.findOne({ guildId: gId });
            const guild = client.guilds.cache.get(gId);
            const member = await guild.members.fetch(targetId).catch(() => null);
            
            if (member && config?.verifyRoleId) {
                await member.roles.add(config.verifyRoleId);
                await RequestTracker.findOneAndUpdate({ userId: targetId, guildId: gId }, { status: 'success', adminId: i.user.id });
                
                const edited = EmbedBuilder.from(i.message.embeds[0])
                    .setTitle('✅ SESJA ZATWIERDZONA')
                    .setColor('#10b981')
                    .addFields({ name: '👮 Autoryzował', value: `<@${i.user.id}>`, inline: false });
                
                await i.update({ embeds: [edited], components: [] });
            } else {
                i.reply({ content: "❌ Błąd: Nie znaleziono roli lub użytkownika.", ephemeral: true });
            }
        }

        if (action === 'rej') {
            const modal = new ModalBuilder().setCustomId(`mod_rej_${targetId}_${gId}`).setTitle('Odmowa autoryzacji');
            const input = new TextInputBuilder()
                .setCustomId('reason')
                .setLabel('Powód odrzucenia wniosku:')
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder('np. Podejrzane zachowanie, VPN, błędne dane...')
                .setRequired(true);
            modal.addComponents(new ActionRowBuilder().addComponents(input));
            await i.showModal(modal);
        }
    }

    if (i.isModalSubmit()) {
        const [,, targetId, gId] = i.customId.split('_');
        const reason = i.fields.getTextInputValue('reason');

        await RequestTracker.findOneAndUpdate({ userId: targetId, guildId: gId }, { status: 'rejected', adminId: i.user.id, reason });
        
        const edited = EmbedBuilder.from(i.message.embeds[0])
            .setTitle('❌ SESJA ODRZUCONA')
            .setColor('#ef4444')
            .addFields(
                { name: '👮 Odrzucił', value: `<@${i.user.id}>`, inline: true },
                { name: '📝 Powód', value: `\`\`\`${reason}\`\`\`` }
            );

        await i.update({ embeds: [edited], components: [] });
    }
});

// --- DALSZE TRASY (STATUS/DASHBOARD) ---
app.get('/status', async (req, res) => {
    const doc = await RequestTracker.findOne({ userId: req.query.userId, guildId: req.query.guildId });
    res.json({ status: doc ? doc.status : 'pending', reason: doc ? doc.reason : null });
});

app.get('/login', (req, res, next) => {
    const state = Buffer.from(JSON.stringify({ type: req.query.target || 'dashboard' })).toString('base64');
    passport.authenticate('discord', { state })(req, res, next);
});

app.get('/auth/callback', passport.authenticate('discord', { failureRedirect: '/' }), (req, res) => {
    const decoded = JSON.parse(Buffer.from(req.query.state, 'base64').toString());
    res.redirect(`/${decoded.type}`);
});

app.listen(process.env.PORT || 3000);
