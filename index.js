const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');
const axios = require('axios');

// --- KONFIGURACJA GITHUB (Dla Rendera) ---
const BOT_TOKEN = process.env.DISCORD_TOKEN; // NIE ZMIENIAJ TEGO NA GITHUBIE!
const PROXYCHECK_API_KEY = 'e2brv7-y9y366-243469-435457';
const GUILD_ID = '1456335080116191436';
const ROLE_ID = '1457037758974394560';
const ADMIN_IDS = ['1364295526736199883', '1447828677109878904', '1131510639769178132'];

const app = express();
const PORT = process.env.PORT || 3000;

const client = new Client({ 
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] 
});

async function sendLog(message) {
    for (const id of ADMIN_IDS) {
        try {
            const admin = await client.users.fetch(id);
            await admin.send(`📑 **LOG Z RENDERA:**\n${message}`);
        } catch (err) { console.log(err); }
    }
}

app.use(express.urlencoded({ extended: true }));

app.get('/auth', async (req, res) => {
    const userId = req.query.token;
    if (!userId) return res.status(400).send('Błąd sesji.');
    await sendLog(`👤 Użytkownik o ID \`${userId}\` otworzył stronę weryfikacji.`);
    res.send('<html><body style="background:#2f3136;color:white;text-align:center;padding-top:50px;font-family:sans-serif;"><h2>Weryfikacja IP</h2><form action="/complete" method="POST"><input type="hidden" name="userId" value="'+userId+'"><button type="submit" style="background:#5865f2;color:white;padding:15px;border:none;border-radius:4px;cursor:pointer;font-weight:bold;">Zakończ weryfikację</button></form></body></html>');
});

app.post('/complete', async (req, res) => {
    const userId = req.body.userId;
    const userIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const cleanIP = userIP.split(',')[0].trim();

    try {
        const response = await axios.get(`https://proxycheck.io/v2/${cleanIP}?key=${PROXYCHECK_API_KEY}&vpn=1`);
        const result = response.data[cleanIP];

        if (result && result.proxy === 'yes') {
            await sendLog(`❌ **BLOKADA VPN**\nUżytkownik: <@${userId}>\nIP: \`${cleanIP}\`\nKraj: ${result.isocode}`);
            return res.status(403).send('VPN jest zabroniony.');
        }

        const guild = await client.guilds.fetch(GUILD_ID);
        const member = await guild.members.fetch(userId);
        await member.roles.add(ROLE_ID);
        
        // KLUCZOWY LOG Z IP DLA ADMINÓW
        await sendLog(`✅ **WERYFIKACJA UDANA**\nGracz: **${member.user.tag}**\nID: \`${userId}\`\nIP: \`${cleanIP}\``);
        
        res.send('<h1>Sukces! Rola nadana.</h1>');
    } catch (error) {
        res.status(500).send('Błąd serwera.');
    }
});

client.login(BOT_TOKEN);
app.listen(PORT, () => console.log(`Render Live na porcie ${PORT}`));
