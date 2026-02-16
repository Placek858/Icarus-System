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

mongoose.connect(MONGO_URI).then(() => console.log("✅ Baza danych aktywna"));

// --- MODELE BAZY DANYCH ---
const UserIP = mongoose.model('UserIP', new mongoose.Schema({ userId: String, ip: String, fingerprint: String, country: String }));
const RequestTracker = mongoose.model('RequestTracker', new mongoose.Schema({ userId: String, status: { type: String, default: 'pending' }, reason: String }));
const AdminLog = mongoose.model('AdminLog', new mongoose.Schema({ targetId: String, messages: [{ adminId: String, messageId: String }] }));

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.DirectMessages] });
const app = express();
app.use(express.json());

// --- STRONA WERYFIKACJI (PROFESJONALNY LOOK) ---
app.get('/auth', (req, res) => {
    const userId = req.query.token;
    res.send(`
        <!DOCTYPE html>
        <html lang="pl">
        <head>
            <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Night RP | Security</title>
            <style>
                body { margin: 0; padding: 0; font-family: 'Segoe UI', sans-serif; background: #0d0d12 url('https://discord.com/assets/652f404f275e28ef9a35.png') no-repeat center center fixed; background-size: cover; display: flex; justify-content: center; align-items: center; min-height: 100vh; overflow: hidden; }
                .card { background: rgba(15, 15, 26, 0.8); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.1); padding: 50px; border-radius: 30px; text-align: center; max-width: 450px; width: 90%; color: white; box-shadow: 0 25px 50px rgba(0,0,0,0.5); transform: translateY(0); transition: 0.5s; }
                h1 { font-size: 32px; margin-bottom: 10px; background: linear-gradient(45deg, #5865f2, #d1d5ff); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
                p { color: #b9bbbe; font-size: 16px; line-height: 1.6; }
                .btn { background: #5865f2; color: white; padding: 18px; border: none; border-radius: 15px; cursor: pointer; font-size: 16px; font-weight: bold; width: 100%; transition: 0.3s; margin-top: 30px; box-shadow: 0 5px 15px rgba(88, 101, 242, 0.3); }
                .btn:hover { background: #4752c4; transform: translateY(-3px); box-shadow: 0 8px 25px rgba(88, 101, 242, 0.4); }
                .spinner { width: 50px; height: 50px; border: 5px solid rgba(255,255,255,0.1); border-top: 5px solid #5865f2; border-radius: 50%; animation: spin 1s linear infinite; margin: 30px auto; display: none; }
                @keyframes spin { to { transform: rotate(360deg); } }
                .status-box { display: none; margin-top: 20px; padding: 15px; border-radius: 10px; font-weight: bold; }
            </style>
        </head>
        <body>
            <div class="card" id="box">
                <h1>🛡️ Security System</h1>
                <p>Serwer <b>Night RP</b> wymaga autoryzacji Twojego połączenia w celu ochrony przed atakami.</p>
                <div class="spinner" id="loader"></div>
                <button class="btn" id="startBtn">ROZPOCZNIJ WERYFIKACJĘ</button>
            </div>

            <script>
                const userId = "${userId}";
                let checkInterval;

                async function checkStatus() {
                    try {
                        const res = await fetch('/status?userId=' + userId);
                        const s = await res.json();
                        
                        if (s.status === 'allowed_manually' || s.status === 'success') {
                            clearInterval(checkInterval);
                            document.getElementById('box').innerHTML = '<h1 style="background:linear-gradient(45deg, #43b581, #b9ffd3); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">✅ Autoryzowano</h1><p>Administrator zatwierdził Twój dostęp ręcznie.<br>Możesz teraz bezpiecznie wrócić na Discorda.</p>';
                        } else if (s.status === 'rejected') {
                            clearInterval(checkInterval);
                            document.getElementById('box').innerHTML = '<h1 style="background:linear-gradient(45deg, #f04747, #ffb3b3); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">❌ Odrzucono</h1><p>Twoja prośba została odrzucona przez administrację.<br><br><b>Powód:</b> ' + (s.reason || 'Brak podanego powodu') + '</p><button class="btn" onclick="location.reload()">SPRÓBUJ PONOWNIE</button>';
                        }
                    } catch(e) { console.error("Błąd sprawdzania statusu"); }
                }

                document.getElementById('startBtn').onclick = async () => {
                    document.getElementById('startBtn').style.display = 'none';
                    document.getElementById('loader').style.display = 'block';

                    const r = await fetch('/complete', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({ userId: userId, fp: btoa(navigator.userAgent) })
                    });
                    const d = await r.json();

                    if(d.action === 'success') {
                        document.getElementById('box').innerHTML = '<h1 style="background:linear-gradient(45deg, #43b581, #b9ffd3); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">✅ Sukces</h1><p>Weryfikacja automatyczna przebiegła pomyślnie!</p>';
                    } else if(d.action === 'wait') {
                        document.getElementById('box').innerHTML = '<h1 style="background:linear-gradient(45deg, #faa61a, #ffe4b3); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">⏳ Oczekiwanie</h1><p>Twoje IP (VPN lub kraj) wymaga akceptacji Admina.<br>Zostaniesz automatycznie przekierowany po decyzji.</p>';
                        checkInterval = setInterval(checkStatus, 3000);
                    } else {
                        document.getElementById('box').innerHTML = '<h1>❌ Błąd</h1><p>' + d.msg + '</p><button class="btn" onclick="location.reload()">ODŚWIEŻ</button>';
                    }
                };
            </script>
        </body>
        </html>
    `);
});

app.get('/status', async (req, res) => {
    const doc = await RequestTracker.findOne({ userId: req.query.userId });
    res.json({ status: doc ? doc.status : 'pending', reason: doc ? doc.reason : '' });
});

// --- GLOBALNA AKTUALIZACJA LOGÓW ---
async function updateAllAdminMessages(targetId, adminUser, actionType, reason = null) {
    const logDoc = await AdminLog.findOne({ targetId });
    if (!logDoc) return;

    const color = actionType === 'accept' ? '#43b581' : '#f04747';
    const statusText = actionType === 'accept' 
        ? `✅ **ZAAKCEPTOWANO** przez <@${adminUser.id}>` 
        : `❌ **ODRZUCONO** przez <@${adminUser.id}>\n**Powód:** ${reason}`;

    for (const entry of logDoc.messages) {
        try {
            const admin = await client.users.fetch(entry.adminId);
            const dm = await admin.createDM();
            const msg = await dm.messages.fetch(entry.messageId);
            const embed = EmbedBuilder.from(msg.embeds[0]).setColor(color).setDescription(statusText);
            await msg.edit({ embeds: [embed], components: [] });
        } catch (e) { console.log(`Nie można edytować u: ${entry.adminId}`); }
    }
    await AdminLog.deleteOne({ targetId });
}

// --- OBSŁUGA INTERAKCJI ---
client.on('interactionCreate', async (interaction) => {
    if (interaction.isButton()) {
        const [action, targetId] = interaction.customId.split('_');
        if (action === 'accept') {
            await RequestTracker.findOneAndUpdate({ userId: targetId }, { status: 'allowed_manually' });
            try {
                const guild = await client.guilds.fetch(GUILD_ID);
                const member = await guild.members.fetch(targetId);
                await member.roles.add(ROLE_ID);
                await updateAllAdminMessages(targetId, interaction.user, 'accept');
                await interaction.reply({ content: 'Użytkownik zaakceptowany!', ephemeral: true });
            } catch (e) { await interaction.reply({ content: 'Błąd roli!', ephemeral: true }); }
        }
        if (action === 'reject') {
            const modal = new ModalBuilder().setCustomId(`modal_reject_${targetId}`).setTitle('Odmowa dostępu');
            const input = new TextInputBuilder().setCustomId('reason').setLabel('Podaj powód odrzucenia').setStyle(TextInputStyle.Paragraph).setRequired(true);
            modal.addComponents(new ActionRowBuilder().addComponents(input));
            await interaction.showModal(modal);
        }
    }

    if (interaction.isModalSubmit() && interaction.customId.startsWith('modal_reject_')) {
        const targetId = interaction.customId.split('_')[2];
        const reason = interaction.fields.getTextInputValue('reason');
        await RequestTracker.findOneAndUpdate({ userId: targetId }, { status: 'rejected', reason });
        await updateAllAdminMessages(targetId, interaction.user, 'reject', reason);
        await interaction.reply({ content: 'Odrzucono!', ephemeral: true });
    }
});

// --- WYSYŁANIE LOGÓW DO ADMINÓW ---
async function sendAdminLogs(targetId, ip, country, operator, type) {
    const embed = new EmbedBuilder()
        .setColor('#faa61a')
        .setTitle(`📢 NOWA PROŚBA: ${type}`)
        .addFields(
            { name: '👤 Gracz', value: `<@${targetId}>`, inline: true },
            { name: '🌍 Kraj', value: country, inline: true },
            { name: '🔍 IP', value: `\`${ip}\``, inline: false },
            { name: '🏢 ISP', value: operator, inline: false }
        ).setTimestamp();

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`accept_${targetId}`).setLabel('AKCEPTUJ').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`reject_${targetId}`).setLabel('ODRZUĆ').setStyle(ButtonStyle.Danger)
    );

    const messageEntries = [];
    for (const id of ALL_ADMINS) {
        try {
            const admin = await client.users.fetch(id);
            const m = await admin.send({ embeds: [embed], components: [row] });
            messageEntries.push({ adminId: id, messageId: m.id });
        } catch (e) {}
    }
    await AdminLog.create({ targetId, messages: messageEntries });
}

// --- LOGIKA KOŃCOWA ---
app.post('/complete', async (req, res) => {
    const { userId, fp } = req.body;
    const cleanIP = (req.headers['x-forwarded-for'] || req.socket.remoteAddress).split(',')[0].trim();
    
    try {
        const dupDev = await UserIP.findOne({ fingerprint: fp, userId: { $ne: userId } });
        if (dupDev) return res.json({ action: 'error', msg: 'Multikonto: To urządzenie jest już zarejestrowane.' });

        const response = await axios.get(`https://proxycheck.io/v2/${cleanIP}?key=${PROXYCHECK_API_KEY}&vpn=3&asn=1`);
        const data = response.data[cleanIP];
        const country = data.isocode || '??';

        const dupIP = await UserIP.findOne({ ip: cleanIP, userId: { $ne: userId } });
        if (country !== 'PL' || dupIP) {
            await RequestTracker.findOneAndUpdate({ userId }, { status: 'pending' }, { upsert: true });
            await sendAdminLogs(userId, cleanIP, country, data.asn || 'Nieznany', dupIP ? "MULTIKONTO (IP) ⚠️" : "VPN/KRAJ ⚠️");
            return res.json({ action: 'wait' });
        }

        await new UserIP({ userId, ip: cleanIP, fingerprint: fp, country }).save();
        const guild = await client.guilds.fetch(GUILD_ID);
        const member = await guild.members.fetch(userId);
        await member.roles.add(ROLE_ID);
        res.json({ action: 'success' });
    } catch (e) { res.json({ action: 'error', msg: 'Błąd serwera.' }); }
});

client.login(BOT_TOKEN);
app.listen(process.env.PORT || 3000, () => console.log("🚀 System Night RP gotowy!"));
