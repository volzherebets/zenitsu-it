class ProductApp {
    constructor() {
        this.product = null;
        this.cart = JSON.parse(localStorage.getItem('cart')) || [];
        this.categories = [];
        this.subCategories = {};
        this.searchTimeout = null;
        this.productId = window.location.pathname.split('/').pop();
        this.init();
    }

    async init() {
        await Promise.all([this.loadProduct(), this.loadCategories()]);
        this.renderProduct();
        this.renderCategories();
        this.setupEventListeners();
        this.updateCartCount();
    }

    async loadProduct() {
        try {
            const response = await fetch(`/api/products`);
            const data = await response.json();
            if (data.success) {
                this.product = data.products.find(p => p.id === this.productId);
                if (this.product) {
                    await fetch('/api/view', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ productId: this.productId })
                    });
                }
            }
        } catch (error) {
            console.error('Помилка завантаження товару:', error);
            this.showNotification('Не вдалося завантажити товар', 'bg-red-500');
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

    renderProduct() {
        if (!this.product) {
            document.querySelector('.max-w-7xl').innerHTML = '<p class="text-center text-gray-500">Товар не знайдено</p>';
            return;
        }

        document.getElementById('product-name').textContent = this.product.name;
        document.getElementById('product-price').textContent = `${this.product.price} грн`;
        document.getElementById('product-availability').textContent = this.product.available ? 'В наявності' : 'Немає в наявності';
        document.getElementById('product-availability').className = `text-sm mb-4 ${this.product.available ? 'text-green-600' : 'text-red-600'}`;
        document.getElementById('product-vendor').textContent = this.product.vendor ? `Виробник: ${this.product.vendor}` : '';
        document.getElementById('product-vendor-code').textContent = this.product.vendorCode ? `Код товару: ${this.product.vendorCode}` : '';
        document.getElementById('product-image').src = this.product.image;
        document.getElementById('product-image').onerror = () => { this.src = '/images/no-image.jpg'; };
        document.getElementById('add-to-cart').disabled = !this.product.available;
        document.getElementById('add-to-cart').className = `w-full bg-orange-500 text-white py-2 rounded-lg hover:bg-orange-600 ${this.product.available ? '' : 'opacity-50 cursor-not-allowed'}`;
        document.getElementById('product-description').innerHTML = this.product.description || 'Опис відсутній';

        const paramsContainer = document.getElementById('product-params');
        paramsContainer.innerHTML = Object.entries(this.product.params).length > 0
            ? Object.entries(this.product.params).map(([key, value]) => `<p><strong>${key}:</strong> ${value}</p>`).join('')
            : '<p>Характеристики відсутні</p>';

        const thumbnailsContainer = document.getElementById('image-thumbnails');
        thumbnailsContainer.innerHTML = this.product.images.length > 0
            ? this.product.images.map((img, index) => `
                <img src="${img}" alt="${this.product.name}" class="w-16 h-16 object-contain rounded-lg border thumbnail ${index === 0 ? 'active border-blue-500' : 'border-gray-300'}"
                     data-index="${index}" onerror="this.src='/images/no-image.jpg'">
              `).join('')
            : '';
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

    addToCart() {
        if (!this.product) return;

        const cartItem = this.cart.find(p => p.id === this.productId);
        if (cartItem) {
            cartItem.quantity += 1;
        } else {
            this.cart.push({ ...this.product, quantity: 1 });
        }
        localStorage.setItem('cart', JSON.stringify(this.cart));
        this.updateCartCount();
        this.showNotification(`${this.product.name} додано в кошик`, 'bg-blue-500');
    }

    updateCartCount() {
        document.getElementById('cart-count').textContent = this.cart.reduce((sum, item) => sum + item.quantity, 0);
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
        document.getElementById('add-to-cart').addEventListener('click', () => this.addToCart());

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
            if (e.target.closest('.thumbnail')) {
                const thumbnails = document.querySelectorAll('.thumbnail');
                thumbnails.forEach(t => t.classList.remove('active', 'border-blue-500'));
                t.classList.add('active', 'border-blue-500');
                document.getElementById('product-image').src = e.target.src;
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
    new ProductApp();
});