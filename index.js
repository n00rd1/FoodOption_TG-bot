const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('users.db');
const fs = require('fs').promises;
require('dotenv').config();
// Приветственное сообщение в боте
const {TELEGRAM_BOT_TOKEN, ADMIN_ID} = process.env, TelegramApi = require('node-telegram-bot-api'),
    bot = new TelegramApi(TELEGRAM_BOT_TOKEN, {polling: true});

db.run(`CREATE TABLE IF NOT EXISTS users (
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

bot.on('contact', async (msg) => { // Реакция на отправку контакта
    await updatePhoneNumber(msg.from.id, msg.contact.phone);
});
bot.on('document', async (msg) => { // Реакция на отправку документа
    await notifyAdmin(msg.from.id, msg.chat.username || 'unknown', "Прислал документ"); // Отправка уведомления о документе
    await forwardAdmin(msg); // Пересылка самого сообщения
    await bot.sendMessage(msg.from.id, `Ваше сообщение успешно отправлено администрации!`);
});
bot.on('photo', async (msg) => { // Реакция на отправку фото
    await notifyAdmin(msg.from.id, msg.chat.username || 'unknown', "Прислал фото"); // Отправка уведомления о документе
    await forwardAdmin(msg); // Пересылка самого сообщения
    await bot.sendMessage(msg.from.id, `Ваше сообщение успешно отправлено администрации!`);
});
bot.on('voice', async (msg) => { // Реакция на отправку голосового
    await notifyAdmin(msg.from.id, msg.chat.username || 'unknown', "Прислал голосовое сообщение"); // Отправка уведомления о документе
    await forwardAdmin(msg); // Пересылка самого сообщения
    await bot.sendMessage(msg.from.id, `Ваше сообщение успешно отправлено администрации!`);
});

// На написание письма реакция
bot.on('text', async msg => {
await console.log(msg);
    const username = msg.chat.username || 'unknown';
    const chatID = msg.chat.id;

    // Проверка на бота (отказываем в обслуживании)
    if (msg.from.is_bot)
        return await bot.sendMessage(ADMIN_ID, `@${username}: Обнаружен бот!!`);

    // Если не бот, то проверяю регистрацию
    await checkUserInDatabase(chatID, username);

    const text = msg.text || '';
    const msgType = msg.entities ? msg.entities[0].type : 'text';

    if (msgType === 'bot_command') {
        if (text === '/start') {        // Приветственное сообщение
            await sayHello(chatID);
            return ;
        } else if (text === '/command') {
            return;
        }
    } else {
        // Пересылка информации админу
        await notifyAdmin(ADMIN_ID, username, text);
    }

    let state = await getUserState(chatID);
    switch (state) {
        case 'start_gender':
        case 'gender':
            await updateGenderDatabase(chatID, text, state);
            if (state === 'start_gender')
                await askMiddle(chatID);
            break;

        case 'start_format':
        case 'format':
            await updateFormatDatabase(chatID, text);
            text === '👥🌍 Общий 🔄📢' ? await askChooseWeight(chatID) : await askWeight(chatID);
            break;

        case 'start_target':
        case 'target':
            await updateTargetDatabase(chatID, text);
            if (state === 'start_target')
                await findCaloriesDatabase(chatID, state);
            break;

        case 'start_choose_weight':
        case 'choose_weight':
            await updateChooseWeightDatabase(chatID, text);
            await askChoosePrice(chatID);
            break;

        case 'start_activity':
        case 'activity':
            await updateActivityDatabase(chatID, text, state);
            if (state === 'start_activity')
                await askTarget(chatID);
            break;

        case 'start_choose_price':
        case 'choose_price':
            await updateChoosePriceDatabase(chatID, text, state);
            if (state === 'start_choose_price')
                await askDelivery(chatID);
            break;

        default:
            await bot.sendMessage(chatID, 'Це шо?');
            break;
    }
});

// Отправка приветственного сообщения проверка веса
async function sayHello(userId) {
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
/*
    const startSettings = 'Для примерного просчёта уникальных параметров для вас необходимо заполнить простую анкету, для этого ответьте на вопросы ниже.\n\n' +
        'Необходимо будет указать следующие параметры:' +
        '    🤸⚖️ Общая масса тела / кг ⚖️\n' +
        '    🤸‍♀️ % жира 🤸‍♀️\n' +
        '    🍽️ Дефицит калорий 📉\n' +
        '    🍔 Профицит калорий 📈';
*/

    await updateStateInDatabase(userId, 'start_gender');
    await bot.sendMessage(userId, helloMsg);
    await askMale(userId);
}

/*********************************************************
 *****    *****            ПОЛ               *****   *****
 *********************************************************/
async function askMale(userId) {
    const genderKeyboard = {
        reply_markup: JSON.stringify({
            one_time_keyboard: true,
            resize_keyboard: true,
            keyboard: [
                [
                    { text: '👔 Мужчина 👨' },
                    { text: '👠 Женщина 👩' }
                ]
            ]
        })
    };

    await bot.sendMessage(userId, 'Вы мужчина или женщина?', genderKeyboard);
}

// Функция для сохранения или обновления пола пользователя
async function updateGenderDatabase(userId, genderInput, state) {
    let newState = (state !== 'start_gender' ? 'default' : 'start_middle');
    const validatedGender = (genderInput === '👔 Мужчина 👨' ? 'М' : 'Ж');

    db.run('UPDATE users SET gender = ?, state = ? WHERE user_id = ?', [validatedGender, newState, userId], async err => {
        if (err) {
            await logError(`Ошибка при обновлении пола: ${err}`);
            await bot.sendMessage(userId, 'Произошла ошибка при обновлении информации. Пожалуйста, попробуйте снова позже.');
        }
    });
}

/*********************************************************
 *****    *****            ТАЛИЯ            *****   *****
 *********************************************************/
async function askMiddle(userId) {
    await bot.sendMessage(userId, '📏 Укажите размер вашей талии (например, 90) 👖');
}

// Функция для валидации и сохранения обхвата талии
async function updateMiddleDatabase(userId, middleInput, newState = 'default') {

}
/*********************************************************
 *****    *****            РОСТ              *****   *****
 *********************************************************/
// Функция для запроса роста пользователя
async function askHeight(userId) {
    await bot.sendMessage(userId, '📏 Укажите ваш рост (например, 185) 👤');
}

async function updateHeightDatabase(userId, heightInput, newState = 'default') {

}
/*********************************************************
 *****    *****  ВЫБОР ИЗ ВАРИАНТОВ ПИТАНИЯ  *****   *****
 *********************************************************/
async function askFormat(userId) {
    const genderKeyboard = {
        reply_markup: JSON.stringify({
            one_time_keyboard: true,
            resize_keyboard: true,
            keyboard: [
                [
                    { text: '👥🌍 Общий 🔄📢' },
                    { text: '👤💡 Индивидуальный 🌟🔍' }
                ]
            ]
        })
    };

    await bot.sendMessage(userId, 'Выберите формат питания:', genderKeyboard);
}

// Функция для сохранения или обновления варианта питания пользователя
async function updateFormatDatabase(userId, formatInput) {
    const validatedFormat = (formatInput === '👥🌍 Общий 🔄📢' ? 'общ' : 'индив');
    let newState = (validatedFormat === 'индив' ? 'start_weight' : 'start_choose_weight');

    try {
        await new Promise((resolve, reject) => {
            db.run('UPDATE users SET format = ?, state = ? WHERE user_id = ?', [validatedFormat, newState, userId], (err) => {
                if (err) {
                    logError(`Ошибка при обновлении формата питания: ${err}`).then(() => {
                        reject(err);
                    });
                    return;
                }
                resolve();
            });
        });
    } catch (err) {
        // Обработка ошибок, возникших при обновлении формата питания
        await bot.sendMessage(userId, 'Произошла ошибка при обновлении информации. Пожалуйста, попробуйте снова позже.');
    }
}
/*********************************************************
 *****    *****    ВЫБОР ИЗ ВАРИАНТОВ ВЕСА   *****   *****
 *********************************************************/
async function askChooseWeight(userId) {
    const chooseWeightKeyboard = {
        reply_markup: JSON.stringify({
            one_time_keyboard: true,
            resize_keyboard: true,
            keyboard: [
                [
                    { text: '55-60 🥦'},
                    { text: '65-70 🍇'}
                ],
                [
                    { text: '75-80 🍏'},
                    { text: '85-90 🍊'}
                ],
                [
                    { text: '95-100 🍖'},
                    { text: '105-110 🍰'}
                ],
                [
                    { text: '115-120 🍕'},
                    { text: '125-130 🍔'}
                ]
            ]
        })
    };

    await bot.sendMessage(userId, 'Выберите ваш вес:', chooseWeightKeyboard);
}

// Функция для валидации и получения значения коэффициента активности
async function validateAndGetChooseWeight(chooseWeightInput) {
    const chooseWeight = {
        '55-60 🥦': 55,
        '65-70 🍇': 65,
        '75-80 🍏': 75,
        '85-90 🍊': 85,
        '95-100 🍖': 95,
        '105-110 🍰': 105,
        '115-120 🍕': 115,
        '125-130 🍔': 125
    };

    return chooseWeight[chooseWeightInput] || null;
}

// Функция для сохранения или обновления пола пользователя
async function updateChooseWeightDatabase(userId, chooseWeightInput) {
    const validatedChooseWeight = validateAndGetChooseWeight(chooseWeightInput);

    try {
        await new Promise((resolve, reject) => {
            db.run('UPDATE users SET weight = ?, state = ? WHERE user_id = ?', [validatedChooseWeight, 'start_price', userId], (err) => {
                if (err) {
                    logError(`Ошибка при обновлении веса: ${err}`).then(() => {
                        reject(err);
                    });
                    return;
                }
                resolve();
            });
        });
    } catch (err) {
        // Обработка ошибок, возникших при обновлении веса
        await bot.sendMessage(userId, 'Произошла ошибка при обновлении информации. Пожалуйста, попробуйте снова позже.');
    }
}
/*********************************************************
 *****    *****    ВЫБОР ИЗ ВАРИАНТОВ ЦЕНЫ   *****   *****
 *********************************************************/
async function askChoosePrice(userId) {
    const choosePriceKeyboard = {
        reply_markup: JSON.stringify({
            one_time_keyboard: true,
            resize_keyboard: true,
            keyboard: [
                { text: '🥦'},
                { text: '🍔'}
            ]
        })
    };

    await bot.sendMessage(userId, 'Выберите пакет с ценой:', choosePriceKeyboard);
}

// Функция для валидации цены
async function validateAndGetChoosePrice(choosePriceInput) {
    const choosePrice = {
        'X': 1,
        'Y': 2
    };

    return choosePrice[choosePriceInput] || null;
}

// Функция для сохранения или обновления цены выбранной пользователем
async function updateChoosePriceDatabase(userId, choosePriceInput, state) {
    const newActivityCoefficient = validateAndGetChoosePrice(choosePriceInput);
    let newState = (state === 'start_choose_price' ? 'delivery' : 'default');

    // Обработка ошибок, возникших при обновлении веса
    await bot.sendMessage(userId, 'Произошла ошибка при обновлении информации. Пожалуйста, попробуйте снова позже.');

}
/*********************************************************
 *****    *****              ВЕС             *****   *****
 *********************************************************/
async function askWeight(userId) {
    await bot.sendMessage(userId, '📊 Введите ваш вес (например, 88,5) 🏋️‍♂️:');
}

// Функция для сохранения или обновления веса пользователя
async function updateWeightDatabase(userId, weightInput, newState = 'default') {

}

/*********************************************************
 *****    *****             ЖИР              *****   *****
 *********************************************************/
async function askFat(userId) {
    await bot.sendMessage(userId, '💪 Введите процент вашего жира (например, 0,25) 📉:');
}

// Функция для сохранения или обновления пола пользователя
async function updateFatDatabase(userId, fatInput, newState = 'default') {

}
/*********************************************************
 *****    *****          АКТИВНОСТЬ          *****   *****
 *********************************************************/
async function askActive(chatID) {
    const activeKeyboard = {
        reply_markup: JSON.stringify({
            one_time_keyboard: true,
            resize_keyboard: true,
            keyboard: [
                { text: '👩‍💻 Бытовая деятельность (сидячая работа) 🏠' },
                { text: '🏋️‍♂️ Фитнес тренировки 3 раза/неделю 💪' },
                { text: '🏋️‍♂️ Интенсивные тренировки 4-5 раз/неделю 🔥' },
                { text: '🏋️‍♀️ Фитнес тренировки 6 раз/неделю 💦' },
                { text: '️‍♂️ Интенсивные тренировки 6 раз/неделю 💦' },
                { text: '️🏋️‍♀️🌞 Интенсивные тренировки 6 раз/неделю (2 раза/день) 💦🌙' }
            ]
        })
    };

    const active = '🏃‍♂️🚴‍♀️ Выберите наиболее близкий для вас вариант ежедневной активности? 🧘‍♂️📊';
    await bot.sendMessage(chatID, active, activeKeyboard);
}

// Функция для валидации и получения значения коэффициента активности
async function validateAndGetActivityCoefficient(activityDescription) {
    const activityCoefficients = {
        'Бытовая деятельность (сидячая работа)': 1.2,
        'Фитнес тренировки 3 раза/неделю': 1.38,
        'Фитнес тренировки 4-5 раз/неделю': 1.46,
        'Интенсивные тренировки 4-5 раз/неделю': 1.55,
        'Фитнес тренировки 6 раз/неделю': 1.64,
        'Интенсивные тренировки 6 раз/неделю': 1.73,
        'Интенсивные тренировки 6 раз/неделю (2 раза/день)': 1.9
    };

    return activityCoefficients[activityDescription] || null;
}

// Функция для сохранения или обновления параметров активности
async function updateActivityDatabase(userId, activityDescription, state) {
    const newActivityCoefficient = validateAndGetActivityCoefficient(activityDescription);
    let newState = (state === 'start_activity' ? 'start_target' : 'default');

    if (newActivityCoefficient === null) {
        await logError(`Некорректное описание активности: ${activityDescription}`);
        await bot.sendMessage(userId, 'Произошла ошибка при обновлении информации. Пожалуйста, укажите корректные данные.');
    }

    try {
        await new Promise((resolve, reject) => {
            db.run('UPDATE users SET activity = ?, state = ? WHERE user_id = ?', [newActivityCoefficient, newState, userId], (err) => {
                if (err) {
                    logError(`Ошибка при обновлении параметров активности: ${err}`).then(() => {
                        reject(err);
                    });
                    return;
                }
                resolve();
            });
        });
    } catch (err) {
        // Обработка ошибок, возникших при обновлении активности
        await bot.sendMessage(userId, 'Произошла ошибка при обновлении информации. Пожалуйста, попробуйте снова позже.');
    }
}
/*********************************************************
 *****    *****             ЦЕЛЬ             *****   *****
 *********************************************************/
async function askTarget(userId) {
    const targerKeyboard = {
        reply_markup: JSON.stringify({
            one_time_keyboard: true,
            resize_keyboard: true,
            keyboard: [
                { text: '🏋️‍♀️🥗 Похудеть 🏃‍♀️️' },
                { text: '🍔🛋️ Потолстеть 🍰' }
            ]
        })
    };

    await bot.sendMessage(userId, 'Выберите цель питания:', targerKeyboard);
}

// Функция для сохранения или обновления цели выбранной пользователем
async function updateTargetDatabase(userId, targetInput) {
    try {
        await new Promise((resolve, reject) => {
            db.run('UPDATE users SET target = ?, state = ? WHERE user_id = ?', [targetInput, 'calories', userId], (err) => {
                if (err) {
                    logError(`Ошибка при обновлении цели: ${err}`).then(() => {
                        reject(err);
                    });
                    return;
                }
                resolve();
            });
        });
    } catch (err) {
        // Обработка ошибок, возникших при обновлении цели
        await bot.sendMessage(userId, 'Произошла ошибка при обновлении информации. Пожалуйста, попробуйте снова позже.');
    }
}
/*********************************************************
 *****    *****           КАЛОРИИ            *****   *****
 *********************************************************/
// Функция для просчёта, обновления и вывода
async function findCaloriesDatabase(userId, state) {

}
/*********************************************************
 *****    *****           Доставка            *****   *****
 *********************************************************/
/*async function askDelivery(userId) {
    const deliveryKeyboard = {
        reply_markup: JSON.stringify({
            one_time_keyboard: true,
            resize_keyboard: true,
            keyboard: [
                { text: '🌅☕ Утро (7-9) 🍳' },
                { text: '🌆🍷 Вечер (21-23) 🌙' }
            ]
        })
    };

    await bot.sendMessage(userId, 'Выберите время доставки:', deliveryKeyboard);
}

// Функция для сохранения или обновления цели выбранной пользователем
async function updateDeliveryDatabase(userId, targetInput) {
    db.run('UPDATE users SET delivery = ?, state = ? WHERE user_id = ?', [targetInput, 'calories', userId], async err => {
        if (err) {
            await logError(`Ошибка при обновлении формата питания: ${err}`);
            await bot.sendMessage(userId, 'Произошла ошибка при обновлении информации. Пожалуйста, попробуйте снова позже.');
        }
    });
}*/
/*********************************************************
 *****    *****            ПРОЧЕЕ            *****   *****
 *********************************************************/
// Функция для получения статуса пользователя
async function getUserState(userID) {
    try {
        // Используем Promise для обработки асинхронного запроса
        const row = await new Promise((resolve, reject) => {
            db.get('SELECT state FROM users WHERE user_id = ?', [userID], (err, row) => {
                if (err) {
                    // Логируем ошибку и перебрасываем её дальше
                    logError(`Ошибка при получении статуса пользователя: ${err}`).then(() => {
                        reject(err);
                    });
                    return;
                }
                resolve(row);
            });
        });

        // Возвращаем статус пользователя или null, если пользователь не найден
        return row ? row.state : null;
    } catch (err) {
        // Логирование ошибки и отправка уведомления пользователю (если это необходимо)
        await logError(`Ошибка при получении статуса пользователя: ${err}`);
        throw err;
    }
}

// Получить гендер пользователя
async function getGenderUser(userID) {
    try {
        const row = await new Promise((resolve, reject) => {
            db.get('SELECT gender FROM users WHERE user_id = ?', [userID], (err, row) => {
                if (err) {
                    logError(`Ошибка при получении пола пользователя: ${err}`);
                    reject(err);
                    return;
                }
                resolve(row);
            });
        });

        // Возвращаем пол пользователя или null, если пользователь не найден
        return row ? row.gender : null;
    } catch (err) {
        // Обработка и логирование ошибок
        await logError(`Ошибка при получении пола пользователя для user_id ${userID}: ${err}`);
        throw err; // Перебрасываем ошибку дальше
    }
}

// Получение текущего состояния
function getStateOrder(currentState, currentFormat) {
    // Список состояний в порядке их следования
    const allStatesStart = [
        'start_gender', 'start_middle', 'start_height', 'start_format',
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
                if (currentFormat === "общ") { // Если текущей формат - общий
                    newState = allStatesDefaultStart[0];
                } else if (currentFormat === "индив") { // Если текущей формат - индивидуальный
                    newState = allStatesIndividualStart[0]
                }
            } else {
                if (currentFormat === "общ") {
                    currentIndex = allStatesDefaultStart.indexOf(currentState);
                    if (currentIndex !== -1 && currentIndex !== allStatesDefaultStart.length - 1) { // Если текущее состояние входит в общее
                        newState = allStatesDefaultStart[currentIndex + 1];
                    } else {
                        newState = allStatesDefault[allStatesDefault.length - 1];
                    }
                } else if (currentFormat === "индив") {
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
    return newState;
}

// Функция для получения следующего статуса (возможна проблема в работе статусов)
async function setNextStates(userID) {
    try {
        const row = await new Promise((resolve, reject) => {
            db.get('SELECT state, format FROM users WHERE user_id = ?', [userID], (err, row) => {
                if (err) {
                    logError(`Ошибка при получении состояния и формата из базы данных: ${err}`).then(() => {
                        reject(err);
                    });
                    return;
                }
                resolve(row);
            });
        });

        if (!row) {
            await logError('Пользователь не найден в базе данных');
            return;
        }

        const { state: currentState, format: currentFormat } = row;
        const newState = getNextState(currentState, currentFormat);

        if (newState !== null) {
            await updateStateInDatabase(userID, newState);
        } else {
            // Обработка ситуации, когда следующее состояние не может быть определено
            await logError(`Невозможно определить следующее состояние для пользователя с ID ${userID}`);
        }
    } catch (err) {
        await logError(`Ошибка при обновлении статуса в базе данных: ${err}`);
    }
}


// Функция для создания нового пользователя
async function checkUserInDatabase(userID, username) {
    try {
        // Проверяем, существует ли уже пользователь с таким userID
        const existingUser = await new Promise((resolve, reject) => {
            db.get('SELECT user_id FROM users WHERE user_id = ?', [userID], (err, row) => {
                if (err) {
                    logError(`Ошибка при проверке существования пользователя: ${err}`).then(() => {
                        reject(err);
                    });
                    return;
                }
                resolve(row);
            });
        });

        // Если пользователь уже существует, просто возвращаем
        if (existingUser) {
            return;
        }

        // Создаем нового пользователя, если он не найден
        await new Promise((resolve, reject) => {
            const query = 'INSERT INTO users (user_id, username) VALUES (?, ?)';
            db.run(query, [userID, username], (err) => {
                if (err) {
                    logError(`Ошибка при создании пользователя: ${err}`).then(() => {
                        reject(err);
                    });
                    return;
                }
                resolve(); // Успешное выполнение
            });
        });
    } catch (err) { // Обработка возможных ошибок
        await logError(`Ошибка при создании или проверке пользователя: ${err}`);
        await bot.sendMessage(userID, 'Проблема в работе бота, попробуйте позже!');
    }
}

// Функция для обновления username в базе данных по user_id
async function updateUsernameInDatabase(userID, newUsername) {
    try {
        await new Promise((resolve, reject) => {
            db.run('UPDATE users SET username = ? WHERE user_id = ?', [newUsername, userID], (err) => {
                if (err) {
                    logError(`Ошибка при обновлении username в базе данных: ${err}`).then(() => {
                        reject(err);
                    });
                    return;
                }
                resolve();
            });
        });
    } catch (err) {
        await logError(`Ошибка при обновлении имени пользователя в базе данных: ${err}`);
    }
}

// Запись обновлённого состояния в базу данных
async function updateStateInDatabase(userID, newState) {
    try {
        await new Promise((resolve, reject) => {
            db.run('UPDATE users SET state = ? WHERE user_id = ?', [newState, userID], (err) => {
                if (err) {
                    logError(`Ошибка при обновлении состояния в базе данных для userID ${userID}: ${err}`).then(() => {
                        reject(err);
                    });
                    return;
                }
                resolve();
            });
        });
    } catch (err) {
        await logError(`Ошибка при обновлении состояния в базе данных: ${err}`);
    }
}
/*********************************************************
 ***    *****   ВАЖНЫЕ ЧАСТИ ДЛЯ РАБОТЫ       ****   *****
 *********************************************************/
// Функция для отправки сообщений администратору
async function notifyAdmin(userId, username, text = 'Без текста') {
//    if (ADMIN_ID !== userId) {
        await bot.sendMessage(ADMIN_ID, `@${username || userId}: ${text}`);
//    }
}

// Функция для пересылки сообщений администратору
async function forwardAdmin(msg) {
    await bot.forwardMessage(ADMIN_ID, msg.chat.id, msg.message_id); // Пересылка самого документа
}

// Обработчик ошибок базы данных
db.on('error', async err => {
    await notifyAdmin(ADMIN_ID, '', 'База данных поела говна');
    await logError(`Ошибка базы данных: ${err}`);
});

// Закрываем базу данных при выходе из приложения
process.on('exit', async () => {
    db.close(async err => {
        if (err) {
            await notifyAdmin(ADMIN_ID, '', 'Ошибка при закрытии базы данных');
            await logError(`Ошибка при закрытии базы данных: ${err}`);
        }
    });
});

/*********************************************************
 ***    *****           ТЕЛЕФОН               ****   *****
 *********************************************************/
// Обновление номера телефона в базе данных
const updatePhoneNumber = async (userID, phoneNumber) => {
    try {
        await new Promise((resolve, reject) => {
            db.run('UPDATE users SET phone = ? WHERE user_id = ?', [phoneNumber, userID], (err) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve();
            });
        });
        console.log(`Номер телефона обновлен для пользователя ${userID}`); // Используем console.log для успешных операций
    } catch (err) {
        await logError(`Ошибка при обновлении номера телефона в базе данных: ${err}`);
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
