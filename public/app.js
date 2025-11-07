const API_URL = 'http://localhost:3000/api';
let currentUser = null;
let trucks = [];

// Проверка авторизации
function checkAuth() {
  const userStr = localStorage.getItem('user');
  if (!userStr) {
    window.location.href = 'login.html';
    return;
  }
  currentUser = JSON.parse(userStr);
  document.getElementById('userRole').textContent = `${currentUser.username} (${currentUser.role})`;
}

// Выход
document.getElementById('logoutBtn').addEventListener('click', () => {
  localStorage.removeItem('user');
  window.location.href = 'login.html';
});

// Загрузка данных
async function loadTrucks() {
  try {
    const response = await fetch(`${API_URL}/trucks`);
    trucks = await response.json();
    renderTable();
    updateStats();
    loadCharts();
  } catch (error) {
    console.error('Ошибка загрузки данных:', error);
  }
}

// Отображение таблицы
function renderTable() {
  const tbody = document.getElementById('trucksTableBody');
  tbody.innerHTML = '';
  
  trucks.forEach(truck => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${truck.id}</td>
      <td>${truck.model}</td>
      <td>${truck.year}</td>
      <td>${formatPrice(truck.price)}</td>
      <td>${truck.status}</td>
      <td>${truck.engine_power || '-'}</td>
      <td>${truck.mileage || 0}</td>
      <td>
        <button class="btn btn-edit" onclick="editTruck(${truck.id})">Изменить</button>
        <button class="btn btn-delete" onclick="deleteTruck(${truck.id})">Удалить</button>
      </td>
    `;
    tbody.appendChild(row);
  });
}

// Форматирование цены
function formatPrice(price) {
  return new Intl.NumberFormat('ru-RU').format(price) + ' $';
}

// Обновление статистики
function updateStats() {
  const total = trucks.length;
  const available = trucks.filter(t => t.status === 'В наличии').length;
  const avgPrice = trucks.length > 0 
    ? trucks.reduce((sum, t) => sum + parseFloat(t.price), 0) / trucks.length 
    : 0;
  
  document.getElementById('totalTrucks').textContent = total;
  document.getElementById('availableTrucks').textContent = available;
  document.getElementById('avgPrice').textContent = formatPrice(avgPrice);
}

// Простые графики (псевдо-графики с CSS)
async function loadCharts() {
  try {
    const response = await fetch(`${API_URL}/stats`);
    const stats = await response.json();
    
    renderYearChart(stats.byYear);
    renderStatusChart(stats.byStatus);
  } catch (error) {
    console.error('Ошибка загрузки статистики:', error);
  }
}

function renderYearChart(data) {
  const canvas = document.getElementById('yearChart');
  const ctx = canvas.getContext('2d');
  
  canvas.width = canvas.offsetWidth;
  canvas.height = 200;
  
  const maxCount = Math.max(...data.map(d => parseInt(d.count)));
  const barWidth = canvas.width / data.length - 20;
  const barHeightRatio = 150 / maxCount;
  
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  data.forEach((item, index) => {
    const x = index * (barWidth + 20) + 10;
    const height = parseInt(item.count) * barHeightRatio;
    const y = 150 - height;
    
    // Рисуем столбец
    ctx.fillStyle = '#667eea';
    ctx.fillRect(x, y, barWidth, height);
    
    // Год
    ctx.fillStyle = '#333';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(item.year, x + barWidth / 2, 170);
    
    // Количество
    ctx.fillText(item.count, x + barWidth / 2, y - 5);
  });
}

function renderStatusChart(data) {
  const canvas = document.getElementById('statusChart');
  const ctx = canvas.getContext('2d');
  
  canvas.width = canvas.offsetWidth;
  canvas.height = 200;
  
  const maxCount = Math.max(...data.map(d => parseInt(d.count)));
  const barWidth = canvas.width / data.length - 20;
  const barHeightRatio = 150 / maxCount;
  
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  const colors = ['#667eea', '#28a745', '#dc3545', '#ffc107'];
  
  data.forEach((item, index) => {
    const x = index * (barWidth + 20) + 10;
    const height = parseInt(item.count) * barHeightRatio;
    const y = 150 - height;
    
    // Рисуем столбец
    ctx.fillStyle = colors[index % colors.length];
    ctx.fillRect(x, y, barWidth, height);
    
    // Статус
    ctx.fillStyle = '#333';
    ctx.font = '10px Arial';
    ctx.textAlign = 'center';
    const words = item.status.split(' ');
    words.forEach((word, i) => {
      ctx.fillText(word, x + barWidth / 2, 165 + i * 12);
    });
    
    // Количество
    ctx.fillText(item.count, x + barWidth / 2, y - 5);
  });
}

// Модальное окно
const modal = document.getElementById('truckModal');
const closeBtn = document.querySelector('.close');
const cancelBtn = document.getElementById('cancelBtn');

document.getElementById('addTruckBtn').addEventListener('click', () => {
  document.getElementById('modalTitle').textContent = 'Добавить тягач';
  document.getElementById('truckForm').reset();
  document.getElementById('truckId').value = '';
  modal.style.display = 'block';
});

closeBtn.addEventListener('click', () => {
  modal.style.display = 'none';
});

cancelBtn.addEventListener('click', () => {
  modal.style.display = 'none';
});

window.addEventListener('click', (e) => {
  if (e.target === modal) {
    modal.style.display = 'none';
  }
});

// Редактирование
window.editTruck = async (id) => {
  const truck = trucks.find(t => t.id === id);
  if (!truck) return;
  
  document.getElementById('modalTitle').textContent = 'Редактировать тягач';
  document.getElementById('truckId').value = truck.id;
  document.getElementById('model').value = truck.model;
  document.getElementById('year').value = truck.year;
  document.getElementById('price').value = truck.price;
  document.getElementById('status').value = truck.status;
  document.getElementById('enginePower').value = truck.engine_power || '';
  document.getElementById('mileage').value = truck.mileage || 0;
  
  modal.style.display = 'block';
};

// Удаление
window.deleteTruck = async (id) => {
  if (!confirm('Вы уверены, что хотите удалить этот тягач?')) return;
  
  try {
    const response = await fetch(`${API_URL}/trucks/${id}`, {
      method: 'DELETE'
    });
    
    if (response.ok) {
      await loadTrucks();
    } else {
      alert('Ошибка удаления');
    }
  } catch (error) {
    console.error('Ошибка удаления:', error);
    alert('Ошибка удаления');
  }
};

// Сохранение
document.getElementById('truckForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const id = document.getElementById('truckId').value;
  const data = {
    model: document.getElementById('model').value,
    year: parseInt(document.getElementById('year').value),
    price: parseFloat(document.getElementById('price').value),
    status: document.getElementById('status').value,
    engine_power: parseInt(document.getElementById('enginePower').value) || null,
    mileage: parseInt(document.getElementById('mileage').value) || 0
  };
  
  try {
    const url = id ? `${API_URL}/trucks/${id}` : `${API_URL}/trucks`;
    const method = id ? 'PUT' : 'POST';
    
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });
    
    if (response.ok) {
      modal.style.display = 'none';
      await loadTrucks();
    } else {
      alert('Ошибка сохранения');
    }
  } catch (error) {
    console.error('Ошибка сохранения:', error);
    alert('Ошибка сохранения');
  }
});

// Инициализация
checkAuth();
loadTrucks();
