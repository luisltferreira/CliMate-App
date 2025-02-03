let currentUser = null;
let map = null;

// Initialize Map
function initMap() {
    map = L.map('map').setView([38.7223, -9.1393], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
}

// Auth System
function login() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    const users = JSON.parse(localStorage.getItem('users')) || [];
    const user = users.find(u => u.username === username && u.password === password);
    
    if (user) {
        currentUser = user;
        document.getElementById('auth-screen').style.display = 'none';
        document.getElementById('app').style.display = 'block';
        initMap();
    } else {
        alert('Invalid credentials');
    }
}

function signup() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    const users = JSON.parse(localStorage.getItem('users')) || [];
    if (users.some(u => u.username === username)) {
        alert('Username already exists');
        return;
    }
    
    const newUser = {
        id: Date.now(),
        username,
        password,
        events: []
    };
    
    users.push(newUser);
    localStorage.setItem('users', JSON.stringify(users));
    alert('Account created! Please login.');
}

// Event System
function createEvent() {
    const title = document.getElementById('event-title').value;
    const description = document.getElementById('event-desc').value;
    
    const newEvent = {
        id: Date.now(),
        title,
        description,
        location: map.getCenter(),
        creator: currentUser.id
    };
    
    currentUser.events.push(newEvent);
    localStorage.setItem('users', JSON.stringify(
        JSON.parse(localStorage.getItem('users')).map(u => 
            u.id === currentUser.id ? currentUser : u
        )
    ));
    
    L.marker(newEvent.location)
        .addTo(map)
        .bindPopup(`<b>${title}</b><p>${description}</p>`);
    
    closeModal('event-form');
}

// Modal System
function showModal(modalId) {
    document.getElementById(modalId).classList.add('visible');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('visible');
}

// Profile System
function showProfile() {
    document.getElementById('profile-username').textContent = currentUser.username;
    document.getElementById('my-events').innerHTML = currentUser.events
        .map(event => `<div class="event-item">${event.title}</div>`)
        .join('');
    showModal('profile-modal');
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Event Listeners
    document.getElementById('login-btn').addEventListener('click', login);
    document.getElementById('signup-btn').addEventListener('click', signup);
    document.getElementById('create-event-btn').addEventListener('click', () => showModal('event-form'));
    document.getElementById('profile-btn').addEventListener('click', showProfile);
    document.getElementById('save-event-btn').addEventListener('click', createEvent);
    
    // Check existing session
    const lastUser = localStorage.getItem('currentUser');
    if (lastUser) {
        currentUser = JSON.parse(lastUser);
        document.getElementById('auth-screen').style.display = 'none';
        document.getElementById('app').style.display = 'block';
        initMap();
    }
});