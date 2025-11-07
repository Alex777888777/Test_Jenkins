const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'truck_crm',
  user: 'postgres',
  password: 'postgres'
});

async function initDatabase() {
  const client = await pool.connect();
  
  try {
    console.log('Инициализация базы данных...');
    
    // Создание таблицы пользователей
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password VARCHAR(100) NOT NULL,
        role VARCHAR(20) NOT NULL
      )
    `);
    
    // Создание таблицы тягачей
    await client.query(`
      CREATE TABLE IF NOT EXISTS trucks (
        id SERIAL PRIMARY KEY,
        model VARCHAR(100) NOT NULL,
        year INTEGER NOT NULL,
        price DECIMAL(12, 2) NOT NULL,
        status VARCHAR(50) NOT NULL,
        engine_power INTEGER,
        mileage INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Добавление тестовых пользователей
    await client.query(`
      INSERT INTO users (username, password, role) 
      VALUES 
        ('admin', 'admin123', 'admin'),
        ('manager', 'manager123', 'manager'),
        ('user', 'user123', 'user')
      ON CONFLICT (username) DO NOTHING
    `);
    
    // Добавление тестовых тягачей
    await client.query(`
      INSERT INTO trucks (model, year, price, status, engine_power, mileage) 
      VALUES 
        ('КАМАЗ-5490', 2023, 4500000, 'В наличии', 400, 0),
        ('МАЗ-5440', 2022, 3800000, 'В наличии', 420, 15000),
        ('УРАЛ-6370', 2023, 5200000, 'Заказ', 450, 0),
        ('КАМАЗ-65206', 2021, 3200000, 'Продан', 380, 45000),
        ('МАЗ-6430', 2023, 4100000, 'В наличии', 410, 5000)
      ON CONFLICT DO NOTHING
    `);
    
    console.log('База данных успешно инициализирована!');
    console.log('Пользователи:');
    console.log('  admin / admin123 (администратор)');
    console.log('  manager / manager123 (менеджер)');
    console.log('  user / user123 (пользователь)');
    
  } catch (error) {
    console.error('Ошибка инициализации:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

initDatabase();
