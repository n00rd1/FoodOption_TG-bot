const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('users.db');
const fs = require('fs').promises;
require('dotenv').config();
// Приветственное сообщение в боте
const {TELEGRAM_BOT_TOKEN, ADMIN_ID} = process.env, TelegramApi = require('node-telegram-bot-api'),
    bot = new TelegramApi(TELEGRAM_BOT_TOKEN, {polling: true});

db.run(`CREATE TABLE IF NOT EXISTS users
        (
            id                            INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id                       INTEGER UNIQUE,
            username                      TEXT,
            phone                         TEXT,
            gender                        TEXT DEFAULT 'М',
            height                        REAL DEFAULT 0,
            middle                        REAL DEFAULT 0,
            format                        TEXT DEFAULT 'общий',
            weight                        REAL DEFAULT 0,
            fat                           REAL DEFAULT 0,
            activity                      REAL DEFAULT 0,
            target                        TEXT DEFAULT 'похудеть',
            state                         TEXT DEFAULT 'start_gender',
            calories                      REAL DEFAULT 0
        );`);

// Реакция на callback
bot.on('callback_query', async (callbackQuery) => {
    const message = callbackQuery.message;
    const userId = message.chat.id;
    const callbackQueryData = callbackQuery.data;

    const [data, value] = data.split(':');

    switch (data) {
        case 'activity':
            await handleActivitySelection(userId, value);
            break;
        case 'format':
            await handleFormatSelection(userId, value);
            break;
        case 'общий':
        case 'индивидуальный':
            await updateFormatDatabase(userId, data);
            break;

        // Добавьте другие случаи обработки здесь
        default:
            // Неизвестный тип запроса
            await bot.sendMessage(userId, 'Неизвестный запрос.');
    }
});

// Реакция на отправку контакта
bot.on('contact', async (msg) => {
    const phoneNumber = msg.contact.phone;
    const username = msg.chat.username || 'unknown';
    const userID = msg.from.id;

    await updatePhoneNumber(phoneNumber, userID);
});

// На написание письма реакция
bot.on('message', async msg => {
    await console.log(msg);
    const username = msg.chat.username || 'unknown';
    const chatID = msg.chat.id;

    // Проверка на бота (отказываем в обслуживании)
    if (msg.from.is_bot)
        return await bot.sendMessage(ADMIN_ID, `@${username}: Обнаружен бот!!`);

    const text = msg.text || '';
    const msgType = msg.entities ? msg.entities[0].type : 'text';
    const contact = msg.contact ? msg.contact.phone : 0;

    if (msgType === 'bot_command') {
        // приветственное сообщение
        if (text === '/start') {
            await sayHello(chatID);
        }

        // Настройка БЖУ
        if (text === '/reset') {
            await sayHello(chatID, true)
        }
    } else {
        // Пересылка информации админу
        await notifyAdmin(ADMIN_ID, username, text);
    }


    // Проверяем, существует ли пользователь в базе данных
    db.get('SELECT * FROM users WHERE user_id = ?', [chatID], async (err, row) => {
        //
        if (err) await logError('Ошибка при проверке пользователя в базе данных:', err);

        // Добавляю нового пользователя
        if (!row) await giveMeYourPhoneNumber(chatID, username);
    });

});

// Отправка приветственного сообщения проверка веса
async function sayHello(chatID, reset = false) {
    const helloMsg = 'Приветствуем вас в «Food Options»!\n\n' +
        'Я ваш персональный помощник в мире здорового и вкусного питания. Моя миссия - упростить ваш выбор и обеспечить вас сбалансированными и вкусными блюдами, учитывая ваш индивидуальный калораж и особенности здоровья.\n\n' +
        'Что мы можем для вас сделать\n' +
        '💠 Рассчитать необходимый калораж, учитывая ваши предпочтения и ограничения.\n' +
        '💠 Подготовить персонализированное меню, исключив продукты, которые вам не подходят из-за язв, гастрита, лактозной непереносимости и других особенностей.\n' +
        '💠 Предложить вам варианты блюд, соответствующих вашим потребностям и вкусам.\n' +
        '💠 Подсказать примерную стоимость вашего заказа и предоставить статистику по вашим предпочтениям.\n' +
        '💠 Держать вас в курсе акций, скидок и изменений в расписании доставки.\n\n' +
        'Следите за нашими обновлениями и специальными предложениями в Instagram: https://www.instagram.com/foodoptions.kz/\n\n' +
        'Если у вас возникнут вопросы или понадобится помощь, не стесняйтесь обращаться. Мы также доступны в WhatsApp: https://wa.me/77776886396\n\n' +
        'Приятного аппетита и заботы о своем здоровье! 🍽️🌿';

    const start_settings = 'Для примерного просчёта уникальных параметров для вас необходимо заполнить простую анкету, для этого ответьте на вопросы ниже.\n\n' +
        'Необходимо будет указать следующие параметры:' +
        '    🤸⚖️ Общая масса тела / кг ⚖️\n' +
        '    🤸‍♀️ % жира 🤸‍♀️\n' +
        '    🍽️ Дефицит калорий 📉\n' +
        '    🍔 Профицит калорий 📈';

    if (reset === false) {
        await bot.sendMessage(chatID, helloMsg);
    }

    db.run('UPDATE users SET state = ? WHERE user_id = ?', ['start_quick', chatID], async err => {
        if (err) {
            await logError('Ошибка при обновлении изменении статуса', err);
        }
    });

    await bot.sendMessage(chatID, start_settings);
    await askMale(chatID);
}

/*********************************************************
 *****    *****            ПРОЧЕЕ            *****   *****
 *********************************************************/
// Функция для отправки сообщений администратору
async function notifyAdmin(chatID, username, text) {
    if (ADMIN_ID !== chatID) {
        const message = `@${username || chatID}: ${text}`;
        await bot.sendMessage(ADMIN_ID, message);
    }
}

// Функция для обновления username в базе данных по user_id
async function updateUsernameInDatabase(userID, newUsername) {
    db.run('UPDATE users SET username = ? WHERE user_id = ?', [newUsername, userID], async err => {
        if (err) {
            await logError('Ошибка при обновлении username в базе данных:', err);
        }
    });
}

// Функция для обновления статуса
async function getNextStates(userID){
    let currentState = "", currentFormat = "";
    db.get('SELECT state, format FROM users WHERE user_id = ?', [userID], (err, row) => {
        if (err) {
            // Обработка ошибки
            logError('Ошибка при получении данных из базы данных:', err);
            return;
        }

        if (row) {
            currentState = row.state; // Сохраняем статус в переменной
            currentFormat = row.format; // Сохраняем формат в переменной
        } else {
            logError('Пользователь не найден в базе данных'); // Ситуация, когда пользователь не найден
            return;
        }
    });

    // Список состояний в порядке их следования
    const allStatesStart = [
        'start_quick', 'start_gender', 'start_middle', 'start_height', 'start_format',
    ];

    const allStatesDefaultStart = [
        'start_choose_weight', 'start_price',
    ];

    const allStatesIndividualStart = [
        'start_weight', 'start_fat', 'start_activity', 'start_target', 'start_calories',
    ];

    const allStatesDefault = [
        'gender', 'middle', 'height', 'format', 'choose_weight', 'price', 'weight', 'fat', 'activity', 'target', 'delivery',
    ];

    // Определяем индекс текущего состояния
    let newState = "", currentIndex = allStatesDefault.indexOf(currentState);

    if (currentIndex !== -1 && currentIndex !== allStatesDefault.length - 1) {
        newState = allStatesDefault[currentIndex + 1];
    }
    else {
        if (currentIndex === allStatesDefault.length - 1) {
            newState = 'default';
        }
        else {
            currentIndex = allStatesStart.indexOf(currentState);
            if (currentIndex !== -1 && currentIndex !== allStatesStart.length - 1) { // Если текущее состояние входит в начальное
                newState = allStatesStart[currentIndex + 1];
            } else if (currentIndex === allStatesStart.length - 1) { // Если текущее состояние входит в начальное и оно последнее
                if (currentFormat == "общ") { // Если текущей формат - общий
                    newState = allStatesDefaultStart[0];
                } else if (currentFormat == "индив") { // Если текущей формат - индивидуальный
                    newState = allStatesIndividualStart[0]
                }
            } else {
                if (currentFormat == "общ") {
                    currentIndex = allStatesDefaultStart.indexOf(currentState);
                    if (currentIndex !== -1 && currentIndex !== allStatesDefaultStart.length - 1) { // Если текущее состояние входит в общее
                        newState = allStatesDefaultStart[currentIndex + 1];
                    } else {
                        newState = allStatesDefault[allStatesDefault.length - 1];
                    }
                } else if (currentFormat == "индив") {
                    currentIndex = allStatesIndividualStart.indexOf(currentState);
                    if (currentIndex !== -1 && currentIndex !== allStatesIndividualStart.length - 1) { // Если текущее состояние входит в общее
                        newState = allStatesIndividualStart[currentIndex + 1];
                    } else {
                        newState = allStatesDefault[allStatesDefault.length - 1];
                    }
                }
            }
        }
    }


db.run('UPDATE users SET state = ? WHERE user_id = ?', [newState, userID], async err => {
    if (err) {
        await logError('Ошибка при обновлении username в базе данных:', err);
    }
});
}

/*********************************************************
 ***    *****   ВАЖНЫЕ ЧАСТИ ДЛЯ РАБОТЫ       ****   *****
 *********************************************************/
// Обработчик ошибок базы данных
db.on('error', async err => {
    await notifyAdmin(ADMIN_ID, '', 'База данных поела говна');
    await logError('Ошибка базы данных:', err);
});

// Закрываем базу данных при выходе из приложения
process.on('exit', async () => {
    db.close(async err => {
        if (err) {
            await notifyAdmin(ADMIN_ID, '', 'Ошибка при закрытии базы данных');
            await logError('Ошибка при закрытии базы данных:', err)
        }
    });
});

/*********************************************************
 ***    *****           ТЕЛЕФОН               ****   *****
 *********************************************************/
// Обновление номера телефона в базе данных
const updatePhoneNumber = async (phoneNumber, userID) => {
    try {
        await db.run('UPDATE users SET phone = ? WHERE user_id = ?', [phoneNumber, userID]);
        await logError(`Номер телефона обновлен для пользователя ${userID}`);
    } catch (err) {
        await logError('Ошибка при обновлении номера телефона в базе данных:', err);
        await bot.sendMessage(userID, 'Произошла ошибка при обновлении вашего номера телефона. Пожалуйста, попробуйте снова.');
    }
};

// Функция записи в лог файл
async function logError(err) {
    const errorMessage = `[${new Date().toISOString()}] ${err}\n`;
    try {
        await fs.appendFile('error.log', errorMessage);
    } catch (fileErr) {
        await notifyAdmin(ADMIN_ID, '', 'Ошибка при записи в лог-файл');
        console.error('Ошибка при записи в лог-файл', fileErr);
    }
}
