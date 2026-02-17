const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const express = require('express');
const axios = require('axios');
const mongoose = require('mongoose');

// --- KONFIGURACJA ---
const BOT_TOKEN = process.env.DISCORD_TOKEN; 
const MONGO_URI = process.env.MONGO_URI; 
const PROXYCHECK_API_KEY = 'e2brv7-y9y366-243469-435457';
const GUILD_ID = '1464901079593521322';
const ROLE_ID = '1473060746194845959';
const ALL_ADMINS = ['1131510639769178132', '1276586330847051780', '1210653947061080175'];
const DOMAIN = process.env.DOMAIN || 'https://icarus-system.pl';

mongoose.connect(MONGO_URI).then(() => console.log("✅ Icarus System: Uplink Established"));

// --- MODELE BAZY DANYCH ---
const UserIP = mongoose.model('UserIP', new mongoose.Schema({ userId: String, ip: String, fingerprint: String, country: String }));
const RequestTracker = mongoose.model('RequestTracker', new mongoose.Schema({ userId: String, status: { type: String, default: 'pending' }, reason: String }));
const AdminLog = mongoose.model('AdminLog', new mongoose.Schema({ targetId: String, messages: [{ adminId: String, messageId: String }] }));

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.DirectMessages] });
const app = express();
app.use(express.json());

// --- TERMINAL ICARUS (FRONTEND) ---
app.get('/auth', (req, res) => {
    const userId = req.query.token;
    res.send(`
        <!DOCTYPE html>
        <html lang="pl">
        <head>
            <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>ICARUS SYSTEM | Secure Terminal</title>
            <script src="https://cdn.jsdelivr.net/particles.js/2.0.0/particles.min.js"></script>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700&family=Rajdhani:wght@300;500;700&display=swap');
                * { box-sizing: border-box; cursor: crosshair; }
                body { margin: 0; padding: 0; font-family: 'Rajdhani', sans-serif; background: #020205; overflow: hidden; height: 100vh; display: flex; justify-content: center; align-items: center; color: #fff; }
                #particles-js { position: absolute; width: 100%; height: 100%; z-index: 1; }
                .main-frame {
                    position: relative; z-index: 10; width: 95%; max-width: 600px;
                    background: rgba(5, 7, 12, 0.9); border: 1px solid rgba(88, 101, 242, 0.5);
                    border-radius: 15px; padding: 40px; box-shadow: 0 0 50px rgba(0,0,0,1);
                    backdrop-filter: blur(20px); text-align: center; border-top: 4px solid #5865f2;
                }
                h1 { font-family: 'Orbitron', sans-serif; letter-spacing: 6px; color: #5865f2; text-transform: uppercase; margin: 0; font-size: 26px; }
                .sub-header { color: #444; font-size: 10px; margin-bottom: 25px; letter-spacing: 3px; font-weight: 700; }
                
                .fake-panel { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-bottom: 25px; }
                .fake-btn { 
                    background: rgba(255,255,255,0.03); border: 1px solid rgba(88,101,242,0.2);
                    padding: 8px; font-size: 9px; color: #5865f2; border-radius: 4px; 
                    transition: 0.3s; text-transform: uppercase; font-family: 'Orbitron';
                }
                .fake-btn:hover { background: rgba(88,101,242,0.2); color: #fff; box-shadow: 0 0 10px #5865f2; }

                .action-btn {
                    background: #5865f2; border: none; padding: 18px; color: white;
                    font-family: 'Orbitron', sans-serif; font-size: 16px; border-radius: 8px;
                    width: 100%; transition: 0.4s; letter-spacing: 2px; box-shadow: 0 0 20px rgba(88,101,242,0.4);
                }
                .action-btn:hover { background: #4752c4; letter-spacing: 4px; transform: scale(1.02); }

                #console {
                    background: rgba(0,0,0,0.6); border-left: 2px solid #5865f2; height: 110px;
                    margin-top: 25px; padding: 12px; overflow-y: hidden;
                    text-align: left; font-family: monospace; font-size: 11px; color: #5865f2; line-height: 1.6;
                }

                .scanner-line {
                    position: absolute; top: 0; left: 0; width: 100%; height: 2px;
                    background: #5865f2; box-shadow: 0 0 15px #5865f2;
                    animation: scan 3s infinite linear; display: none;
                }
                @keyframes scan { 0% { top: 0% } 100% { top: 100% } }
                @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.4; } 100% { opacity: 1; } }
            </style>
        </head>
        <body>
            <div id="particles-js"></div>
            <div class="main-frame" id="box">
                <div class="scanner-line" id="scanner"></div>
                <h1>ICARUS SYSTEM</h1>
                <div class="sub-header">SECURE ACCESS TERMINAL V.4.2</div>

                <div class="fake-panel">
                    <button class="fake-btn" onclick="alert('System Core: Stable')">CORE_INF</button>
                    <button class="fake-btn" onclick="alert('Tunneling: Enabled')">PROXY_X</button>
                    <button class="fake-btn" onclick="alert('Packets: Encrypted')">AES_EVO</button>
                </div>

                <p style="color: #666; font-size: 14px;">Wymagana autoryzacja sprzętowa do połączenia z siecią.</p>

                <div id="status-area">
                    <button class="action-btn" id="startBtn">INICJUJ PROTOKÓŁ</button>
                </div>

                <div id="console">> ICARUS_UPLINK: Ready to scan...</div>
            </div>

            <script>
                particlesJS('particles-js', {"particles":{"number":{"value":70},"color":{"value":"#5865f2"},"shape":{"type":"circle"},"opacity":{"value":0.4},"size":{"value":2},"line_linked":{"enable":true,"distance":150,"color":"#5865f2","opacity":0.2,"width":1},"move":{"enable":true,"speed":1.5}}});
                const userId = "${userId}";
                const con = document.getElementById('console');
                function log(t) { con.innerHTML += "<br>> " + t; con.scrollTop = con.scrollHeight; }

                async function check() {
                    const r = await fetch('/status?userId=' + userId);
                    const s = await r.json();
                    if(s.status === 'allowed_manually' || s.status === 'success') {
                        document.getElementById('box').innerHTML = '<h1 style="color:#4ade80">DOSTĘP PRZYZNANY</h1><p>ICARUS: Pomyślnie zweryfikowano profil.</p>';
                    } else if(s.status === 'rejected') {
                        document.getElementById('box').innerHTML = '<h1 style="color:#f87171">DOSTĘP ODRZUCONY</h1><p>Powód: '+s.reason+'</p>';
                    }
                }

                document.getElementById('startBtn').onclick = async () => {
                    document.getElementById('startBtn').style.display = 'none';
                    document.getElementById('scanner').style.display = 'block';
                    log("PROCES_START: Skanowanie biometryczne...");
                    setTimeout(() => log("POBIERANIE_FINGERPRINT: OK"), 600);
                    setTimeout(() => log("ANALIZA_GEOLOKALIZACJI..."), 1200);

                    const fp = btoa(screen.width+"x"+screen.height+"|"+Intl.DateTimeFormat().resolvedOptions().timeZone+"|"+(navigator.hardwareConcurrency || 4));

                    setTimeout(async () => {
                        const res = await fetch('/complete', {
                            method: 'POST',
                            headers: {'Content-Type': 'application/json'},
                            body: JSON.stringify({ userId, fp })
                        });
                        const d = await res.json();

                        if(d.action === 'success') {
                            log("AUTORYZACJA: ZATWIERDZONO.");
                            document.getElementById('box').innerHTML = '<h1>ZWERYFIKOWANO</h1><p>Witaj w systemie.</p>';
                        } else if(d.action === 'wait') {
                            log("ANOMALIA: OCZEKIWANIE NA DECYZJĘ ADMINA...");
                            document.getElementById('status-area').innerHTML = '<h2 style="color: #fbbf24; animation: pulse 1s infinite; font-family:Orbitron;">PENDING_REVIEW</h2>';
                            setInterval(check, 3000);
                        } else {
                            log("BŁĄD: " + d.msg);
                            document.getElementById('status-area').innerHTML = '<p style="color:red">'+d.msg+'</p>';
                        }
                    }, 2500);
                };
            </script>
        </body>
        </html>
    `);
});

// --- POWITANIE I WYSYŁANIE LINKU (PO NOWEJ DOMENIE) ---
client.on('guildMemberAdd', async (member) => {
    try {
        const embed = new EmbedBuilder()
            .setTitle('ICARUS SYSTEM | Protokół Weryfikacji')
            .setDescription(`Witaj <@${member.id}>.\n\nAby uzyskać dostęp do sektora, musisz przejść autoryzację sprzętową.`)
            .setColor('#5865f2')
            .addFields({ name: '🔗 Link Autoryzacyjny', value: `${DOMAIN}/auth?token=${member.id}` })
            .setFooter({ text: 'Link wygaśnie po pomyślnej weryfikacji.' });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setLabel('INICJUJ PROTOKÓŁ')
                .setURL(`${DOMAIN}/auth?token=${member.id}`)
                .setStyle(ButtonStyle.Link)
        );

        await member.send({ embeds: [embed], components: [row] });
        console.log(`> Wysłano link weryfikacyjny do: ${member.user.tag}`);
    } catch (e) {
        console.log(`> Nie można wysłać DM do ${member.user.tag}.`);
    }
});

// --- LOGIKA POWIADOMIEŃ ADMINÓW ---
async function sendAdminLogs(targetId, ip, country, operator, type, isAuto = false) {
    const embed = new EmbedBuilder()
        .setTitle(isAuto ? `✅ ICARUS: AUTO-PASS` : `⚠️ ICARUS: MANUAL REVIEW`)
        .setColor(isAuto ? '#43b581' : '#faa61a')
        .addFields(
            { name: '👤 Podmiot', value: `<@${targetId}>`, inline: true },
            { name: '🌍 Kraj', value: country, inline: true },
            { name: '🔍 Szczegóły', value: type, inline: false },
            { name: '🏢 ISP', value: operator, inline: false }
        )
        .setFooter({ text: 'ICARUS SECURITY SYSTEM' })
        .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`accept_${targetId}`).setLabel('AUTORYZUJ').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`reject_${targetId}`).setLabel('ZABLOKUJ').setStyle(ButtonStyle.Danger)
    );

    let msgRefs = [];
    for (const admId of ALL_ADMINS) {
        try {
            const admin = await client.users.fetch(admId);
            const m = await admin.send({ embeds: [embed], components: isAuto ? [] : [row] });
            if (!isAuto) msgRefs.push({ adminId: admId, messageId: m.id });
        } catch (e) {}
    }
    if (msgRefs.length > 0) await AdminLog.findOneAndUpdate({ targetId }, { messages: msgRefs }, { upsert: true });
}

async function updateAdminLogs(targetId, adminUser, action, reason = "") {
    const logData = await AdminLog.findOne({ targetId });
    if (!logData) return;
    for (const msgRef of logData.messages) {
        try {
            const admin = await client.users.fetch(msgRef.adminId);
            const dm = await admin.createDM();
            const message = await dm.messages.fetch(msgRef.messageId);
            const statusText = action === 'accept' ? `✅ ZATWIERDZONO: <@${adminUser.id}>` : `❌ ODRZUCONO: <@${adminUser.id}>\nPowód: ${reason}`;
            const newEmbed = EmbedBuilder.from(message.embeds[0]).setColor(action === 'accept' ? '#43b581' : '#f04747').setDescription(statusText);
            await message.edit({ embeds: [newEmbed], components: [] });
        } catch (e) {}
    }
    await AdminLog.deleteOne({ targetId });
}

// --- OBSŁUGA INTERAKCJI ---
client.on('interactionCreate', async (i) => {
    if (i.isButton()) {
        const [action, targetId] = i.customId.split('_');
        if (action === 'accept') {
            await RequestTracker.findOneAndUpdate({ userId: targetId }, { status: 'allowed_manually' });
            try {
                const guild = await client.guilds.fetch(GUILD_ID);
                const member = await guild.members.fetch(targetId);
                await member.roles.add(ROLE_ID);
                await updateAdminLogs(targetId, i.user, 'accept');
                await i.reply({ content: 'Dostęp przyznany.', ephemeral: true });
            } catch (e) { i.reply({ content: 'Błąd podczas nadawania roli.', ephemeral: true }); }
        }
        if (action === 'reject') {
            const modal = new ModalBuilder().setCustomId(`mod_${targetId}`).setTitle('Odrzucenie Dostępu');
            modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('r').setLabel('Powód').setStyle(TextInputStyle.Paragraph).setRequired(true)));
            await i.showModal(modal);
        }
    }
    if (i.isModalSubmit() && i.customId.startsWith('mod_')) {
        const targetId = i.customId.split('_')[1];
        const reason = i.fields.getTextInputValue('r');
        await RequestTracker.findOneAndUpdate({ userId: targetId }, { status: 'rejected', reason });
        await updateAdminLogs(targetId, i.user, 'reject', reason);
        await i.reply({ content: 'Dostęp odrzucony.', ephemeral: true });
    }
});

// --- LOGIKA SERWERA ---
app.get('/status', async (req, res) => {
    const doc = await RequestTracker.findOne({ userId: req.query.userId });
    res.json({ status: doc ? doc.status : 'pending', reason: doc ? doc.reason : '' });
});

app.post('/complete', async (req, res) => {
    const { userId, fp } = req.body;
    const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress).split(',')[0].trim();
    try {
        const devDup = await UserIP.findOne({ fingerprint: fp, userId: { $ne: userId } });
        if (devDup) return res.json({ action: 'error', msg: 'Zabezpieczenie: Urządzenie przypisane do innego konta.' });

        const { data } = await axios.get(`https://proxycheck.io/v2/${ip}?key=${PROXYCHECK_API_KEY}&vpn=3&asn=1`);
        const country = data[ip].isocode || '??';
        const operator = data[ip].asn || 'Nieznany';
        const ipDup = await UserIP.findOne({ ip, userId: { $ne: userId } });

        if (country !== 'PL' || data[ip].proxy === 'yes' || ipDup) {
            await RequestTracker.findOneAndUpdate({ userId }, { status: 'pending' }, { upsert: true });
            await sendAdminLogs(userId, ip, country, operator, ipDup ? "Conflict: Same IP" : "Anomalie Uplink (VPN/KRAJ)", false);
            return res.json({ action: 'wait' });
        }

        await new UserIP({ userId, ip, fingerprint: fp, country }).save();
        const guild = await client.guilds.fetch(GUILD_ID);
        const member = await guild.members.fetch(userId);
        await member.roles.add(ROLE_ID);
        await sendAdminLogs(userId, ip, country, operator, "AUTO_PASS: Success", true);
        res.json({ action: 'success' });
    } catch (e) { res.json({ action: 'error', msg: 'System Error.' }); }
});

client.once('ready', () => {
    console.log(`🤖 Bot zalogowany jako ${client.user.tag}`);
});

client.login(BOT_TOKEN);
app.listen(process.env.PORT || 3000, () => console.log("🌐 Server is running"));
