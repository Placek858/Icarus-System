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
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
                :root {
                    --bg-color: #23272a;
                    --card-bg: #2c2f33;
                    --discord-blurple: #5865f2;
                    --success: #43b581;
                    --warning: #faa61a;
                    --danger: #f04747;
                    --text: #ffffff;
                }

                body { 
                    background-color: var(--bg-color); 
                    color: var(--text); 
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    height: 100vh;
                    margin: 0;
                    overflow: hidden;
                }

                .box { 
                    background: var(--card-bg); 
                    padding: 50px; 
                    border-radius: 16px; 
                    box-shadow: 0 10px 30px rgba(0,0,0,0.6); 
                    max-width: 450px;
                    width: 90%;
                    text-align: center;
                    border: 1px solid rgba(255,255,255,0.05);
                    transition: all 0.3s ease;
                }

                h2 { margin-bottom: 10px; font-size: 28px; }
                p { color: #b9bbbe; margin-bottom: 30px; line-height: 1.5; }

                button { 
                    background: var(--discord-blurple); 
                    color: white; 
                    padding: 16px 40px; 
                    border: none; 
                    border-radius: 8px; 
                    cursor: pointer; 
                    font-weight: bold; 
                    font-size: 18px;
                    width: 100%;
                    transition: transform 0.2s, background 0.2s;
                    box-shadow: 0 4px 15px rgba(88, 101, 242, 0.3);
                }

                button:hover { 
                    background: #4752c4; 
                    transform: translateY(-2px);
                }

                button:active { transform: translateY(0); }

                /* Animacja ładowania */
                .spinner {
                    width: 50px;
                    height: 50px;
                    border: 5px solid rgba(255,255,255,0.1);
                    border-top: 5px solid var(--discord-blurple);
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                    margin: 20px auto;
                }

                @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

                .status-icon { font-size: 60px; margin-bottom: 20px; }
            </style>
        </head>
        <body>
            <div class="box">
                <div id="content">
                    <div class="status-icon">🛡️</div>
                    <h2>Weryfikacja</h2>
                    <p>Aby uzyskać dostęp do serwera, kliknij przycisk poniżej. Sprawdzimy czy nie używasz VPN.</p>
                    <button id="vBtn">ZWERYFIKUJ MNIE</button>
                </div>
            </div>

            <script>
                const content = document.getElementById('content');
                document.getElementById('vBtn').onclick = async () => {
                    content.innerHTML = '<div class="spinner"></div><h3>Analizowanie połączenia...</h3>';
                    
                    const r = await fetch('/complete', { 
                        method: 'POST', 
                        headers: {'Content-Type': 'application/x-www-form-urlencoded'},
                        body: 'userId=${userId}' 
                    });
                    const d = await r.json();

                    if (d.action === 'wait') {
                        content.innerHTML = \`
                            <div class="status-icon">⏳</div>
                            <h3 style="color:var(--warning)">Oczekiwanie na decyzję...</h3>
                            <p>Twoje IP wymaga ręcznej akceptacji administratora. Proszę nie zamykać tej karty.</p>
                        \`;
                        startPolling('${userId}');
                    } else if (d.action === 'success') {
                        showSuccess();
                    } else {
                        content.innerHTML = \`
                            <div class="status-icon">❌</div>
                            <h3 style="color:var(--danger)">Weryfikacja przerwana</h3>
                            <p>\${d.msg}</p>
                            <button onclick="location.reload()">Spróbuj ponownie</button>
                        \`;
                    }
                };

                function showSuccess() {
                    content.innerHTML = \`
                        <div class="status-icon">✅</div>
                        <h2 style="color:var(--success)">Sukces!</h2>
                        <p>Zostałeś pomyślnie zweryfikowany. Możesz już wrócić na Discorda!</p>
                    \`;
                }

                function startPolling(uid) {
                    const timer = setInterval(async () => {
                        try {
                            const check = await fetch('/status?userId=' + uid);
                            const s = await check.json();
                            if (s.status === 'allowed') {
                                clearInterval(timer);
                                showSuccess();
                            } else if (s.status === 'banned') {
                                clearInterval(timer);
                                content.innerHTML = \`
                                    <div class="status-icon">🚫</div>
                                    <h3 style="color:var(--danger)">Dostęp odrzucony</h3>
                                    <p>Administrator nie zaakceptował Twojego zgłoszenia.</p>
                                \`;
                            }
                        } catch (e) {}
                    }, 2500);
                }
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
