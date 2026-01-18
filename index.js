const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const express = require('express');
const axios = require('axios');
const mongoose = require('mongoose');

// --- KONFIGURACJA ---
const BOT_TOKEN = process.env.DISCORD_TOKEN; 
const MONGO_URI = process.env.MONGO_URI; 
const PROXYCHECK_API_KEY = 'e2brv7-y9y366-243469-435457';
const GUILD_ID = '1456335080116191436';
const ROLE_ID = '1461789323262296084';
const MY_ID = '1131510639769178132'; 
const ALL_ADMINS = [MY_ID, '1131510639769178132'];

mongoose.connect(MONGO_URI).then(() => console.log("✅ Połączono z MongoDB Atlas"));

const UserIP = mongoose.model('UserIP', new mongoose.Schema({ userId: String, ip: String, country: String, operator: String }));
const PanelTracker = mongoose.model('PanelTracker', new mongoose.Schema({ targetId: String, adminMessages: [{ adminId: String, messageId: String }] }));
const RequestTracker = mongoose.model('RequestTracker', new mongoose.Schema({ userId: String, status: { type: String, default: 'pending' } }));

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });
const app = express();
app.use(express.urlencoded({ extended: true }));

// --- LOGI DLA ADMINÓW ---
async function sendAdminLogs(targetId, ip, country, operator, type, adminTag = null) {
    const myLog = new EmbedBuilder()
        .setColor(type.includes('RĘCZNA') ? '#43b581' : '#5865f2')
        .setTitle(`📢 LOG WERYFIKACJI: ${type}`)
        .setDescription(`**Użytkownik:** <@${targetId}>\n**Kraj:** ${country}\n**Operator:** \`${operator}\`\n**IP:** \`${ip}\`${adminTag ? `\n**Admin:** ${adminTag}` : ''}`)
        .setTimestamp();

    const adminLog = new EmbedBuilder()
        .setColor(type.includes('RĘCZNA') ? '#43b581' : '#5865f2')
        .setTitle(`📢 LOG WERYFIKACJI: ${type}`)
        .setDescription(`**Użytkownik:** <@${targetId}>\n**Kraj:** ${country}\n**Operator:** \`UKRYTE\`\n**IP:** \`UKRYTE\`${adminTag ? `\n**Admin:** ${adminTag}` : ''}`)
        .setTimestamp();

    for (const id of ALL_ADMINS) {
        try {
            const admin = await client.users.fetch(id);
            await admin.send({ embeds: [(id === MY_ID) ? myLog : adminLog] });
        } catch (e) {}
    }
}

async function updateLiveStatus(targetId, newStatus, actionText) {
    await RequestTracker.findOneAndUpdate({ userId: targetId }, { status: newStatus }, { upsert: true });
    const panel = await PanelTracker.findOne({ targetId });
    if (!panel) return;
    for (const entry of panel.adminMessages) {
        try {
            const admin = await client.users.fetch(entry.adminId);
            const msg = await admin.dmChannel.messages.fetch(entry.messageId);
            await msg.edit({ content: `**ZAKOŃCZONO:** ${actionText}`, components: [] });
        } catch (e) {}
    }
    await PanelTracker.deleteOne({ targetId });
}

// --- STRONA INTERNETOWA (NOWOCZESNY DESIGN) ---
app.get('/auth', (req, res) => {
    const userId = req.query.token;
    res.send(`
        <html>
        <head>
            <meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
            <title>Weryfikacja Konta</title>
            <style>
                body { margin: 0; font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; background: #0f0f1a; color: white; }
                .card { background: #1c1c2b; padding: 40px; border-radius: 24px; box-shadow: 0 20px 50px rgba(0,0,0,0.5); text-align: center; max-width: 400px; width: 90%; border: 1px solid #2d2d44; }
                h1 { font-size: 28px; margin-bottom: 10px; }
                p { color: #a0a0b8; margin-bottom: 30px; line-height: 1.5; }
                .btn { background: #5865f2; color: white; padding: 16px 32px; border: none; border-radius: 12px; cursor: pointer; font-size: 16px; font-weight: 700; transition: all 0.3s ease; width: 100%; }
                .btn:hover { background: #4752c4; transform: translateY(-2px); box-shadow: 0 5px 15px rgba(88, 101, 242, 0.4); }
                .spinner { width: 60px; height: 60px; border: 6px solid rgba(255,255,255,0.1); border-top: 6px solid #5865f2; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 20px auto; }
                @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                .icon { font-size: 60px; margin-bottom: 20px; }
                .success-text { color: #43b581; font-weight: bold; }
                .wait-text { color: #faa61a; font-weight: bold; }
            </style>
        </head>
        <body>
            <div class="card" id="mainBox">
                <div class="icon">🛡️</div>
                <h1>Weryfikacja</h1>
                <p>Aby uzyskać dostęp do serwera Night RP, kliknij przycisk poniżej w celu weryfikacji połączenia.</p>
                <button class="btn" id="verifyBtn">ROZPOCZNIJ WERYFIKACJĘ</button>
            </div>

            <script>
                const box = document.getElementById('mainBox');
                document.getElementById('verifyBtn').onclick = async () => {
                    box.innerHTML = '<div class="spinner"></div><h1>Analiza...</h1><p>Trwa sprawdzanie bezpieczeństwa Twojego połączenia. Prosimy nie zamykać okna.</p>';
                    
                    try {
                        const r = await fetch('/complete', { 
                            method: 'POST', 
                            headers: {'Content-Type': 'application/x-www-form-urlencoded'}, 
                            body: 'userId=${userId}' 
                        });
                        const d = await r.json();

                        if (d.action === 'wait') {
                            box.innerHTML = '<div class="icon">⏳</div><h1 class="wait-text">Oczekiwanie</h1><p>Twoje połączenie wymaga ręcznej akceptacji administratora. Zostaniesz automatycznie przekierowany po decyzji.</p>';
                            const interval = setInterval(async () => {
                                const rs = await fetch('/status?userId=${userId}');
                                const s = await rs.json();
                                if (s.status === 'allowed') {
                                    clearInterval(interval);
                                    showFinalSuccess();
                                }
                            }, 3000);
                        } else if (d.action === 'success') {
                            showFinalSuccess();
                        } else {
                            box.innerHTML = '<div class="icon">❌</div><h1 style="color:#f04747">Błąd</h1><p>' + d.msg + '</p><button class="btn" onclick="location.reload()">SPRÓBUJ PONOWNIE</button>';
                        }
                    } catch(e) {
                        box.innerHTML = '<h1>Błąd połączenia</h1>';
                    }
                };

                function showFinalSuccess() {
                    box.innerHTML = '<div class="icon">✅</div><h1 class="success-text">Zweryfikowano!</h1><p>Pomyślnie przeszedłeś proces weryfikacji. Twoja ranga na Discordzie została nadana. Możesz już zamknąć to okno.</p>';
                }
            </script>
        </body>
        </html>
    `);
});

app.get('/status', async (req, res) => {
    const track = await RequestTracker.findOne({ userId: req.query.userId });
    res.json({ status: track ? track.status : 'pending' });
});

app.post('/complete', async (req, res) => {
    const userId = req.body.userId;
    const userIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const cleanIP = userIP.split(',')[0].trim();
    try {
        const response = await axios.get(`https://proxycheck.io/v2/${cleanIP}?key=${PROXYCHECK_API_KEY}&vpn=3&asn=1`);
        const result = response.data[cleanIP];
        const country = result.isocode || '??';
        const operator = result.asn || 'Nieznany';
        
        if (result.proxy === 'yes') return res.json({ action: 'error', msg: 'Używanie VPN/Proxy jest zabronione.' });

        const existingEntry = await UserIP.findOne({ ip: cleanIP });
        if (country !== 'PL' || (existingEntry && existingEntry.userId !== userId)) {
            await RequestTracker.findOneAndUpdate({ userId }, { status: 'pending' }, { upsert: true });
            const myEmbed = new EmbedBuilder().setColor('#ffaa00').setTitle('⚠️ PODEJRZANE IP (TY)').setDescription(`Użytkownik: <@${userId}>\nKraj: ${country}\nOperator: \`${operator}\`\nIP: \`${cleanIP}\``).setTimestamp();
            const adminEmbed = new EmbedBuilder().setColor('#ffaa00').setTitle('⚠️ PODEJRZANE IP').setDescription(`Użytkownik: <@${userId}>\nKraj: ${country}\nOperator: \`UKRYTE\`\nIP: \`UKRYTE\``).setTimestamp();
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`allow_${userId}_${cleanIP}_${country}_${operator.replace(/ /g, '-')}`).setLabel('Przepuść').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId(`ban_${userId}`).setLabel('Zablokuj').setStyle(ButtonStyle.Danger)
            );
            const adminMsgs = [];
            for (const id of ALL_ADMINS) {
                try {
                    const admin = await client.users.fetch(id);
                    const msg = await admin.send({ embeds: [(id === MY_ID) ? myEmbed : adminEmbed], components: [row] });
                    adminMsgs.push({ adminId: id, messageId: msg.id });
                } catch(err) {}
            }
            await new PanelTracker({ targetId: userId, adminMessages: adminMsgs }).save();
            return res.json({ action: 'wait' });
        }

        await new UserIP({ userId, ip: cleanIP, country, operator }).save();
        const guild = await client.guilds.fetch(GUILD_ID);
        const member = await guild.members.fetch(userId);
        await member.roles.add(ROLE_ID);
        await sendAdminLogs(userId, cleanIP, country, operator, "AUTOMATYCZNA");
        res.json({ action: 'success' });
    } catch (e) { res.json({ action: 'error', msg: 'Wystąpił błąd podczas analizy.' }); }
});

client.on('interactionCreate', async (int) => {
    if (!int.isButton()) return;
    const [action, targetId, ip, country, operatorRaw] = int.customId.split('_');
    const operator = operatorRaw ? operatorRaw.replace(/-/g, ' ') : 'Nieznany';
    try {
        if (action === 'allow') {
            const guild = await client.guilds.fetch(GUILD_ID);
            const member = await guild.members.fetch(targetId);
            await member.roles.add(ROLE_ID);
            await UserIP.findOneAndUpdate({ userId: targetId }, { ip, country, operator }, { upsert: true });
            await updateLiveStatus(targetId, 'allowed', `✅ Zaakceptował ${int.user.tag}`);
            await sendAdminLogs(targetId, ip, country, operator, "RĘCZNA AKCEPTACJA", int.user.tag);
            await int.reply({ content: `Użytkownik zaakceptowany.`, ephemeral: true });
        } else if (action === 'ban') {
            const guild = await client.guilds.fetch(GUILD_ID);
            await guild.members.ban(targetId, { reason: 'Odrzucona weryfikacja (Podejrzane IP)' });
            await updateLiveStatus(targetId, 'banned', `🚫 Zbanował ${int.user.tag}`);
            await int.reply({ content: `Użytkownik zbanowany.`, ephemeral: true });
        }
    } catch (e) {}
});

client.on('ready', () => console.log(`🤖 Render Bot: ${client.user.tag}`));
client.login(BOT_TOKEN);
app.listen(process.env.PORT || 3000);
