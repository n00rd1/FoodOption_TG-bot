require('dotenv').config();
const { TELEGRAM_BOT_TOKEN, ADMIN_ID } = process.env;
const TelegramApi = require('node-telegram-bot-api');
const bot = new TelegramApi(TELEGRAM_BOT_TOKEN, {polling: true});

// Приветственное сообщение в боте
const helloMsg = 'Добро пожаловать в «Food Options»🤍\nЯ умный бот, который поможет ответить на ваши вопросы! Вот что я умею\n ....';

// TODO: написать приветственное сообщение
// TODO: ----------------------------------------------------------------
// TODO: Расчёт калорий и прочего по индивидуальным показателям
// TODO: 1) Похудеть/потолстеть
// TODO: 2) общий вес
// TODO: 3) % жира
// TODO: 4) активность (из вариантов)
// TODO: 5*) похудеть => -300 от общего калоража
// TODO: 5*) потолстеть => +300 от общего калоража
// TODO: ----------------------------------------------------------------
// TODO: Указание времени для доставки питания
// TODO: 1) вечер (с 19 00 до 22 00)
// TODO: 2) утро (с 7 00 до 10 00)
// TODO: ----------------------------------------------------------------
// TODO: Сохранение всей информации по обращающимся клиентам (контакты в ТГ и номер телефона)
// TODO: ----------------------------------------------------------------
// TODO: Массовая рассылка информации по доставке (например, задержка или отмена поставки сегодня)
// TODO: ----------------------------------------------------------------


// На написание письма реакция
bot.on('message', async msg => {
    const username = msg.chat.username;

    // Проверка на бота (отказываем в обслуживании)
    if (msg.from.is_bot == true) {
        //await bot.sendMessage(ADMIN_ID, `@${username}: Обнаружен бот!!`);
        return;
    }

    const text = msg.text;
    const chatID = msg.chat.id;

    // приветственное сообщение
    if (text == '/start') {
        await bot.sendMessage(chatID, helloMsg);
        return;
    }

    // Настройка БЖУ
    if (text == '/setting') {

    }

    // Пересылка информации админу
    if (chatID != ADMIN_ID) {
        if (!msg.sticker) {
            await bot.sendMessage(ADMIN_ID, `@${username || chatID}: ${text}`);
        }
    }

    console.log(msg);
});
