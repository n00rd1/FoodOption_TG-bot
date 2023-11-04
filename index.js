const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('users.db');
require('dotenv').config();
// Приветственное сообщение в боте
const {TELEGRAM_BOT_TOKEN, ADMIN_ID} = process.env, TelegramApi = require('node-telegram-bot-api'),
    bot = new TelegramApi(TELEGRAM_BOT_TOKEN, {polling: true});

db.run(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER UNIQUE, username TEXT, phone_number TEXT, body_weight REAL DEFAULT 0, body_fat_percentage REAL DEFAULT 0, physical_activity_coefficient REAL DEFAULT 0, deficit REAL DEFAULT 0, surplus REAL DEFAULT 0, calories REAL DEFAULT 0);`);
const helloMsg = 'Приветствуем вас в «Food Options»!\n\n' +
    'Я ваш персональный помощник в мире здорового и вкусного питания. Моя миссия - упростить ваш выбор и обеспечить вас балансированными и вкусными блюдами, учитывая ваш индивидуальный калораж и особенности здоровья.\n\n' +
    'Что мы можем для вас сделать\n' +
    '💠 Рассчитать необходимый калораж, учитывая ваши предпочтения и ограничения.\n' +
    '💠 Подготовить персонализированное меню, исключив продукты, которые вам не подходят из-за язв, гастрита, лактозной непереносимости и других особенностей.\n' +
    '💠 Предложить вам варианты блюд, соответствующих вашим потребностям и вкусам.\n' +
    '💠 Подсказать примерную стоимость вашего заказа и предоставить статистику по вашим предпочтениям.\n' +
    '💠 Держать вас в курсе акций, скидок и изменений в расписании доставки.\n\n' +
    'Следите за нашими обновлениями и специальными предложениями в Instagram: https://www.instagram.com/foodoptions.kz/\n\n' +
    'Если у вас возникнут вопросы или понадобится помощь, не стесняйтесь обращаться. Мы также доступны в WhatsApp: http://wa.me/77776886396\n\n' +
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
// TODO: Массовая рассылка информации по доставке (например, задержка или отмена поставки сегодня)
// TODO: ----------------------------------------------------------------
// TODO: Проверить БД
// TODO: Добавить в БД поле с сохранением Калорий
// TODO: Добавить в БД поле для сохранения времени в которое доставляют
// TODO: Добавить в БД адрес для доставки

// Реакция на отправку контакта
bot.on('contact', async (msg) => {
    console.log('123');
    const phoneNumber = msg.contact.phone_number;
    const username = msg.chat.username || 'unknown';
    const userID = msg.from.id;

    // Обновление номера телефона в базе данных по user_id
    db.run('UPDATE users SET phone_number = ? WHERE user_id = ?', [phoneNumber, userID], err => {
        if (err) {
            console.error('Ошибка при обновлении номера телефона в базе данных:', err);
        }
    });

    if (username != 'unknown') {
        db.run('UPDATE users SET phone_number = ? WHERE user_id = ?', [phoneNumber, userID], err => {
            if (err) {
                console.error('Ошибка при обновлении номера телефона в базе данных:', err);
            }
        });
    }

    bot.sendMessage(userID, `Вы поделились своим номером телефона: ${phoneNumber}`);

    // чтобы дальше не шли проверки
    return;
});

// На написание письма реакция
bot.on('message', async msg => {
    console.log(msg);
    const username = msg.chat.username || 'unknown';

    // Проверка на бота (отказываем в обслуживании)
    if (msg.from.is_bot === true) {
        await bot.sendMessage(ADMIN_ID, `@${username}: Обнаружен бот!!`);
        return;
    }

    const text = msg.text;
    const chatID = msg.chat.id;
    const msgType = msg.entities ? msg.entities[0].type : 0;
    const contact = msg.contact ? msg.contact.phone_number : 0;

    if (contact != 0) {
        checkPhoneNumber(chatID);
    }

    // Проверяем, существует ли пользователь в базе данных
    db.get('SELECT * FROM users WHERE user_id = ?', [chatID], (err, row) => {
        if (err) {
            console.error('Ошибка при проверке пользователя в базе данных:', err);
            return;
        }
        // Добавляю нового пользователя
        if (!row) {
            const keyboard = {
                reply_markup: {
                    one_time_keyboard: true,
                    keyboard: [[{ text: 'Поделиться номером телефона', request_contact: true }]],
                },
            };
            bot.sendMessage(chatID, 'Поделитесь своим номером телефона, чтобы получить новый функционал!', keyboard);

            // Если пользователя нет в базе данных, добавляем его
            db.run('INSERT OR IGNORE INTO users (user_id, username) VALUES (?, ?)', [chatID, username], err => {
                if (err) {
                    console.error('Ошибка при добавлении пользователя в базу данных:', err);
                }
            });
        } else {
            // Если пользователь существует, тогда

        }
    });

// На время разработки
    if (ADMIN_ID !== chatID) {
        await bot.sendMessage(chatID, `Бот в разработке, обращайтесь в WhatsApp -- wa.me/77776886396`);
        await bot.sendMessage(ADMIN_ID, `Новый неавторизованный пользователь - {@${username} | ${chatID}} - ${text}`);
        return;
    }

    if (msgType === 'bot_command') {
        // приветственное сообщение
        if (text === '/start') {
            await bot.sendMessage(chatID, helloMsg);
        }

        // Настройка БЖУ
        if (text === '/setting') {

        }
    } else {
        // Пересылка информации админу
        if (ADMIN_ID !== chatID) {
            if (!msg.sticker) {
                await bot.sendMessage(ADMIN_ID, `@${username || chatID}: ${text}`);
            }
        }
    }
});

// Функция для проверки наличия номера телефона в базе данных по user_id
function checkPhoneNumber(chatID) {
    db.get('SELECT phone_number FROM users WHERE user_id = ?', [chatID], (err, row) => {
        if (err) {
            console.error('Ошибка при проверке номера телефона в базе данных:', err);
            return;
        }

        if (row && row.phone_number) {
            console.log('Номер телефона уже существует в базе данных:', row.phone_number);
        } else {
            // Запрос на отправку номера телефона пользователю
            const keyboard = {
                reply_markup: {
                    one_time_keyboard: true,
                    keyboard: [[{ text: 'Поделиться номером телефона', request_contact: true }]],
                },
            };
            bot.sendMessage(chatID, 'Поделитесь своим номером телефона:', keyboard);
        }
    });
}

// Функция для обновления username в базе данных по user_id
function updateUsernameInDatabase(userID, newUsername) {
    db.run('UPDATE users SET username = ? WHERE user_id = ?', [newUsername, userID], err => {
        if (err) {
            console.error('Ошибка при обновлении username в базе данных:', err);
        }
    });
}

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