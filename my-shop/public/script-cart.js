class CartApp {
  constructor() {
    this.cart = JSON.parse(localStorage.getItem('cart')) || [];
    this.init();
  }

  init() {
    this.renderCart();
    this.setupEventListeners();
  }

  renderCart() {
    const container = document.getElementById('cart-items');
    const totalCount = document.getElementById('total-count');
    const totalPrice = document.getElementById('total-price');
    const checkoutBtn = document.getElementById('checkout-btn');

    if (this.cart.length === 0) {
      container.innerHTML = `
        <div class="empty-cart">
          <i class="fas fa-shopping-cart"></i>
          <p>Ваш кошик порожній</p>
          <a href="/" class="continue-shopping">Продовжити покупки</a>
        </div>
      `;
      totalCount.textContent = '0';
      totalPrice.textContent = '0.00 грн';
      checkoutBtn.style.display = 'none';
      return;
    }

    container.innerHTML = this.cart.map(item => `
      <div class="cart-item">
        <img src="${item.image}" alt="${item.name}" 
             onerror="this.src='/images/no-image.jpg'">
        <div class="item-info">
          <h3>${item.name}</h3>
          <div class="item-price">${item.price} грн</div>
        </div>
        <button class="remove-item" data-id="${item.id}">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    `).join('');

    totalCount.textContent = this.cart.length;
    const total = this.cart.reduce((sum, item) => sum + parseFloat(item.price), 0);
    totalPrice.textContent = total.toFixed(2) + ' грн';
    checkoutBtn.style.display = 'block';
  }

  setupEventListeners() {
    // Видалення товару
    document.addEventListener('click', (e) => {
      if (e.target.closest('.remove-item')) {
        const id = e.target.closest('.remove-item').dataset.id;
        this.removeItem(id);
      }
    });

    // Оформлення замовлення
    document.getElementById('checkout-btn').addEventListener('click', () => {
      this.checkout();
    });
  }

  removeItem(id) {
    this.cart = this.cart.filter(item => item.id !== id);
    localStorage.setItem('cart', JSON.stringify(this.cart));
    this.renderCart();
    this.showNotification('Товар видалено з кошика');
  }

  checkout() {
    // Тут може бути логіка оформлення замовлення
    this.showNotification('Замовлення оформлено!');
    setTimeout(() => {
      this.cart = [];
      localStorage.removeItem('cart');
      this.renderCart();
    }, 1500);
  }

  showNotification(message) {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.classList.add('show');
    
    setTimeout(() => {
      notification.classList.remove('show');
    }, 3000);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new CartApp();
});