const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('users.db');
require('dotenv').config();
// Приветственное сообщение в боте
const {TELEGRAM_BOT_TOKEN, ADMIN_ID} = process.env, TelegramApi = require('node-telegram-bot-api'),
    bot = new TelegramApi(TELEGRAM_BOT_TOKEN, {polling: true});

db.run(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER UNIQUE, body_weight REAL, body_fat_percentage REAL, physical_activity_coefficient REAL, deficit REAL, surplus REAL, message_count INTEGER DEFAULT 0)`);

const helloMsg = 'Добро пожаловать в «Food Options»🤍\n\n' +
    'Я ваш персональный помощник в мире здорового и вкусного питания. Моя миссия - упростить ваш выбор и обеспечить вас балансированными и вкусными блюдами, учитывая ваш индивидуальный калораж и особенности здоровья.\n\n' +
    'Что я могу для вас сделать:\n' +
    '💠 Рассчитать необходимый калораж, учитывая ваши предпочтения и ограничения.\n' +
    '💠 Составить меню, исключая продукты, которые вам не подходят из-за язв, гастрита, лактозной непереносимости и других особенностей.\n' +
    '💠 Предложить вам варианты блюд, отвечающих вашим потребностям и вкусам.\n' +
    '💠 Подсказать примерную стоимость вашего заказа и предоставить статистику по вашим предпочтениям.\n' +
    '💠 Держать вас в курсе акций, скидок и изменений в расписании доставки.\n\n' +
    'Следите за нашими обновлениями и специальными предложениями на Instagram: https://www.instagram.com/foodoptions.kz/\n\n' +
    'Если у вас есть какие-либо вопросы или вам нужна помощь, не стесняйтесь обращаться. Для связи с нами также доступен WhatsApp: http://wa.me/77776886396\n\n' +
    'Приятного аппетита и заботы о своем здоровье! 🍽️🌿';

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
// TODO: Проверить БД
// TODO: Добавить в БД поле с сохранением Калорий
// TODO: Добавить в БД поле для сохранения времени в которое доставляют
// TODO: Добавить в БД адрес для доставки

// На написание письма реакция
bot.on('message', async msg => {
    console.log(msg);

    // Проверка на бота (отказываем в обслуживании)
    if (msg.from.is_bot == true) {
        await bot.sendMessage(ADMIN_ID, `@${username}: Обнаружен бот!!`);
        return;
    }

    const text = msg.text;
    const chatID = msg.chat.id;
    const username = msg.chat.username;
    const msgType = msg.entities ? msg.entities[0].type : 0;

    // Проверяем, существует ли пользователь в базе данных
    db.get('SELECT * FROM users WHERE chat_id = ?', [chatID], (err, row) => {
        if (err) {
            console.error('Ошибка при проверке пользователя в базе данных:', err);
            return;
        }

        if (!row) {
            // Если пользователя нет в базе данных, добавляем его
            db.run('INSERT INTO users (chat_id) VALUES (?)', [chatID], err => {
                if (err) {
                    console.error('Ошибка при добавлении пользователя в базу данных:', err);
                }
            });
        } else {
            // Если пользователь существует, тогда
        }
    });

// На время разработки
    if (chatID != ADMIN_ID) {
        await bot.sendMessage(chatID, `Бот в разработке, обращайтесь в WhatsApp -- wa.me/77776886396`);
        await bot.sendMessage(ADMIN_ID, `Новый неавторизованный пользователь - {@${username} | ${chatID}} - ${text}`);
        return;
    }

    if (msgType == 'bot_command') {
        // приветственное сообщение
        if (text == '/start') {
            await bot.sendMessage(chatID, helloMsg);
        }

        // Настройка БЖУ
        if (text == '/setting') {

        }
    }
    else {
        // Пересылка информации админу
        if (chatID != ADMIN_ID) {
            if (!msg.sticker) {
                await bot.sendMessage(ADMIN_ID, `@${username || chatID}: ${text}`);
            }
        }
    }
});

// Обработчик ошибок базы данных
db.on('error', err => {
    console.error('Ошибка базы данных:', err);
});

// Закрываем базу данных при выходе из приложения
process.on('exit', () => {
    db.close(err => {
        if (err) {
            console.error('Ошибка при закрытии базы данных:', err);
        }
    });
});