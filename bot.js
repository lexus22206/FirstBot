const express = require('express');
const bodyParser = require('body-parser');
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

const token = process.env.BOT_TOKEN || '8287055755:AAFDyxXqAEr6iw0Jc3IZYxJHwIL_4hnbqGM';
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

//Якщо webhook-режим, то реєструємо маршрут для прийому апдейтів
if(isProduction) {
    app.post(`/bot${token}`, (req, res) => {
        console.log('Received update (webhook):', JSON.stringify(req.body).slice(0, 1000));
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
    console.log("Отримано команду /start від:",msg.from && (msg.from.username || msg.from.first_name));
    bot.sendMessage(msg.chat.id, `Привіт! ${msg.from.first_name || 'друг'}! Я валютний конвертер \nПриклад: 100 USD UAH`);
});

// /usd N
bot.onText(/\/usd (\d+(\.\d+)?)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const amount = parseFloat(match[1]);
    try {
        const response = await axios.get("https://api.exchangerate.host/latest?base=USD&symbols=UAH");
        console.log("API USD Response:", response.data); //Лог для перевірки 
        const rate = response.data?.rates?.UAH;
        if(!rate) throw new Error('No rate in response');
        const converted = (amount * rate).toFixed(2);
        bot.sendMessage(chatId, `${amount} USD = ${converted} UAH (курс: ${rate})`);
    } catch (err) {
        console.error("Currency error (USD):", err.message || err);
        bot.sendMessage(chatId, "Не вдалося отримати курс валют.");
    }
});

// /eur N
bot.onText(/\/eur (\d+(\.\d+)?)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const amount = parseFloat(match[1]);
    try {
        const response = await axios.get("https://api.exchangerate.host/latest?base=EUR&symbols=UAH");
        console.log("API EUR Response:", response.data); //Лог для перевірки 
        const rate = response.data?.rates?.UAH;
        if (!rate) throw new Error('No rate in response');
        const converted = (amount * rate).toFixed(2);
        bot.sendMessage(chatId, `${amount} EUR = ${converted} UAH (курс: ${rate})`);
    } catch (err) {
        console.error("Currency error (EUR):", err.message || err);
        bot.sendMessage(chatId, "Не вдалося отримати курс валют.");
    }
});

//Універсальний конвертер "100 USD UAH"
bot.on('message', async (msg) => {
    if(!msg.text) return;
    if(msg.text.startsWith('/')) return; //Команди обробляються окремо

    console.log("Received message:", msg.text, "from", msg.from && (msg.from.username || msg.from.first_name));

    const parts = msg.text.trim().split(/\s+/);
    if(parts.length === 3) {
        const amount = parseFloat(parts[0].replace(',', '.'));
        const from = parts[1].toUpperCase();
        const to = parts[2].toUpperCase();

        if(!isNaN(amount)) {
            try {
                const resp = await axios.get(`https://api.exchangerate.host/convert?from=${from}&to=${to}&amount=${amount}`);
                if(resp.data && typeof resp.data.result !== 'undefined') {
                    bot.sendMessage(msg.chat.id, `${amount} ${from} = ${resp.data.result.toFixed(2)} ${to}`);
                } else {
                    bot.sendMessage(msg.chat.id, "Не вдалося конвертувати валюту. Перевір правельність коду валют.");
                }
            } catch (err) {
                console.error('Convert error:', err.message || err);
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
        console.log(`Server running on port ${port} (webhook mode). App URL: ${url}`);
    
        try {
            const res = await bot.setWebHook(`${url}/bot${token}`);
            console.log("Webhook set:", res);
        } catch(err) {
            console.error("Webhook error:", (err.response && err.response.data) || err.message || err);
        }
    });
} else {
    console.log('Started in local mode. No express server listening for webhook.');
}

