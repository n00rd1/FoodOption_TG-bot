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

    const text = msg.text || '';
    const msgType = msg.entities ? msg.entities[0].type : 'text';

    if (msgType === 'bot_command') {
        if (text === '/start') {        // Приветственное сообщение
            await sayHello(chatID);
        }
        else if (text === '/reset') {   // Настройка БЖУ
            await sayHello(chatID, true)
        }
        else if (text === '/command') {
            return;
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
async function sayHello(userId, reset = false) {
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
        await bot.sendMessage(userId, helloMsg);
    }

    await updateStateInDatabase(userId, 'start_gender');
    await bot.sendMessage(userId, start_settings);
    await askMale(userId);
}

//-----------------------------------------------------------------------------
//-----------------------------------------------------------------------------
// -----    -----   ПОЛ
// Вопрос про пол
/*async function askMale(userId){
    // Клавиатура для выбора пола
    const genderKeyboard  = {
        reply_markup: {
            one_time_keyboard: true,
            keyboard: [
                [
                    { text: '👠 Женщина 👩'},
                    { text: '👔 Мужчина 👨'}
                ]
            ],
        },
    };

    await bot.sendMessage(userId, 'Вы мужчина или женщина?', genderKeyboard);
}

// Функция для сохранения или обновления пола пользователя
async function updateGenderDatabase(userId, genderInput) {
    const validatedGender = (genderInput === '👠 Женщина 👩' ? 'Ж': 'M');

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
*/

async function askMale(userId) {
    const genderKeyboard = {
        reply_markup: JSON.stringify({
            keyboard: [
                [{ text: '👠 Женщина 👩' }],
                [{ text: '👔 Мужчина 👨' }]
            ],
            one_time_keyboard: true
        })
    };

    await bot.sendMessage(userId, 'Вы мужчина или женщина?', genderKeyboard);
}

// Функция для сохранения или обновления пола пользователя
async function updateGenderDatabase(userId, genderInput, newState = 'default') {
    db.run('UPDATE users SET gender = ?, state = ? WHERE user_id = ?', [genderInput, newState, userId], async err => {
        if (err) {
            await logError('Ошибка при обновлении пола:', err);
            await bot.sendMessage(userId, 'Произошла ошибка при обновлении информации. Пожалуйста, попробуйте снова позже.');
        }
    });
}

/*********************************************************
 *****    *****            ТАЛИЯ            *****   *****
 *********************************************************/
async function askMiddle(userId) {

}

// Функция для валидации и сохранения обхвата талии
async function updateMiddleDatabase(userId, middleInput, newState = 'default') {

}
/*********************************************************
 *****    *****            РОСТ              *****   *****
 *********************************************************/
// Функция для запроса роста пользователя
async function askHeight(userId) {

}

async function updateHeightDatabase(userId, heightInput, newState = 'default') {

}
/*********************************************************
 *****    *****  ВЫБОР ИЗ ВАРИАНТОВ ПИТАНИЯ  *****   *****
 *********************************************************/
async function askFormat(userId) {
    const genderKeyboard = {
        reply_markup: JSON.stringify({
            keyboard: [
                [{ text: '👥🌍 Общий 🔄📢' }],
                [{ text: '👤💡 Индивидуальный 🌟🔍' }]
            ],
            one_time_keyboard: true
        })
    };

    await bot.sendMessage(userId, 'Выберите формат питания:', genderKeyboard);
}

// Функция для сохранения или обновления варианта питания пользователя
async function updateFormatDatabase(userId, formatInput, newState = 'default') {
    const validatedFormat = (formatInput === '👥🌍 Общий 🔄📢' ? 'общ' : 'индив');

    db.run('UPDATE users SET format = ? WHERE user_id = ?', [validatedFormat, userId], async err => {
        if (err) {
            await logError('Ошибка при обновлении формата питания:', err);
            await bot.sendMessage(userId, 'Произошла ошибка при обновлении информации. Пожалуйста, попробуйте снова позже.');
        }
    });
}
/*********************************************************
 *****    *****    ВЫБОР ИЗ ВАРИАНТОВ ВЕСА   *****   *****
 *********************************************************/
async function askChooseWeight(userId) {
    const chooseWeightKeyboard = {
        reply_markup: JSON.stringify({
            keyboard: [
                { text: '55-60 🥦'},
                { text: '65-70 🍇'},
                { text: '75-80 🍏'},
                { text: '85-90 🍊'},
                { text: '95-100 🍖'},
                { text: '105-110 🍰'},
                { text: '115-120 🍕'},
                { text: '125-130 🍔'}
            ],
            one_time_keyboard: true
        })
    };

    await bot.sendMessage(userId, 'Выберите ваш вес:', chooseWeightKeyboard);
}

// Функция для сохранения или обновления пола пользователя
async function updateChooseWeightDatabase(userId, weightInput, newState = 'default') {

}
/*********************************************************
 *****    *****    ВЫБОР ИЗ ВАРИАНТОВ ЦЕНЫ   *****   *****
 *********************************************************/
async function askChoosePrice(userId) {
    const choosePriceKeyboard = {
        reply_markup: JSON.stringify({
            keyboard: [
                { text: '🥦'},
                { text: '🍔'}
            ],
            one_time_keyboard: true
        })
    };

    await bot.sendMessage(userId, 'Выберите пакет с ценой:', choosePriceKeyboard);
}

// Функция для сохранения или обновления цены выбранной пользователем
async function updateChoosePriceDatabase(userId, priceInput, newState = 'default') {

}
/*********************************************************
 *****    *****              ВЕС             *****   *****
 *********************************************************/
async function askWeight(userId) {
    await bot.sendMessage(userId, 'Введите ваш вес:');
}

// Функция для сохранения или обновления веса пользователя
async function updateWeightDatabase(userId, weightInput, newState = 'default') {

}

/*********************************************************
 *****    *****             ЖИР              *****   *****
 *********************************************************/
async function askFat(userId) {
    await bot.sendMessage(userId, 'Введите процент вашего жира (например, 0,25):');
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
            keyboard: [
                { text: '👩‍💻 Бытовая деятельность (сидячая работа) 🏠' },
                { text: '🏋️‍♂️ Фитнес тренировки 3 раза/неделю 💪' },
                { text: '🏋️‍♂️ Интенсивные тренировки 4-5 раз/неделю 🔥' },
                { text: '🏋️‍♀️ Фитнес тренировки 6 раз/неделю 💦' },
                { text: '️‍♂️ Интенсивные тренировки 6 раз/неделю 💦' },
                { text: '️🏋️‍♀️🌞 Интенсивные тренировки 6 раз/неделю (2 раза/день) 💦🌙' }
            ],
            one_time_keyboard: true
        })
    };

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

/*********************************************************
 *****    *****             ЦЕЛЬ             *****   *****
 *********************************************************/
async function askTarget(userId) {
    const choosePriceKeyboard = {
        reply_markup: JSON.stringify({
            keyboard: [
                { text: '🥦'},
                { text: '🍔'}
            ],
            one_time_keyboard: true
        })
    };

    await bot.sendMessage(userId, 'Выберите пакет с ценой:', choosePriceKeyboard);
}

// Функция для сохранения или обновления цены выбранной пользователем
async function updateTargetDatabase(userId, targetInput, newState = 'default') {

}
/*********************************************************
 *****    *****           КАЛОРИИ            *****   *****
 *********************************************************/
async function askCalories(userId) {
    const choosePriceKeyboard = {
        reply_markup: JSON.stringify({
            keyboard: [
                { text: '🥦'},
                { text: '🍔'}
            ],
            one_time_keyboard: true
        })
    };

    await bot.sendMessage(userId, 'Выберите пакет с ценой:', choosePriceKeyboard);
}

// Функция для сохранения или обновления Калорий
async function updateCaloriesDatabase(userId, priceCalories, newState = 'default') {

}
/*********************************************************
 *****    *****            ПРОЧЕЕ            *****   *****
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

// Функция для получения статуса пользователя
async function getUserState(userID) {
    return new Promise((resolve, reject) => {
        db.get('SELECT state FROM users WHERE user_id = ?', [userID], (err, row) => {
            if (err) {
                reject(err); // В случае ошибки передаем ее в reject
                return;
            }
            if (row) {
                resolve(row.state); // Возвращаем статус пользователя
            } else {
                resolve(null); // В случае отсутствия пользователя возвращаем null
            }
        });
    });
}


// Получить гендер пользователя
async function getGenderUser(userID) {
    return new Promise((resolve, reject) => {
        db.get('SELECT gender FROM users WHERE user_id = ?', [userID], (err, row) => {
            if (err) {
                reject(err); // В случае ошибки передаем ее в reject
                return;
            }
            if (row) {
                resolve(row.gender); // Возвращаем статус пользователя
            } else {
                resolve(null); // В случае отсутствия пользователя возвращаем null
            }
        });
    });
}

// Функция для обновления username в базе данных по user_id
async function updateUsernameInDatabase(userID, newUsername) {
    db.run('UPDATE users SET username = ? WHERE user_id = ?', [newUsername, userID], async err => {
        if (err) {
            await logError('Ошибка при обновлении username в базе данных:', err);
        }
    });
}

// Функция для обновления статуса (возможна проблема в работе статусов)
async function setNextStates(userID) {
    try {
        // Получаем текущее состояние и формат из базы данных
        const row = await new Promise((resolve, reject) => {
            db.get('SELECT state, format FROM users WHERE user_id = ?', [userID], (err, row) => {
                if (err) {
                    reject(err);
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
        const stateOrder = getStateOrder(currentState, currentFormat);
        const newState = stateOrder.indexOf(currentState);

        // Обновляем состояние в базе данных
        if (newState) {
            await updateStateInDatabase(userID, newState);
        }
    } catch (err) {
        await logError('Ошибка при обновлении статуса в базе данных:', err);
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
    return newState;
}

// Запись обновлённого состояния в базу данных
async function updateStateInDatabase(userID, newState) {
    return new Promise((resolve, reject) => {
        db.run('UPDATE users SET state = ? WHERE user_id = ?', [newState, userID], err => {
            if (err) {
                reject(err);
                return;
            }
            resolve();
        });
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
const updatePhoneNumber = async (userID, phoneNumber) => {
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
