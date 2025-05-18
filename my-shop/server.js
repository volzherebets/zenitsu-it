require('dotenv').config();
const express = require('express');
const path = require('path');
const axios = require('axios');
const xml2js = require('xml2js');
const cron = require('node-cron');
const fs = require('fs').promises;
const { existsSync } = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const XML_URL = process.env.XML_URL;

// Перевірка URL
if (!XML_URL || !XML_URL.startsWith('http')) {
    console.error('Помилка: Некоректний URL для XML. Перевірте .env файл');
    process.exit(1);
}

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Кеш даних
let cachedProducts = [];
let cachedCategories = [];
let cachedSubCategories = {};
let lastUpdate = null;

// Обробка даних XML
function processData(result) {
    try {
        // Створення мапи категорій з XML
        const categoriesMap = {};
        result.yml_catalog.shop[0].categories[0].category.forEach(cat => {
            categoriesMap[cat.$.id] = cat._;
        });

        // Основні категорії та підкатегорії
        const mainCategories = {
            'Портативна техніка': [
                'Ноутбуки', 'Планшетні комп\'ютери', 'Мобільні телефони смартфони',
                'Електронні книги (Пристрої)', 'Смарт-годинники', 'Відеокамери, екшн-камери',
                'Сумки і рюкзаки для ноутбуків', 'Чохли для планшетів, електронних книг',
                'Блоки живлення до комп\'ютерів', 'Підставки для ноутбуків',
                'Портативні зарядні пристрої', 'Павербанки', 'Карти пам\'яті',
                'USB накопичувачі', 'Захисні плівки та скло для портативних пристроїв',
                'Чохли для телефонів', 'USB хаби', 'Bluetooth-адаптері', 'Батарейки',
                'Акумулятори загального призначення', 'Зарядні пристрої для акумуляторів',
                'Наклейки на клавіатуру', 'Дорожні сумки та валізи'
            ],
            'Комп\'ютерна техніка': [
                'Системні блоки', 'Монітори', 'Веб камери', 'Принтери, сканері, бфп',
                'Акустичні системи', 'Мікрофони', 'Навушники і гарнітури',
                'Джерела безперебійного живлення', 'Стабілізатори напруги',
                'Комп\'ютерні миші і клавіатури', 'Джойстіки та ігрові маніпулятори',
                'Килимки для миші', 'Зовнішні жорсткі диски, HDD, SSD',
                'Оптичні приводи', 'Кардрідери', 'DVD, BD і CD диски',
                'Програмне забезпечення', 'Офісне ПЗ', 'Операційні системи та утиліти'
            ],
            'Комплектуючі для ПК': [
                'Корпуси до комп\'ютерів', 'Процесори', 'Відеокарти', 'Материнські плати',
                'Модулі пам\'яті', 'SSD диски', 'Жорсткі диски', 'Блоки живлення до комп\'ютерів',
                'Звукові карти', 'Мережеві карти', 'Wi-fi адаптери', 'Кулера і системи охолодження',
                'Термопрокладки й термопаста', 'Кишені для жостких дисків'
            ],
            'Мережеве обладнання': [
                'Маршрутизатори', 'Комутатори', 'Точки доступу', 'Патч панелі',
                'Патч-корді', 'Кабель для систем зв\'язку', 'Мережеві коннектори, модулі і роз\'єми',
                'Оптичні конвертори', 'Модулі GBIC та SFP', 'Монтажні шафи',
                'Шафи монтажні', 'IP-, skype- телефони', 'Камери відеоспостереження'
            ],
            'Кабелі, подовжувачі': [
                'Кабелі для електроніки', 'Подовжувачі електричні', 'USB кабелі',
                'HDMI кабелі', 'Аудіо кабелі', 'Кабель живлення', 'Електроізоляційні стрічки'
            ],
            'Перехідники, адаптери': [
                'Адаптери и плати разширення', 'Автомобільні адаптери живлення',
                'Підставки тримачі для портативних пристроїв', 'Перехідники для розеток'
            ],
            'Для офісу, ТВ, інше': [
                'Телевізори', 'Проектори', 'Проекційні екрани', 'Стаціонарні телефони',
                'Радіоняні, відеоняні', 'Ламінатори', 'Плівки для ламінування',
                'Біндер для зшивання документів', 'Сканери штрихкодів',
                'Принтеры етикеток, штрихкодів, чеків', 'Офісний і поліграфічний папір',
                'Файли і папки', 'Канцелярський і пакувальний скотч'
            ],
            'Витратні матеріали': [
                'Тонер і чорнила для друку', 'Картриджі для принтерів та БФП',
                'Фотобарабани', 'Фотопапір', 'Витратні матеріали для 3D пристроїв',
                'Стрічки LED'
            ],
            'Ремонт картриджів': [
                'Запчастини і коплектуючі до офісної техніки', 'Фотобарабани',
                'Чиповані картриджі', 'Ремонтні комплекти'
            ],
            'Автотовари': [
                'Авто-, мото', 'Аксесуарі для авто', 'Автомобільні електронні аксесуари',
                'Відеореєстратори автомобільні', 'GPS-навігатори', 'Автомобільні інвертори',
                'Автомобільні пуско-зарядні пристрої', 'Автохолодильники',
                'Автомобільні щітки та скребки'
            ],
            'Догляд за технікою': [
                'Засоби для чистки цифрової техніки', 'Чистячі засоби для цифрової техніки',
                'Етикетки та бирки', 'Замки для ноутбуків'
            ],
            'Побутова техніка': [
                'Побутова техніка', 'Кліматична техніка', 'Інфрачервоні і каталітичні обігрівачі',
                'Побутові масляні обігрівачі', 'Конвектори', 'Мікрохвильові печі',
                'Праски', 'Фены для волосся', 'Блендери', 'Електрочайники',
                'Кавоварки/Кавомашини', 'Кавомолки', 'Електричні м\'ясорубки',
                'Міксери', 'Мультиварки', 'Плити настільні', 'Кухонні комбайни/машини/подрібнювачі',
                'Соковитискачі', 'Сушарки/Дегідратори', 'Тостері', 'Роботи-пилососи',
                'Прасувальні дошки', 'Кухонні ножі і підставки', 'Ваги кухонні',
                'Ваги підлогові', 'Електричні грілки', 'Зволожувачі та очищувачі повітря',
                'Охоронні системи та сигналізації'
            ]
        };

        // Формування списку всіх категорій
        const allCategories = {};
        for (const [mainCat, subCats] of Object.entries(mainCategories)) {
            allCategories[mainCat] = subCats;
        }

        // Обробка товарів
        cachedProducts = result.yml_catalog.shop[0].offers[0].offer.map(item => {
            const xmlCategory = categoriesMap[item.categoryId[0]] || 'Інше';

            // Знаходимо до якої основної категорії належить товар
            let mainCategory = 'Інше';
            let subCategory = xmlCategory;

            for (const [mainCat, subCats] of Object.entries(mainCategories)) {
                if (subCats.includes(xmlCategory)) {
                    mainCategory = mainCat;
                    break;
                }
            }

            return {
                id: item.$.id,
                name: item.name[0],
                price: parseFloat(item.price[0]).toFixed(2),
                image: item.picture?.[0] || '/images/no-image.jpg',
                category: mainCategory,
                subCategory: subCategory,
                description: item.description?.[0] || '',
                available: item.$.available === 'true'
            };
        });

        // Зберігаємо структуру категорій
        cachedCategories = Object.keys(mainCategories);
        cachedSubCategories = mainCategories;

        lastUpdate = Date.now();

        saveBackup();
        console.log(`Оновлено: ${cachedProducts.length} товарів, ${cachedCategories.length} основних категорій`);
    } catch (error) {
        console.error('Помилка обробки даних:', error);
        throw error;
    }
}

// Збереження резерву
async function saveBackup() {
    const backupData = {
        products: cachedProducts,
        categories: cachedCategories,
        subCategories: cachedSubCategories,
        timestamp: lastUpdate
    };

    await fs.writeFile(
        path.join(__dirname, 'data', 'last-products.json'),
        JSON.stringify(backupData, null, 2),
        'utf-8'
    );
}

// Завантаження даних
async function loadProducts() {
    try {
        console.log(`Спробую завантажити XML з ${XML_URL}...`);
        const response = await axios.get(XML_URL, {
            timeout: 10000,
            headers: { 'User-Agent': 'MyShop/1.0' }
        });
        const result = await xml2js.parseStringPromise(response.data);
        processData(result);
    } catch (error) {
        console.error('Помилка завантаження XML:', error.message);
        await loadLocalBackup();
    }
}

// Завантаження резерву
async function loadLocalBackup() {
    try {
        const backupPath = path.join(__dirname, 'data', 'last-products.json');

        if (!existsSync(backupPath)) {
            console.log('Резервний файл не знайдено, спробую локальний XML...');
            await loadLocalXML();
            return;
        }

        const data = await fs.readFile(backupPath, 'utf-8');
        const backup = JSON.parse(data);

        cachedProducts = backup.products || [];
        cachedCategories = backup.categories || [];
        cachedSubCategories = backup.subCategories || {};
        lastUpdate = backup.timestamp || Date.now();

        console.log(`Використано резервні дані (${cachedProducts.length} товарів, ${cachedCategories.length} категорій)`);
    } catch (e) {
        console.error('Помилка резерву:', e.message);
        await loadLocalXML();
    }
}

// Завантаження локального XML
async function loadLocalXML() {
    try {
        const xmlPath = path.join(__dirname, 'data', 'products.xml');
        if (!existsSync(xmlPath)) {
            throw new Error('Локальний XML файл не знайдено');
        }

        const data = await fs.readFile(xmlPath, 'utf-8');
        const result = await xml2js.parseStringPromise(data);
        processData(result);
        console.log('Використано локальний XML файл');
    } catch (error) {
        console.error('Помилка локального XML:', error.message);
        await createEmptyBackup();
    }
}

// Створення порожнього резерву
async function createEmptyBackup() {
    cachedProducts = [];
    cachedCategories = [];
    cachedSubCategories = {};
    lastUpdate = Date.now();

    await saveBackup();
    console.log('Створено порожній резервний файл');
}

// API
app.get('/api/products', async (req, res) => {
    try {
        const { category } = req.query;
        let filteredProducts = cachedProducts.filter(p => p.available);

        if (category) {
            filteredProducts = filteredProducts.filter(p => p.category === category);
        }

        res.json({
            success: true,
            products: filteredProducts,
            lastUpdate: new Date(lastUpdate).toISOString(),
            count: filteredProducts.length
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/categories', async (req, res) => {
    res.json({
        success: true,
        categories: cachedCategories,
        subCategories: cachedSubCategories
    });
});

// Сторінки
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/cart', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'cart.html'));
});

app.get('/category/:categoryName', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Запуск сервера
async function startServer() {
    await loadProducts();

    // Планувальник оновлень (кожні 30 хв)
    cron.schedule('*/30 * * * *', () => {
        console.log('\n--- Заплановане оновлення ---');
        loadProducts();
    });

    app.listen(PORT, () => {
        console.log(`
            🚀 Сервер запущено: http://localhost:${PORT}
            ⏱ Останнє оновлення: ${new Date(lastUpdate).toLocaleString()}
            📦 Товарів: ${cachedProducts.length}
            🗂 Основних категорій: ${cachedCategories.length}
        `);
    });
}

startServer().catch(error => {
    console.error('Помилка запуску сервера:', error);
    process.exit(1);
});