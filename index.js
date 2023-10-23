require('dotenv').config();

const TelegramApi = require('node-telegram-bot-api');
const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramApi(token, {polling: true});

// ID администраторов Бота
const n00rd1ID = '5572836167';
const Oleg = '';
// Приветственное сообщение в боте
const helloMsg = 'Добро пожаловать в «Food Options»🤍\nЯ умный бот, который поможет ответить на ваши вопросы! Вот что я умею\n ....';

// На написание письма реакция
bot.on('message', async msg => {
    const username = msg.chat.username;

    // Проверка на бота
    if (msg.from.is_bot == true) {
        await bot.sendMessage(n00rd1ID, `@${username}: Обнаружен бот!!`);
        return;
    }

    const text = msg.text;
    const chatID = msg.chat.id;

    if (text == '/start') {
        // стикер "Привет!"
        // await bot.sendSticker(chatID, 'CAACAgIAAxkBAAN0ZE2EB_6623WLGIP3-C7fvOxFLQ8AAtMAA1advQr1Mo-X1RL5PS8E');

        // приветсвенное сообщение
        await bot.sendMessage(chatID, helloMsg);
    }

    // Пересылка информации админу
    if (chatID != n00rd1ID) {
        if (msg.sticker) {
            await bot.sendMessage(n00rd1ID, `@${username}: прислал стикер`);
            //await bot.sendSticker(n00rd1ID, msg.file_id)
        } else {
            await bot.sendMessage(n00rd1ID, `@${username}: ${text}`);
        }
    }

    console.log(msg);

    /*    if ((msg.chat.type === 'group' || msg.chat.type === 'supergroup')) {
            try {

            } catch (error) {
                // Вывод ошибки в консоль
                console.error(error);
                // Отправка сообщения об ошибке
                await bot.sendMessage(chatId, 'Произошла ошибка при попытке назначить пользователя администратором беседы');
            }
        }*/
});
