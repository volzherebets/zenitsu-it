class ShopApp {
  constructor() {
    this.products = [];
    this.filteredProducts = [];
    this.categories = [];
    this.cart = JSON.parse(localStorage.getItem('cart')) || [];
    this.init();
  }

  async init() {
    await this.loadData();
    this.renderCategories();
    this.renderProducts();
    this.setupEventListeners();
    this.updateCartCount();
  }

  async loadData() {
    try {
      const [productsRes, categoriesRes] = await Promise.all([
        fetch('/api/products'),
        fetch('/api/categories')
      ]);
      
      const productsData = await productsRes.json();
      const categoriesData = await categoriesRes.json();
      
      if (productsData.success && categoriesData.success) {
        this.products = productsData.products;
        this.filteredProducts = [...this.products];
        this.categories = categoriesData.categories;
        console.log('Дані завантажено:', this.products.length, 'товарів');
      }
    } catch (error) {
      console.error('Помилка завантаження:', error);
      this.showError('Не вдалося завантажити товари');
    }
  }

  renderCategories() {
    const dropdown = document.getElementById('categories-dropdown');
    dropdown.innerHTML = this.categories.map(category => `
      <a href="#" data-category="${category}">${category}</a>
    `).join('');
  }

  renderProducts() {
    const container = document.getElementById('products');
    
    if (this.filteredProducts.length === 0) {
      container.innerHTML = '<p class="no-products">Товарів не знайдено</p>';
      return;
    }
    
    container.innerHTML = this.filteredProducts.map(product => `
      <div class="product-card">
        <img src="${product.image}" alt="${product.name}" class="product-image" 
             onerror="this.src='/images/no-image.jpg'">
        <div class="product-info">
          <h3 class="product-title">${product.name}</h3>
          <div class="product-price">${product.price} грн</div>
          <button class="add-to-cart" data-id="${product.id}">
            Додати в кошик
          </button>
        </div>
      </div>
    `).join('');
  }

  addToCart(productId) {
    const product = this.products.find(p => p.id === productId);
    if (!product) return;

    this.cart.push(product);
    localStorage.setItem('cart', JSON.stringify(this.cart));
    this.updateCartCount();
    this.showNotification(`${product.name} додано в кошик`);
  }

  updateCartCount() {
    document.getElementById('cart-count').textContent = this.cart.length;
  }

  setupEventListeners() {
    // Додавання в кошик
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('add-to-cart')) {
        this.addToCart(e.target.dataset.id);
      }
    });

    // Пошук товарів
    document.getElementById('search-input').addEventListener('input', (e) => {
      const searchTerm = e.target.value.toLowerCase();
      this.filteredProducts = this.products.filter(product => 
        product.name.toLowerCase().includes(searchTerm) || 
        (product.description && product.description.toLowerCase().includes(searchTerm))
      );
      this.renderProducts();
    });

    // Фільтрація по категоріях
    document.getElementById('categories-dropdown').addEventListener('click', (e) => {
      if (e.target.tagName === 'A') {
        e.preventDefault();
        const category = e.target.dataset.category;
        this.filteredProducts = category === 'all' 
          ? [...this.products] 
          : this.products.filter(p => p.category === category);
        this.renderProducts();
      }
    });
  }

  showNotification(message) {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.classList.add('show');
    
    setTimeout(() => {
      notification.classList.remove('show');
    }, 3000);
  }

  showError(message) {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.style.backgroundColor = 'var(--accent)';
    notification.classList.add('show');
    
    setTimeout(() => {
      notification.classList.remove('show');
    }, 5000);
  }
}

// Ініціалізація додатку
document.addEventListener('DOMContentLoaded', () => {
  new ShopApp();
});