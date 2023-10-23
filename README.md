# TG_FoodOption

Проект TG_FoodOption представляет собой телеграм-бота для небольшой сети доставки питания с использованием Node.js и библиотеки `node-telegram-bot-api`.

## Установка и Настройка

1. **Инициализация проекта с помощью npm:**
   ```bash
   npm init -y
   ```

2. **Инициализируем npm**
   ```bash
   npm init -y
   ```

3. **Устанавливаем библиотеку для работы с telegram API**
   ```bash
   npm i node-telegram-bot-api
   ```

4. **Для хранения ключей скачиваем dotenv**
   ```bash
   npm install dotenv
   ```

5. **Создаём в корне проекта файл .env и добавляем туда свои ключи для ТГ бота**
   ```bash
   TELEGRAM_BOT_TOKEN=*ключ*
   ```

Убедитесь, что файл .env не добавлен в репозиторий (добавьте его в .gitignore), чтобы сохранить конфиденциальность ваших данных.

## Использование
Ваш бот готов к использованию! Теперь вы можете разрабатывать и добавлять функционал для небольшой сети доставки питания в вашем проекте. Помните, что вы можете использовать переменные среды в вашем коде для безопасного доступа к ключам и другим конфиденциальным данным:
   ```javascript
   require('dotenv').config();
   
   const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
   const apiKey = process.env.API_KEY;
   
   // Ваш код для работы с Telegram API и другими функциями бота здесь
   ```