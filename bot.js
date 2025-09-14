const express = require('express');
const bodyParser = require('body-parser');
const TelegramBot = require('node-telegram-bot-api');

const token = '8287055755:AAFDyxXqAEr6iw0Jc3IZYxJHwIL_4hnbqGM';
const url = 'https://firstbot-san3.onrender.com';

//Створюємо бота в режимі webhook
const bot = new TelegramBot(token, { webHook: true });
const app = express();

app.use(bodyParser.json());

//Маршрут для прийому апдейтів від Telegram
app.post(`/bot${token}`, (req, res) => {
    bot.processUpdate(req.body);
    res.sendStatus(200);
});

//реакція на команду /start
bot.onText(/\/start/, (msg) => {
    console.log("Отримано команду /start від:", msg.from.username || msg.from.first_name);
   bot.sendMessage(msg.chat.id, `Привіт! ${msg.from.first_name}! Я працюю на Render.`);
});

//Конвертер
const axios = require("axios");

bot.onText(/\/usd (\d+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const amount = parseFloat(match[1]);

    try {
        const response = await axios.get("https://api.exchangerate.host/latest?base=USD&symbols=UAH");
        const rate = response.date.rates.UAH;

        const converted = (amount * rate).toFixed(2);
        bot.sendMessage(chatId, `${amount} USD = ${converted} UAH (курс: ${rate})`);
    } catch (err) {
        console.error("Currency error:", err.message);
        bot.sendMessage(chatId, "Не вдалося отримати курс валют.");
    }
});

bot.onText(/\/eur (\d+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const amount = parseFloat(match[1]);

    try {
        const response = await axios.get("https://api.exchangerate.host/latest?base=EUR&symbols=UAH");
        const rate = response.date.rates.UAH;

        const converted = (amount * rate).toFixed(2);
        bot.sendMessage(chatId, `${amount} EUR = ${converted} UAH (курс: ${rate})`);
    } catch (err) {
        console.error("Currency error:", err.message);
        bot.sendMessage(chatId, "Не вдалося отримати курс валют.");
    }
});

//exo для інших повідомленнь
bot.on("message", (msg) => {
    if(msg.text && msg.text !== '/start') {
        console.log("Отримано повідомлення:", msg.text, "від", msg.from.username || msg.from.first_name_name);
        bot.sendMessage(msg.chat.id, `Ти написав: ${msg.text}`);
    }
});

//запускаємо сервер
const port = process.env.PORT || 3000;
app.listen(port, async () => {
    console.log(`Bot running on port ${port}`);

    try {
        const res = await bot.setWebHook(`${url}/bot${token}`);
        console.log("Webhook set:", res);
    } catch(err) {
        console.error("Webhook error:", err.response?.body || err);
    }
});
