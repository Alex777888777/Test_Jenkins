const API_URL = '/api';
let currentUser = null;
let clients = [], trucks = [], parts = [], orders = [];

// Инициализация после загрузки DOM
document.addEventListener('DOMContentLoaded', function() {
  checkAuth();
});

// Проверка авторизации
function checkAuth() {
  const userStr = localStorage.getItem('user');
  if (!userStr) {
    window.location.href = 'login.html';
    return;
  }
  currentUser = JSON.parse(userStr);
  document.getElementById('userRole').textContent = `${currentUser.full_name} (${getRoleName(currentUser.role)})`;
  
  // Выход
  document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.removeItem('user');
    window.location.href = 'login.html';
  });
  
  initInterface();
}

function getRoleName(role) {
  const names = { manager: 'Менеджер', worker: 'Работник', customer: 'Заказчик' };
  return names[role] || role;
}

// Инициализация интерфейса по роли
async function initInterface() {
  if (currentUser.role === 'manager') {
    document.getElementById('managerSection').style.display = 'block';
    document.getElementById('partsSection').style.display = 'block';
    await loadClients();
    await loadParts();
    await loadTrucks();
    initManagerHandlers();
  }
  await loadOrders();
  await loadStats();
  initModalHandlers();
}

// Инициализация обработчиков для менеджера
function initManagerHandlers() {
  // Добавление клиента
  document.getElementById('addClientBtn').addEventListener('click', () => {
    document.getElementById('clientModal').style.display = 'block';
  });
  
  document.getElementById('clientForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    console.log('Current user:', currentUser);
    console.log('User ID:', currentUser.id);
    
    try {
      const clientData = {
        full_name: document.getElementById('clientName').value,
        company: document.getElementById('clientCompany').value,
        email: document.getElementById('clientEmail').value,
        phone: document.getElementById('clientPhone').value,
        address: document.getElementById('clientAddress').value,
        username: document.getElementById('clientLogin').value,
        password: document.getElementById('clientPassword').value,
        created_by: currentUser.id
      };
      
      console.log('Sending client data:', clientData);
      
      const response = await fetch(`${API_URL}/clients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(clientData)
      });
      
      if (response.ok) {
        document.getElementById('clientModal').style.display = 'none';
        document.getElementById('clientForm').reset();
        await loadClients();
        alert('Клиент успешно создан! Логин: ' + document.getElementById('clientLogin').value);
      } else {
        const error = await response.json();
        alert('Ошибка: ' + error.error);
      }
    } catch (error) {
      console.error('Ошибка:', error);
      alert('Ошибка создания клиента');
    }
  });
  
  // Добавление сотрудника
  document.getElementById('addEmployeeBtn').addEventListener('click', () => {
    document.getElementById('employeeModal').style.display = 'block';
  });
  
  document.getElementById('employeeForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_URL}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: document.getElementById('employeeLogin').value,
          password: document.getElementById('employeePassword').value,
          role: document.getElementById('employeeRole').value,
          full_name: document.getElementById('employeeName').value,
          email: document.getElementById('employeeEmail').value
        })
      });
      
      if (response.ok) {
        document.getElementById('employeeModal').style.display = 'none';
        document.getElementById('employeeForm').reset();
        alert('Сотрудник успешно добавлен!');
      } else {
        const error = await response.json();
        alert('Ошибка: ' + error.error);
      }
    } catch (error) {
      console.error('Ошибка:', error);
      alert('Ошибка добавления сотрудника');
    }
  });
  
  // Создание заказа
  document.getElementById('addOrderBtn').addEventListener('click', async () => {
    await prepareOrderModal();
  });
  
  // Выбор тягача загружает конфигурации
  document.getElementById('orderTruck').addEventListener('change', async (e) => {
    const truckId = e.target.value;
    if (!truckId) return;
    
    const res = await fetch(`${API_URL}/configurations/${truckId}`);
    const configs = await res.json();
    
    const configSelect = document.getElementById('orderConfig');
    configSelect.innerHTML = '<option value="">Выберите конфигурацию</option>';
    configs.forEach(c => {
      configSelect.innerHTML += `<option value="${c.id}" data-price="${c.additional_price}">${c.name} (+${formatPrice(c.additional_price)})</option>`;
    });
    
    updateOrderTotal();
  });
  
  document.getElementById('orderConfig').addEventListener('change', updateOrderTotal);
  
  // Добавить запчасть
  document.getElementById('addPartBtn').addEventListener('click', () => {
    const partsList = document.getElementById('orderPartsList');
    const partItem = document.createElement('div');
    partItem.className = 'part-item';
    partItem.innerHTML = `
      <select class="part-select">
        <option value="">Выберите запчасть</option>
        ${parts.map(p => `<option value="${p.id}" data-price="${p.price}">${p.name} - ${formatPrice(p.price)}</option>`).join('')}
      </select>
      <input type="number" class="part-quantity" min="1" value="1" placeholder="Количество">
      <button type="button" class="btn btn-delete" onclick="this.parentElement.remove(); updateOrderTotal();">Удалить</button>
    `;
    partsList.appendChild(partItem);
    
    partItem.querySelector('.part-select').addEventListener('change', updateOrderTotal);
    partItem.querySelector('.part-quantity').addEventListener('input', updateOrderTotal);
  });
  
  // Отправка заказа
  document.getElementById('orderForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const partItems = [];
    document.querySelectorAll('.part-item').forEach(item => {
      const partId = item.querySelector('.part-select').value;
      const quantity = item.querySelector('.part-quantity').value;
      const price = item.querySelector('.part-select option:checked').dataset.price;
      if (partId) {
        partItems.push({ part_id: partId, quantity: parseInt(quantity), price: parseFloat(price) });
      }
    });
    
    const truck = trucks.find(t => t.id == document.getElementById('orderTruck').value);
    const configOption = document.querySelector('#orderConfig option:checked');
    let totalPrice = parseFloat(truck.base_price) + parseFloat(configOption.dataset.price || 0);
    partItems.forEach(p => totalPrice += p.price * p.quantity);
    
    await fetch(`${API_URL}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: document.getElementById('orderClient').value,
        truck_id: document.getElementById('orderTruck').value,
        configuration_id: document.getElementById('orderConfig').value,
        total_price: totalPrice,
        status: 'Новый',
        deadline: document.getElementById('orderDeadline').value || null,
        manager_id: currentUser.id,
        notes: document.getElementById('orderNotes').value,
        parts: partItems
      })
    });
    
    document.getElementById('orderModal').style.display = 'none';
    document.getElementById('orderForm').reset();
    document.getElementById('orderPartsList').innerHTML = '';
    await loadOrders();
    await loadStats();
  });
  
  // Редактирование заказа
  document.getElementById('editOrderForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const orderId = document.getElementById('editOrderId').value;
    await fetch(`/api/orders/${orderId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: document.getElementById('editOrderStatus').value,
        deadline: document.getElementById('editOrderDeadline').value,
        notes: document.getElementById('editOrderNotes').value
      })
    });
    
    document.getElementById('orderDetailModal').style.display = 'none';
    await loadOrders();
    await loadStats();
  });
}

// Инициализация обработчиков модальных окон
function initModalHandlers() {
  document.querySelectorAll('.close').forEach(btn => {
    btn.addEventListener('click', function() {
      document.getElementById(this.dataset.modal).style.display = 'none';
    });
  });
}

// Подготовка модального окна заказа
async function prepareOrderModal() {
  const trucksRes = await fetch(`${API_URL}/trucks`);
  trucks = await trucksRes.json();
  
  const clientSelect = document.getElementById('orderClient');
  clientSelect.innerHTML = '<option value="">Выберите клиента</option>';
  clients.forEach(c => {
    clientSelect.innerHTML += `<option value="${c.id}">${c.full_name} ${c.company ? '(' + c.company + ')' : ''}</option>`;
  });
  
  const truckSelect = document.getElementById('orderTruck');
  truckSelect.innerHTML = '<option value="">Выберите тягач</option>';
  trucks.forEach(t => {
    truckSelect.innerHTML += `<option value="${t.id}">${t.model} - ${formatPrice(t.base_price)}</option>`;
  });
  
  document.getElementById('orderPartsList').innerHTML = '';
  document.getElementById('orderModal').style.display = 'block';
}

function updateOrderTotal() {
  const truckId = document.getElementById('orderTruck').value;
  const configId = document.getElementById('orderConfig').value;
  
  if (!truckId) return;
  
  const truck = trucks.find(t => t.id == truckId);
  let total = parseFloat(truck.base_price);
  
  if (configId) {
    const configOption = document.querySelector(`#orderConfig option[value="${configId}"]`);
    total += parseFloat(configOption.dataset.price || 0);
  }
  
  document.querySelectorAll('.part-item').forEach(item => {
    const partSelect = item.querySelector('.part-select');
    const quantity = parseInt(item.querySelector('.part-quantity').value) || 0;
    const selectedOption = partSelect.options[partSelect.selectedIndex];
    if (selectedOption.value) {
      total += parseFloat(selectedOption.dataset.price) * quantity;
    }
  });
  
  document.getElementById('orderTotal').textContent = formatPrice(total);
}

// Загрузка данных
async function loadClients() {
  const response = await fetch(`${API_URL}/clients`);
  clients = await response.json();
  renderClients();
}

async function loadTrucks() {
  const response = await fetch(`${API_URL}/trucks`);
  trucks = await response.json();
  renderTrucks();
}

async function loadParts() {
  const response = await fetch(`${API_URL}/parts`);
  parts = await response.json();
  renderParts();
}

async function loadOrders() {
  const response = await fetch(`${API_URL}/orders?role=${currentUser.role}&userId=${currentUser.id}`);
  orders = await response.json();
  renderOrders();
}

async function loadStats() {
  const response = await fetch(`${API_URL}/stats`);
  const stats = await response.json();
  
  document.getElementById('totalOrders').textContent = stats.totalOrders;
  document.getElementById('totalClients').textContent = stats.totalClients;
  document.getElementById('avgPrice').textContent = formatPrice(stats.avgOrderPrice);
  
  renderOrdersChart(stats.ordersByStatus);
  renderPartsChart(stats.partsByCategory);
}

// Форматирование цены
function formatPrice(price) {
  return '$' + new Intl.NumberFormat('en-US').format(price || 0);
}

// Рендеринг
function renderTrucks() {
  const tbody = document.getElementById('trucksTableBody');
  tbody.innerHTML = '';
  trucks.forEach(truck => {
    const row = `<tr>
      <td>${truck.id}</td>
      <td>${truck.model}</td>
      <td>${truck.year}</td>
      <td>${formatPrice(truck.base_price)}</td>
      <td>${truck.engine_power || '-'}</td>
      <td>${truck.description || '-'}</td>
    </tr>`;
    tbody.innerHTML += row;
  });
}

function renderClients() {
  const tbody = document.getElementById('clientsTableBody');
  tbody.innerHTML = '';
  clients.forEach(client => {
    const row = `<tr>
      <td>${client.full_name}</td>
      <td>${client.company || '-'}</td>
      <td>${client.email || '-'}</td>
      <td>${client.phone || '-'}</td>
    </tr>`;
    tbody.innerHTML += row;
  });
}

function renderParts() {
  const tbody = document.getElementById('partsTableBody');
  tbody.innerHTML = '';
  parts.forEach(part => {
    const row = `<tr>
      <td>${part.name}</td>
      <td>${part.category}</td>
      <td>${formatPrice(part.price)}</td>
      <td>${part.stock}</td>
    </tr>`;
    tbody.innerHTML += row;
  });
}

function renderOrders() {
  const container = document.getElementById('ordersContainer');
  container.innerHTML = '';
  
  if (orders.length === 0) {
    container.innerHTML = '<p>Нет заказов</p>';
    return;
  }
  
  orders.forEach(order => {
    const statusClass = order.status.toLowerCase().replace(/\s/g, '-');
    const card = document.createElement('div');
    card.className = 'order-card';
    card.onclick = () => viewOrder(order.id);
    card.innerHTML = `
      <div class="order-header">
        <h3>Заказ #${order.order_number}</h3>
        <span class="order-status status-${statusClass}">${order.status}</span>
      </div>
      <p><strong>Клиент:</strong> ${order.client_name} ${order.client_company ? '(' + order.client_company + ')' : ''}</p>
      <p><strong>Тягач:</strong> ${order.truck_model}</p>
      <p><strong>Конфигурация:</strong> ${order.configuration_name}</p>
      <p><strong>Цена:</strong> ${formatPrice(order.total_price)}</p>
      ${order.deadline ? `<p><strong>Дедлайн:</strong> ${new Date(order.deadline).toLocaleDateString()}</p>` : ''}
    `;
    container.appendChild(card);
  });
}

// Просмотр заказа
async function viewOrder(orderId) {
  const response = await fetch(`${API_URL}/orders/${orderId}`);
  const order = await response.json();
  
  const modal = document.getElementById('orderDetailModal');
  document.getElementById('orderNumber').textContent = order.order_number;
  
  // Детали заказа
  document.getElementById('orderDetails').innerHTML = `
    <p><strong>Клиент:</strong> ${order.client_name}</p>
    <p><strong>Компания:</strong> ${order.client_company || '-'}</p>
    <p><strong>Тягач:</strong> ${order.truck_model} (${order.truck_year})</p>
    <p><strong>Конфигурация:</strong> ${order.configuration_name}</p>
    <p><strong>Статус:</strong> ${order.status}</p>
    <p><strong>Цена:</strong> ${formatPrice(order.total_price)}</p>
    <p><strong>Менеджер:</strong> ${order.manager_name}</p>
    ${order.deadline ? `<p><strong>Дедлайн:</strong> ${new Date(order.deadline).toLocaleDateString()}</p>` : ''}
    ${order.notes ? `<p><strong>Примечания:</strong> ${order.notes}</p>` : ''}
  `;
  
  // Показать форму редактирования только для менеджера
  if (currentUser.role === 'manager') {
    document.getElementById('editOrderSection').style.display = 'block';
    document.getElementById('editOrderId').value = order.id;
    document.getElementById('editOrderStatus').value = order.status;
    document.getElementById('editOrderDeadline').value = order.deadline ? order.deadline.split('T')[0] : '';
    document.getElementById('editOrderNotes').value = order.notes || '';
  } else {
    document.getElementById('editOrderSection').style.display = 'none';
  }
  
  // Этапы
  const stagesDiv = document.getElementById('orderStages');
  stagesDiv.innerHTML = '';
  (order.stages || []).forEach(stage => {
    const stageClass = stage.status === 'Завершен' ? 'completed' : stage.status === 'В процессе' ? 'in-progress' : '';
    const stageDiv = document.createElement('div');
    stageDiv.className = `stage-item ${stageClass}`;
    stageDiv.innerHTML = `
      <h4>${stage.stage_name}</h4>
      <p><strong>Статус:</strong> ${stage.status}</p>
      ${stage.worker_name ? `<p><strong>Исполнитель:</strong> ${stage.worker_name}</p>` : ''}
      ${currentUser.role === 'worker' ? `
        <div class="stage-controls">
          <select id="stageStatus${stage.id}">
            <option value="Ожидание" ${stage.status === 'Ожидание' ? 'selected' : ''}>Ожидание</option>
            <option value="В процессе" ${stage.status === 'В процессе' ? 'selected' : ''}>В процессе</option>
            <option value="Завершен" ${stage.status === 'Завершен' ? 'selected' : ''}>Завершен</option>
          </select>
          <button class="btn btn-primary" onclick="updateStage(${stage.id})">Обновить</button>
        </div>
      ` : ''}
    `;
    stagesDiv.appendChild(stageDiv);
  });
  
  // Запчасти
  const partsDiv = document.getElementById('orderPartDetails');
  partsDiv.innerHTML = '<table><tr><th>Название</th><th>Категория</th><th>Кол-во</th><th>Цена</th></tr>';
  (order.parts || []).forEach(part => {
    partsDiv.innerHTML += `<tr>
      <td>${part.part_name}</td>
      <td>${part.category}</td>
      <td>${part.quantity}</td>
      <td>${formatPrice(part.price)}</td>
    </tr>`;
  });
  partsDiv.innerHTML += '</table>';
  
  modal.style.display = 'block';
}

// Обновление этапа (для работника)
window.updateStage = async function(stageId) {
  const status = document.getElementById(`stageStatus${stageId}`).value;
  await fetch(`${API_URL}/order-stages/${stageId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, assigned_to: currentUser.id })
  });
  location.reload();
};

// Графики
function renderOrdersChart(data) {
  const canvas = document.getElementById('ordersChart');
  drawPieChart(canvas, data.map(d => ({ label: d.status, value: parseInt(d.count) })));
}

function renderPartsChart(data) {
  const canvas = document.getElementById('partsChart');
  drawPieChart(canvas, data.map(d => ({ label: d.category, value: parseInt(d.count) })));
}

// Круговая диаграмма
function drawPieChart(canvas, data) {
  const ctx = canvas.getContext('2d');
  canvas.width = canvas.offsetWidth;
  canvas.height = 250;
  
  const total = data.reduce((sum, item) => sum + item.value, 0);
  if (total === 0) return;
  
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2 - 20;
  const radius = Math.min(centerX, centerY) - 30;
  
  const colors = ['#667eea', '#28a745', '#ffc107', '#dc3545', '#17a2b8', '#6c757d'];
  let currentAngle = -Math.PI / 2;
  
  data.forEach((item, index) => {
    const sliceAngle = (item.value / total) * 2 * Math.PI;
    
    ctx.fillStyle = colors[index % colors.length];
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
    ctx.closePath();
    ctx.fill();
    
    const labelAngle = currentAngle + sliceAngle / 2;
    const labelX = centerX + Math.cos(labelAngle) * (radius + 40);
    const labelY = centerY + Math.sin(labelAngle) * (radius + 40);
    
    ctx.fillStyle = '#333';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`${item.label}: ${item.value}`, labelX, labelY);
    
    currentAngle += sliceAngle;
  });
}
