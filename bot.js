require('dotenv').config();//Підключаємо .env

const express = require('express');
const bodyParser = require('body-parser');
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config();
const currencyApiKey = process.env.CURRENCY_API_KEY;
const token = process.env.BOT_TOKEN;
const url = process.env.BOT_URL || 'https://firstbot-san3.onrender.com';

//Визначаємо режим: production -> webhook, інакше -> polling
const isProduction = process.env.NODE_ENV === 'production';

let bot;

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
//Меню команд
bot.setMyCommands([
    { command: '/start', description: 'Запустити бота' },
    { command: '/menu', description: 'Меню валют' },
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
                    { text: "Інша конвертація", callback_data: "custom" }
                ]
            ]
        }
    });
});

//Реакція на кнопки
bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;

    if(data === "usd_uah") {
        bot.sendMessage(chatId, "Введіть суму у USD, яку потрібно конвертувати");
    }
    if(data === "eur_uah") {
        bot.sendMessage(chatId, "Введіть суму у EUR:");
    }
    if(data === "uah_usd") {
        bot.sendMessage(chatId, "Введіть суму у гривнях (UAH):");
    }
    if(data === "uah_eur") {
        bot.sendMessage(chatId, "Введіть суму у гривнях (UAH):");
    }
    if(data === "custom") {
        bot.sendMessage(chatId, "Введіть у форматі `100 USD EUR`", {parse_mode: "Markdown"});
    }

    bot.answerCallbackQuery(query.id);
});

//Універсальний конвертер "100 USD UAH"
bot.on("message", async (msg) => {
    if(!msg.text  || msg.text.startsWith('/')) return;

    const parts = msg.text.trim().split(/\s+/);
    if(parts.length === 3) {
        const amount = parseFloat(parts[0].replace(',', '.'));
        const from = parts[1].toUpperCase();
        const to = parts[2].toUpperCase();

        if(!isNaN(amount)) {
            try {
                const response = await axios.get(`https://api.currencylayer.com/convert?access_key=${currencyApiKey}&from=${from}&to=${to}&amount=${amount}`);
                if(response.data.success) {
                    bot.sendMessage(msg.chat.id, `${amount} ${from} = ${response.data.result.toFixed(2)} ${to}`);
                } else {
                    bot.sendMessage(msg.chat.id, "Не вдалося конвертувати валюту. Перевір правельність коду валют.");
                }
            } catch (err) {
                console.error('Convert error:', err.message);
                bot.sendMessage(msg.chat.id, "Помилка при отриманні курсу. Спробуйте пізніше.");
            }
            return
        }
    }

    //Якщо не конвертер, то ехо
    bot.sendMessage(msg.chat.id, `Ти написав: ${msg.text}`);
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
bot.onText(/\/usd (\d+(\.\d+)?)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const amount = parseFloat(match[1]);
    try {
        const response = await axios.get(`https://api.currencylayer.com/live?access_key=${currencyApiKey}&currencies=UAH&source=USD`);
        if(!response.data.success) {
            throw new Error(response.data.error?.info || 'API error');
        }
        const rate = response.data?.quotes?.USDUAH;
        if(!rate) throw new Error('No rate in response');
        const converted = (amount * rate).toFixed(2);
        bot.sendMessage(chatId, `${amount} USD = ${converted} UAH (курс: ${rate})`);
    } catch (err) {
        console.error("Currency error (USD):", err.message);
        bot.sendMessage(chatId, "Не вдалося отримати курс валют.Спробуйте пізніше.");
    }
});

// /eur N
bot.onText(/\/eur (\d+(\.\d+)?)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const amount = parseFloat(match[1]);
    try {
        const response = await axios.get(`https://api.currencylayer.com/live?access_key=${currencyApiKey}&currencies=UAH,EUR&source=USD`);
        if(!response.data.success) {
            throw new Error(response.data.error?.info || 'API error');
        }
        const usdUah = response.data.quotes.USDUAH;
        const usdEur = response.data.quotes.USDEUR;
        if (!usdUah || !usdEur) throw new Error('No rate in response');
        const eurUah = usdUah / usdEur;
        const converted = (amount * eurUah).toFixed(2);
        bot.sendMessage(chatId, `${amount} EUR = ${converted} UAH (курс: ${eurUah.toFixed(4)})`);
    } catch (err) {
        console.error("Currency error (EUR):", err.message);
        bot.sendMessage(chatId, "Не вдалося отримати курс валют.");
    }
});

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

