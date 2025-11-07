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
        role VARCHAR(20) NOT NULL,
        full_name VARCHAR(100),
        email VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Создание таблицы клиентов
    await client.query(`
      CREATE TABLE IF NOT EXISTS clients (
        id SERIAL PRIMARY KEY,
        full_name VARCHAR(100) NOT NULL,
        company VARCHAR(100),
        email VARCHAR(100),
        phone VARCHAR(20),
        address TEXT,
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Создание таблицы тягачей
    await client.query(`
      CREATE TABLE IF NOT EXISTS trucks (
        id SERIAL PRIMARY KEY,
        model VARCHAR(100) NOT NULL,
        year INTEGER NOT NULL,
        base_price DECIMAL(12, 2) NOT NULL,
        description TEXT,
        engine_power INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Создание таблицы запчастей/деталей
    await client.query(`
      CREATE TABLE IF NOT EXISTS parts (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        category VARCHAR(50) NOT NULL,
        price DECIMAL(12, 2) NOT NULL,
        stock INTEGER DEFAULT 0,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Создание таблицы конфигураций
    await client.query(`
      CREATE TABLE IF NOT EXISTS truck_configurations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        truck_id INTEGER REFERENCES trucks(id),
        additional_price DECIMAL(12, 2) DEFAULT 0,
        description TEXT
      )
    `);
    
    // Создание таблицы заказов
    await client.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        order_number VARCHAR(50) UNIQUE NOT NULL,
        client_id INTEGER REFERENCES clients(id),
        truck_id INTEGER REFERENCES trucks(id),
        configuration_id INTEGER REFERENCES truck_configurations(id),
        total_price DECIMAL(12, 2) NOT NULL,
        status VARCHAR(50) NOT NULL,
        deadline DATE,
        manager_id INTEGER REFERENCES users(id),
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Создание таблицы этапов заказа
    await client.query(`
      CREATE TABLE IF NOT EXISTS order_stages (
        id SERIAL PRIMARY KEY,
        order_id INTEGER REFERENCES orders(id),
        stage_name VARCHAR(100) NOT NULL,
        status VARCHAR(50) NOT NULL,
        started_at TIMESTAMP,
        completed_at TIMESTAMP,
        assigned_to INTEGER REFERENCES users(id),
        notes TEXT
      )
    `);
    
    // Создание таблицы запчастей в заказе
    await client.query(`
      CREATE TABLE IF NOT EXISTS order_parts (
        id SERIAL PRIMARY KEY,
        order_id INTEGER REFERENCES orders(id),
        part_id INTEGER REFERENCES parts(id),
        quantity INTEGER NOT NULL,
        price DECIMAL(12, 2) NOT NULL
      )
    `);
    
    // Добавление тестовых пользователей
    await client.query(`
      INSERT INTO users (username, password, role, full_name, email) 
      VALUES 
        ('manager', 'manager123', 'manager', 'Иван Петров', 'manager@truck.com'),
        ('worker', 'worker123', 'worker', 'Алексей Сидоров', 'worker@truck.com'),
        ('customer', 'customer123', 'customer', 'Компания ООО "ТрансЛогистик"', 'customer@logistics.com')
      ON CONFLICT (username) DO NOTHING
    `);
    
    // Добавление тестовых тягачей
    await client.query(`
      INSERT INTO trucks (model, year, base_price, engine_power, description) 
      VALUES 
        ('КАМАЗ-5490', 2024, 85000, 400, 'Современный магистральный тягач'),
        ('МАЗ-5440', 2024, 75000, 420, 'Надежный седельный тягач'),
        ('УРАЛ-6370', 2024, 95000, 450, 'Мощный тягач для тяжелых условий')
      ON CONFLICT DO NOTHING
    `);
    
    // Добавление запчастей
    await client.query(`
      INSERT INTO parts (name, category, price, stock, description) 
      VALUES 
        ('Колеса R22.5 Michelin', 'Колеса', 850, 50, 'Премиальные шины для дальних перевозок'),
        ('Колеса R22.5 Continental', 'Колеса', 780, 35, 'Качественные шины европейского производства'),
        ('Аккумулятор 225Ah', 'Электрика', 320, 20, 'Мощный аккумулятор для грузовых автомобилей'),
        ('Топливный фильтр Mann', 'Фильтры', 45, 100, 'Оригинальный топливный фильтр'),
        ('Масляный фильтр Bosch', 'Фильтры', 35, 80, 'Качественный масляный фильтр'),
        ('Тормозные колодки Knorr', 'Тормоза', 280, 60, 'Дисковые тормозные колодки'),
        ('Воздушный фильтр', 'Фильтры', 55, 70, 'Фильтр очистки воздуха двигателя'),
        ('Стартер 24V', 'Электрика', 450, 15, 'Стартер для дизельного двигателя')
      ON CONFLICT DO NOTHING
    `);
    
    // Добавление конфигураций
    await client.query(`
      INSERT INTO truck_configurations (name, truck_id, additional_price, description) 
      VALUES 
        ('Базовая', 1, 0, 'Стандартная комплектация'),
        ('Комфорт', 1, 5000, 'Улучшенная кабина, климат-контроль, кожаный салон'),
        ('Премиум', 1, 12000, 'Максимальная комплектация с GPS, автопилотом'),
        ('Базовая', 2, 0, 'Стандартная комплектация'),
        ('Комфорт', 2, 4500, 'Улучшенная кабина, климат-контроль'),
        ('Базовая', 3, 0, 'Стандартная комплектация'),
        ('Усиленная', 3, 8000, 'Усиленная подвеска и рама')
      ON CONFLICT DO NOTHING
    `);
    
    console.log('База данных успешно инициализирована!');
    console.log('Пользователи:');
    console.log('  manager / manager123 (менеджер)');
    console.log('  worker / worker123 (работник)');
    console.log('  customer / customer123 (заказчик)');
    
  } catch (error) {
    console.error('Ошибка инициализации:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

initDatabase();
