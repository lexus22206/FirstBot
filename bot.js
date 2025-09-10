const express = require('express');
const bodyParser = require('body-parser');
const TelegramBot = require('node-telegram-bot-api');
const token = '8287055755:AAFDyxXqAEr6iw0Jc3IZYxJHwIL_4hnbqGM';
const bot = new TelegramBot(token);
const app = express();

app.use(bodyParser.json());

//URL з ngrok
const url = 'https://9a5d27ff2e4c.ngrok-free.app';
const port = 3000;

//встановлюємо webhook
bot.setWebHook("https://firstbot-san3.onrender.com" + token);

//приймаємо повідомлення від Telegram
app.post(`/bot${token}`, (req, res) => {
    bot.processUpdate(req.body);
    res.sendStatus(200);
});

//реакція на команду /start
bot.onText(/\/start/, (msg) => {
   bot.sendMessage(msg.chat.id, `Привіт! ${msg.from.first_name}! Я працюю через Webhook.`);
});

//exo
bot.on("message", (msg) => {
    if(msg.text && msg.text !== '/start') {
        bot.sendMessage(msg.chat.id, `Ти написав: ${msg.text}`);
    }
});

//запускаємо сервер
app.listen(port, () => {
    console.log(`Express server running on port ${port}`);
});