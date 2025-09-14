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
   bot.sendMessage(msg.chat.id, `Привіт! ${msg.from.first_name}! Я працюю на Render.`);
});

//exo для інших повідомленнь
bot.on("message", (msg) => {
    if(msg.text && msg.text !== '/start') {
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
