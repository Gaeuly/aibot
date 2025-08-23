const { Client } = require('discord.js-selfbot-v13');
const config = require('./config');

const client = new Client({ checkUpdate: false });

// Menyimpan riwayat percakapan sederhana untuk setiap channel
const conversationHistories = new Map();

client.on('ready', () => {
    console.log(`[INFO] AI Self-Bot logged in as ${client.user.tag}`);
    console.log('[INFO] Waiting for replies to your messages...');
});

client.on('messageCreate', async (message) => {
    // 1. Jangan balas pesan dari diri sendiri untuk menghindari loop
    if (message.author.id === client.user.id) {
        return;
    }

    // 2. Cek apakah pesan ini adalah balasan (reply)
    //    dan apakah balasan itu ditujukan ke pesan kita
    if (message.reference && message.reference.messageId) {
        try {
            const repliedToMessage = await message.channel.messages.fetch(message.reference.messageId);
            
            if (repliedToMessage.author.id === client.user.id) {
                console.log(`[REPLY DETECTED] From: ${message.author.tag} | Content: "${message.content}"`);

                // Menambahkan indikator "Typing..."
                await message.channel.sendTyping();

                // 3. Siapkan data untuk dikirim ke AI Gemini
                const userMessage = message.content;
                const channelId = message.channel.id;

                // Ambil atau buat riwayat percakapan untuk channel ini
                if (!conversationHistories.has(channelId)) {
                    conversationHistories.set(channelId, []);
                }
                const history = conversationHistories.get(channelId);

                // Tambahkan pesan baru ke riwayat
                history.push({ role: "user", parts: [{ text: userMessage }] });

                // Batasi riwayat agar tidak terlalu panjang (misal: 10 pesan terakhir)
                if (history.length > 10) {
                    history.splice(0, history.length - 10);
                }

                // 4. Panggil API Gemini
                const aiResponse = await getAiReply(history);

                if (aiResponse) {
                    // Tambahkan balasan AI ke riwayat
                    history.push({ role: "model", parts: [{ text: aiResponse }] });
                    
                    // 5. Balas pesan pengguna dengan respons dari AI
                    await message.reply(aiResponse);
                    console.log(`[AI REPLIED] To: ${message.author.tag} | Response: "${aiResponse}"`);
                } else {
                    console.warn('[WARN] AI did not return a response.');
                }
            }
        } catch (error) {
            console.error('[ERROR] Failed to process reply:', error);
        }
    }
});

/**
 * Mengirim prompt ke Gemini API dan mendapatkan balasan.
 * @param {Array} history Riwayat percakapan.
 * @returns {Promise<string|null>} Teks balasan dari AI.
 */
async function getAiReply(history) {
    try {
        // Gabungkan prompt sistem dengan riwayat percakapan
        const fullHistory = [
            { role: "user", parts: [{ text: config.aiPrompt }] },
            { role: "model", parts: [{ text: "Siap! Aku akan jadi teman ngobrol yang asik." }] },
            ...history
        ];

        const payload = {
            contents: fullHistory,
            generationConfig: {
                temperature: 0.9,
                topK: 1,
                topP: 1,
                maxOutputTokens: 2048,
            },
        };

        const apiKey = "AIzaSyDZ0h3NgaxJKYg5B6oKD-W6z41xM00m128"; // Disediakan oleh environment
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.0-pro:generateContent?key=${apiKey}`;

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorBody = await response.json();
            console.error("API Error Response:", errorBody);
            return "Maaf, AI sedang ada gangguan. Coba lagi nanti.";
        }

        const result = await response.json();
        
        if (result.candidates && result.candidates.length > 0 && result.candidates[0].content.parts.length > 0) {
            return result.candidates[0].content.parts[0].text;
        } else {
            return null;
        }

    } catch (error) {
        console.error('Error calling Gemini API:', error);
        return "Duh, otak AI-ku lagi nge-lag nih. Gagal memproses balasan.";
    }
}

client.login(config.token).catch(err => {
    console.error("[LOGIN FAILED] Token tidak valid atau koneksi bermasalah.", err);
});
