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

// Основні категорії
const mainCategories = {
    'Портативна техніка': [
        'Ноутбуки', 'Планшетні комп’ютери', 'Мобільні телефони смартфони', 'Електронні книги (Пристрої)',
        'Смарт-годинники', 'Портативні зарядні пристрої', 'Павербанки', 'Чохли для планшетів, електронних книг',
        'Чохли для телефонів', 'Захисні плівки та скло для портативних пристроїв', 'Сумки і рюкзаки для ноутбуків',
        'Підставки для ноутбуків', 'Зарядні пристрої для ноутбуків', 'Зарядні пристрої для фото-, відеокамер'
    ],
    'Комп’ютерна техніка': [
        'Системні блоки', 'Монітори', 'Веб камери', 'Принтери, сканери, бфп', 'Комп’ютерні миші і клавіатури',
        'Акустичні системи', 'Навушники і гарнітури', 'Мікрофони', 'Джойстіки та ігрові маніпулятори',
        'Килимки для миші', 'Джерела безперебійного живлення', 'Стабілізатори напруги'
    ],
    'Комплектуючі для ПК': [
        'Процесори', 'Відеокарти', 'Материнські плати', 'Модулі пам’яті', 'Внутрішні та зовнішні жорсткі диски, HDD, SSD',
        'Корпуси до комп’ютерів', 'Блоки живлення до комп’ютерів', 'Кулера і системи охолодження',
        'Звукові карти', 'Мережеві карти', 'Wi-fi адаптери', 'Термопрокладки й термопаста', 'Підставка для відеокарти'
    ],
    'Мережеве обладнання': [
        'Маршрутизатори', 'Комутатори', 'Точки доступу', 'Патч панелі', 'Патч-корди', 'Кабель для систем зв’язку',
        'Мережеві коннектори, модулі і роз’єми', 'Оптичні конвертори', 'Модулі GBIC та SFP', 'Монтажні шафи',
        'Шафи монтажні', 'IP-, skype- телефони', 'Камери відеоспостереження'
    ],
    'Побутова техніка': [
        'Мікрохвильові печі', 'Праски', 'Фени для волосся', 'Блендери', 'Електрочайники', 'Кавоварки/Кавомашини',
        'Кавомолки', 'Електричні м’ясорубки', 'Міксери', 'Мультиварки', 'Плити настільні', 'Кухонні комбайни/машини/подрібнювачі',
        'Соковитискачі', 'Сушарки/Дегідратори', 'Тостери', 'Роботи-пилососи', 'Кліматична техніка',
        'Інфрачервоні і каталітичні обігрівачі', 'Побутові масляні обігрівачі', 'Конвектори', 'Зволожувачі та очищувачі повітря',
        'Побутові вбудовані духові шафи', 'Вбудовані варильні поверхні', 'Кухонні витяжки', 'Грилі і барбекю побутові електричні'
    ],
    'Автотовари': [
        'Авто-, мото', 'Аксесуари для авто', 'Автомобільні електронні аксесуари', 'Відеореєстратори автомобільні',
        'GPS-навігатори', 'Автомобільні інвертори', 'Автохолодильники', 'Автомобільні пускозарядні пристрої',
        'Автомобільні щітки та скребки', 'Автомобільні кріплення', 'Автоакустика'
    ],
    'Аксесуари для техніки': [
        'Кабелі для електроніки', 'Подовжувачі електричні', 'USB хаби', 'Карти пам’яті', 'USB накопичувачі',
        'Кардрідери', 'DVD, BD і CD диски', 'Оптичні приводи', 'Наклейки на клавіатуру', 'Bluetooth-адаптери',
        'Акумулятори загального призначення', 'Зарядні пристрої для акумуляторів', 'Батарейки'
    ],
    'Офісна техніка та витратні матеріали': [
        'Офісне ПЗ', 'Операційні системи та утиліти', 'Картриджі для принтерів та БФП', 'Тонер і чорнила для друку',
        'Фотопапір', 'Офісний і поліграфічний папір', 'Плівки для ламінування', 'Ламінатори', 'Біндер для зшивання документів',
        'Принтери етикеток, штрихкодів, чеків', 'Сканери штрихкодів', 'Канцелярський і пакувальний скотч', 'Файли і папки'
    ],
    'Догляд за технікою та інструменти': [
        'Засоби для чистки цифрової техніки', 'Чистячі засоби для цифрової техніки', 'Термопрокладки й термопаста',
        'Інструменти обжимні ручні', 'Набори інструментів', 'Електроінструмент', 'Дрилі, шуруповерти', 'Шліфувальні машини',
        'Електролобзики', 'Паяльники', 'Фени технічні', 'Ручні дискові пили'
    ],
    'Інше': [
        'Настільні ігри', 'Пазли і головоломки', 'Іграшки для малюків', 'Дерев’яні іграшки', 'Ляльки, пупси',
        'Кухонний посуд', 'Каструлі', 'Сковорідки, сотейники, жаровні', 'Чайники', 'Кухонні дошки', 'Кухонні ножі і підставки',
        'Тарілки і піали', 'Ополоники, шумівки', 'Ваги кухонні', 'Ваги підлогові', 'Електричні грілки',
        'Охоронні системи та сигналізації', 'Радіоняні, відеоняні'
    ]
};

// Обробка даних XML
function processData(result) {
    try {
        const xmlCategories = result.yml_catalog.shop[0].categories[0].category;
        const categoriesMap = {};
        xmlCategories.forEach(cat => {
            categoriesMap[cat.$.id] = {
                name: cat._,
                parentId: cat.$.parentId || null
            };
        });

        const subCategoriesMap = {};
        Object.keys(mainCategories).forEach(mainCat => {
            subCategoriesMap[mainCat] = mainCategories[mainCat];
        });

        Object.values(categoriesMap).forEach(cat => {
            let assigned = false;
            for (const [mainCat, subCats] of Object.entries(mainCategories)) {
                if (subCats.includes(cat.name)) {
                    assigned = true;
                    break;
                }
            }
            if (!assigned && !subCategoriesMap['Інше'].includes(cat.name)) {
                subCategoriesMap['Інше'].push(cat.name);
            }
        });

        cachedProducts = result.yml_catalog.shop[0].offers[0].offer.map(item => {
            const xmlCategoryId = item.categoryId[0];
            const xmlCategory = categoriesMap[xmlCategoryId]?.name || 'Інше';
            let mainCategory = 'Інше';
            let subCategory = xmlCategory;

            for (const [mainCat, subCats] of Object.entries(mainCategories)) {
                if (subCats.includes(xmlCategory)) {
                    mainCategory = mainCat;
                    break;
                }
            }

            const params = {};
            if (item.param) {
                item.param.forEach(p => {
                    params[p.$.name] = p._;
                });
            }

            const images = item.picture ? item.picture : [];

            return {
                id: item.$.id,
                name: item.name[0],
                price: parseFloat(item.price[0]).toFixed(2),
                image: images[0] || '/images/no-image.jpg',
                images: images,
                category: mainCategory,
                subCategory: subCategory,
                description: item.description?.[0] || '',
                available: item.$.available === 'true',
                params: params,
                vendor: item.vendor?.[0] || '',
                vendorCode: item.vendorCode?.[0] || '',
                views: 0,
                createdAt: new Date().toISOString()
            };
        });

        cachedCategories = Object.keys(mainCategories);
        cachedSubCategories = subCategoriesMap;
        lastUpdate = Date.now();

        saveBackup();
        console.log(`Оновлено: ${cachedProducts.length} товарів, ${cachedCategories.length} основних категорій`);
    } catch (error) {
        console.error('Помилка обробки даних:', error);
        throw error;
    }
}

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
        const { category, subCategory, search, sort, priceMin, priceMax, available, limit } = req.query;
        let filteredProducts = cachedProducts;

        if (category) {
            filteredProducts = filteredProducts.filter(p => p.category === category);
        }

        if (subCategory) {
            filteredProducts = filteredProducts.filter(p => p.subCategory === subCategory);
        }

        if (search) {
            filteredProducts = filteredProducts.filter(p =>
                p.name.toLowerCase().includes(search.toLowerCase())
            );
        }

        if (priceMin) {
            filteredProducts = filteredProducts.filter(p => parseFloat(p.price) >= parseFloat(priceMin));
        }

        if (priceMax) {
            filteredProducts = filteredProducts.filter(p => parseFloat(p.price) <= parseFloat(priceMax));
        }

        if (available === 'true') {
            filteredProducts = filteredProducts.filter(p => p.available);
        }

        if (sort) {
            switch (sort) {
                case 'price-asc':
                    filteredProducts = filteredProducts.sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
                    break;
                case 'price-desc':
                    filteredProducts = filteredProducts.sort((a, b) => parseFloat(b.price) - parseFloat(a.price));
                    break;
                case 'popularity':
                    filteredProducts = filteredProducts.sort((a, b) => (b.views || 0) - (a.views || 0));
                    break;
                case 'new':
                    filteredProducts = filteredProducts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                    break;
                default:
                    break;
            }
        }

        if (limit) {
            filteredProducts = filteredProducts.slice(0, parseInt(limit));
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

app.get('/api/popular', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 12;
        const popularProducts = cachedProducts
            .sort((a, b) => (b.views || 0) - (a.views || 0))
            .slice(0, limit);
        res.json({
            success: true,
            products: popularProducts,
            count: popularProducts.length
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/view', async (req, res) => {
    try {
        const { productId } = req.body;
        const product = cachedProducts.find(p => p.id === productId);
        if (product) {
            product.views = (product.views || 0) + 1;
            await saveBackup();
            res.json({ success: true });
        } else {
            res.status(404).json({ success: false, error: 'Товар не знайдено' });
        }
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

app.post('/api/contact', async (req, res) => {
    try {
        const { name, email, message } = req.body;
        if (!name || !email || !message) {
            return res.status(400).json({ success: false, error: 'Усі поля обов’язкові' });
        }

        console.log('Отримано повідомлення:', { name, email, message });
        res.json({ success: true, message: 'Повідомлення надіслано' });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Помилка надсилання повідомлення' });
    }
});

// Сторінки
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/cart', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'cart.html'));
});

app.get('/product/:id', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'product.html'));
});

app.get('/categories', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'categories.html'));
});

app.get('/category/:categoryName', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'category.html'));
});

app.get('/subcategory/:subCategoryName', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'category.html'));
});

app.get('/search/:query', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'search.html'));
});

app.get('/contacts', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'contacts.html'));
});

app.get('/map', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'map.html'));
});

app.get('/warranty', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'warranty.html'));
});

// Запуск сервера
async function startServer() {
    await loadProducts();

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