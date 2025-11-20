const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const PORT = 3000;

// Подключение к PostgreSQL
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'truck_crm',
  user: 'postgres',
  password: 'postgres'
});

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// ============= АУТЕНТИФИКАЦИЯ =============

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  
  try {
    const result = await pool.query(
      'SELECT id, username, role, full_name, email FROM users WHERE username = $1 AND password = $2',
      [username, password]
    );
    
    if (result.rows.length > 0) {
      res.json({ success: true, user: result.rows[0] });
    } else {
      res.json({ success: false, message: 'Неверный логин или пароль' });
    }
  } catch (error) {
    console.error('Ошибка входа:', error);
    res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
});

// ============= ПОЛЬЗОВАТЕЛИ =============

app.post('/api/users', async (req, res) => {
  const { username, password, role, full_name, email } = req.body;
  
  try {
    const result = await pool.query(
      'INSERT INTO users (username, password, role, full_name, email) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [username, password, role, full_name, email]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Ошибка создания пользователя:', error);
    if (error.code === '23505') {
      res.status(400).json({ error: 'Логин уже существует' });
    } else {
      res.status(500).json({ error: 'Ошибка сервера' });
    }
  }
});

app.get('/api/users', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, username, role, full_name, email, created_at FROM users ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Ошибка получения пользователей:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ============= КЛИЕНТЫ =============

app.get('/api/clients', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT c.*, u.username as created_by_name 
      FROM clients c 
      LEFT JOIN users u ON c.created_by = u.id 
      ORDER BY c.created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Ошибка получения клиентов:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.post('/api/clients', async (req, res) => {
  const { full_name, company, email, phone, address, created_by, username, password } = req.body;
  
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Создаем пользователя
    const userResult = await client.query(
      'INSERT INTO users (username, password, role, full_name, email) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [username, password, 'customer', full_name, email]
    );
    
    const userId = userResult.rows[0].id;
    
    // Создаем клиента со ссылкой на пользователя
    const clientResult = await client.query(
      'INSERT INTO clients (full_name, company, email, phone, address, user_id, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [full_name, company, email, phone, address, userId, created_by]
    );
    
    await client.query('COMMIT');
    res.status(201).json(clientResult.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Ошибка добавления клиента:', error);
    if (error.code === '23505') {
      res.status(400).json({ error: 'Логин уже существует' });
    } else {
      res.status(500).json({ error: 'Ошибка сервера' });
    }
  } finally {
    client.release();
  }
});

// ============= ТЯГАЧИ =============

app.get('/api/trucks', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM trucks ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Ошибка получения тягачей:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ============= КОНФИГУРАЦИИ =============

app.get('/api/configurations/:truckId', async (req, res) => {
  const { truckId } = req.params;
  
  try {
    const result = await pool.query(
      'SELECT * FROM truck_configurations WHERE truck_id = $1',
      [truckId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Ошибка получения конфигураций:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ============= ЗАПЧАСТИ =============

app.get('/api/parts', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM parts ORDER BY category, name');
    res.json(result.rows);
  } catch (error) {
    console.error('Ошибка получения запчастей:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ============= ЗАКАЗЫ =============

app.get('/api/orders', async (req, res) => {
  const { role, userId } = req.query;
  
  try {
    let query = `
      SELECT o.*, 
             c.full_name as client_name,
             c.company as client_company,
             t.model as truck_model,
             tc.name as configuration_name,
             u.full_name as manager_name
      FROM orders o
      LEFT JOIN clients c ON o.client_id = c.id
      LEFT JOIN trucks t ON o.truck_id = t.id
      LEFT JOIN truck_configurations tc ON o.configuration_id = tc.id
      LEFT JOIN users u ON o.manager_id = u.id
    `;
    
    // Для заказчика показываем только его заказы (через client_id связанный с user_id)
    if (role === 'customer') {
      query += ` WHERE c.user_id = $1`;
      const result = await pool.query(query + ' ORDER BY o.created_at DESC', [userId]);
      return res.json(result.rows);
    }
    
    const result = await pool.query(query + ' ORDER BY o.created_at DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Ошибка получения заказов:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.get('/api/orders/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
    const orderResult = await pool.query(`
      SELECT o.*, 
             c.full_name as client_name,
             c.company as client_company,
             c.email as client_email,
             c.phone as client_phone,
             t.model as truck_model,
             t.year as truck_year,
             t.base_price as truck_base_price,
             tc.name as configuration_name,
             tc.additional_price as configuration_price,
             u.full_name as manager_name
      FROM orders o
      LEFT JOIN clients c ON o.client_id = c.id
      LEFT JOIN trucks t ON o.truck_id = t.id
      LEFT JOIN truck_configurations tc ON o.configuration_id = tc.id
      LEFT JOIN users u ON o.manager_id = u.id
      WHERE o.id = $1
    `, [id]);
    
    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: 'Заказ не найден' });
    }
    
    // Получаем этапы заказа
    const stagesResult = await pool.query(`
      SELECT s.*, u.full_name as worker_name
      FROM order_stages s
      LEFT JOIN users u ON s.assigned_to = u.id
      WHERE s.order_id = $1
      ORDER BY s.id
    `, [id]);
    
    // Получаем запчасти заказа
    const partsResult = await pool.query(`
      SELECT op.*, p.name as part_name, p.category
      FROM order_parts op
      LEFT JOIN parts p ON op.part_id = p.id
      WHERE op.order_id = $1
    `, [id]);
    
    res.json({
      ...orderResult.rows[0],
      stages: stagesResult.rows,
      parts: partsResult.rows
    });
  } catch (error) {
    console.error('Ошибка получения заказа:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.post('/api/orders', async (req, res) => {
  const { client_id, truck_id, configuration_id, total_price, status, deadline, manager_id, notes, parts } = req.body;
  
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Генерируем номер заказа
    const orderNumber = 'ORD-' + Date.now();
    
    // Создаем заказ
    const orderResult = await client.query(
      `INSERT INTO orders (order_number, client_id, truck_id, configuration_id, total_price, status, deadline, manager_id, notes) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [orderNumber, client_id, truck_id, configuration_id, total_price, status, deadline, manager_id, notes]
    );
    
    const orderId = orderResult.rows[0].id;
    
    // Добавляем запчасти
    if (parts && parts.length > 0) {
      for (const part of parts) {
        await client.query(
          'INSERT INTO order_parts (order_id, part_id, quantity, price) VALUES ($1, $2, $3, $4)',
          [orderId, part.part_id, part.quantity, part.price]
        );
      }
    }
    
    // Создаем стандартные этапы
    const stages = [
      'Подтверждение заказа',
      'Закупка компонентов',
      'Сборка',
      'Контроль качества',
      'Доставка'
    ];
    
    for (const stage of stages) {
      await client.query(
        'INSERT INTO order_stages (order_id, stage_name, status) VALUES ($1, $2, $3)',
        [orderId, stage, 'Ожидание']
      );
    }
    
    await client.query('COMMIT');
    res.status(201).json(orderResult.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Ошибка создания заказа:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  } finally {
    client.release();
  }
});

app.put('/api/orders/:id', async (req, res) => {
  const { id } = req.params;
  const { status, deadline, notes } = req.body;
  
  try {
    const result = await pool.query(
      'UPDATE orders SET status = $1, deadline = $2, notes = $3 WHERE id = $4 RETURNING *',
      [status, deadline, notes, id]
    );
    
    if (result.rows.length > 0) {
      res.json(result.rows[0]);
    } else {
      res.status(404).json({ error: 'Заказ не найден' });
    }
  } catch (error) {
    console.error('Ошибка обновления заказа:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ============= ЭТАПЫ ЗАКАЗОВ =============

app.put('/api/order-stages/:id', async (req, res) => {
  const { id } = req.params;
  const { status, assigned_to, notes } = req.body;
  
  try {
    let query = 'UPDATE order_stages SET status = $1, notes = $2';
    let params = [status, notes];
    
    // Если этап начат, устанавливаем started_at
    if (status === 'В процессе' || status === 'In Progress') {
      query += ', started_at = CURRENT_TIMESTAMP';
    }
    
    // Если этап завершен, устанавливаем completed_at
    if (status === 'Завершен' || status === 'Completed') {
      query += ', completed_at = CURRENT_TIMESTAMP';
    }
    
    if (assigned_to) {
      query += ', assigned_to = $3';
      params.push(assigned_to);
      query += ' WHERE id = $4 RETURNING *';
      params.push(id);
    } else {
      query += ' WHERE id = $3 RETURNING *';
      params.push(id);
    }
    
    const result = await pool.query(query, params);
    
    if (result.rows.length > 0) {
      res.json(result.rows[0]);
    } else {
      res.status(404).json({ error: 'Этап не найден' });
    }
  } catch (error) {
    console.error('Ошибка обновления этапа:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ============= СТАТИСТИКА =============

app.get('/api/stats', async (req, res) => {
  try {
    // Статистика по заказам
    const orderStats = await pool.query(`
      SELECT status, COUNT(*) as count 
      FROM orders 
      GROUP BY status
    `);
    
    // Статистика по запчастям (категории)
    const partsStats = await pool.query(`
      SELECT category, COUNT(*) as count 
      FROM parts 
      GROUP BY category
    `);
    
    // Общая статистика
    const totalOrders = await pool.query('SELECT COUNT(*) as count FROM orders');
    const totalClients = await pool.query('SELECT COUNT(*) as count FROM clients');
    const avgOrderPrice = await pool.query('SELECT AVG(total_price) as avg FROM orders');
    
    // Статистика по использованию запчастей в заказах
    const partsUsage = await pool.query(`
      SELECT p.category, SUM(op.quantity) as total_quantity
      FROM order_parts op
      JOIN parts p ON op.part_id = p.id
      GROUP BY p.category
    `);
    
    res.json({
      ordersByStatus: orderStats.rows,
      partsByCategory: partsStats.rows,
      partsUsage: partsUsage.rows,
      totalOrders: totalOrders.rows[0].count,
      totalClients: totalClients.rows[0].count,
      avgOrderPrice: avgOrderPrice.rows[0].avg || 0
    });
  } catch (error) {
    console.error('Ошибка получения статистики:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.listen(PORT, () => {
  console.log(`Сервер запущен на http://localhost:${PORT}`);
});
