class ShopApp {
    constructor() {
        this.popularProducts = [];
        this.newProducts = [];
        this.cart = JSON.parse(localStorage.getItem('cart')) || [];
        this.categories = [];
        this.subCategories = {};
        this.searchTimeout = null;
        this.init();
    }

    async init() {
        await Promise.all([this.loadData(), this.loadCategories()]);
        this.renderCategories();
        this.renderProducts();
        this.setupEventListeners();
        this.updateCartCount();
    }

    async loadData() {
        try {
            const [popularRes, newRes] = await Promise.all([
                fetch('/api/popular?limit=10'),
                fetch('/api/products?sort=new&limit=10')
            ]);
            const [popularData, newData] = await Promise.all([popularRes.json(), newRes.json()]);
            if (popularData.success && newData.success) {
                this.popularProducts = popularData.products;
                this.newProducts = newData.products;
            }
        } catch (error) {
            console.error('Помилка завантаження:', error);
            this.showNotification('Не вдалося завантажити товари', 'bg-red-500');
        }
    }

    async loadCategories() {
        try {
            const response = await fetch('/api/categories');
            const data = await response.json();
            if (data.success) {
                this.categories = data.categories;
                this.subCategories = data.subCategories;
            }
        } catch (error) {
            console.error('Помилка завантаження категорій:', error);
        }
    }

    renderCategories() {
        const section = document.getElementById('categories-section');
        section.innerHTML = this.categories.map(cat => `
            <a href="/category/${encodeURIComponent(cat)}" class="category-card bg-white rounded-lg p-4 text-center">
                <i class="fas fa-laptop text-3xl text-blue-500 mb-2"></i>
                <h3 class="text-gray-800 font-semibold">${cat}</h3>
            </a>
        `).join('');

        const dropdown = document.getElementById('categories-dropdown');
        dropdown.innerHTML = this.categories.map(cat => `
            <div class="relative dropdown">
                <a href="/category/${encodeURIComponent(cat)}" class="block p-2 hover:bg-gray-100">${cat}</a>
                <div class="dropdown-menu w-48 p-2 left-full top-0">
                    ${this.subCategories[cat].map(sub => `
                        <a href="/subcategory/${encodeURIComponent(sub)}" class="block p-2 hover:bg-gray-100">${sub}</a>
                    `).join('')}
                </div>
            </div>
        `).join('');

        const mobile = document.getElementById('mobile-categories');
        mobile.innerHTML = this.categories.map(cat => `
            <div>
                <div class="flex justify-between items-center p-2 hover:bg-gray-100">
                    <a href="/category/${encodeURIComponent(cat)}" class="text-gray-800">${cat}</a>
                    <button class="toggle-subcategory text-blue-600" data-category="${cat}">
                        <i class="fas fa-chevron-down"></i>
                    </button>
                </div>
                <div class="subcategories hidden pl-4">
                    ${this.subCategories[cat].map(sub => `
                        <a href="/subcategory/${encodeURIComponent(sub)}" class="block p-2 hover:bg-gray-100">${sub}</a>
                    `).join('')}
                </div>
            </div>
        `).join('');
    }

    renderProducts() {
        const popularContainer = document.getElementById('popular-products');
        popularContainer.innerHTML = this.popularProducts.map(p => this.renderProductCard(p)).join('');

        const newContainer = document.getElementById('new-products');
        newContainer.innerHTML = this.newProducts.map(p => this.renderProductCard(p)).join('');
    }

    renderProductCard(product) {
        return `
            <div class="product-card bg-white rounded-lg overflow-hidden">
                <a href="/product/${product.id}">
                    <img src="${product.image}" alt="${product.name}" class="w-full h-40 object-contain p-4"
                         onerror="this.src='/images/no-image.jpg'">
                </a>
                <div class="p-4">
                    <a href="/product/${product.id}" class="text-gray-800 font-semibold line-clamp-2">${product.name}</a>
                    <p class="text-blue-600 font-bold mt-1">${product.price} грн</p>
                    <p class="text-sm ${product.available ? 'text-green-600' : 'text-red-600'}">
                        ${product.available ? 'В наявності' : 'Немає в наявності'}
                    </p>
                    <button class="mt-2 w-full bg-orange-500 text-white py-1 rounded-lg hover:bg-orange-600 
                                   ${product.available ? '' : 'opacity-50 cursor-not-allowed'}" 
                            data-id="${product.id}" ${product.available ? '' : 'disabled'}>
                        Додати в кошик
                    </button>
                </div>
            </div>
        `;
    }

    async searchProducts(query, containerId = 'search-results') {
        try {
            const response = await fetch(`/api/products?search=${encodeURIComponent(query)}`);
            const data = await response.json();
            if (data.success) {
                const container = document.getElementById(containerId);
                container.innerHTML = data.products
                    .filter(p => p.name.toLowerCase().includes(query.toLowerCase()))
                    .slice(0, 5)
                    .map(product => `
                        <a href="/product/${product.id}" class="block p-2 hover:bg-gray-100">
                            <div class="flex items-center">
                                <img src="${product.image}" alt="${product.name}" class="w-10 h-10 object-contain mr-2"
                                     onerror="this.src='/images/no-image.jpg'">
                                <div>
                                    <p class="text-gray-800">${product.name}</p>
                                    <p class="text-blue-600">${product.price} грн</p>
                                </div>
                            </div>
                        </a>
                    `).join('') || '<p class="p-2 text-gray-500">Нічого не знайдено</p>';
                container.classList.add('dropdown-menu');
            }
        } catch (error) {
            console.error('Помилка пошуку:', error);
            this.showNotification('Помилка пошуку', 'bg-red-500');
        }
    }

    addToCart(productId) {
        const product = [...this.popularProducts, ...this.newProducts].find(p => p.id === productId);
        if (!product) return;

        const cartItem = this.cart.find(p => p.id === productId);
        if (cartItem) {
            cartItem.quantity += 1;
        } else {
            this.cart.push({ ...product, quantity: 1 });
        }
        localStorage.setItem('cart', JSON.stringify(this.cart));
        this.updateCartCount();
        this.showNotification(`${product.name} додано в кошик`, 'bg-blue-500');
    }

    updateCartCount() {
        document.getElementById('cart-count').textContent = this.cart.reduce((sum, item) => sum + item.quantity, 0);
    }

    setupEventListeners() {
        // Додавання в кошик
        document.addEventListener('click', (e) => {
            if (e.target.closest('button[data-id]')) {
                const id = e.target.dataset.id;
                this.addToCart(id);
            }
            if (e.target.closest('.toggle-subcategory')) {
                const category = e.target.closest('.toggle-subcategory').dataset.category;
                const subcategories = e.target.closest('.toggle-subcategory').parentElement.nextElementSibling;
                subcategories.classList.toggle('hidden');
                const icon = e.target.querySelector('i');
                icon.classList.toggle('fa-chevron-down');
                icon.classList.toggle('fa-chevron-up');
            }
        });

        // Пошук
        const searchInputs = [
            { input: document.getElementById('search-input'), results: 'search-results' },
            { input: document.getElementById('mobile-search-input'), results: 'mobile-search-results' }
        ];

        searchInputs.forEach(({ input, results }) => {
            input.addEventListener('input', () => {
                clearTimeout(this.searchTimeout);
                const query = input.value.trim();
                if (query.length > 0) {
                    this.searchTimeout = setTimeout(() => this.searchProducts(query, results), 300);
                } else {
                    document.getElementById(results).innerHTML = '';
                    document.getElementById(results).classList.remove('dropdown-menu');
                }
            });

            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    const query = input.value.trim();
                    if (query) {
                        window.location.href = `/search/${encodeURIComponent(query)}`;
                    }
                }
            });
        });

        // Закриття результатів пошуку
        document.addEventListener('click', (e) => {
            if (!e.target.closest('#search-input') && !e.target.closest('#search-results') &&
                !e.target.closest('#mobile-search-input') && !e.target.closest('#mobile-search-results')) {
                document.getElementById('search-results').innerHTML = '';
                document.getElementById('search-results').classList.remove('dropdown-menu');
                document.getElementById('mobile-search-results').innerHTML = '';
                document.getElementById('mobile-search-results').classList.remove('dropdown-menu');
            }
        });

        // Бургер-меню
        document.getElementById('burger-menu').addEventListener('click', () => {
            const menu = document.getElementById('mobile-menu');
            menu.classList.toggle('active');
        });
    }

    showNotification(message, bgClass = 'bg-blue-500') {
        const notification = document.getElementById('notification');
        notification.textContent = message;
        notification.className = `fixed bottom-4 right-4 ${bgClass} text-white px-4 py-2 rounded-lg shadow-lg`;
        notification.classList.remove('hidden');
        setTimeout(() => notification.classList.add('hidden'), 3000);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new ShopApp();
});