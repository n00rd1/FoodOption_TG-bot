const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('users.db');
const fs = require('fs').promises;
require('dotenv').config();
const {TELEGRAM_BOT_TOKEN, ADMIN_ID} = process.env, TelegramApi = require('node-telegram-bot-api'),
    bot = new TelegramApi(TELEGRAM_BOT_TOKEN, {polling: true});

db.run(`CREATE TABLE IF NOT EXISTS users (
            id                            INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id                       INTEGER UNIQUE,
            username                      TEXT,
            phone                         TEXT,
            gender                        TEXT DEFAULT 'М' CHECK(gender IN ('М', 'Ж')),
            height                        REAL DEFAULT 0,
            middle                        REAL DEFAULT 0,
            format                        TEXT DEFAULT 'общий' CHECK(format IN ('индив', 'общий')),
            choose_weight                 TEXT,
            choose_price                  TEXT,
            choose_per_days               TEXT,
            weight                        REAL DEFAULT 0,
            fat                           REAL DEFAULT 0,
            activity                      REAL DEFAULT 1.2 CHECK(activity IN (1.2, 1.38, 1.46, 1.55, 1.64, 1.73, 1.9)),
            target                        TEXT DEFAULT 'похудеть' CHECK(target IN ('похудеть', 'потолстеть')),
            state                         TEXT DEFAULT 'start_gender',
            calories                      REAL DEFAULT 0,
            delivery                      TEXT CHECK(delivery IN ('утро','вечер')),
            registration_date             DATETIME DEFAULT CURRENT_TIMESTAMP
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

        case 'start_choose_weight':
        case 'choose_weight':
            await updateChooseWeightDatabase(chatID, text);
            await askChoosePrice(chatID);
            break;

        case 'start_choose_price':
        case 'choose_price':
            await updateChoosePriceDatabase(chatID, text, state);
            if (state === 'start_choose_price')
                await askDelivery(chatID);
            break;

        case 'start_activity':
        case 'activity':
            await updateActivityDatabase(chatID, text, state);
            if (state === 'start_activity')
                await askTarget(chatID);
            break;

        case 'start_target':
        case 'target':
            await updateTargetDatabase(chatID, text);
            if (state === 'start_target')
                await findCaloriesDatabase(chatID, state);
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

    try {
        await new Promise((resolve, reject) => {
            db.run('UPDATE users SET gender = ?, state = ? WHERE user_id = ?', [validatedGender, newState, userId], (err) => {
                if (err) {
                    logError(`Ошибка при обновлении пола: ${err}`).then(() => {
                        reject(err);
                    });
                    return;
                }
                resolve();
            });
        });
    } catch (err) {
        await bot.sendMessage(userId, 'Произошла ошибка при обновлении информации. Пожалуйста, попробуйте снова позже.');
    }
}

/*********************************************************
 *****    *****            ТАЛИЯ            *****   *****
 *********************************************************/
async function askMiddle(userId) {
    await bot.sendMessage(userId, '📏 Укажите размер вашей талии (например, 90) 👖');
}

// Валидация введённых данных по замеру талии
async function validateMiddle(middleInput) {
    const middle = parseInt(middleInput);
    if (isNaN(middle) || middle < 40 || middle > 150) {
        return null; // Валидация не пройдена
    }
    return middle; // Валидация пройдена
}

// Функция для валидации и сохранения обхвата талии
async function updateMiddleDatabase(userId, middleInput, state) {
    let newState = (state !== 'start_middle' ? 'default' : 'start_height');
    const validatedMiddle = await validateMiddle(middleInput);

    if (validatedMiddle === null) {
        await bot.sendMessage(userId, 'Введены некорректные данные.');
        return;
    }

    try {
        await new Promise((resolve, reject) => {
            db.run('UPDATE users SET middle = ?, state = ? WHERE user_id = ?', [validatedMiddle, newState, userId], (err) => {
                if (err) {
                    logError(`Ошибка при обновлении обхвата талии: ${err}`).then(() => {
                        reject(err);
                    });
                    return;
                }
                resolve();
            });
        });
    } catch (err) {
        await bot.sendMessage(userId, 'Произошла ошибка при обновлении информации. Пожалуйста, попробуйте снова позже.');
    }
}
/*********************************************************
 *****    *****            РОСТ              *****   *****
 *********************************************************/
// Функция для запроса роста пользователя
async function askHeight(userId) {
    await bot.sendMessage(userId, '📏 Укажите ваш рост (например, 185) 👤');
}

// Валидация введённого роста пользователя
function validateHeight(heightInput) {
    const height = parseInt(heightInput);
    if (isNaN(height) || height < 100 || height > 250) {
        return null; // Валидация не пройдена
    }
    return height; // Валидация пройдена
}

// Функция для валидации и обновления роста пользователя
async function updateHeightDatabase(userId, heightInput, state) {
    let newState = (state !== 'start_height' ? 'default' : 'start_format');
    const validatedHeight = validateHeight(heightInput);

    if (validatedHeight === null) {
        await bot.sendMessage(userId, 'Введены некорректные данные. Укажите ваш рост в диапазоне от 100 до 250 см.');
        return;
    }

    try {
        await new Promise((resolve, reject) => {
            db.run('UPDATE users SET height = ?, state = ? WHERE user_id = ?', [validatedHeight, newState, userId], (err) => {
                if (err) {
                    logError(`Ошибка при обновлении роста: ${err}`).then(() => {
                        reject(err);
                    });
                    return;
                }
                resolve();
            });
        });
    } catch (err) {
        await bot.sendMessage(userId, 'Произошла ошибка при обновлении информации. Пожалуйста, попробуйте снова позже.');
    }
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
    const validatedFormat = (formatInput === '👥🌍 Общий 🔄📢' ? 'общий' : 'индив');
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
        '55-60 🥦': '55-60',
        '65-70 🍇': '65-70',
        '75-80 🍏': '75-80',
        '85-90 🍊': '85-90',
        '95-100 🍖': '95-100',
        '105-110 🍰': '105-110',
        '115-120 🍕': '115-120',
        '125-130 🍔': '125-130'
    };

    return chooseWeight[chooseWeightInput] || null;
}

// Функция для сохранения или обновления пола пользователя
async function updateChooseWeightDatabase(userId, chooseWeightInput) {
    const validatedChooseWeight = await validateAndGetChooseWeight(chooseWeightInput);

    if (!validatedChooseWeight) {
        await bot.sendMessage(userId, 'Некорректный выбор веса. Пожалуйста, попробуйте снова.');
        return;
    }

    try {
        await new Promise((resolve, reject) => {
            db.run('UPDATE users SET choose_weight = ?, state = ? WHERE user_id = ?', [validatedChooseWeight, 'start_price', userId], (err) => {
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
    const gender = await getGenderUser(userId);
    const choose_weight = await getWeightUser(userId);
    const price = await findPrice(gender, choose_weight);

    const choosePriceKeyboard = {
        reply_markup: JSON.stringify({
            one_time_keyboard: true,
            resize_keyboard: true,
            keyboard: [
                [
                    { text: '🗓️ 6 дней ✨'},
                    { text: '🗓️ 12 дней 🌟'}
                ],
                [
                    { text: '🗓️ 24 дней 💫'},
                    { text: '🗓️ 30 дней 🔥'}
                ]
            ]
        })
    };

    const text = `Для веса ${price['weight']} кг и суточной потребности в ${price['ccal']} ккал, ваш персонализированный план питания на разные сроки выглядит следующим образом:\n` +
        `\n` +
        `📅 На 6 дней: ваша инвестиция составит ${price['6_day']} ₸ (один день — ${price['1_day']} ₸). 💸🌟\n` +
        `📅 На 12 дней: полная стоимость будет ${price['12_day']} ₸, в то время как без скидки цена достигла бы ${price['12_day_no_sale']} ₸. 💸✂️\n` +
        `📅 На 24 дней: план обойдется в ${price['24_day']} ₸, со скидкой от первоначальных ${price['24_day_no_sale']} ₸. 💸🏷️` +
        `📅 На 30 дней: программа предлагается за ${price['30_day']} ₸, что меньше стандартной цены в ${price['30_day_no_sale']} ₸. 💸🎉\n` +
        `💪🥑 Выберите оптимальный для себя вариант и начните свой путь к здоровью и хорошему самочувствию сегодня! 🍽️✨`

    await bot.sendMessage(userId, 'Выберите пакет с ценой:', choosePriceKeyboard);
}

// Функция для валидации цены
async function findPrice(gender, choose_weight) {
    const manPrice = [
        {
            "weight": "125-130",
            "ccal": "2400-2500",
            "1_day": 6500,
            "6_day": 39000,
            "12_day": 74100,
            "12_day_no_sale": 78000,
            "24_day": 140400,
            "24_day_no_sale": 156000,
            "30_day": 171600,
            "30_day_no_sale": 195000
        },
        {
            "weight": "115-120",
            "ccal": "2200-2300",
            "1_day": 6300,
            "6_day": 37800,
            "12_day": 71820,
            "12_day_no_sale": 75000,
            "24_day": 136080,
            "24_day_no_sale": 151200,
            "30_day": 166320,
            "30_day_no_sale": 189000
        },
        {
            "weight": "105-110",
            "ccal": "2000-2100",
            "1_day": 6100,
            "6_day": 36600,
            "12_day": 69540,
            "12_day_no_sale": 73000,
            "24_day": 131760,
            "24_day_no_sale": 146400,
            "30_day": 161040,
            "30_day_no_sale": 183000
        },
        {
            "weight": "95-100",
            "ccal": "1800-1900",
            "1_day": 5900,
            "6_day": 35400,
            "12_day": 67260,
            "12_day_no_sale": 70800,
            "24_day": 127440,
            "24_day_no_sale": 141600,
            "30_day": 155760,
            "30_day_no_sale": 177000
        },
        {
            "weight": "85-90",
            "ccal": "1650-1750",
            "1_day": 5700,
            "6_day": 34200,
            "12_day": 64980,
            "12_day_no_sale": 68400,
            "24_day": 123120,
            "24_day_no_sale": 136800,
            "30_day": 150480,
            "30_day_no_sale": 171000
        },
        {
            "weight": "75-80",
            "ccal": "1600-1700",
            "1_day": 5500,
            "6_day": 33000,
            "12_day": 62700,
            "12_day_no_sale": 66000,
            "24_day": 118800,
            "24_day_no_sale": 132000,
            "30_day": 145200,
            "30_day_no_sale": 165000
        }
    ];
    const womanPrice = [
        {
            "weight": "125-130",
            "ccal": "2050-2100",
            "1_day": 6000,
            "6_day": 36000,
            "12_day": 68400,
            "12_day_no_sale": 72000,
            "24_day": 129600,
            "24_day_no_sale": 144000,
            "30_day": 158400,
            "30_day_no_sale": 180000
        },
        {
            "weight": "115-120",
            "ccal": "1900-1950",
            "1_day": 5800,
            "6_day": 34800,
            "12_day": 66120,
            "12_day_no_sale": 69600,
            "24_day": 125280,
            "24_day_no_sale": 139200,
            "30_day": 153120,
            "30_day_no_sale": 174000
        },
        {
            "weight": "105-110",
            "ccal": "1810-1850",
            "1_day": 5600,
            "6_day": 33600,
            "12_day": 63840,
            "12_day_no_sale": 67200,
            "24_day": 120960,
            "24_day_no_sale": 134400,
            "30_day": 147840,
            "30_day_no_sale": 168000
        },
        {
            "weight": "95-100",
            "ccal": "1710-1750",
            "1_day": 5400,
            "6_day": 32400,
            "12_day": 61560,
            "12_day_no_sale": 64800,
            "24_day": 116640,
            "24_day_no_sale": 129600,
            "30_day": 142560,
            "30_day_no_sale": 162000
        },
        {
            "weight": "85-90",
            "ccal": "1610-1650",
            "1_day": 5200,
            "6_day": 31200,
            "12_day": 59280,
            "12_day_no_sale": 62400,
            "24_day": 112320,
            "24_day_no_sale": 124800,
            "30_day": 137280,
            "30_day_no_sale": 156000
        },
        {
            "weight": "75-80",
            "ccal": "1510-1550",
            "1_day": 5000,
            "6_day": 30000,
            "12_day": 57000,
            "12_day_no_sale": 60000,
            "24_day": 108000,
            "24_day_no_sale": 120000,
            "30_day": 132000,
            "30_day_no_sale": 150000
        },
        {
            "weight": "65-70",
            "ccal": "1310-1350",
            "1_day": 4900,
            "6_day": 29400,
            "12_day": 55860,
            "12_day_no_sale": 58800,
            "24_day": 105840,
            "24_day_no_sale": 117600,
            "30_day": 129360,
            "30_day_no_sale": 147000
        },
        {
            "weight": "55-60",
            "ccal": "1150-1200",
            "1_day": 4800,
            "6_day": 28800,
            "12_day": 51840,
            "12_day_no_sale": 57600,
            "24_day": 103680,
            "24_day_no_sale": 115200,
            "30_day": 126720,
            "30_day_no_sale": 144000
        }
    ];
    // Возвращаем таблицу в зависимости от пола
    const prices = gender === 'М' ? manPrice : womanPrice;
    return prices.find(price => price.weight === choose_weight);
}

// Функция для сохранения или обновления цены выбранной пользователем
async function updateChoosePriceDatabase(userId, choosePriceInput, state) {
    const newState = (state !== 'start_choose_price' ? 'default' : 'delivery');
    const gender = await getGenderUser(userId);
    const choose_weight = await getWeightUser(userId);
    const price = await findPrice(gender, choose_weight);
    let priceChoose = 0;
    let dayChoose = '';

    switch (choosePriceInput) {
        case '🗓️ 6 дней ✨':
            priceChoose = price['6_day'];
            dayChoose = '6 дней';
            break;
        case '🗓️ 12 дней 🌟':
            priceChoose = price['12_day'];
            dayChoose = '12 дней';
            break;
        case '🗓️ 24 дней 💫':
            priceChoose = price['24_day'];
            dayChoose = '24 дней';
            break;
        case '🗓️ 30 дней 🔥':
            priceChoose = price['30_day'];
            dayChoose = '30 дней';
            break;
        default:
            await bot.sendMessage(userId, 'Произошла ошибка при обновлении информации. Пожалуйста, попробуйте снова позже.');
            return;
    }

    try {
        await new Promise((resolve, reject) => {
            db.run('UPDATE users SET choose_price = ?, choose_per_days = ?, state = ? WHERE user_id = ?', [priceChoose, dayChoose, 'start_price', userId], (err) => {
                if (err) {
                    logError(`Ошибка при указании параметров: ${err}`).then(() => {
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
 *****    *****              ВЕС             *****   *****
 *********************************************************/
async function askWeight(userId) {
    await bot.sendMessage(userId, '📊 Введите ваш вес (например, 88,5) 🏋️‍♂️:');
}

// Валидация введённого значения пользователем
function validateWeight(weightInput) {
    // Преобразовываем ввод, заменяя запятые на точки и удаляя лишние символы
    const normalizedInput = weightInput.replace(',', '.').replace(/[^0-9.]/g, '');
    const weight = parseFloat(normalizedInput);

    // Проверяем, что преобразованное значение является числом и находится в допустимых пределах
    if (isNaN(weight) || weight < 30 || weight > 200) {
        return null; // Валидация не пройдена
    }
    return weight; // Валидация пройдена
}

// Функция для сохранения или обновления веса пользователя
async function updateWeightDatabase(userId, weightInput, state) {
    let newState = (state !== 'start_weight' ? 'default' : 'start_fat');
    const validatedWeight = validateWeight(weightInput);

    if (validatedWeight === null) {
        await bot.sendMessage(userId, 'Введены некорректные данные. Укажите ваш вес в диапазоне от 30 до 200 кг.');
        return;
    }

    try {
        await new Promise((resolve, reject) => {
            db.run('UPDATE users SET weight = ?, state = ? WHERE user_id = ?', [validatedWeight, newState, userId], (err) => {
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
        await bot.sendMessage(userId, 'Произошла ошибка при обновлении информации. Пожалуйста, попробуйте снова позже.');
    }
}
/*********************************************************
 *****    *****             ЖИР              *****   *****
 *********************************************************/
async function askFat(userId) {
    await bot.sendMessage(userId, '💪 Введите процент вашего жира (например, 0,25) 📉:');
}

// Валидация введённого процента пользователя
function validateFat(fatInput) {
    const normalizedInput = fatInput.replace(',', '.').replace(/[^0-9.]/g, '');
    const fatPercentage = parseFloat(normalizedInput);

    if (isNaN(fatPercentage) || fatPercentage < 0 || fatPercentage > 1) {
        return null;
    }
    return fatPercentage;
}

// Функция для сохранения или обновления процента жира пользователя
async function updateFatDatabase(userId, fatInput, state) {
    const validatedFat = validateFat(fatInput);
    let newState = (state !== 'start_fat' ? 'default' : 'start_activity');

    if (validatedFat === null) {
        await bot.sendMessage(userId, 'Введены некорректные данные. Укажите процент жира в правильном формате (например, 0.25).');
        return;
    }

    try {
        await new Promise((resolve, reject) => {
            db.run('UPDATE users SET fat = ?, state = ? WHERE user_id = ?', [validatedFat, newState, userId], (err) => {
                if (err) {
                    logError(`Ошибка при обновлении процента жира: ${err}`).then(() => {
                        reject(err);
                    });
                    return;
                }
                resolve();
            });
        });
    } catch (err) {
        await bot.sendMessage(userId, 'Произошла ошибка при обновлении информации. Пожалуйста, попробуйте снова позже.');
    }
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
    const target = ((targetInput === '🍔🛋️ Потолстеть 🍰') ? 'Потолстеть' : 'Похудеть');
    try {
        await new Promise((resolve, reject) => {
            db.run('UPDATE users SET target = ?, state = ? WHERE user_id = ?', [target, 'calories', userId], (err) => {
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
    try {

        const row = await new Promise((resolve, reject) => {
            db.get('SELECT weight, fat, activity, target FROM users WHERE user_id = ?', [userId], (err, row) => {
                if (err) {
                    logError(`Ошибка при получении данных пользователя: ${err}`).then(() => reject(err));
                    return;
                }
                resolve(row);
            });
        });

        if (row) {
            const { weight, fat, activity, target } = row;

            // Проверяем, что все данные присутствуют и корректны
            if (weight && fat && activity) {
                // Инициализация и расчет основных параметров
                let fatOnKg = weight * fat;
                let BMT = weight - fatOnKg; // Базовая масса тела
                let BOO = BMT * 23; // Базовый обмен веществ
                let activCcal = BOO * activity; // Активность

                // Корректировка калорийности в зависимости от цели
                let targetCcal = target === 'Похудеть' ? -300 : 300;

                // Расчет БЖУ
                let dayProtein = 2.42 * BMT;
                let dayProteinCcal = dayProtein * 4;
                let dayFat = 0.7 * BMT;
                let dayFatCcal = dayFat * 9;
                let dayCarbohydratesCcal = activCcal + targetCcal - dayProteinCcal - dayFatCcal;
                let dayCarbohydrates = dayCarbohydratesCcal / 4;
                let dayPerKgCarbohy = dayCarbohydrates / BMT; // Углеводы на кг массы тела

                // Расчет калорийности
                let normalCcal = activCcal * 7;
                let factCcal = normalCcal + targetCcal * 7;
                let deficit = normalCcal - factCcal; // Дефицит калорий
                let fatCycle = deficit / 7.716; // Жиры за цикл

                // Формируем сообщение 📝
                let message = `При весе в ${weight}кг и проценте жира ${(fat * 100).toFixed(2)}% при цели ${target}.\n\n` +
                    `Получается, что масса жира = ${fatOnKg.toFixed(1)} 😱\n`+
                    `БМТ (Базовый метаболический темп) = ${BMT.toFixed(1)} 🔥\n` +
                    `ВОО (Величина Общего Обмена) = ${BOO.toFixed(1)} 💪\n` +
                    `В таком случае стандартный объём калорий = ${activCcal.toFixed(1)} 🍏\n\n` +
                    `А индивидуальные показатели БЖУ получаются следующим образом:\n` +
                    `Белков на КГ должно быть 2.42 г/кг, т.е. ${dayProtein.toFixed(1)} г и ${dayProteinCcal.toFixed(1)} Ккал. 🥚\n` +
                    `Жиров на КГ должно быть 0.7 г/кг, т.е. ${dayFat.toFixed(1)} г и ${dayFatCcal.toFixed(1)} Ккал. 🧈\n` +
                    `Углеводов на КГ должно быть ${(dayCarbohydratesCcal).toFixed(2)} г/кг, т.е. ${(dayCarbohydrates * 7)} г и ${dayCarbohydratesCcal.toFixed(2)} Ккал. 🍞\n\n` +
                    `Итого по калориям получается, что норма - ${normalCcal.toFixed(2)}, а фактически - ${factCcal.toFixed(2)}, т.е. ${targetCcal} составляет ${deficit.toFixed(2)}, а жир/кг (за цикл) = ${fatCycle.toFixed(2)} 🚴‍♂️`;

                await bot.sendMessage(userId, message);
                const newState = (state !== 'start_target' ? 'default' : 'delivery');

                // Обновляем поле calories в базе данных
                await new Promise((resolve, reject) => {
                    db.run('UPDATE users SET calories = ?, state = ? WHERE user_id = ?', [calories, newState, userId], err => {
                        if (err) {
                            logError(`Ошибка при обновлении калорий в базе данных: ${err}`).then(() => reject(err));
                            return;
                        }
                        resolve();
                    });
                });
            } else {
                await logError('Недостаточно данных для расчета калорий.');
                await bot.sendMessage(userId, 'Недостаточно данных для расчёта калорий, пожалуйста, заполните все необходимые данные.');
            }
        }
    } catch (err) {
        await bot.sendMessage(userId, 'Произошла ошибка при расчете калорий. Пожалуйста, попробуйте позже.');
    }
}
/*********************************************************
 *****    *****           Доставка            *****   *****
 *********************************************************/
async function askDelivery(userId) {
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
async function updateDeliveryDatabase(userId, deliveryInput) {
    const validatedDelivery = (deliveryInput === '🌅☕ Утро (7-9) 🍳' ? 'Утро':'Вечер');

    if (validatedDelivery === null) {
        await bot.sendMessage(userId, 'Введены некорректные данные. Пожалуйста, выберите корректное время доставки.');
        return;
    }

    try {
        await new Promise((resolve, reject) => {
            db.run('UPDATE users SET delivery = ?, state = ? WHERE user_id = ?', [validatedDelivery, 'default', userId], (err) => {
                if (err) {
                    logError(`Ошибка при обновлении времени доставки: ${err}`).then(() => {
                        reject(err);
                    });
                    return;
                }
                resolve();
            });
        });
    } catch (err) {
        await bot.sendMessage(userId, 'Произошла ошибка при обновлении информации. Пожалуйста, попробуйте снова позже.');
    }
}
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

// Получить вес пользователя
async function getWeightUser(userID) {
    try {
        const row = await new Promise((resolve, reject) => {
            db.get('SELECT choose_weight FROM users WHERE user_id = ?', [userID], (err, row) => {
                if (err) {
                    logError(`Ошибка при получении веса пользователя: ${err}`);
                    reject(err);
                    return;
                }
                resolve(row);
            });
        });

        // Возвращаем вес пользователя или null, если пользователь не найден
        return row ? row.weight : null;
    } catch (err) {
        // Обработка и логирование ошибок
        await logError(`Ошибка при получении веса пользователя для user_id ${userID}: ${err}`);
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
                if (currentFormat === "общий") { // Если текущей формат - общий
                    newState = allStatesDefaultStart[0];
                } else if (currentFormat === "индив") { // Если текущей формат - индивидуальный
                    newState = allStatesIndividualStart[0]
                }
            } else {
                if (currentFormat === "общий") {
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
    if (ADMIN_ID !== userId) {
        await bot.sendMessage(ADMIN_ID, `@${username || userId}: ${text}`);
    }
}

// Функция для пересылки сообщений администратору
async function forwardAdmin(msg) {
    await bot.forwardMessage(ADMIN_ID, msg.chat.id, msg.message_id); // Пересылка самого документа
}

// Обработчик ошибок базы данных
db.on('error', async err => {
    await notifyAdmin(ADMIN_ID, '', `База данных поела говна; ${err}`);
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
