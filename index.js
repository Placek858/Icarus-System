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

mongoose.connect(MONGO_URI).then(() => console.log("✅ Baza danych Night RP aktywna"));

// --- MODELE ---
const UserIP = mongoose.model('UserIP', new mongoose.Schema({ userId: String, ip: String, fingerprint: String, country: String }));
const RequestTracker = mongoose.model('RequestTracker', new mongoose.Schema({ userId: String, status: { type: String, default: 'pending' }, reason: String }));
const AdminLog = mongoose.model('AdminLog', new mongoose.Schema({ targetId: String, messages: [{ adminId: String, messageId: String }] }));

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.DirectMessages] });
const app = express();
app.use(express.json());

// --- FRONTEND (STYLIZACJA PREMIUM) ---
app.get('/auth', (req, res) => {
    const userId = req.query.token;
    res.send(`
        <!DOCTYPE html>
        <html lang="pl">
        <head>
            <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Night RP | Security</title>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;600&display=swap');
                body { margin: 0; padding: 0; font-family: 'Poppins', sans-serif; background: #09090e url('https://discord.com/assets/652f404f275e28ef9a35.png') no-repeat center center fixed; background-size: cover; display: flex; justify-content: center; align-items: center; min-height: 100vh; color: white; }
                .card { background: rgba(13, 13, 20, 0.85); backdrop-filter: blur(25px); -webkit-backdrop-filter: blur(25px); border: 1px solid rgba(255,255,255,0.08); padding: 50px; border-radius: 40px; text-align: center; max-width: 450px; width: 90%; box-shadow: 0 30px 60px rgba(0,0,0,0.7); animation: fadeIn 0.8s ease-out; }
                @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
                h1 { font-size: 34px; margin-bottom: 15px; font-weight: 600; background: linear-gradient(135deg, #5865f2, #a5b4fc); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
                p { color: #a1a1aa; font-size: 15px; line-height: 1.7; margin-bottom: 25px; }
                .btn { background: linear-gradient(135deg, #5865f2, #4752c4); color: white; padding: 18px; border: none; border-radius: 18px; cursor: pointer; font-size: 16px; font-weight: 600; width: 100%; transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); box-shadow: 0 10px 25px rgba(88, 101, 242, 0.3); }
                .btn:hover { transform: scale(1.03); box-shadow: 0 15px 35px rgba(88, 101, 242, 0.5); }
                .spinner { width: 55px; height: 55px; border: 5px solid rgba(255,255,255,0.05); border-top: 5px solid #5865f2; border-radius: 50%; animation: spin 1s linear infinite; margin: 30px auto; display: none; }
                @keyframes spin { to { transform: rotate(360deg); } }
                .badge { display: inline-block; padding: 6px 12px; border-radius: 8px; font-size: 11px; font-weight: bold; background: rgba(255,255,255,0.05); color: #888; margin-bottom: 15px; text-transform: uppercase; letter-spacing: 1px; }
            </style>
        </head>
        <body>
            <div class="card" id="box">
                <div class="badge">Safe Connect v3.0</div>
                <h1>🛡️ Weryfikacja</h1>
                <p>System Night RP sprawdza Twoje urządzenie i połączenie. Kliknij przycisk, aby kontynuować.</p>
                <div class="spinner" id="loader"></div>
                <button class="btn" id="startBtn">AUTORYZUJ PROFIL</button>
            </div>

            <script>
                const userId = "${userId}";
                
                async function checkStatus() {
                    const res = await fetch('/status?userId=' + userId);
                    const s = await res.json();
                    if (s.status === 'allowed_manually' || s.status === 'success') {
                        location.reload(); // Przeładuje stronę i pokaże sukces z CSS
                    } else if (s.status === 'rejected') {
                        document.getElementById('box').innerHTML = '<h1 style="color:#f87171">❌ Odrzucono</h1><p>Powód: ' + (s.reason || 'Brak danych') + '</p><button class="btn" onclick="location.reload()">SPRÓBUJ PONOWNIE</button>';
                    }
                }

                document.getElementById('startBtn').onclick = async () => {
                    const btn = document.getElementById('startBtn');
                    const loader = document.getElementById('loader');
                    btn.style.display = 'none'; loader.style.display = 'block';

                    // Inteligentny Fingerprint (Monitor + Procesor + Strefa czasowa)
                    const fpData = btoa(screen.width + "x" + screen.height + "|" + Intl.DateTimeFormat().resolvedOptions().timeZone + "|" + (navigator.hardwareConcurrency || 4));

                    const r = await fetch('/complete', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({ userId: userId, fp: fpData })
                    });
                    const d = await r.json();

                    if(d.action === 'success') {
                        document.getElementById('box').innerHTML = '<h1 style="color:#4ade80">✅ Sukces</h1><p>Twoje połączenie jest bezpieczne. Możesz wrócić na Discorda!</p>';
                    } else if(d.action === 'wait') {
                        document.getElementById('box').innerHTML = '<h1 style="color:#fbbf24">⏳ Oczekiwanie</h1><p>Wymagana ręczna zgoda Admina (VPN lub podejrzane IP). Proszę nie zamykać tej strony...</p>';
                        setInterval(checkStatus, 3000);
                    } else {
                        document.getElementById('box').innerHTML = '<h1 style="color:#f87171">❌ Błąd</h1><p>' + d.msg + '</p><button class="btn" onclick="location.reload()">ODŚWIEŻ</button>';
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

// --- GLOBALNA EDYCJA WIADOMOŚCI U ADMINÓW ---
async function updateAdminLogs(targetId, adminUser, action, reason = "") {
    const logData = await AdminLog.findOne({ targetId });
    if (!logData) return;

    const embedColor = action === 'accept' ? '#43b581' : '#f04747';
    const description = action === 'accept' 
        ? `✅ **ZAAKCEPTOWANO**\nPrzez: <@${adminUser.id}>` 
        : `❌ **ODRZUCONO**\nPrzez: <@${adminUser.id}>\n**Powód:** ${reason}`;

    for (const msgRef of logData.messages) {
        try {
            const admin = await client.users.fetch(msgRef.adminId);
            const dm = await admin.createDM();
            const message = await dm.messages.fetch(msgRef.messageId);
            const updatedEmbed = EmbedBuilder.from(message.embeds[0]).setColor(embedColor).setDescription(description);
            await message.edit({ embeds: [updatedEmbed], components: [] });
        } catch (e) { console.log(`Błąd edycji u admina: ${msgRef.adminId}`); }
    }
    await AdminLog.deleteOne({ targetId });
}

// --- INTERAKCJE ---
client.on('interactionCreate', async (interaction) => {
    if (interaction.isButton()) {
        const [action, targetId] = interaction.customId.split('_');
        if (action === 'accept') {
            await RequestTracker.findOneAndUpdate({ userId: targetId }, { status: 'allowed_manually' });
            try {
                const guild = await client.guilds.fetch(GUILD_ID);
                const member = await guild.members.fetch(targetId);
                await member.roles.add(ROLE_ID);
                await updateAdminLogs(targetId, interaction.user, 'accept');
                await interaction.reply({ content: '✅ Zaakceptowano!', ephemeral: true });
            } catch (e) { await interaction.reply({ content: '❌ Błąd nadawania roli!', ephemeral: true }); }
        }
        if (action === 'reject') {
            const modal = new ModalBuilder().setCustomId(`modal_reject_${targetId}`).setTitle('Powód odrzucenia');
            modal.addComponents(new ActionRowBuilder().addComponents(
                new TextInputBuilder().setCustomId('reason').setLabel('Dlaczego odrzucasz?').setStyle(TextInputStyle.Paragraph).setRequired(true)
            ));
            await interaction.showModal(modal);
        }
    }

    if (interaction.isModalSubmit() && interaction.customId.startsWith('modal_reject_')) {
        const targetId = interaction.customId.split('_')[2];
        const reason = interaction.fields.getTextInputValue('reason');
        await RequestTracker.findOneAndUpdate({ userId: targetId }, { status: 'rejected', reason });
        await updateAdminLogs(targetId, interaction.user, 'reject', reason);
        await interaction.reply({ content: '❌ Odrzucono pomyślnie.', ephemeral: true });
    }
});

// --- BACKEND LOGIC ---
app.post('/complete', async (req, res) => {
    const { userId, fp } = req.body;
    const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress).split(',')[0].trim();

    try {
        // Blokada Fingerprint
        const devDup = await UserIP.findOne({ fingerprint: fp, userId: { $ne: userId } });
        if (devDup) return res.json({ action: 'error', msg: 'Wykryto próbę użycia tego samego urządzenia na innym koncie.' });

        // Sprawdzanie ProxyCheck
        const { data } = await axios.get(`https://proxycheck.io/v2/${ip}?key=${PROXYCHECK_API_KEY}&vpn=3&asn=1`);
        const country = data[ip].isocode || '??';
        const isVPN = data[ip].proxy === 'yes';

        // Blokada IP Duplikatu
        const ipDup = await UserIP.findOne({ ip, userId: { $ne: userId } });

        if (country !== 'PL' || isVPN || ipDup) {
            await RequestTracker.findOneAndUpdate({ userId }, { status: 'pending' }, { upsert: true });
            
            // Wysyłanie logów do adminów
            const logEmbed = new EmbedBuilder().setTitle('⚠️ Wymagana Akceptacja').setColor('#faa61a')
                .addFields({name:'Gracz', value:`<@${userId}>`, inline:true}, {name:'Kraj', value:country, inline:true}, {name:'IP', value:ip})
                .setFooter({text: isVPN ? 'Wykryto VPN' : (ipDup ? 'Możliwe Multikonto (IP)' : 'Inny Kraj')});
            
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`accept_${userId}`).setLabel('AKCEPTUJ').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId(`reject_${userId}`).setLabel('ODRZUĆ').setStyle(ButtonStyle.Danger)
            );

            let msgRefs = [];
            for (const admId of ALL_ADMINS) {
                try {
                    const admin = await client.users.fetch(admId);
                    const m = await admin.send({ embeds: [logEmbed], components: [row] });
                    msgRefs.push({ adminId: admId, messageId: m.id });
                } catch(e){}
            }
            await AdminLog.create({ targetId: userId, messages: msgRefs });
            return res.json({ action: 'wait' });
        }

        // Automatyczny Sukces
        await new UserIP({ userId, ip, fingerprint: fp, country }).save();
        const guild = await client.guilds.fetch(GUILD_ID);
        const member = await guild.members.fetch(userId);
        await member.roles.add(ROLE_ID);
        res.json({ action: 'success' });
    } catch (e) { res.json({ action: 'error', msg: 'Błąd połączenia z bazą.' }); }
});

client.login(BOT_TOKEN);
app.listen(process.env.PORT || 3000, () => console.log("🚀 Night RP Security LIVE"));
