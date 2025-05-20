class CategoryApp {
    constructor() {
        this.products = [];
        this.categories = [];
        this.subCategories = {};
        this.cart = JSON.parse(localStorage.getItem('cart')) || [];
        this.searchTimeout = null;
        const path = window.location.pathname;
        this.isSubCategory = path.startsWith('/subcategory/');
        this.categoryName = decodeURIComponent(path.split('/').pop());
        this.filters = {
            priceMin: null,
            priceMax: null,
            availableOnly: false,
            sort: 'default'
        };
        this.init();
    }

    async init() {
        await Promise.all([this.loadProducts(), this.loadCategories()]);
        this.renderCategories();
        this.renderProducts();
        this.setupEventListeners();
        this.updateCartCount();
    }

    async loadProducts() {
        try {
            const params = new URLSearchParams();
            if (this.isSubCategory) {
                params.append('subCategory', this.categoryName);
            } else {
                params.append('category', this.categoryName);
            }
            if (this.filters.priceMin) params.append('priceMin', this.filters.priceMin);
            if (this.filters.priceMax) params.append('priceMax', this.filters.priceMax);
            if (this.filters.availableOnly) params.append('available', true);
            if (this.filters.sort !== 'default') params.append('sort', this.filters.sort);

            const response = await fetch(`/api/products?${params.toString()}`);
            const data = await response.json();
            if (data.success) {
                this.products = data.products;
                document.getElementById('category-title').textContent = this.categoryName;
            }
        } catch (error) {
            console.error('Помилка завантаження товарів:', error);
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
        const sidebar = document.getElementById('categories-sidebar');
        sidebar.innerHTML = this.categories.map(cat => `
            <div>
                <div class="flex justify-between items-center p-2 hover:bg-gray-100">
                    <a href="/category/${encodeURIComponent(cat)}" class="text-gray-800 font-semibold">${cat}</a>
                    <button class="toggle-subcategory text-blue-600" data-category="${cat}">
                        <i class="fas ${this.isSubCategory && this.subCategories[cat].includes(this.categoryName) ? 'fa-chevron-up' : 'fa-chevron-down'}"></i>
                    </button>
                </div>
                <div class="subcategories ${this.isSubCategory && this.subCategories[cat].includes(this.categoryName) ? '' : 'hidden'} pl-4 space-y-1">
                    ${this.subCategories[cat].map(sub => `
                        <a href="/subcategory/${encodeURIComponent(sub)}" class="block p-2 hover:bg-gray-100 text-gray-600">${sub}</a>
                    `).join('')}
                </div>
            </div>
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
        const container = document.getElementById('products-container');
        container.innerHTML = this.products.length > 0
            ? this.products.map(p => `
                <div class="product-card bg-white rounded-lg overflow-hidden">
                    <a href="/product/${p.id}">
                        <img src="${p.image}" alt="${p.name}" class="w-full h-40 object-contain p-4"
                             onerror="this.src='/images/no-image.jpg'">
                    </a>
                    <div class="p-4">
                        <a href="/product/${p.id}" class="text-gray-800 font-semibold line-clamp-2">${p.name}</a>
                        <p class="text-blue-600 font-bold mt-1">${p.price} грн</p>
                        <p class="text-sm ${p.available ? 'text-green-600' : 'text-red-600'}">
                            ${p.available ? 'В наявності' : 'Немає в наявності'}
                        </p>
                        <button class="mt-2 w-full bg-orange-500 text-white py-1 rounded-lg hover:bg-orange-600 
                                       ${p.available ? '' : 'opacity-50 cursor-not-allowed'}" 
                                data-id="${p.id}" ${p.available ? '' : 'disabled'}>
                            Додати в кошик
                        </button>
                    </div>
                </div>
            `).join('')
            : '<p class="col-span-full text-center text-gray-500">Товари відсутні</p>';
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
        const product = this.products.find(p => p.id === productId);
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

    applyFilters() {
        this.filters.priceMin = parseFloat(document.getElementById('price-min').value) || null;
        this.filters.priceMax = parseFloat(document.getElementById('price-max').value) || null;
        this.filters.availableOnly = document.getElementById('available-only').checked;
        this.filters.sort = document.getElementById('sort').value;
        this.loadProducts().then(() => this.renderProducts());
    }

    setupEventListeners() {
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

        document.addEventListener('click', (e) => {
            if (!e.target.closest('#search-input') && !e.target.closest('#search-results') &&
                !e.target.closest('#mobile-search-input') && !e.target.closest('#mobile-search-results')) {
                document.getElementById('search-results').innerHTML = '';
                document.getElementById('search-results').classList.remove('dropdown-menu');
                document.getElementById('mobile-search-results').innerHTML = '';
                document.getElementById('mobile-search-results').classList.remove('dropdown-menu');
            }
        });

        document.getElementById('burger-menu').addEventListener('click', () => {
            const menu = document.getElementById('mobile-menu');
            menu.classList.toggle('active');
        });

        document.getElementById('price-min').addEventListener('input', () => this.applyFilters());
        document.getElementById('price-max').addEventListener('input', () => this.applyFilters());
        document.getElementById('available-only').addEventListener('change', () => this.applyFilters());
        document.getElementById('sort').addEventListener('change', () => this.applyFilters());
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
    new CategoryApp();
});