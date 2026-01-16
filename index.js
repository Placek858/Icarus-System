const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const express = require('express');
const axios = require('axios');
const fs = require('fs'); // Do zapisywania bazy IP w pliku

// --- KONFIGURACJA ---
const BOT_TOKEN = process.env.DISCORD_TOKEN;
const PROXYCHECK_API_KEY = 'e2brv7-y9y366-243469-435457';
const GUILD_ID = '1456335080116191436';
const ROLE_ID = '1457037758974394560';
const ADMIN_IDS = ['1364295526736199883', '1447828677109878904', '1131510639769178132'];

// Prosta baza danych w pliku JSON
const DB_FILE = './database.json';
if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify({ ips: {} }));

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });
const app = express();
app.use(express.urlencoded({ extended: true }));

// Funkcja sprawdzająca czy IP już istnieje
function checkIP(ip, userId) {
    let data = JSON.parse(fs.readFileSync(DB_FILE));
    if (data.ips[ip] && data.ips[ip] !== userId) {
        return data.ips[ip]; // Zwraca ID pierwszego użytkownika z tym IP
    }
    data.ips[ip] = userId;
    fs.writeFileSync(DB_FILE, JSON.stringify(data));
    return null;
}

app.post('/complete', async (req, res) => {
    const userId = req.body.userId;
    const userIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const cleanIP = userIP.split(',')[0].trim();

    try {
        const response = await axios.get(`https://proxycheck.io/v2/${cleanIP}?key=${PROXYCHECK_API_KEY}&vpn=1&asn=1`);
        const result = response.data[cleanIP];

        if (result && result.proxy === 'yes') {
            return res.status(403).send('VPN jest zabroniony.');
        }

        const duplicateUser = checkIP(cleanIP, userId);

        if (duplicateUser) {
            // WYKRYTO MULTIKONTO - Wysyłamy Panel do Adminów
            const embed = new EmbedBuilder()
                .setColor('#ff1100')
                .setTitle('⚠️ WYKRYTO POWTARZAJĄCE SIĘ IP!')
                .setDescription(`Użytkownik <@${userId}> ma to samo IP co <@${duplicateUser}>.`)
                .addFields(
                    { name: 'Adres IP', value: `\`${cleanIP}\``, inline: true },
                    { name: 'Dostawca', value: `${result.asn || 'Nieznany'}`, inline: true }
                )
                .setTimestamp();

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`allow_${userId}`).setLabel('Przepuść gracza').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId(`ban_${userId}_${cleanIP}`).setLabel('Zablokuj (Ban IP)').setStyle(ButtonStyle.Danger)
            );

            for (const id of ADMIN_IDS) {
                const admin = await client.users.fetch(id);
                await admin.send({ embeds: [embed], components: [row] });
            }

            return res.send('<h1>Wykryto powiązanie z innym kontem. Oczekiwanie na decyzję administratora...</h1>');
        }

        // Jeśli to nie multikonto - nadaj rolę od razu
        const guild = await client.guilds.fetch(GUILD_ID);
        const member = await guild.members.fetch(userId);
        await member.roles.add(ROLE_ID);
        
        res.send('<h1>Sukces! Rola została nadana.</h1>');

    } catch (error) {
        res.status(500).send('Błąd serwera.');
    }
});

// Obsługa przycisków
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;
    if (!ADMIN_IDS.includes(interaction.user.id)) return interaction.reply({ content: 'Nie masz uprawnień!', ephemeral: true });

    const [action, targetId, ip] = interaction.customId.split('_');

    try {
        const guild = await client.guilds.fetch(GUILD_ID);
        const member = await guild.members.fetch(targetId);

        if (action === 'allow') {
            await member.roles.add(ROLE_ID);
            await interaction.reply(`✅ Przepuszczono użytkownika <@${targetId}>.`);
        } else if (action === 'ban') {
            await guild.bans.create(targetId, { reason: `Multikonto / Ban IP: ${ip}` });
            await interaction.reply(`🚫 Zbanowano użytkownika <@${targetId}> i zablokowano IP: \`${ip}\`.`);
        }
    } catch (err) {
        await interaction.reply('Wystąpił błąd przy wykonywaniu akcji.');
    }
});

client.login(BOT_TOKEN);
app.listen(process.env.PORT || 3000);
