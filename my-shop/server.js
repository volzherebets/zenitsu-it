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
let lastUpdate = null;

// Обробка даних XML
function processData(result) {
  try {
    const categoriesMap = {};
    result.yml_catalog.shop[0].categories[0].category.forEach(cat => {
      categoriesMap[cat.$.id] = cat._;
    });

    cachedProducts = result.yml_catalog.shop[0].offers[0].offer.map(item => ({
      id: item.$.id,
      name: item.name[0],
      price: parseFloat(item.price[0]).toFixed(2),
      image: item.picture?.[0] || '/images/no-image.jpg',
      category: categoriesMap[item.categoryId[0]] || 'Інше',
      description: item.description?.[0] || '',
      available: item.$.available === 'true'
    }));

    cachedCategories = [...new Set(cachedProducts.map(p => p.category))];
    lastUpdate = Date.now();

    saveBackup();
    console.log(`Оновлено: ${cachedProducts.length} товарів, ${cachedCategories.length} категорій`);
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
    lastUpdate = backup.timestamp || Date.now();
    
    console.log(`Використано резервні дані (${cachedProducts.length} товарів)`);
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
  lastUpdate = Date.now();

  await saveBackup();
  console.log('Створено порожній резервний файл');
}

// API
app.get('/api/products', async (req, res) => {
  try {
    res.json({
      success: true,
      products: cachedProducts.filter(p => p.available),
      lastUpdate: new Date(lastUpdate).toISOString(),
      count: cachedProducts.length
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/categories', async (req, res) => {
  res.json({
    success: true,
    categories: cachedCategories
  });
});

// Сторінки
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/cart', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'cart.html'));
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
      🗂 Категорій: ${cachedCategories.length}
    `);
  });
}

startServer().catch(error => {
  console.error('Помилка запуску сервера:', error);
  process.exit(1);
});