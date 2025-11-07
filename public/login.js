//const API_URL = 'http://localhost:3000/api';

document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  const errorMessage = document.getElementById('error-message');
  
  try {
    const response = await fetch(`api/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username, password })
    });
    
    const data = await response.json();
    
    if (data.success) {
      localStorage.setItem('user', JSON.stringify(data.user));
      window.location.href = 'index.html';
    } else {
      errorMessage.textContent = data.message || 'Ошибка входа';
    }
  } catch (error) {
    console.error('Ошибка:', error);
    errorMessage.textContent = 'Ошибка подключения к серверу';
  }
});
