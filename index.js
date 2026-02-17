const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const express = require('express');
const axios = require('axios');
const mongoose = require('mongoose');

// --- CONFIGURATION (ICARUS CORPORATE) ---
const BOT_TOKEN = process.env.DISCORD_TOKEN; 
const MONGO_URI = process.env.MONGO_URI; 
const PROXYCHECK_API_KEY = 'e2brv7-y9y366-243469-435457';
const ALL_ADMINS = ['1131510639769178132', '1276586330847051780', '1210653947061080175'];
const DOMAIN = process.env.DOMAIN || 'https://icarus-system.pl';
const ROLE_NAME = 'Zweryfikowany'; 

// --- DATABASE ---
mongoose.connect(MONGO_URI).then(() => console.log("✅ ICARUS: Corporate Systems Online"));

const UserIP = mongoose.model('UserIP', new mongoose.Schema({ userId: String, ip: String, fingerprint: String, country: String }));
const RequestTracker = mongoose.model('RequestTracker', new mongoose.Schema({ userId: String, status: { type: String, default: 'pending' }, reason: String }));
const AdminLog = mongoose.model('AdminLog', new mongoose.Schema({ targetId: String, messages: [{ adminId: String, messageId: String }] }));

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.DirectMessages] });
const app = express();
app.use(express.json());

// --- FRONTEND: REALISTIC CORPORATE DESIGN ---
app.get('/auth', (req, res) => {
    const userId = req.query.token;
    res.send(`
        <!DOCTYPE html>
        <html lang="pl">
        <head>
            <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Centrum Weryfikacji Icarus</title>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');
                
                body { 
                    margin: 0; padding: 0; font-family: 'Inter', -apple-system, sans-serif; 
                    background-color: #f6f9fc; color: #1a1f36;
                    display: flex; justify-content: center; align-items: center; height: 100vh;
                }

                .card {
                    background: #ffffff; padding: 48px; width: 100%; max-width: 420px;
                    border-radius: 16px; box-shadow: 0 15px 35px rgba(50,50,93,0.1), 0 5px 15px rgba(0,0,0,0.07);
                }

                .brand {
                    display: flex; align-items: center; gap: 10px; margin-bottom: 32px;
                    font-weight: 600; font-size: 20px; color: #5469d4; letter-spacing: -0.5px;
                }

                .brand-icon {
                    width: 32px; height: 32px; background: #5469d4; border-radius: 8px;
                }

                h1 { font-size: 24px; font-weight: 600; margin: 0 0 12px 0; color: #1a1f36; }
                p { font-size: 15px; line-height: 1.6; color: #4f566b; margin-bottom: 32px; }

                .btn {
                    background-color: #5469d4; color: #fff; border: none;
                    padding: 12px 24px; font-size: 16px; font-weight: 500;
                    border-radius: 4px; width: 100%; cursor: pointer;
                    transition: all 0.15s ease;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.08);
                }

                .btn:hover { background-color: #243d8c; transform: translateY(-1px); }
                .btn:active { transform: translateY(0); }

                .footer-text {
                    margin-top: 32px; font-size: 12px; color: #a3acb9; text-align: center;
                    border-top: 1px solid #e3e8ee; padding-top: 24px;
                }

                .loader {
                    display: none; width: 24px; height: 24px; border: 2px solid #e3e8ee;
                    border-top: 2px solid #5469d4; border-radius: 50%;
                    margin: 0 auto 20px; animation: spin 0.6s linear infinite;
                }

                #console { font-size: 13px; color: #697386; margin-top: 16px; min-height: 18px; text-align: center; }

                @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            </style>
        </head>
        <body>
            <div class="card">
                <div class="brand">
                    <div class="brand-icon"></div>
                    ICARUS SOLUTIONS
                </div>
                <h1>Weryfikacja tożsamości</h1>
                <p>Aby kontynuować i uzyskać dostęp do bezpiecznych zasobów, prosimy o przeprowadzenie standardowej autoryzacji urządzenia.</p>
                
                <div class="loader" id="loader"></div>
                <div id="status-area">
                    <button class="btn" id="startBtn">Kontynuuj</button>
                </div>
                <div id="console"></div>

                <div class="footer-text">
                    &copy; 2026 Icarus Solutions Ltd. System Bezpieczeństwa Sieciowego.
                </div>
            </div>

            <script>
                const userId = "${userId}";
                const btn = document.getElementById('startBtn');
                const loader = document.getElementById('loader');
                const con = document.getElementById('console');

                async function check() {
                    const r = await fetch('/status?userId=' + userId);
                    const s = await r.json();
                    if(s.status === 'allowed_manually' || s.status === 'success') location.reload();
                }

                btn.onclick = async () => {
                    btn.style.display = 'none'; loader.style.display = 'block';
                    con.innerText = "Przetwarzanie danych...";
                    const fp = btoa(screen.width+"x"+screen.height+"|"+Intl.DateTimeFormat().resolvedOptions().timeZone);
                    
                    const res = await fetch('/complete', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({ userId, fp })
                    });
                    const d = await res.json();

                    if(d.action === 'success') {
                        document.querySelector('.card').innerHTML = '<div style="text-align:center;"><div style="font-size:48px; color:#24b47e; margin-bottom:24px;">✓</div><h1>Autoryzacja zakończona</h1><p>Twoje urządzenie zostało pomyślnie zweryfikowane. Możesz teraz powrócić do aplikacji.</p></div>';
                    } else if(d.action === 'wait') {
                        con.innerText = "Wymagana dodatkowa weryfikacja administracyjna.";
                        setInterval(check, 3000);
                    } else {
                        con.style.color = "#cd3d64"; con.innerText = d.msg;
                        btn.style.display = 'block'; loader.style.display = 'none';
                    }
                };
            </script>
        </body>
        </html>
    `);
});

// --- BACKEND: PROFESSIONAL LOGGING ---
async function grantAccess(userId) {
    client.guilds.cache.forEach(async (guild) => {
        try {
            const role = guild.roles.cache.find(r => r.name === ROLE_NAME);
            if (role) {
                const member = await guild.members.fetch(userId).catch(() => null);
                if (member) await member.roles.add(role);
            }
        } catch (e) { console.error(`[Admin] Role assignment failed on ${guild.name}`); }
    });
}

client.on('guildMemberAdd', async (member) => {
    try {
        const embed = new EmbedBuilder()
            .setTitle('Wymagana autoryzacja konta')
            .setDescription(`Dzień dobry, <@${member.id}>.\n\nZe względów bezpieczeństwa, przed uzyskaniem dostępu do infrastruktury wymagane jest potwierdzenie tożsamości poprzez oficjalny portal Icarus.`)
            .setColor('#5469d4')
            .setFooter({ text: 'Icarus Identity Management System' });
        
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setLabel('Przejdź do weryfikacji').setURL(`${DOMAIN}/auth?token=${member.id}`).setStyle(ButtonStyle.Link)
        );
        await member.send({ embeds: [embed], components: [row] });
    } catch (e) { console.log(`[System] Unable to send DM to ${member.user.tag}`); }
});

async function sendAdminLogs(targetId, ip, country, operator, type, isAuto = false) {
    const embed = new EmbedBuilder()
        .setAuthor({ name: 'System Raportowania Icarus', iconURL: client.user.displayAvatarURL() })
        .setTitle(isAuto ? `Raport: Autoryzacja pozytywna` : `Zgłoszenie: Weryfikacja ręczna`)
        .setColor(isAuto ? '#24b47e' : '#f5a623')
        .addFields(
            { name: 'Użytkownik', value: `<@${targetId}> (\`${targetId}\`)`, inline: false },
            { name: 'Lokalizacja sieciowa', value: `Kraj: ${country}\nIP: ${ip}`, inline: true },
            { name: 'Dostawca usług', value: `\`${operator}\``, inline: true },
            { name: 'Szczegóły incydentu', value: `Powód: **${type}**`, inline: false }
        )
        .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`accept_${targetId}`).setLabel('Autoryzuj').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`reject_${targetId}`).setLabel('Odrzuć dostęp').setStyle(ButtonStyle.Danger)
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

// --- REST OF THE CODE (ADMIN ACTIONS & API) ---
client.on('interactionCreate', async (i) => {
    if (i.isButton()) {
        const [action, targetId] = i.customId.split('_');
        if (action === 'accept') {
            await RequestTracker.findOneAndUpdate({ userId: targetId }, { status: 'allowed_manually' });
            await grantAccess(targetId);
            await updateAdminLogs(targetId, i.user, 'accept');
            await i.reply({ content: 'Zatwierdzono dostęp dla użytkownika.', ephemeral: true });
        }
        if (action === 'reject') {
            const modal = new ModalBuilder().setCustomId(`mod_${targetId}`).setTitle('Odmowa dostępu');
            modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('r').setLabel('Uzasadnienie decyzji').setStyle(TextInputStyle.Paragraph).setRequired(true)));
            await i.showModal(modal);
        }
    }
    if (i.isModalSubmit() && i.customId.startsWith('mod_')) {
        const targetId = i.customId.split('_')[1];
        const reason = i.fields.getTextInputValue('r');
        await RequestTracker.findOneAndUpdate({ userId: targetId }, { status: 'rejected', reason });
        await updateAdminLogs(targetId, i.user, 'reject', reason);
        await i.reply({ content: 'Odmowa została wysłana do bazy danych.', ephemeral: true });
    }
});

async function updateAdminLogs(targetId, adminUser, action, reason = "") {
    const logData = await AdminLog.findOne({ targetId });
    if (!logData) return;
    for (const msgRef of logData.messages) {
        try {
            const admin = await client.users.fetch(msgRef.adminId);
            const message = await (await admin.createDM()).messages.fetch(msgRef.messageId);
            const status = action === 'accept' ? `✅ **Dostęp autoryzowany** przez: <@${adminUser.id}>` : `❌ **Dostęp zablokowany** przez: <@${adminUser.id}>\nPowód: ${reason}`;
            const newEmbed = EmbedBuilder.from(message.embeds[0]).setColor(action === 'accept' ? '#24b47e' : '#cd3d64').setDescription(status);
            await message.edit({ embeds: [newEmbed], components: [] });
        } catch (e) {}
    }
    await AdminLog.deleteOne({ targetId });
}

app.get('/status', async (req, res) => {
    const doc = await RequestTracker.findOne({ userId: req.query.userId });
    res.json({ status: doc ? doc.status : 'pending', reason: doc ? doc.reason : '' });
});

app.post('/complete', async (req, res) => {
    const { userId, fp } = req.body;
    const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress).split(',')[0].trim();
    try {
        const { data } = await axios.get(`https://proxycheck.io/v2/${ip}?key=${PROXYCHECK_API_KEY}&vpn=3&asn=1`);
        const country = data[ip].isocode || '??';
        const operator = data[ip].asn || 'Nieznany';
        
        const devDup = await UserIP.findOne({ fingerprint: fp, userId: { $ne: userId } });
        if (devDup) {
            await sendAdminLogs(userId, ip, country, operator, `Poważny konflikt: Duplikacja urządzenia z <@${devDup.userId}>`, false);
            return res.json({ action: 'error', msg: 'To urządzenie zostało już użyte do autoryzacji innego konta.' });
        }

        const ipDup = await UserIP.findOne({ ip, userId: { $ne: userId } });
        if (country !== 'PL' || data[ip].proxy === 'yes' || ipDup) {
            await RequestTracker.findOneAndUpdate({ userId }, { status: 'pending' }, { upsert: true });
            let reason = "Inicjacja weryfikacji manualnej";
            if (country !== 'PL') reason = "Połączenie z lokalizacji: " + country;
            if (data[ip].proxy === 'yes') reason = "Wykryto system maskujący VPN/Proxy";
            if (ipDup) reason = `Adres IP powiązany z innym użytkownikiem (<@${ipDup.userId}>)`;

            await sendAdminLogs(userId, ip, country, operator, reason, false);
            return res.json({ action: 'wait' });
        }

        await new UserIP({ userId, ip, fingerprint: fp, country }).save();
        await grantAccess(userId);
        await sendAdminLogs(userId, ip, country, operator, "Zatwierdzenie automatyczne", true);
        res.json({ action: 'success' });
    } catch (e) { res.json({ action: 'error', msg: 'Błąd serwera podczas przetwarzania.' }); }
});

client.once('ready', () => console.log(`🚀 ICARUS SOLUTIONS: Core Systems Active.`));
client.login(BOT_TOKEN);
app.listen(process.env.PORT || 3000);
