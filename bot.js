const express = require('express');
const bodyParser = require('body-parser');
const TelegramBot = require('node-telegram-bot-api');
const token = '8287055755:AAFDyxXqAEr6iw0Jc3IZYxJHwIL_4hnbqGM';
const bot = new TelegramBot(token);
const app = express();


app.use(bodyParser.json());

//URL з ngrok
const url = 'https://firstbot-san3.onrender.com';

//приймаємо повідомлення від Telegram
app.post(`/bot${token}`, (req, res) => {
    bot.processUpdate(req.body);
    res.sendStatus(200);
});

//реакція на команду /start
bot.onText(/\/start/, (msg) => {
   bot.sendMessage(msg.chat.id, `Привіт! ${msg.from.first_name}! Я працюю на Render.`);
});

//exo
bot.on("message", (msg) => {
    if(msg.text && msg.text !== '/start') {
        bot.sendMessage(msg.chat.id, `Ти написав: ${msg.text}`);
    }
});

//запускаємо сервер
const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log("Bot ranning on port", port);

    //встановлюємо webhook
    bot.setWebHook(`${url}/bot${token}`);
});
