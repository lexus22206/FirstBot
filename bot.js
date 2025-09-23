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

//Меню команд
bot.setMyCommands([
    { command: '/start', description: 'Запустити бота' },
    { command: '/menu', description: 'Меню валют' },
    { command: '/help', description: 'Ljdslrf' }
]);

//Меню з кнопками
bot.onText(/\/menu/, (msg) => {
    bot.sendMessage(msg.chat.id, "Оберіть валюту для конвертації:", {
        reply_markup: {
            keyboard: [
                ["USD → UAH", "EUR → UAH"],
                ["UAH → USD", "UAH → EUR"],
                ["Інша конвертація"]
            ],
            resize_keyboard: true, //робить кнопки компактними
            one_time_keyboard: false //меню не зникає після натискання
        }
    });
});

//Реакція на кнопки
bot.on('message', async (msg) => {
    const text = msg.text;
    constchatId = msg.chat.id;

    if(text === "USD → UAH") {
        bot.sendMessage(chatId, "Введіть суму у USD, яку потрібно конвертувати");
        return;
    }
    if(trxt === "EUR → UAH") {
        bot.sendMessage(chatId, "Введіть суму у EUR:");
        return;
    }
    if(text === "UAH → USD") {
        bot.sendMesage(chatId, "Введіть суму у гривнях (UAH):");
        return;
    }
    if(text === "UAH → EUR") {
        bot.sendMessage(chatId, "Введіть суму у гривнях (UAH):");
        return;
    }
    if(text === "Інша конвертація") {
        bot.sendMessage(chatId, "Введіть у форматі `100 USD EUR`", {parse_mode: "Markdown"});
        return;
    }
});

//Красиві повідомлення 
bot.sendMessage(chatId,
    `💵 *${amount} ${from}* = 💶 *${converted} ${to}*\n\n📊 Курс: _${rate.toFixed(2)}_`,
    {parse_mode: "Markdown"}
);

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

// ---- Команди та логіка бота ---- 

// /start
bot.onText(/\/start/, (msg) => {
    console.log("Отримано команду /start від:", msg.from.username || msg.from.first_name);
    bot.sendMessage(msg.chat.id, `Привіт! ${msg.from.first_name || 'друг'}! Я валютний конвертер \nПриклад: 100 USD UAH\nКоманди:\n/usd 100\n/eur 100`);
});

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

//Універсальний конвертер "100 USD UAH"
bot.on('message', async (msg) => {
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

