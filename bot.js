require('dotenv').config();//Підключаємо .env

const express = require('express');
const bodyParser = require('body-parser');
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const currencyApiKey = process.env.CURRENCY_API_KEY;
const token = process.env.BOT_TOKEN;
const url = process.env.BOT_URL || 'https://firstbot-san3.onrender.com';

//Визначаємо режим: production -> webhook, інакше -> polling
const isProduction = process.env.NODE_ENV === 'production';

let bot;
let exchangeRates = {}; //тут зберігатимуться курси
let lastUpdate = null;

if(isProduction) {
    //Webkook
    bot = new TelegramBot(token, { webHook: true });
} else {
    //Local
    bot = new TelegramBot(token, { polling: true });
    console.log('Bot running locally in polling mode');
}

const app = express();
app.use(bodyParser.json());

//Кінцева точка перевірки працездатності
app.get('/',(req, res) => {
    res.send('Bot is running')
})

//Якщо webhook-режим, то реєструємо маршрут для прийому апдейтів
if(isProduction) {
    app.post(`/bot${token}`, (req, res) => {
        console.log('Received update (webhook):', JSON.stringify(req.body).slice(0, 500));
        try {
            bot.processUpdate(req.body);
            res.sendStatus(200);
        } catch (err) {
            console.error('processUpdate error:', err);
            res.sendStatus(500);
        }
    });
}

//Функція для оновлення курсів
async function updateRates() {
    try {
        const response = await axios.get(`https://api.currencylayer.com/live?access_key=${currencyApiKey}&currencies=UAH,EUR,USD`);

        if(response.data.success) {

            const usdToUah = response.data.quotes.USDUAH;
            const usdToEur = response.data.quotesUSDEUR;

            exchangeRates = {
                usd: usdToUah,                  //USD → UAH
                eur: usdToUah / usdToEur,       //EUR → UAH (через USD)
                uahToUsd: 1 / usdToUah,         //UAH → USD
                uahToEur: usdToEur / usdToUah   //UAH → EUR
            };
            lastUpdate = new Date();
            console.log("Курси оновлено:", exchangeRates);
        } else {
            console.error("Помилка API:", response.data.error);
        }
    } catch (error) {
        console.error("Помилка при отриманні курсів:", error.message);
    }
}

//Оновлення курсів при запуску і кожні 30 хв
updateRates();
setInterval(updateRates, 30 * 60 * 1000);

//Допоміжна функція конвертації
function convertCurrency(amount, from, to) {
    if(!exchangeRates.usd || !exchangeRates.eur) return null;

    from = from.toUpperCase();
    to = to.toUpperCase();

    let result;

    if(from === "USD" && to === "UAH") result = amount * exchangeRates.usd;
    else if(from === "EUR" && to === "UAH") result = amount * exchangeRates.eur;
    else if(from === "UAH" && to === "USD") result = amount * exchangeRates.uahToUsd;
    else if(from === "UAH" && to === "EUR") result = amount * exchangeRates.uahToEur;
    else if(from === "USD" && to === "EUR") result = amount * exchangeRates.usd / exchangeRates.eur;
    else if(from === "EUR" && to === "USD") result = amount * exchangeRates.eur / exchangeRates.usd;
    else return null;

    return result;
}

//Меню команд
bot.setMyCommands([
    { command: '/start', description: 'Запустити бота' },
    { command: '/menu', description: 'Меню валют' },
    { command: '/rates', description: 'Показати всі курси'},
    { command: '/help', description: 'Довідка' }
]);

// /start
bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id,
        `👋 Привіт, ${msg.from.first_name || 'друг'}!\n\n` +
        "Я валютний конвертер.\n" +
        "Приклади:\n" +
        "▫️ 100 USD UAH\n" +
        "▫️ /usd 100\n" +
        "▫️ /eur 50\n\n" +
        "Або скористайся меню: /menu 🚀"
    );
});

//Команда для показу курсів
bot.onText(/\/rates/, (msg) => {
    if (!exchangeRates.usd) {
        return bot.sendMessage(msg.chat.id,"Курси ще не завантажені. Спробуйте пізніше ⏳");
    }

    const updatedAt = lastUpdate ? lastUpdate.toLocaleTimeString() : "невідомо";

    bot.sendMessage(msg.chat.id, `
        📊 Поточні курси:
        💵 1 USD = ${exchangeRates.usd.toFixed(2)} UAH
        💶 1 EUR = ${exchangeRates.eur.toFixed(2)} UAH
        🇺🇦 1 UAH = ${exchangeRates.uahToUsd.toFixed(4)} USD | ${exchangeRates.uahToEur.toFixed(4)} EUR
        ⏱ Оновлено: ${updatedAt}
    `);
});

//Меню з кнопками
bot.onText(/\/menu/, (msg) => {
    bot.sendMessage(msg.chat.id, "Оберіть валюту для конвертації:", {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: "USD → UAH", callback_data: "usd_uah" },
                    { text: "EUR → UAH", callback_data: "eur_uah" }
                ],
                [
                    { text: "UAH → USD", callback_data: "uah_usd" },
                    { text: "UAH → EUR", callback_data: "uah_eur" }
                ],
                [
                    { text: "USD ↔ EUR", callback_data: "usd_eur"}
                ],
                [
                    { text: "Інша конвертація", callback_data: "custom" }
                ]
            ]
        }
    });
});

//Сховище станів користувачів
const userState = new Map();

//Реакція на кнопки
bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;

    if(data === "custom") {
        userState.set(chatId, { custom: true });
        bot.sendMessage(chatId, "Введіть у форматі `100 USD EUR`", {parse_mode: "Markdown"});
    } else {
        const [from, to] = data.split("_");
        userState.set(chatId, { from: from.toUpperCase(), to: to.toUpperCase() });
        bot.sendMessage(chatId, `Введіть суму у ${from.toUpperCase()}:`)
    }

    bot.answerCallbackQuery(query.id);
});

//Обробка повідомлень
bot.on("message", (msg) => {
    if(!msg.text || msg.text.startsWith('/')) return;

    const chatId = msg.chat.id;
    const state = userState.get(chatId);

    //Якщо користувач натиснув кнопку і вводить число
    if(state && state.from && state.to) {
        const amount = parseFloat(msg.text.replace(',','.'));
        if(!isNaN(amount)) { 
            const result = convertCurrency(amount, state.from, state.to);
            if(result !== null) {
                bot.sendMessage(chatId, `${amount} ${state.from} = ${result.toFixed(2)} ${state.to}`);
            } else {
                bot.sendMessage(chatId, "Не підтримується така конвертація.");
            }
        } else {
            bot.sendMessage(chatId, "Введіть правильне число.");
        }

        //після виконання очищаємо стан
        userState.delete(chatId);
        return;
    }

    //Якщо custom формат: 100 USD EUR
    if(state && state.custom) {
        const parts = msg.text.trim().split(/\s+/);
        if(parts.length === 3) {
            const amount = parseFloat(parts[0].replace(',', '.'));
            if(!isNaN(amount)) {
                const result = convertCurrency(amount, parts[1], parts[2]);
                if(result !== null) {
                    bot.sendMessage(chatId, `${amount} ${parts[1].toUpperCase()} = ${result.toFixed(2)} ${parts[2].toUpperCase()}`);
                } else {
                    bot.sendMessage(chatId, "Не підтримується така конвертація.");
                }
            } else {
                bot.sendMessage(chatId, "Введіть правильне число.");
            }
        } else {
            bot.sendMessage(chatId, "Формат: 100 USD EUR");
        }
        userState.delete(chatId);
        return;
    }

    //Якщо просто написав "100 USD UAH"
    const parts = msg.text.trim().split(/\s+/);
    if(parts.length === 3) {
        const amount = parseFloat(parts[0].replace(',', '.'));
        if(!isNaN(amount)) {
            const result = convertCurrency(amount, parts[1], parts[2]);
            if(result !== null) {
                bot.sendMessage(chatId, `${amount} ${parts[1].toUpperCase()} = ${result.toFixed(2)} ${parts[2].toUpperCase()}`);
                return;
            }
        }
    }

    //Якщо не конвертер, то ехо
    bot.sendMessage(chatId, `Ти написав: ${msg.text}`); 
});

//Help
bot.onText(/\/help/, (msg) => {
    bot.sendMessage(msg.chat.id,
        "📌 Я валютний конвертер.\n\n" +
        "Використання:\n" +
        "• /eur 50 → переведе 50 EUR у гривні\n" +
        "• 100 USD UAH → універсальний формат\n\n" +
        "Або скористайся меню /menu 🚀"
    );
});

// ---- Команди та логіка бота ---- 

// /usd N
// bot.onText(/\/usd (\d+(\.\d+)?)/, async (msg, match) => {
//     const chatId = msg.chat.id;
//     const amount = parseFloat(match[1]);
//     try {
//         const response = await axios.get(`https://api.currencylayer.com/live?access_key=${currencyApiKey}&currencies=UAH&source=USD`);
//         if(!response.data.success) {
//             throw new Error(response.data.error?.info || 'API error');
//         }
//         const rate = response.data?.quotes?.USDUAH;
//         if(!rate) throw new Error('No rate in response');
//         const converted = (amount * rate).toFixed(2);
//         bot.sendMessage(chatId, `${amount} USD = ${converted} UAH (курс: ${rate})`);
//     } catch (err) {
//         console.error("Currency error (USD):", err.message);
//         bot.sendMessage(chatId, "Не вдалося отримати курс валют.Спробуйте пізніше.");
//     }
// });

// // /eur N
// bot.onText(/\/eur (\d+(\.\d+)?)/, async (msg, match) => {
//     const chatId = msg.chat.id;
//     const amount = parseFloat(match[1]);
//     try {
//         const response = await axios.get(`https://api.currencylayer.com/live?access_key=${currencyApiKey}&currencies=UAH,EUR&source=USD`);
//         if(!response.data.success) {
//             throw new Error(response.data.error?.info || 'API error');
//         }
//         const usdUah = response.data.quotes.USDUAH;
//         const usdEur = response.data.quotes.USDEUR;
//         if (!usdUah || !usdEur) throw new Error('No rate in response');
//         const eurUah = usdUah / usdEur;
//         const converted = (amount * eurUah).toFixed(2);
//         bot.sendMessage(chatId, `${amount} EUR = ${converted} UAH (курс: ${eurUah.toFixed(4)})`);
//     } catch (err) {
//         console.error("Currency error (EUR):", err.message);
//         bot.sendMessage(chatId, "Не вдалося отримати курс валют.");
//     }
// });

// ---- запуск сервера (тільки для webhook) або просто лог для polling ----
const port = process.env.PORT || 3000;
if(isProduction) {
    app.listen(port, async () => {
        console.log(`Server running on port ${port}`);
        try {
            await bot.setWebHook(`${url}/bot${token}`);
            console.log("Webhook set successfully");
        } catch (err) {
            console.error("Webhook error:",  err.message);
        }
    });
} else {
    console.log('Started in local polling mode.');
}

