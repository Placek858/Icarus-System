const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const express = require('express');
const axios = require('axios');
const mongoose = require('mongoose');

// --- KONFIGURACJA ---
const BOT_TOKEN = process.env.DISCORD_TOKEN; 
const MONGO_URI = process.env.MONGO_URI; 
const PROXYCHECK_API_KEY = 'e2brv7-y9y366-243469-435457';
const ALL_ADMINS = ['1131510639769178132', '1276586330847051780', '1210653947061080175'];
const DOMAIN = process.env.DOMAIN || 'https://icarus-system.pl';
const VERIFIED_ROLE_NAME = 'Zweryfikowany'; // Nazwa roli, którą bot nada na serwerach

mongoose.connect(MONGO_URI).then(() => console.log("✅ ICARUS SYSTEM: Uplink Established"));

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
            <title>ICARUS SECURITY | Terminal</title>
            <script src="https://cdn.jsdelivr.net/particles.js/2.0.0/particles.min.js"></script>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700&family=Share+Tech+Mono&display=swap');
                :root { --main-color: #00f2ff; --bg-dark: #050508; }
                * { box-sizing: border-box; cursor: crosshair; }
                body { margin: 0; padding: 0; font-family: 'Share Tech Mono', monospace; background: var(--bg-dark); overflow: hidden; height: 100vh; display: flex; justify-content: center; align-items: center; color: #fff; }
                .grid-bg { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-image: linear-gradient(rgba(0, 242, 255, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 242, 255, 0.05) 1px, transparent 1px); background-size: 30px 30px; z-index: 0; }
                #particles-js { position: absolute; width: 100%; height: 100%; z-index: 1; }
                .main-frame { position: relative; z-index: 10; width: 95%; max-width: 500px; background: rgba(10, 12, 18, 0.95); border: 1px solid var(--main-color); border-radius: 4px; padding: 40px; box-shadow: 0 0 30px rgba(0, 242, 255, 0.2); backdrop-filter: blur(10px); text-align: center; }
                .corner { position: absolute; width: 20px; height: 20px; border: 2px solid var(--main-color); }
                .top-l { top: -2px; left: -2px; border-right: none; border-bottom: none; }
                .top-r { top: -2px; right: -2px; border-left: none; border-bottom: none; }
                .bot-l { bottom: -2px; left: -2px; border-right: none; border-top: none; }
                .bot-r { bottom: -2px; right: -2px; border-left: none; border-top: none; }
                h1 { font-family: 'Orbitron', sans-serif; letter-spacing: 4px; color: var(--main-color); text-transform: uppercase; margin: 0; font-size: 22px; text-shadow: 0 0 10px var(--main-color); }
                .sub-header { color: #555; font-size: 11px; margin-bottom: 30px; letter-spacing: 2px; }
                .id-box { width: 120px; height: 120px; margin: 0 auto 20px; border: 1px solid #333; position: relative; background: rgba(255,255,255,0.02); display: flex; align-items: center; justify-content: center; }
                .id-box::after { content: ""; position: absolute; top: 0; left: 0; width: 100%; height: 2px; background: var(--main-color); box-shadow: 0 0 15px var(--main-color); animation: scan 2s infinite ease-in-out; }
                .action-btn { background: transparent; border: 1px solid var(--main-color); padding: 15px; color: var(--main-color); font-family: 'Orbitron'; font-size: 13px; width: 100%; transition: 0.3s; letter-spacing: 2px; }
                .action-btn:hover { background: var(--main-color); color: #000; box-shadow: 0 0 20px var(--main-color); }
                #console { background: rgba(0,0,0,0.8); height: 100px; margin-top: 25px; padding: 10px; overflow-y: hidden; text-align: left; font-size: 10px; color: #00f2ff; opacity: 0.7; border: 1px solid #111; }
                @keyframes scan { 0% { top: 0% } 50% { top: 100% } 100% { top: 0% } }
            </style>
        </head>
        <body>
            <div class="grid-bg"></div>
            <div id="particles-js"></div>
            <div class="main-frame">
                <div class="corner top-l"></div><div class="corner top-r"></div>
                <div class="corner bot-l"></div><div class="corner bot-r"></div>
                <h1>ICARUS SYSTEM</h1>
                <div class="sub-header">NETWORK SECURITY PROTOCOL V5.0</div>
                <div class="id-box">
                   <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="#00f2ff" stroke-width="0.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                </div>
                <div id="status-area"><button class="action-btn" id="startBtn">AUTORYZACJA SPRZĘTOWA</button></div>
                <div id="console">> SYSTEM_READY: Czekam na inicjalizację...</div>
            </div>
            <script>
                particlesJS('particles-js', {"particles":{"number":{"value":40},"color":{"value":"#00f2ff"},"opacity":{"value":0.2},"size":{"value":1},"line_linked":{"enable":true,"distance":150,"color":"#00f2ff","opacity":0.1}}});
                const userId = "${userId}";
                const con = document.getElementById('console');
                function log(t) { con.innerHTML += "<br>> " + t; con.scrollTop = con.scrollHeight; }

                async function check() {
                    const r = await fetch('/status?userId=' + userId);
                    const s = await r.json();
                    if(s.status === 'allowed_manually' || s.status === 'success') {
                        document.querySelector('.main-frame').innerHTML = '<h1 style="color:#00f2ff">ACCESS GRANTED</h1><p>Profil zweryfikowany. Możesz wrócić na Discord.</p>';
                    } else if(s.status === 'rejected') {
                        document.querySelector('.main-frame').innerHTML = '<h1 style="color:#ff4444">ACCESS DENIED</h1><p>Powód: '+s.reason+'</p>';
                    }
                }

                document.getElementById('startBtn').onclick = async () => {
                    document.getElementById('startBtn').innerText = "SKANOWANIE...";
                    log("POBIERANIE FINGERPRINT...");
                    const fp = btoa(screen.width+"x"+screen.height+"|"+Intl.DateTimeFormat().resolvedOptions().timeZone);
                    setTimeout(async () => {
                        const res = await fetch('/complete', {
                            method: 'POST',
                            headers: {'Content-Type': 'application/json'},
                            body: JSON.stringify({ userId, fp })
                        });
                        const d = await res.json();
                        if(d.action === 'success') {
                            log("STATUS: ZWERYFIKOWANO.");
                            document.querySelector('.main-frame').innerHTML = '<h1 style="color:#00f2ff">SYSTEM ACTIVE</h1><p>Witaj w sieci Icarus.</p>';
                        } else if(d.action === 'wait') {
                            log("ANOMALIA: OCZEKIWANIE NA ADMINA...");
                            document.getElementById('status-area').innerHTML = '<h2 style="color:#00f2ff;font-size:14px;">PENDING...</h2>';
                            setInterval(check, 3000);
                        } else { log("BŁĄD: " + d.msg); }
                    }, 2000);
                };
            </script>
        </body>
        </html>
    `);
});

// --- FUNKCJA NADAWANIA ROLI NA WSZYSTKICH SERWERACH ---
async function assignRolesEverywhere(userId) {
    client.guilds.cache.forEach(async (guild) => {
        try {
            const role = guild.roles.cache.find(r => r.name === VERIFIED_ROLE_NAME);
            if (role) {
                const member = await guild.members.fetch(userId).catch(() => null);
                if (member) await member.roles.add(role);
            }
        } catch (err) { console.log(`Błąd roli na serwerze ${guild.name}`); }
    });
}

// --- POWITANIE ---
client.on('guildMemberAdd', async (member) => {
    try {
        const embed = new EmbedBuilder()
            .setTitle('ICARUS SYSTEM | Weryfikacja')
            .setDescription(`Witaj <@${member.id}>.\nWymagana autoryzacja do pełnego dostępu.`)
            .setColor('#00f2ff')
            .addFields({ name: '🔗 Link', value: `${DOMAIN}/auth?token=${member.id}` });
        
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setLabel('INICJUJ PROTOKÓŁ').setURL(`${DOMAIN}/auth?token=${member.id}`).setStyle(ButtonStyle.Link)
        );
        await member.send({ embeds: [embed], components: [row] });
    } catch (e) { console.log(`Blokada DM: ${member.user.tag}`); }
});

// --- ADMIN LOGS & INTERAKCJE (Uproszczone pod Multi-Server) ---
client.on('interactionCreate', async (i) => {
    if (i.isButton()) {
        const [action, targetId] = i.customId.split('_');
        if (action === 'accept') {
            await RequestTracker.findOneAndUpdate({ userId: targetId }, { status: 'allowed_manually' });
            await assignRolesEverywhere(targetId);
            await updateAdminLogs(targetId, i.user, 'accept');
            await i.reply({ content: 'Dopuszczono użytkownika.', ephemeral: true });
        }
        if (action === 'reject') {
            const modal = new ModalBuilder().setCustomId(`mod_${targetId}`).setTitle('Odrzucenie');
            modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('r').setLabel('Powód').setStyle(TextInputStyle.Paragraph).setRequired(true)));
            await i.showModal(modal);
        }
    }
    if (i.isModalSubmit() && i.customId.startsWith('mod_')) {
        const targetId = i.customId.split('_')[1];
        const reason = i.fields.getTextInputValue('r');
        await RequestTracker.findOneAndUpdate({ userId: targetId }, { status: 'rejected', reason });
        await updateAdminLogs(targetId, i.user, 'reject', reason);
        await i.reply({ content: 'Odrzucono.', ephemeral: true });
    }
});

// --- ADMIN LOGS SEND/UPDATE (Analogicznie jak w Twoim kodzie) ---
async function sendAdminLogs(targetId, ip, country, operator, type, isAuto = false) {
    const embed = new EmbedBuilder()
        .setTitle(isAuto ? `✅ AUTO-PASS` : `⚠️ MANUAL REVIEW`)
        .setColor(isAuto ? '#00f2ff' : '#faa61a')
        .addFields({ name: '👤 Podmiot', value: `<@${targetId}>`, inline: true }, { name: '🌍 Kraj', value: country, inline: true }, { name: '🔍 Szczegóły', value: type, inline: false })
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

// --- SERWER API ---
app.get('/status', async (req, res) => {
    const doc = await RequestTracker.findOne({ userId: req.query.userId });
    res.json({ status: doc ? doc.status : 'pending', reason: doc ? doc.reason : '' });
});

app.post('/complete', async (req, res) => {
    const { userId, fp } = req.body;
    const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress).split(',')[0].trim();
    try {
        const devDup = await UserIP.findOne({ fingerprint: fp, userId: { $ne: userId } });
        if (devDup) return res.json({ action: 'error', msg: 'Urządzenie powiązane z innym kontem.' });

        const { data } = await axios.get(`https://proxycheck.io/v2/${ip}?key=${PROXYCHECK_API_KEY}&vpn=3&asn=1`);
        const country = data[ip].isocode || '??';
        const operator = data[ip].asn || 'Nieznany';
        const ipDup = await UserIP.findOne({ ip, userId: { $ne: userId } });

        if (country !== 'PL' || data[ip].proxy === 'yes' || ipDup) {
            await RequestTracker.findOneAndUpdate({ userId }, { status: 'pending' }, { upsert: true });
            await sendAdminLogs(userId, ip, country, operator, ipDup ? "Conflict: Same IP" : "VPN/Country Alert", false);
            return res.json({ action: 'wait' });
        }

        await new UserIP({ userId, ip, fingerprint: fp, country }).save();
        await assignRolesEverywhere(userId);
        await sendAdminLogs(userId, ip, country, operator, "AUTO_PASS", true);
        res.json({ action: 'success' });
    } catch (e) { res.json({ action: 'error', msg: 'System Error.' }); }
});

client.once('ready', () => console.log(`🤖 Bot online: ${client.user.tag}`));
client.login(BOT_TOKEN);
app.listen(process.env.PORT || 3000);
