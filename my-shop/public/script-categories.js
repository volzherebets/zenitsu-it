class CategoriesApp {
    constructor() {
        this.categories = [];
        this.subCategories = {};
        this.cart = JSON.parse(localStorage.getItem('cart')) || [];
        this.searchTimeout = null;
        this.expandedCategories = new Set();
        this.init();
    }

    async init() {
        await this.loadCategories();
        this.renderCategories();
        this.setupEventListeners();
        this.updateCartCount();
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
            this.showNotification('Не вдалося завантажити категорії', 'bg-red-500');
        }
    }

    renderCategories() {
        const container = document.getElementById('categories-container');
        container.innerHTML = this.categories.map(category => `
            <div class="category-card bg-white rounded-lg p-6 shadow-sm">
                <h2 class="text-xl font-bold text-gray-800 mb-4">
                    <a href="/category/${encodeURIComponent(category)}" class="hover:text-blue-600">${category}</a>
                </h2>
                <ul class="space-y-2">
                    ${this.subCategories[category].slice(0, this.expandedCategories.has(category) ? undefined : 3).map(subCategory => `
                        <li>
                            <a href="/subcategory/${encodeURIComponent(subCategory)}" class="text-gray-600 hover:text-blue-600">
                                ${subCategory}
                            </a>
                        </li>
                    `).join('')}
                </ul>
                ${this.subCategories[category].length > 3 ? `
                    <button data-category="${category}" class="show-more mt-4 text-blue-600 hover:text-blue-700">
                        ${this.expandedCategories.has(category) ? 'Приховати' : `Показати всі (${this.subCategories[category].length})`}
                    </button>
                ` : ''}
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

    updateCartCount() {
        document.getElementById('cart-count').textContent = this.cart.reduce((sum, item) => sum + item.quantity, 0);
    }

    toggleCategory(category) {
        if (this.expandedCategories.has(category)) {
            this.expandedCategories.delete(category);
        } else {
            this.expandedCategories.add(category);
        }
        this.renderCategories();
    }

    setupEventListeners() {
        document.addEventListener('click', (e) => {
            if (e.target.closest('.show-more')) {
                const category = e.target.dataset.category;
                this.toggleCategory(category);
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
    new CategoriesApp();
});