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
const ALL_ADMINS = [MY_ID, '1364295526736199883', '1447828677109878904'];

mongoose.connect(MONGO_URI).then(() => console.log("✅ Połączono z MongoDB"));

const UserIP = mongoose.model('UserIP', new mongoose.Schema({ userId: String, ip: String, country: String }));
const PanelTracker = mongoose.model('PanelTracker', new mongoose.Schema({ targetId: String, adminMessages: [{ adminId: String, messageId: String }] }));
const RequestTracker = mongoose.model('RequestTracker', new mongoose.Schema({ userId: String, status: { type: String, default: 'pending' } }));

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });
const app = express();
app.use(express.urlencoded({ extended: true }));

// --- AKTUALIZACJA STATUSU ---
async function updateLiveStatus(targetId, newStatus, actionText) {
    console.log(`Zmieniam status dla ${targetId} na: ${newStatus}`);
    await RequestTracker.findOneAndUpdate({ userId: targetId }, { status: newStatus }, { upsert: true });
    
    const panel = await PanelTracker.findOne({ targetId });
    if (!panel) return;

    for (const entry of panel.adminMessages) {
        try {
            const admin = await client.users.fetch(entry.adminId);
            const message = await admin.dmChannel.messages.fetch(entry.messageId);
            await message.edit({ content: `**ZAKOŃCZONO:** ${actionText}`, components: [] });
        } catch (e) { console.log("Nie udało się edytować wiadomości u admina."); }
    }
    await PanelTracker.deleteOne({ targetId });
}

// --- STRONA WWW ---
app.get('/auth', (req, res) => {
    const userId = req.query.token;
    res.send(`
        <html>
        <head>
            <meta charset="utf-8">
            <style>
                body { background:#2f3136; color:white; text-align:center; font-family:sans-serif; padding-top:100px; }
                .box { background:#36393f; display:inline-block; padding:40px; border-radius:10px; box-shadow: 0 4px 15px rgba(0,0,0,0.5); }
                button { background:#5865f2; color:white; padding:15px 40px; border:none; border-radius:5px; cursor:pointer; font-weight:bold; font-size:16px; }
                .loading { color: #faa61a; font-weight: bold; margin: 20px; }
            </style>
        </head>
        <body>
            <div class="box">
                <h2>🛡️ Weryfikacja Konta</h2>
                <div id="content">
                    <p>Potwierdź, że nie jesteś robotem i nie używasz VPN.</p>
                    <button id="vBtn">ROZPOCZNIJ WERYFIKACJĘ</button>
                </div>
            </div>
            <script>
                const content = document.getElementById('content');
                document.getElementById('vBtn').onclick = async () => {
                    content.innerHTML = "<div class='loading'>🔄 Sprawdzanie Twojego połączenia...</div>";
                    const r = await fetch('/complete', { 
                        method: 'POST', 
                        headers: {'Content-Type': 'application/x-www-form-urlencoded'},
                        body: 'userId=${userId}' 
                    });
                    const d = await r.json();

                    if (d.action === 'wait') {
                        content.innerHTML = "<h3 style='color:#faa61a'>⏳ Oczekiwanie na akceptację...</h3><p>Twoje IP wymaga ręcznej weryfikacji przez administratora.<br>Proszę nie zamykać tej strony.</p>";
                        // Start sprawdzania statusu
                        const timer = setInterval(async () => {
                            try {
                                const check = await fetch('/status?userId=${userId}');
                                const s = await check.json();
                                if (s.status === 'allowed') {
                                    clearInterval(timer);
                                    content.innerHTML = "<h2 style='color:#43b581'>✅ ZAAKCEPTOWANO</h2><p>Możesz już wrócić na Discorda. Rola została nadana.</p>";
                                } else if (s.status === 'banned') {
                                    clearInterval(timer);
                                    content.innerHTML = "<h2 style='color:#f04747'>❌ ODRZUCONO</h2><p>Zostałeś zablokowany przez administratora.</p>";
                                }
                            } catch (e) { console.error("Błąd statusu"); }
                        }, 2000);
                    } else if (d.action === 'success') {
                        content.innerHTML = "<h2 style='color:#43b581'>✅ ZWERYFIKOWANO</h2><p>Możesz wrócić na serwer.</p>";
                    } else {
                        content.innerHTML = "<h2 style='color:#f04747'>❌ BŁĄD</h2><p>" + d.msg + "</p>";
                    }
                };
            </script>
        </body>
        </html>
    `);
});

// --- API STATUSU ---
app.get('/status', async (req, res) => {
    const userId = req.query.userId;
    const track = await RequestTracker.findOne({ userId });
    console.log(`Zapytanie o status: User=${userId}, Status=${track ? track.status : 'brak'}`);
    res.set('Access-Control-Allow-Origin', '*'); // Pozwala na zapytania z przeglądarki
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
        
        const existingEntry = await UserIP.findOne({ ip: cleanIP });
        const isVPN = result.proxy === 'yes';
        const isForeign = country !== 'PL'; 
        const isMulticount = existingEntry && existingEntry.userId !== userId;

        if (isVPN) return res.json({ action: 'error', msg: 'VPN jest zabroniony na tym serwerze.' });

        if (isMulticount || isForeign) {
            await RequestTracker.findOneAndUpdate({ userId }, { status: 'pending' }, { upsert: true });
            
            const embed = new EmbedBuilder().setColor('#ff0000').setTitle('🛡️ PANEL WERYFIKACJI').setDescription(`Użytkownik: <@${userId}>\nKraj: **${country}**\nIP: \`${cleanIP}\``);
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`allow_${userId}_${cleanIP}_${country}`).setLabel('Przepuść').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId(`ban_${userId}`).setLabel('Zbanuj').setStyle(ButtonStyle.Danger)
            );

            const adminMsgs = [];
            for (const id of ALL_ADMINS) {
                const admin = await client.users.fetch(id);
                const msg = await admin.send({ embeds: [embed], components: [row] });
                adminMsgs.push({ adminId: id, messageId: msg.id });
            }
            await new PanelTracker({ targetId: userId, adminMessages: adminMsgs }).save();
            return res.json({ action: 'wait' });
        }

        await new UserIP({ userId, ip: cleanIP, country }).save();
        const guild = await client.guilds.fetch(GUILD_ID);
        const member = await guild.members.fetch(userId);
        await member.roles.add(ROLE_ID);
        res.json({ action: 'success' });
    } catch (e) { res.json({ action: 'error', msg: 'Błąd połączenia z serwerem.' }); }
});

client.on('interactionCreate', async (int) => {
    if (!int.isButton()) return;
    const [action, targetId, ip, country] = int.customId.split('_');
    const guild = await client.guilds.fetch(GUILD_ID);

    try {
        if (action === 'allow') {
            const member = await guild.members.fetch(targetId);
            await member.roles.add(ROLE_ID);
            if (ip) await UserIP.findOneAndUpdate({ userId: targetId }, { ip, country }, { upsert: true });
            await updateLiveStatus(targetId, 'allowed', `✅ Zaakceptowano przez **${int.user.tag}**`);
        } else {
            await guild.members.ban(targetId, { reason: 'Odrzucono weryfikację' });
            await updateLiveStatus(targetId, 'banned', `🚫 Zbanowano przez **${int.user.tag}**`);
        }
    } catch (e) { console.log("Błąd przycisku."); }
});

client.login(BOT_TOKEN);
app.listen(process.env.PORT || 3000);
