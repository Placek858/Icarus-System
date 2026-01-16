const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const express = require('express');
const axios = require('axios');

const BOT_TOKEN = process.env.DISCORD_TOKEN; // TYLKO TO! Nie wklejaj tu ciągu znaków.
const PROXYCHECK_API_KEY = 'e2brv7-y9y366-243469-435457';
const GUILD_ID = '1456335080116191436';
const ROLE_ID = '1461789323262296084';
const ADMIN_IDS = ['1364295526736199883', '1447828677109878904', '1131510639769178132']; 
const DOMAIN = 'https://kk-7stm.onrender.com';

const app = express();
const PORT = process.env.PORT || 3000;

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.DirectMessages // DODANE: pozwala pisać na PV
    ] 
});

app.use(express.urlencoded({ extended: true }));

async function sendLogToAdmins(message) {
    for (const id of ADMIN_IDS) {
        try {
            const admin = await client.users.fetch(id);
            await admin.send(`🔔 **LOG WERYFIKACJI:** ${message}`);
        } catch (err) {
            console.log(`Nie udało się wysłać loga do ${id}`);
        }
    }
}

// --- NOWA SEKCJA: WYSYŁANIE WIADOMOŚCI NA WEJŚCIU ---
client.on('guildMemberAdd', async (member) => {
    const verifyLink = `${DOMAIN}/auth?token=${member.id}`;
    
    const embed = new EmbedBuilder()
        .setColor('#5865f2')
        .setTitle('🛡️ Weryfikacja')
        .setDescription(`Witaj! Aby uzyskać dostęp do serwera, musisz się zweryfikować.\n\n**[➤ KLIKNIJ TUTAJ, ABY SIĘ ZWERYFIKOWAĆ](${verifyLink})**`)
        .setFooter({ text: 'Masz 10 minut na weryfikację' });

    try {
        await member.send({ embeds: [embed] });
        await sendLogToAdmins(`📩 Wysłano link do nowego użytkownika: **${member.user.tag}**`);
    } catch (err) {
        await sendLogToAdmins(`⚠️ Nie można wysłać DM do **${member.user.tag}** (zablokowane PV).`);
    }
});

// --- STRONA WWW ---
app.get('/auth', async (req, res) => {
    const userId = req.query.token;
    if (!userId) return res.status(400).send('Błąd: Brak tokenu.');
    await sendLogToAdmins(`Użytkownik o ID: \`${userId}\` wszedł na stronę.`);
    res.send(`<html><body style="background:#2f3136;color:white;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;font-family:sans-serif;"><div style="background:#36393f;padding:40px;border-radius:8px;text-align:center;"><h2>Weryfikacja Konta</h2><form action="/complete" method="POST"><input type="hidden" name="userId" value="${userId}"><button type="submit" style="background:#5865f2;color:white;border:none;padding:14px 20px;border-radius:4px;cursor:pointer;font-weight:bold;">Zakończ weryfikację</button></form></div></body></html>`);
});

app.post('/complete', async (req, res) => {
    const userId = req.body.userId;
    const userIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const cleanIP = userIP.split(',')[0].trim();
    try {
        const response = await axios.get(`https://proxycheck.io/v2/${cleanIP}?key=${PROXYCHECK_API_KEY}&vpn=1`);
        if (response.data[cleanIP] && response.data[cleanIP].proxy === 'yes') {
            await sendLogToAdmins(`❌ Odrzucono VPN: <@${userId}> (${cleanIP})`);
            return res.status(403).send('Błąd: Wyłącz VPN.');
        }
        const guild = await client.guilds.fetch(GUILD_ID);
        const member = await guild.members.fetch(userId);
        await member.roles.add(ROLE_ID);
        await sendLogToAdmins(`✅ Sukces: **${member.user.tag}** przeszedł weryfikację.`);
        res.send('<h1>Sukces! Rola nadana.</h1>');
    } catch (error) {
        res.status(500).send('Błąd serwera.');
    }
});

client.login(BOT_TOKEN);
app.listen(PORT, () => console.log(`Bot i serwer WWW aktywny na porcie ${PORT}`));
