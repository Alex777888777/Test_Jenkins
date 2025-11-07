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

// API: Вход пользователя
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  
  try {
    const result = await pool.query(
      'SELECT id, username, role FROM users WHERE username = $1 AND password = $2',
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

// API: Получить все тягачи
app.get('/api/trucks', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM trucks ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Ошибка получения тягачей:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// API: Получить тягач по ID
app.get('/api/trucks/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
    const result = await pool.query('SELECT * FROM trucks WHERE id = $1', [id]);
    
    if (result.rows.length > 0) {
      res.json(result.rows[0]);
    } else {
      res.status(404).json({ error: 'Тягач не найден' });
    }
  } catch (error) {
    console.error('Ошибка получения тягача:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// API: Добавить новый тягач
app.post('/api/trucks', async (req, res) => {
  const { model, year, price, status, engine_power, mileage } = req.body;
  
  try {
    const result = await pool.query(
      'INSERT INTO trucks (model, year, price, status, engine_power, mileage) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [model, year, price, status, engine_power, mileage]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Ошибка добавления тягача:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// API: Обновить тягач
app.put('/api/trucks/:id', async (req, res) => {
  const { id } = req.params;
  const { model, year, price, status, engine_power, mileage } = req.body;
  
  try {
    const result = await pool.query(
      'UPDATE trucks SET model = $1, year = $2, price = $3, status = $4, engine_power = $5, mileage = $6 WHERE id = $7 RETURNING *',
      [model, year, price, status, engine_power, mileage, id]
    );
    
    if (result.rows.length > 0) {
      res.json(result.rows[0]);
    } else {
      res.status(404).json({ error: 'Тягач не найден' });
    }
  } catch (error) {
    console.error('Ошибка обновления тягача:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// API: Удалить тягач
app.delete('/api/trucks/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
    const result = await pool.query('DELETE FROM trucks WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length > 0) {
      res.json({ success: true, message: 'Тягач удален' });
    } else {
      res.status(404).json({ error: 'Тягач не найден' });
    }
  } catch (error) {
    console.error('Ошибка удаления тягача:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// API: Статистика для графиков
app.get('/api/stats', async (req, res) => {
  try {
    // Количество по годам
    const yearStats = await pool.query(`
      SELECT year, COUNT(*) as count 
      FROM trucks 
      GROUP BY year 
      ORDER BY year
    `);
    
    // Количество по статусам
    const statusStats = await pool.query(`
      SELECT status, COUNT(*) as count 
      FROM trucks 
      GROUP BY status
    `);
    
    // Средняя цена
    const avgPrice = await pool.query('SELECT AVG(price) as avg FROM trucks');
    
    res.json({
      byYear: yearStats.rows,
      byStatus: statusStats.rows,
      avgPrice: avgPrice.rows[0].avg
    });
  } catch (error) {
    console.error('Ошибка получения статистики:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.listen(PORT, () => {
  console.log(`Сервер запущен на http://localhost:${PORT}`);
});
