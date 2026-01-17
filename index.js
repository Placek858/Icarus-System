const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const express = require('express');
const axios = require('axios');
const mongoose = require('mongoose');

const BOT_TOKEN = process.env.DISCORD_TOKEN; 
const MONGO_URI = process.env.MONGO_URI; 
const PROXYCHECK_API_KEY = 'e2brv7-y9y366-243469-435457';
const GUILD_ID = '1456335080116191436';
const ROLE_ID = '1461789323262296084';
const MY_ID = '1131510639769178132'; 
const ALL_ADMINS = [MY_ID, '1364295526736199883', '1447828677109878904'];

mongoose.connect(MONGO_URI).then(() => console.log("✅ Połączono z MongoDB Atlas"));

const UserIP = mongoose.model('UserIP', new mongoose.Schema({ userId: String, ip: String, country: String, operator: String }));
const PanelTracker = mongoose.model('PanelTracker', new mongoose.Schema({ targetId: String, adminMessages: [{ adminId: String, messageId: String }] }));
const RequestTracker = mongoose.model('RequestTracker', new mongoose.Schema({ userId: String, status: { type: String, default: 'pending' } }));

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });
const app = express();
app.use(express.urlencoded({ extended: true }));

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

app.get('/auth', (req, res) => {
    const userId = req.query.token;
    res.send(`<html><body style="background:#1a1a2e;color:white;font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;text-align:center;"><div style="background:#2c2f33;padding:40px;border-radius:20px;"><h1>🛡️ Weryfikacja</h1><p>Kliknij przycisk poniżej.</p><button id="vBtn" style="background:#5865f2;color:white;padding:15px 30px;border:none;border-radius:10px;cursor:pointer;font-weight:bold;">ZWERYFIKUJ</button></div><script>document.getElementById('vBtn').onclick=async()=>{document.body.innerHTML='<h3>Analiza...</h3>';const r=await fetch('/complete',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:'userId=${userId}'});const d=await r.json();if(d.action==='wait'){document.body.innerHTML='<h3>⏳ Czekaj na akceptację admina...</h3>';setInterval(async()=>{const rs=await fetch('/status?userId=${userId}');const s=await rs.json();if(s.status==='allowed')location.reload();},3000);}else if(d.action==='success'){document.body.innerHTML='<h2 style="color:#43b581">✅ Sukces!</h2>';}else{document.body.innerHTML='<h2 style="color:#f04747">❌ Błąd: '+d.msg+'</h2>';}};</script></body></html>`);
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
        
        if (result.proxy === 'yes') return res.json({ action: 'error', msg: 'VPN jest zabroniony.' });

        const existingEntry = await UserIP.findOne({ ip: cleanIP });
        if (country !== 'PL' || (existingEntry && existingEntry.userId !== userId)) {
            await RequestTracker.findOneAndUpdate({ userId }, { status: 'pending' }, { upsert: true });
            const myEmbed = new EmbedBuilder().setColor('#ffaa00').setTitle('⚠️ PODEJRZANE IP (TY)').setDescription(`Użytkownik: <@${userId}>\nKraj: ${country}\nOperator: \`${operator}\`\nIP: \`${cleanIP}\``);
            const adminEmbed = new EmbedBuilder().setColor('#ffaa00').setTitle('⚠️ PODEJRZANE IP').setDescription(`Użytkownik: <@${userId}>\nKraj: ${country}\nOperator: \`UKRYTE\`\nIP: \`UKRYTE\``);
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
    } catch (e) { res.json({ action: 'error', msg: 'Błąd systemu.' }); }
});

client.on('messageCreate', async (msg) => {
    if (msg.content === '!setup' && ALL_ADMINS.includes(msg.author.id)) {
        const embed = new EmbedBuilder().setColor('#5865f2').setTitle('🛡️ WERYFIKACJA').setDescription('Kliknij przycisk poniżej, aby otrzymać link.');
        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('start_v').setLabel('ZWERYFIKUJ MNIE').setStyle(ButtonStyle.Primary));
        await msg.channel.send({ embeds: [embed], components: [row] });
        await msg.delete().catch(() => {});
    }
});

client.on('interactionCreate', async (int) => {
    if (!int.isButton()) return;
    if (int.customId === 'start_v') {
        const link = `https://kk-7stm.onrender.com/auth?token=${int.user.id}`;
        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setLabel('OTWÓRZ STRONĘ').setURL(link).setStyle(ButtonStyle.Link));
        return int.reply({ content: 'Twój link:', components: [row], ephemeral: true });
    }
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
            await int.reply({ content: `Gotowe.`, ephemeral: true });
        } else if (action === 'ban') {
            const guild = await client.guilds.fetch(GUILD_ID);
            await guild.members.ban(targetId);
            await updateLiveStatus(targetId, 'banned', `🚫 Zbanował ${int.user.tag}`);
            await int.reply({ content: `Zbanowano.`, ephemeral: true });
        }
    } catch (e) {}
});

client.on('ready', () => console.log("🤖 Bot Render/GitHub Online"));
client.login(BOT_TOKEN);
app.listen(process.env.PORT || 3000);
