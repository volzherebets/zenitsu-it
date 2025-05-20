class CartApp {
    constructor() {
        this.cart = JSON.parse(localStorage.getItem('cart')) || [];
        this.categories = [];
        this.subCategories = {};
        this.searchTimeout = null;
        this.init();
    }

    async init() {
        await this.loadCategories();
        this.renderCart();
        this.renderCategories();
        this.setupEventListeners();
        this.updateCartCount();
        this.updateTotalPrice();
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

    renderCart() {
        const container = document.getElementById('cart-items');
        container.innerHTML = this.cart.length > 0
            ? this.cart.map((item, index) => `
                <div class="flex items-center justify-between border-b py-4">
                    <div class="flex items-center">
                        <img src="${item.image}" alt="${item.name}" class="w-16 h-16 object-contain mr-4"
                             onerror="this.src='/images/no-image.jpg'">
                        <div>
                            <a href="/product/${item.id}" class="text-gray-800 font-semibold">${item.name}</a>
                            <p class="text-blue-600 font-bold">${item.price} грн</p>
                        </div>
                    </div>
                    <div class="flex items-center space-x-2">
                        <button data-index="${index}" class="decrement bg-gray-200 text-gray-800 px-2 py-1 rounded">-</button>
                        <span>${item.quantity}</span>
                        <button data-index="${index}" class="increment bg-gray-200 text-gray-800 px-2 py-1 rounded">+</button>
                        <button data-index="${index}" class="remove text-red-600 hover:text-red-700">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `).join('')
            : '<p class="text-center text-gray-500">Кошик порожній</p>';
    }

    renderCategories() {
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

    updateCartCount() {
        document.getElementById('cart-count').textContent = this.cart.reduce((sum, item) => sum + item.quantity, 0);
    }

    updateTotalPrice() {
        const total = this.cart.reduce((sum, item) => sum + (parseFloat(item.price) * item.quantity), 0);
        document.getElementById('total-price').textContent = total.toFixed(2);
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

    setupEventListeners() {
        document.addEventListener('click', (e) => {
            if (e.target.closest('.increment')) {
                const index = e.target.dataset.index;
                this.cart[index].quantity += 1;
                localStorage.setItem('cart', JSON.stringify(this.cart));
                this.renderCart();
                this.updateCartCount();
                this.updateTotalPrice();
            }
            if (e.target.closest('.decrement')) {
                const index = e.target.dataset.index;
                if (this.cart[index].quantity > 1) {
                    this.cart[index].quantity -= 1;
                } else {
                    this.cart.splice(index, 1);
                }
                localStorage.setItem('cart', JSON.stringify(this.cart));
                this.renderCart();
                this.updateCartCount();
                this.updateTotalPrice();
            }
            if (e.target.closest('.remove')) {
                const index = e.target.dataset.index;
                this.cart.splice(index, 1);
                localStorage.setItem('cart', JSON.stringify(this.cart));
                this.renderCart();
                this.updateCartCount();
                this.updateTotalPrice();
            }
            if (e.target.closest('#checkout')) {
                this.showNotification('Функція оформлення замовлення в розробці', 'bg-blue-500');
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
    new CartApp();
});