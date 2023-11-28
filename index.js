const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('users.db');
require('dotenv').config();
// Приветственное сообщение в боте
const {TELEGRAM_BOT_TOKEN, ADMIN_ID} = process.env, TelegramApi = require('node-telegram-bot-api'),
bot = new TelegramApi(TELEGRAM_BOT_TOKEN, {polling: true});

db.run(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER UNIQUE, username TEXT, phone_number TEXT, body_weight REAL DEFAULT 0, body_fat_percentage REAL DEFAULT 0, physical_activity_coefficient REAL DEFAULT 0, gender TEXT DEFAULT 'М', state TEXT DEFAULT 'Похудеть', calories REAL DEFAULT 0);`);

// TODO: Массовая рассылка информации по доставке (например, задержка или отмена поставки сегодня)
// TODO: ----------------------------------------------------------------
// TODO: Проверить БД

// TODO: Добавить подгрузку state и сделать его изменение в зависимости от статуса
// TODO: Доделать логику обработки М/Ж пола
// TODO: сделать обработчик сохранения результата М/Ж
// TODO: Доделать логику обработки Веса
// TODO: сделать обработчик сохранения результата Веса
// TODO: Доделать логику обработки Жира
// TODO: сделать обработчик сохранения результата Жира
// TODO: Доделать логику обработки Калорий (+ или -)
// TODO: сделать обработчик сохранения результата Калорий (+ или -)

/*
    ⚖️ Общая масса тела / кг ⚖️
    🤸‍♀️ % жира 🤸‍♀️
    🍽️ Дефицит калорий 📉
    🍔 Профицит калорий 📈
*/

// Реакция на отправку контакта
bot.on('contact', async (msg) => {
    const phoneNumber = msg.contact.phone_number;
    const username = msg.chat.username || 'unknown';
    const userID = msg.from.id;

    await updatePhoneNumber(phoneNumber, userID);
});

// На написание письма реакция
bot.on('message', async msg => {
    console.log(msg);
    const username = msg.chat.username || 'unknown';
    const chatID = msg.chat.id;

    // Проверка на бота (отказываем в обслуживании)
    if (msg.from.is_bot)
        return await bot.sendMessage(ADMIN_ID, `@${username}: Обнаружен бот!!`);

    const text = msg.text || '';
    const msgType = msg.entities ? msg.entities[0].type : 'text';
    const contact = msg.contact ? msg.contact.phone_number : 0;

    if (contact !== 0) {
        checkPhoneNumber(chatID);
    }

// На время разработки
    if (ADMIN_ID !== chatID || chatID !== '801384711') {
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
        if (err) await console.error('Ошибка при проверке пользователя в базе данных:', err);

        // Добавляю нового пользователя
        if (!row) await giveMeYourPhoneNumber(chatID, username);
    });

});

// Обновление номера телефона в базе данных
const updatePhoneNumber = async (phoneNumber, userID) => {
    try {
        await db.run('UPDATE users SET phone_number = ? WHERE user_id = ?', [phoneNumber, userID]);
        console.log(`Номер телефона обновлен для пользователя ${userID}`);
    } catch (err) {
        console.error('Ошибка при обновлении номера телефона в базе данных:', err);
        bot.sendMessage(userID, 'Произошла ошибка при обновлении вашего номера телефона. Пожалуйста, попробуйте снова.');
    }
};

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

    if (reset === false) {
        await bot.sendMessage(chatID, helloMsg);
    }

    await bot.sendMessage(chatID, start_settings);
    await askMale(chatID);
}

// Вопрос про пол
async function askMale(chatID){
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

    await bot.sendMessage(chatID, 'Вы мужчина или женщина?', genderKeyboard);
}

// Вопрос про вес
async function askWeight(chatID){

}

// Вопрос про активность ежедневную
async function askActive(chatID){
    const activeKeyboard = [
        [ Markup.button("👩‍💻 Бытовая деятельность (сидячая работа) 🏠")],
        [ Markup.button("🏋️‍♂️ Фитнес тренировки 3 раза/неделю 💪") ],
        [ Markup.button("🏋️‍♀️ Фитнес тренировки 4-5 раз/неделю 💪") ],
        [ Markup.button("🏋️‍♂️ Интенсивные тренировки 4-5 раз/неделю 🔥")],
        [ Markup.button("🏋️‍♀️ Фитнес тренировки 6 раз/неделю 💦")],
        [ Markup.button("🏋️‍♂️ Интенсивные тренировки 6 раз/неделю 💦")],
        [ Markup.button("🏋️‍♀️🌞 Интенсивные тренировки 6 раз/неделю (2 раза/день) 💦🌙")]
    ];

    const active = 'Выберите наиболее близкий для вас вариант ежедневной активности?';

    await bot.sendMessage(chatID, active, activeKeyboard);
}

// Функция для проверки наличия номера телефона в базе данных по user_id
async function checkPhoneNumber(chatID) {
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

// Функция для обработки новых пользователей
async function giveMeYourPhoneNumber(chatID, username) {
    const keyboard = {
        reply_markup: {
            one_time_keyboard: true,
            keyboard: [[{ text: 'Поделиться номером телефона', request_contact: true }]],
        },
    };
    await bot.sendMessage(chatID, 'Поделитесь своим номером телефона, чтобы получить новый функционал!', keyboard);

    db.run('INSERT OR IGNORE INTO users (user_id, username) VALUES (?, ?)', [chatID, username], err => {
        if (err) console.error('Ошибка при добавлении пользователя в базу данных:', err);
    });
}

// Функция для отправки сообщений администратору
async function notifyAdmin(chatID, username, text) {
    if (ADMIN_ID !== chatID) {
        const message = `@${username || chatID}: ${text}`;
        await bot.sendMessage(ADMIN_ID, message);
    }
}

// Функция для обновления username в базе данных по user_id
async function updateUsernameInDatabase(userID, newUsername) {
    db.run('UPDATE users SET username = ? WHERE user_id = ?', [newUsername, userID], err => {
        if (err) {
            console.error('Ошибка при обновлении username в базе данных:', err);
        }
    });
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
        db.run('UPDATE users SET gender = ? WHERE user_id = ?', [validatedGender, userId], err => {
            if (err) {
                console.error('Ошибка при обновлении пола:', err);
            }
        });
    } else {
        console.error('Некорректное значение пола:', genderInput);
        // Здесь можно отправить сообщение пользователю о некорректном вводе
    }
}

// Функция для валидации веса
async function validateWeight(weight) {
    // Проверяем, что вес - это число
    const weightNumber = parseFloat(weight);
    if (isNaN(weightNumber)) {
        return false;
    }

    // Проверяем, что вес находится в заданном диапазоне
    if (weightNumber < 30 || weightNumber > 250) {
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
    if (validateWeight(newWeight)) {
        db.run('UPDATE users SET body_weight = ? WHERE user_id = ?', [newWeight, userId], err => {
            if (err) {
                console.error('Ошибка при обновлении веса:', err);
            }
        });
    } else {
        console.error('Некорректное значение веса:', newWeight);
        // Здесь вы можете отправить сообщение пользователю о том, что введен некорректный вес
        await bot.sendMessage(userId, `Вес `);
    }
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
    if (formattedFat < 0.09 || formattedFat > 0.4) {
        return null;
    }

    return formattedFat;
}

// Функция для сохранения или добавления процента жира
async function updateFatDatabase(userId, newFat) {
    const validatedFat = validateAndFormatBodyFat(newFat);

    if (validatedFat !== null) {
        db.run('UPDATE users SET body_fat_percentage = ? WHERE user_id = ?', [validatedFat, userId], err => {
            if (err) {
                console.error('Ошибка при обновлении процента жира:', err);
            }
        });
    } else {
        console.error('Некорректное значение процента жира:', newFat);
        // Здесь вы можете отправить сообщение пользователю о том, что введен некорректный процент жира
    }
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
        db.run('UPDATE users SET physical_activity_coefficient = ? WHERE user_id = ?', [newActivityCoefficient, userId], err => {
            if (err) {
                console.error('Ошибка при обновлении параметров активности:', err);
            }
        });
    } else {
        console.error('Некорректное описание активности:', activityDescription);
        // Здесь вы можете отправить сообщение пользователю о том, что введено некорректное описание активности
    }
}

// Функция для валидации и преобразования значения state
async function validateAndFormatState(stateInput) {
    const loseWeightIdentifiers = ['похудеть', 'меньше', 'уменьшить'];
    const gainWeightIdentifiers = ['потолстеть', 'больше', 'увеличить'];

    stateInput = stateInput.toLowerCase().trim();

    if (loseWeightIdentifiers.includes(stateInput)) {
        return 'Похудеть';
    } else if (gainWeightIdentifiers.includes(stateInput)) {
        return 'Потолстеть';
    } else {
        return null; // Возвращаем null, если значение не соответствует ни одному из идентификаторов
    }
}

// Функция для сохранения или обновления целей пользователя
async function updateStateDatabase(userId, stateInput) {
    const validatedState = validateAndFormatState(stateInput);

    if (validatedState !== null) {
        db.run('UPDATE users SET state = ? WHERE user_id = ?', [validatedState, userId], err => {
            if (err) {
                console.error('Ошибка при обновлении цели:', err);
            }
        });
    } else {
        console.error('Некорректное значение цели:', stateInput);
        // Здесь можно отправить сообщение пользователю о некорректном вводе
    }
}

// Функция высчета калорий
async function calculateCalories(userId) {
    // Расширяем запрос, чтобы получить также поле state
    db.get('SELECT body_weight, body_fat_percentage, physical_activity_coefficient, state FROM users WHERE user_id = ?', [userId], async (err, row) => {
        if (err) {
            console.error('Ошибка при получении данных пользователя:', err);
            return;
        }
        if (row) {
            const { body_weight, body_fat_percentage, physical_activity_coefficient, state } = row;

            // Проверяем, что все данные присутствуют и корректны
            if (body_weight && body_fat_percentage && physical_activity_coefficient) {
                // Вычисляем базовую калорийную норму
                const leanBodyMass = body_weight - (body_weight * body_fat_percentage);
                let calories = ((body_weight - leanBodyMass) * 23) * physical_activity_coefficient;

                // Корректируем калорийность в зависимости от целей пользователя
                if (state === 'Похудеть') {
                    calories -= 300;
                } else if (state === 'Потолстеть') {
                    calories += 300;
                }

                // Обновляем поле calories в базе данных
                db.run('UPDATE users SET calories = ? WHERE user_id = ?', [calories, userId], err => {
                    if (err) {
                        console.error('Ошибка при обновлении калорий в базе данных:', err);
                    }
                });
            } else {
                console.error('Недостаточно данных для расчета калорий.');
                await bot.sendMessage(userId, 'Недостаточно данных для расчёта калорий, попробуйте заполнить всё ещё раз!');
            }
        }
    });
}

/***************************************
 ***        ПОДСЧЁТ СТОИМОСТИ       ****
****************************************/
// Словарь цен в зависимости от калорий (для мужчин)
const priceRangesMan = [
    { minCal: 1600, maxCal: 1699, pricePerDay: 6500, pricePerWeek: 33000, pricePerTwoWeekSale: 62700, pricePerTwoWeek: 66000, pricePerTreeWeekSale: 118800, pricePerTreeWeek: 132000, pricePerMonthSale: 145200, pricePerMonth: 165200 },
    { minCal: 1700, maxCal: 1779, pricePerDay: 6300, pricePerWeek: 34200, pricePerTwoWeekSale: 64980, pricePerTwoWeek: 68400, pricePerTreeWeekSale: 123120, pricePerTreeWeek: 136800, pricePerMonthSale: 150480, pricePerMonth: 171000 },
    { minCal: 1800, maxCal: 1999, pricePerDay: 6100, pricePerWeek: 35400, pricePerTwoWeekSale: 67260, pricePerTwoWeek: 70800, pricePerTreeWeekSale: 127400, pricePerTreeWeek: 141600, pricePerMonthSale: 155760, pricePerMonth: 177000 },
    { minCal: 2000, maxCal: 2199, pricePerDay: 5900, pricePerWeek: 36600, pricePerTwoWeekSale: 69540, pricePerTwoWeek: 73200, pricePerTreeWeekSale: 131760, pricePerTreeWeek: 146400, pricePerMonthSale: 161040, pricePerMonth: 183000 },
    { minCal: 2200, maxCal: 2399, pricePerDay: 5700, pricePerWeek: 37800, pricePerTwoWeekSale: 71820, pricePerTwoWeek: 75600, pricePerTreeWeekSale: 136080, pricePerTreeWeek: 151200, pricePerMonthSale: 166320, pricePerMonth: 189000 },
    { minCal: 2400, maxCal: 2600, pricePerDay: 5500, pricePerWeek: 39000, pricePerTwoWeekSale: 74100, pricePerTwoWeek: 78000, pricePerTreeWeekSale: 140400, pricePerTreeWeek: 156000, pricePerMonthSale: 171600, pricePerMonth: 195000 },
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
            console.error('Ошибка при получении данных пользователя:', err);
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
                console.log(`Пользователь с ID ${userId} - Не удалось определить цену для указанного количества калорий.`);
            }
        } else {
            console.log(`Пользователь с ID ${userId} не найден в базе данных.`);
        }
    });
}


// Обработчик ошибок базы данных
db.on('error', async err => {
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