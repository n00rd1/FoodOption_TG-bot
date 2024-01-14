const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('users.db');
const fs = require('fs').promises;
require('dotenv').config();
// Приветственное сообщение в боте
const {TELEGRAM_BOT_TOKEN, ADMIN_ID} = process.env, TelegramApi = require('node-telegram-bot-api'),
bot = new TelegramApi(TELEGRAM_BOT_TOKEN, {polling: true});

// Пока что - это мусор, но иметь в виду
// TODO: попробовать сделать вывод меню и настройку блюд (доступы на почте через сайт Canva)
// TODO: На перспективу сделать сайт с аналогичным функционалом
// TODO: Починить работу с весом и вывод информации из таблицы
// TODO: сделать метод, меняющий статус на статус с префиксом старт, если предыдущий статус был

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

// TODO: Массовая рассылка информации по доставке (например, задержка или отмена поставки сегодня)
// TODO: Добавить подгрузку state и сделать его изменение в зависимости от статуса
// TODO: Доделать логику обработки М/Ж пола
// TODO: сделать обработчик сохранения результата М/Ж
// TODO: Доделать логику обработки Веса
// TODO: сделать обработчик сохранения результата Веса
// TODO: Доделать логику обработки Жира
// TODO: сделать обработчик сохранения результата Жира
// TODO: Доделать логику обработки Калорий (+ или -)
// TODO: сделать обработчик сохранения результата Калорий (+ или -)

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

    await askMale();
    return ;

//    if (contact !== 0) {
//        await checkPhoneNumber(chatID);
//    }

// На время разработки
if (ADMIN_ID != chatID || chatID != '801384711') {
    await bot.sendMessage(chatID, `Бот в разработке, обращайтесь в WhatsApp -- wa.me/77776886396`);
    await bot.sendMessage(ADMIN_ID, `Новый неавторизованный пользователь - {@${username} | ${chatID}} - ${text}`);
    return;
}
//---------------------
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

//-----------------------------------------------------------------------------
//-----------------------------------------------------------------------------
// -----    -----   Телефон
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


//-----------------------------------------------------------------------------
//-----------------------------------------------------------------------------
// -----    -----   ПОЛ
// Вопрос про пол
async function askMale(userId, start = false){
    let state;
    start === true ? state = 'start_gender':state ='gender';

    // Клавиатура для выбора пола
    const genderKeyboard  = {
        reply_markup: {
            one_time_keyboard: true,
            keyboard: [
                [
                    { text: 'Мужской'},
                    { text: 'Женский'}
                ]
            ],
        },
    };

    db.run('UPDATE users SET state = ? WHERE user_id = ?', [state, userId], async err => {
        if (err) {
            await logError('Ошибка при обновлении cтатуса на запрос пола:', err);
            // Сообщение пользователю о возникшей ошибке
            await bot.sendMessage(userId, '[Обновление статуса] Произошла ошибка при обновлении информации. Пожалуйста, попробуйте снова позже.');
        }
    });

    await bot.sendMessage(userId, 'Вы мужчина или женщина?', genderKeyboard);
}

// Функция для валидации и преобразования значения пола
async function validateAndFormatGender(genderInput) {
    const maleIdentifiers = ['м', 'мужчина', 'male', 'm'];
    const femaleIdentifiers = ['ж', 'женщина', 'female', 'f', 'w'];

    genderInput = genderInput.toLowerCase().trim();

    if (maleIdentifiers.includes(genderInput)) {
        return 'М';
    } else if (femaleIdentifiers.includes(genderInput)) {
        return 'Ж';
    } else {
        return null; // Возвращаем null, если значение не соответствует ни одному из идентификаторов
    }
}

// Функция для сохранения или обновления пола пользователя
async function updateGenderDatabase(userId, genderInput) {
    const validatedGender = validateAndFormatGender(genderInput);

    if (validatedGender !== null) {
        db.run('UPDATE users SET gender = ? WHERE user_id = ?', [validatedGender, userId], async err => {
            if (err) {
                await logError('Ошибка при обновлении пола:', err);
                // Сообщение пользователю о возникшей ошибке
                await bot.sendMessage(userId, 'Произошла ошибка при обновлении информации. Пожалуйста, попробуйте снова позже.');
            }
        });
    } else {
        await logError('Некорректное значение пола:', genderInput);
        // Здесь можно отправить сообщение пользователю о некорректном вводе
    }
}

//-----------------------------------------------------------------------------
//-----------------------------------------------------------------------------
// -----    -----   РОСТ
// Функция для запроса роста пользователя
async function askHeight(userId, start = false) {
    let state;
    start === true ? state = 'start_height':state ='height';

    db.run('UPDATE users SET state = ? WHERE user_id = ?', [state, userId], async err => {
        if (err) {
            await logError('Ошибка при обновлении cтатуса на запрос роста:', err);
            // Сообщение пользователю о возникшей ошибке
            await bot.sendMessage(userId, '[Обновление статуса] Произошла ошибка при обновлении информации. Пожалуйста, попробуйте снова позже.');
        }
    });

    await bot.sendMessage(userId, 'Пожалуйста, введите ваш рост в сантиметрах (например, 175.5):');
}

// Функция для валидации и преобразования введенного роста
async function validateAndFormatHeight(heightInput) {
    // Проверка, является ли ввод числом и находится ли в допустимых пределах
    const height = parseFloat(heightInput);
    if (!isNaN(height) && height > 100 && height < 250) {
        return height;
    } else {
        return null;
    }
}

// Функция для сохранения или обновления роста пользователя
async function updateHeightDatabase(userId, heightInput) {
    const validatedHeight = await validateAndFormatHeight(heightInput);

    if (validatedHeight !== null) {
        db.run('UPDATE users SET height = ? WHERE user_id = ?', [validatedHeight, userId], async err => {
            if (err) {
                await logError('Ошибка при обновлении роста:', err);
            }
        });
    } else {
        await logError('Некорректное значение роста:', heightInput);
        // Здесь нужно отправить сообщение пользователю о некорректном вводе
    }
}


//-----------------------------------------------------------------------------
//-----------------------------------------------------------------------------
// -----    -----   ТАЛИЯ
// Функция для запроса обхвата талии
async function askMiddle(userId, start = false) {
    let state;
    start === true ? state = 'start_middle':state ='middle';

    db.run('UPDATE users SET state = ? WHERE user_id = ?', [state, userId], async err => {
        if (err) {
            await logError('Ошибка при обновлении cтатуса на запрос талии:', err);
            // Сообщение пользователю о возникшей ошибке
            await bot.sendMessage(userId, '[Обновление статуса] Произошла ошибка при обновлении информации. Пожалуйста, попробуйте снова позже.');
        }
    });

    await bot.sendMessage(userId, 'Введите обхват вашей талии в сантиметрах (например, 80.5):');
}

// Функция для валидации и сохранения обхвата талии
async function updateMiddleDatabase(userId, middleInput) {
    const middle = parseFloat(middleInput);
    if (!isNaN(middle) && middle >= 50 && middle <= 150) {
        db.run('UPDATE users SET middle = ? WHERE user_id = ?', [middle, userId], async err => {
            if (err) {
                await logError('Ошибка при обновлении обхвата талии:', err);
            }
        });
    } else {
        await logError('Некорректное значение обхвата талии:', middleInput);
    }
}


//-----------------------------------------------------------------------------
//-----------------------------------------------------------------------------
// -----    -----   ТИП ПИТАНИЯ
// Функция для запроса формата питания
async function askFormat(userId, start = false) {
    const formatKeyboard = {
        reply_markup: JSON.stringify({
            inline_keyboard: [
                [{ text: 'Общий', callback_data: 'общий' }],
                [{ text: 'Индивидуальный', callback_data: 'индивидуальный' }]
            ]
        })
    };

    let state;
    start === true ? state = 'start_format':state ='format';

    db.run('UPDATE users SET state = ? WHERE user_id = ?', [state, userId], async err => {
        if (err) {
            await logError('Ошибка при обновлении cтатуса на запрос типа питания:', err);
            // Сообщение пользователю о возникшей ошибке
            await bot.sendMessage(userId, '[Обновление статуса] Произошла ошибка при обновлении информации. Пожалуйста, попробуйте снова позже.');
        }
    });

    await bot.sendMessage(userId, 'Выберите формат питания:', formatKeyboard);
}

// Функция для обновления формата питания в базе данных
async function updateFormatDatabase(userId, format) {
    db.run('UPDATE users SET format = ? WHERE user_id = ?', [format, userId], async err => {
        if (err) {
            await logError('Ошибка при обновлении формата питания:', err);
        }
    });
}


//-----------------------------------------------------------------------------
//-----------------------------------------------------------------------------
// -----    -----   ВЫБОР ИЗ ВАРИАНТОВ ВЕСА
// Вопрос про пол
async function askWeight(userId, gender = 'М', start = false){
    let state;
    start === true ? state = 'start_choose_weight':state ='choose_weight';

    // Клавиатура для выбора Мужчин
/*    const weightKeyboardMan  = {
        reply_markup: {
            one_time_keyboard: true,
            keyboard: [
                [
                    { text: '75-80'},
                    { text: '85-90'},
                    { text: '95-100'},
                    { text: '105-110'},
                    { text: '115-120'},
                    { text: '125-130'}
                ]
            ],
        },
    };*/
    const weightKeyboardMan = {
        reply_markup: JSON.stringify({
            inline_keyboard: [
                [{ text: '75-80', callback_data: 'm_75' }],
                [{ text: '85-90', callback_data: 'm_85' }],
                [{ text: '95-100', callback_data: 'm_95' }],
                [{ text: '105-110', callback_data: 'm_105' }],
                [{ text: '115-120', callback_data: 'm_115' }],
                [{ text: '125-130', callback_data: 'm_125' }]
            ]
        })
    };

    // Клавиатура для выбора Женщин
/*    const weightKeyboardWoman  = {
        reply_markup: {
            one_time_keyboard: true,
            keyboard: [
                [
                    { text: '55-60'},
                    { text: '65-70'},
                    { text: '75-80'},
                    { text: '85-90'},
                    { text: '95-100'},
                    { text: '105-110'},
                    { text: '115-120'},
                    { text: '125-130'}
                ]
            ],
        },
    };*/
    const weightKeyboardWoman = {
        reply_markup: JSON.stringify({
            inline_keyboard: [
                [{ text: '55-60', callback_data: 'w_55' }],
                [{ text: '65-70', callback_data: 'w_65' }],
                [{ text: '75-80', callback_data: 'w_75' }],
                [{ text: '85-90', callback_data: 'w_85' }],
                [{ text: '95-100', callback_data: 'w_95' }],
                [{ text: '105-110', callback_data: 'w_105' }],
                [{ text: '115-120', callback_data: 'w_115' }],
                [{ text: '125-130', callback_data: 'w_125' }]
            ]
        })
    };

    db.run('UPDATE users SET state = ? WHERE user_id = ?', [state, userId], async err => {
        if (err) {
            await logError('Ошибка при обновлении cтатуса на запрос пола:', err);
            // Сообщение пользователю о возникшей ошибке
            await bot.sendMessage(userId, '[Обновление статуса] Произошла ошибка при обновлении информации. Пожалуйста, попробуйте снова позже.');
        }
    });

    await bot.sendMessage(userId, 'Выберите ваш вес из вариантов', gender === 'М' ? weightKeyboardMan : weightKeyboardWoman);
}

// Функция для валидации и преобразования значения пола
async function validateAndFormatWeight(weightInput) {
    const maleIdentifiers = ['м', 'мужчина', 'male', 'm'];
    const femaleIdentifiers = ['ж', 'женщина', 'female', 'f', 'w'];

    genderInput = genderInput.toLowerCase().trim();

    if (maleIdentifiers.includes(genderInput)) {
        return 'М';
    } else if (femaleIdentifiers.includes(genderInput)) {
        return 'Ж';
    } else {
        return null; // Возвращаем null, если значение не соответствует ни одному из идентификаторов
    }
}


//-----------------------------------------------------------------------------
//-----------------------------------------------------------------------------
// -----    -----   ВЫБОР ИЗ ВАРИАНТОВ ЦЕНЫ


//-----------------------------------------------------------------------------
//-----------------------------------------------------------------------------
// -----    -----   ВЕС
// Функция для валидации веса
async function validateWeight(weight) {
    // Проверяем, что вес - это число
    const weightNumber = parseFloat(weight);

    // Проверяем, что вес находится в заданном диапазоне
    if (isNaN(weightNumber) || weightNumber < 30 || weightNumber > 160) {
        return false;
    }

    // Проверяем, что у веса не более одного символа после запятой
    const weightString = weightNumber.toString();
    const decimalPointIndex = weightString.indexOf('.');

    if (decimalPointIndex !== -1 && weightString.length - decimalPointIndex - 1 > 1) {
        return false;
    }

    return true;
}

// Функция для сохранения или добавления веса пользователя
async function updateWeightDatabase(userId, newWeight) {
    if (await validateWeight(newWeight)) {
        db.run('UPDATE users SET weight = ? WHERE user_id = ?', [newWeight, userId], async err => {
            if (err) {
                await logError('Ошибка при обновлении веса:', err);
            }
        });
    } else {
        await logError('Некорректное значение веса:', newWeight);
        // Здесь вы можете отправить сообщение пользователю о том, что введен некорректный вес
        await bot.sendMessage(userId, `Вес `);
    }
}


//-----------------------------------------------------------------------------
//-----------------------------------------------------------------------------
// -----    -----   ЖИР
// Функция для запроса процента жира
async function askFat(chatID) {
    await bot.sendMessage(chatID, 'Введите процент жира в вашем теле (например, 20.5):');
}

// Функция для валидации и форматирования процента жира
async function validateAndFormatBodyFat(fatPercentage) {
    let formattedFat = parseFloat(fatPercentage);

    // Проверяем, что процент жира - это число
    if (isNaN(formattedFat)) {
        return null;
    }

    // Преобразуем в формат 0.XX, если значение введено в формате XX
    if (formattedFat >= 1 && formattedFat <= 100) {
        formattedFat /= 100;
    }

    // Проверяем, что процент жира находится в допустимом диапазоне
    if (isNaN(formattedFat) || formattedFat < 0.09 || formattedFat > 0.6) {
        return null;
    }

    return formattedFat;
}

// Функция для сохранения или добавления процента жира
async function updateFatDatabase(userId, newFat) {
    const validatedFat = validateAndFormatBodyFat(newFat);

    if (validatedFat !== null) {
        db.run('UPDATE users SET fat = ? WHERE user_id = ?', [validatedFat, userId], async err => {
            if (err) {
                await logError('Ошибка при обновлении процента жира:', err);
            }
        });
    } else {
        await logError('Некорректное значение процента жира:', newFat);
        // Здесь вы можете отправить сообщение пользователю о том, что введен некорректный процент жира
    }
}

//-----------------------------------------------------------------------------
//-----------------------------------------------------------------------------
// -----    -----   АКТИВНОСТЬ
// Вопрос про активность
async function askActive(chatID){
    const activeKeyboard = {
        reply_markup: JSON.stringify({
            inline_keyboard: [
                [{ text: '👩‍💻 Бытовая деятельность (сидячая работа) 🏠', callback_data: 'Бытовая деятельность (сидячая работа)' }],
                [{ text: '🏋️‍♂️ Фитнес тренировки 3 раза/неделю 💪', callback_data: 'Фитнес тренировки 3 раза/неделю' }],
                [{ text: '🏋️‍♀️ Фитнес тренировки 4-5 раз/неделю 💪', callback_data: 'Фитнес тренировки 4-5 раз/неделю' }],
                [{ text: '🏋️‍♂️ Интенсивные тренировки 4-5 раз/неделю 🔥', callback_data: 'Интенсивные тренировки 4-5 раз/неделю' }],
                [{ text: '🏋️‍♀️ Фитнес тренировки 6 раз/неделю 💦', callback_data: 'Фитнес тренировки 6 раз/неделю' }],
                [{ text: '️‍♂️ Интенсивные тренировки 6 раз/неделю 💦', callback_data: 'Интенсивные тренировки 6 раз/неделю' }],
                [{ text: '️🏋️‍♀️🌞 Интенсивные тренировки 6 раз/неделю (2 раза/день) 💦🌙', callback_data: 'Интенсивные тренировки 6 раз/неделю (2 раза/день)' }],
            ]
        })
    };

/*    const activeKeyboard = [
        [ Markup.button("👩‍💻 Бытовая деятельность (сидячая работа) 🏠")],
        [ Markup.button("🏋️‍♂️ Фитнес тренировки 3 раза/неделю 💪") ],
        [ Markup.button("🏋️‍♀️ Фитнес тренировки 4-5 раз/неделю 💪") ],
        [ Markup.button("🏋️‍♂️ Интенсивные тренировки 4-5 раз/неделю 🔥")],
        [ Markup.button("🏋️‍♀️ Фитнес тренировки 6 раз/неделю 💦")],
        [ Markup.button("🏋️‍♂️ Интенсивные тренировки 6 раз/неделю 💦")],
        [ Markup.button("🏋️‍♀️🌞 Интенсивные тренировки 6 раз/неделю (2 раза/день) 💦🌙")]
    ];*/

    const active = 'Выберите наиболее близкий для вас вариант ежедневной активности?';
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
async function updateActivityDatabase(userId, activityDescription) {
    const newActivityCoefficient = validateAndGetActivityCoefficient(activityDescription);

    if (newActivityCoefficient !== null) {
        db.run('UPDATE users SET activity = ? WHERE user_id = ?', [newActivityCoefficient, userId], async err => {
            if (err) {
                await logError('Ошибка при обновлении параметров активности:', err);
            }
        });
    } else {
        //await logError('Некорректное описание активности:', activityDescription);

        // Здесь вы можете отправить сообщение пользователю о том, что введено некорректное описание активности
    }
}


//-----------------------------------------------------------------------------
//-----------------------------------------------------------------------------
// -----    -----   ЦЕЛЬ
// Функция для валидации и преобразования значения ЦЕЛЬ
async function validateAndFormatType(typeInput) {
    const loseWeightIdentifiers = ['похудеть', 'меньше', 'уменьшить'];
    const gainWeightIdentifiers = ['потолстеть', 'больше', 'увеличить'];

    typeInput = typeInput.toLowerCase().trim();

    if (loseWeightIdentifiers.includes(typeInput)) {
        return 'Похудеть';
    } else if (gainWeightIdentifiers.includes(typeInput)) {
        return 'Потолстеть';
    } else {
        return null; // Возвращаем null, если значение не соответствует ни одному из идентификаторов
    }
}

// Функция для сохранения или обновления целей пользователя
async function updateTypeDatabase(userId, typeInput) {
    const validatedType = validateAndFormatType(typeInput);

    if (validatedType !== null) {
        db.run('UPDATE users SET target = ? WHERE user_id = ?', [validatedType, userId], async err => {
            if (err) {
                await logError('Ошибка при обновлении цели:', err);
            }
        });
    } else {
        await logError('Некорректное значение цели:', typeInput);
        // Здесь можно отправить сообщение пользователю о некорректном вводе
    }
}


//-----------------------------------------------------------------------------
//-----------------------------------------------------------------------------
// -----    -----   ДОСТАВКА


//-----------------------------------------------------------------------------
//-----------------------------------------------------------------------------
// -----    -----   НОМЕР ТЕЛЕФОНА
// Функция для обработки новых пользователей
async function giveMeYourPhoneNumber(chatID, username) {
    const keyboard = {
        reply_markup: {
            one_time_keyboard: true,
            keyboard: [[{ text: 'Поделиться номером телефона', request_contact: true }]],
        },
    };
    await bot.sendMessage(chatID, 'Поделитесь своим номером телефона, чтобы получить новый функционал!', keyboard);

    db.run('INSERT OR IGNORE INTO users (user_id, username) VALUES (?, ?)', [chatID, username], async err => {
        if (err) await logError('Ошибка при добавлении пользователя в базу данных:', err);
    });
}

// Функция для проверки наличия номера телефона в базе данных по user_id
async function checkPhoneNumber(chatID) {
    db.get('SELECT phone FROM users WHERE user_id = ?', [chatID], async (err, row) => {
        if (err) {
            await logError('Ошибка при проверке номера телефона в базе данных:', err);
            return;
        }

        if (row && row.phone) {
            await logError('Номер телефона уже существует в базе данных:', row.phone);
        } else {
            // Запрос на отправку номера телефона пользователю
            const keyboard = {
                reply_markup: {
                    one_time_keyboard: true,
                    keyboard: [[{text: 'Поделиться номером телефона', request_contact: true}]],
                },
            };
            bot.sendMessage(chatID, 'Поделитесь своим номером телефона:', keyboard);
        }
    });
}

//-----------------------------------------------------------------------------
//-----------------------------------------------------------------------------
// -----    -----   ПРОЧЕЕ
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

// Функция высчета калорий
async function calculateCalories(userId) {
    // Расширяем запрос, чтобы получить также поле type
    db.get('SELECT weight, fat, activity, target FROM users WHERE user_id = ?', [userId], async (err, row) => {
        if (err) {
            await logError('Ошибка при получении данных пользователя:', err);
            return;
        }
        if (row) {
            const { weight, fat, activity, type } = row;

            // Проверяем, что все данные присутствуют и корректны
            if (weight && fat && activity) {
                // Вычисляем базовую калорийную норму
                const leanBodyMass = weight - (weight * fat);
                let calories = ((weight - leanBodyMass) * 23) * activity;

                // Корректируем калорийность в зависимости от целей пользователя
                if (type === 'Похудеть') {
                    calories -= 300;
                } else if (type === 'Потолстеть') {
                    calories += 300;
                }

                // Обновляем поле calories в базе данных
                db.run('UPDATE users SET calories = ? WHERE user_id = ?', [calories, userId], async err => {
                    if (err) {
                        await logError('Ошибка при обновлении калорий в базе данных:', err);
                    }
                });
            } else {
                await logError('Недостаточно данных для расчета калорий.');
                await bot.sendMessage(userId, 'Недостаточно данных для расчёта калорий, попробуйте заполнить всё ещё раз!');
            }
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

/*********************************************************
 ***    *****        ПОДСЧЁТ СТОИМОСТИ       ****   *****
 *********************************************************/
// Словарь цен в зависимости от калорий (для мужчин)
const priceRangesMan = [
    { minCal: 1600, maxCal: 1699, pricePerDay: 5500, pricePerWeek: 33000, pricePerTwoWeekSale: 62700, pricePerTwoWeek: 66000, pricePerTreeWeekSale: 118800, pricePerTreeWeek: 132000, pricePerMonthSale: 145200, pricePerMonth: 165200 },
    { minCal: 1700, maxCal: 1779, pricePerDay: 5700, pricePerWeek: 34200, pricePerTwoWeekSale: 64980, pricePerTwoWeek: 68400, pricePerTreeWeekSale: 123120, pricePerTreeWeek: 136800, pricePerMonthSale: 150480, pricePerMonth: 171000 },
    { minCal: 1800, maxCal: 1999, pricePerDay: 5900, pricePerWeek: 35400, pricePerTwoWeekSale: 67260, pricePerTwoWeek: 70800, pricePerTreeWeekSale: 127400, pricePerTreeWeek: 141600, pricePerMonthSale: 155760, pricePerMonth: 177000 },
    { minCal: 2000, maxCal: 2199, pricePerDay: 6100, pricePerWeek: 36600, pricePerTwoWeekSale: 69540, pricePerTwoWeek: 73200, pricePerTreeWeekSale: 131760, pricePerTreeWeek: 146400, pricePerMonthSale: 161040, pricePerMonth: 183000 },
    { minCal: 2200, maxCal: 2399, pricePerDay: 6300, pricePerWeek: 37800, pricePerTwoWeekSale: 71820, pricePerTwoWeek: 75600, pricePerTreeWeekSale: 136080, pricePerTreeWeek: 151200, pricePerMonthSale: 166320, pricePerMonth: 189000 },
    { minCal: 2400, maxCal: 2600, pricePerDay: 6500, pricePerWeek: 39000, pricePerTwoWeekSale: 74100, pricePerTwoWeek: 78000, pricePerTreeWeekSale: 140400, pricePerTreeWeek: 156000, pricePerMonthSale: 171600, pricePerMonth: 195000 },
];

// Словарь цен в зависимости от калорий (для женщин)
const priceRangesWoman = [
    { minCal: 1150, maxCal: 1309, pricePerDay: 4800, pricePerWeek: 28800, pricePerTwoWeekSale: 57600, pricePerTwoWeek: 57600, pricePerTreeWeekSale: 103680, pricePerTreeWeek: 115200, pricePerMonthSale: 126720, pricePerMonth: 144000 },
    { minCal: 1310, maxCal: 1509, pricePerDay: 4900, pricePerWeek: 29400, pricePerTwoWeekSale: 58800, pricePerTwoWeek: 58800, pricePerTreeWeekSale: 105680, pricePerTreeWeek: 117600, pricePerMonthSale: 129360, pricePerMonth: 147000 },
    { minCal: 1510, maxCal: 1609, pricePerDay: 5000, pricePerWeek: 30000, pricePerTwoWeekSale: 60000, pricePerTwoWeek: 60000, pricePerTreeWeekSale: 108000, pricePerTreeWeek: 120000, pricePerMonthSale: 132000, pricePerMonth: 150200 },
    { minCal: 1610, maxCal: 1709, pricePerDay: 5200, pricePerWeek: 31200, pricePerTwoWeekSale: 62400, pricePerTwoWeek: 62400, pricePerTreeWeekSale: 112320, pricePerTreeWeek: 124800, pricePerMonthSale: 137280, pricePerMonth: 156000 },
    { minCal: 1710, maxCal: 1809, pricePerDay: 5400, pricePerWeek: 32400, pricePerTwoWeekSale: 64800, pricePerTwoWeek: 64800, pricePerTreeWeekSale: 116640, pricePerTreeWeek: 129600, pricePerMonthSale: 142560, pricePerMonth: 162000 },
    { minCal: 1810, maxCal: 1899, pricePerDay: 5600, pricePerWeek: 33600, pricePerTwoWeekSale: 67200, pricePerTwoWeek: 67200, pricePerTreeWeekSale: 120960, pricePerTreeWeek: 134400, pricePerMonthSale: 147840, pricePerMonth: 168000 },
    { minCal: 1900, maxCal: 2049, pricePerDay: 5800, pricePerWeek: 34800, pricePerTwoWeekSale: 69600, pricePerTwoWeek: 69600, pricePerTreeWeekSale: 125280, pricePerTreeWeek: 139200, pricePerMonthSale: 153120, pricePerMonth: 174000 },
    { minCal: 2050, maxCal: 2200, pricePerDay: 6000, pricePerWeek: 36000, pricePerTwoWeekSale: 72000, pricePerTwoWeek: 72000, pricePerTreeWeekSale: 129600, pricePerTreeWeek: 144000, pricePerMonthSale: 158400, pricePerMonth: 180000 },
];

/*********************************************************
 ***    *****           АРХИВ                 ****   *****
 *********************************************************/
// Функция для определения цены на основе калорий и пола пользователя
async function getPriceBasedOnCaloriesAndGender(calories, gender) {
    const priceRanges = gender === 'М' ? priceRangesMan : priceRangesWoman;
    const priceInfo = priceRanges.find(range => calories >= range.minCal && calories <= range.maxCal);
    return priceInfo ? { pricePerWeek: priceInfo.pricePerWeek, pricePerMonth: priceInfo.pricePerMonth } : null;
}


// Функция, которая извлекает пол и калории пользователя из базы данных и выводит информацию о цене
async function calculateAndDisplayPrice(userId) {
    // Получаем данные пользователя из базы данных
    db.get('SELECT gender, calories FROM users WHERE user_id = ?', [userId], async (err, row) => {
        if (err) {
            await logError('Ошибка при получении данных пользователя:', err);
            return;
        }
        if (row) {
            const {gender, calories} = row;

            // Получаем информацию о цене
            const priceEstimate = getPriceBasedOnCaloriesAndGender(calories, gender);

            if (priceEstimate) {
                // Выводим информацию о цене
                const message = `🌟 Рады предложить Вам индивидуально подобранный рацион питания! 🍽️

👉 На неделю (6 дней) всего за ${priceEstimate.pricePerDay} руб. - отличная возможность попробовать и оценить! (В сутки всего за ${priceEstimate.pricePerDay})
👉 2 недели (12 дней) с 5% скидкой: ${priceEstimate.pricePerTwoWeekSale} руб. - идеально для тех, кто стремится к переменам. (без скидки - ${priceEstimate.pricePerTwoWeek})
👉 3 недели (24 дня) с 10% скидкой: ${priceEstimate.pricePerTreeWeekSale} руб. - для тех, кто уже на пути к своей цели! (без скидки - ${priceEstimate.pricePerTreeWeek})
👉 И получите месяц (30 дней) со скидкой 12%: ${priceEstimate.pricePerMonthSale} руб. - для наиболее решительных и целеустремленных! (без скидки - ${priceEstimate.pricePerMonth})

✨ Попробуйте нашу программу на 6 дней, чтобы увидеть первые результаты и почувствовать разницу! Качество и вкус блюд Вас приятно удивят! 😋

🔥 Закажите сейчас и начните свой путь к здоровому образу жизни уже завтра! 🔥

Для заказа или получения дополнительной информации просто ответьте на это сообщение, либо напишите нам по контактам из шапки профиля. Мы всегда рады помочь!`;

                await bot.sendMessage(userId, message);
            } else {
                await logError(`Пользователь с ID ${userId} - Не удалось определить цену для указанного количества калорий.`);
            }
        } else {
            await logError(`Пользователь с ID ${userId} не найден в базе данных.`);
        }
    });
}

