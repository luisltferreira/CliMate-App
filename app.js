// Initialize Map
let map;
let currentUser = null;
let currentLocation = null;
let events = JSON.parse(localStorage.getItem('events')) || [];

// Login Handler
function handleLogin() {
    const username = document.getElementById('usernameInput').value.trim();
    
    if (!username) {
        alert('Please enter a username');
        return;
    }
    
    currentUser = username;
    localStorage.setItem('currentUser', username);
    
    // Hide login screen
    document.getElementById('loginScreen').style.display = 'none';
    
    // Show map interface
    document.getElementById('map-container').style.display = 'block';
    document.querySelector('.floating-controls').style.display = 'flex';
    
    // Initialize map if not already initialized
    if (!map) initMap();
}

// Initialize Map
function initMap() {
    // First try to get user's location
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const userCoords = [
                    position.coords.latitude,
                    position.coords.longitude
                ];
                
                // Initialize map with user's location
                map = L.map('map').setView(userCoords, 15);
                
                L.tileLayer('https://tile.thunderforest.com/atlas/{z}/{x}/{y}.png?apikey=d196d66770474b16b2442e9fe6edd937', {
                }).addTo(map);

                }).addTo(map).bindPopup('Your current location');

                loadExistingEvents();
            },
            (error) => {
                handleGeolocationError(error);
                initDefaultMap();
            }
        );
    } else {
        initDefaultMap();
    }
}

function initDefaultMap() {
    // Fallback to default coordinates
    map = L.map('map').setView([51.505, -0.09], 13);
    L.tileLayer('https://tile.thunderforest.com/atlas/{z}/{x}/{y}.png?apikey=d196d66770474b16b2442e9fe6edd937').addTo(map);
    loadExistingEvents();
}

function handleGeolocationError(error) {
    console.warn('Geolocation error:', error);
    alert('Unable to get your location. Using default map view.');
}

function findMyLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                map.setView([
                    position.coords.latitude,
                    position.coords.longitude
                ], 15);
            },
            (error) => {
                alert('Error getting location: ' + error.message);
            }
        );
    } else {
        alert("Geolocation is not supported by this browser.");
    }
}

function showCreateEvent() {
    // Reset location selection
    currentLocation = null;
    document.getElementById('coordinates').textContent = 'Selected coordinates: None';
    
    // Clear existing temporary marker
    if (window.tempMarker) {
        map.removeLayer(window.tempMarker);
        window.tempMarker = null;
    }
    
    // Show modal
    document.getElementById('createEventModal').style.display = 'block';
    
    // Set up map click handler
    map.off('click'); // Remove previous handlers
    map.on('click', handleMapClick);
}

function handleMapClick(e) {
    currentLocation = e.latlng;
    document.getElementById('coordinates').textContent = 
        `Selected coordinates: ${e.latlng.lat.toFixed(4)}, ${e.latlng.lng.toFixed(4)}`;
    
    // Update temporary marker
    if (window.tempMarker) map.removeLayer(window.tempMarker);
    window.tempMarker = L.marker(e.latlng, {
        icon: L.divIcon({
            className: 'temp-marker',
            html: '<div class="marker-pulse"></div>'
        })
    }).addTo(map);
}

function closeModal() {
    document.getElementById('createEventModal').style.display = 'none';
    
    // Clean up
    if (window.tempMarker) {
        map.removeLayer(window.tempMarker);
        window.tempMarker = null;
    }
    currentLocation = null;
    document.getElementById('eventForm').reset();
    document.getElementById('coordinates').textContent = 'Selected coordinates: None';
    
    // Restore map controls
    map.off('click');
}

function disableMapInteractions(enable) {
    if (enable) {
        map.dragging.enable();
        map.touchZoom.enable();
        map.doubleClickZoom.enable();
        map.scrollWheelZoom.enable();
    } else {
        map.dragging.disable();
        map.touchZoom.disable();
        map.doubleClickZoom.disable();
        map.scrollWheelZoom.disable();
    }
}

function setupMapClickHandler() {
    // Clear previous handlers
    map.off('click');
    
    // Add new click handler
    map.on('click', function(e) {
        currentLocation = e.latlng;
        document.getElementById('coordinates').textContent = 
            `Selected coordinates: ${e.latlng.lat.toFixed(4)}, ${e.latlng.lng.toFixed(4)}`;
        
        // Add temporary marker
        if (window.tempMarker) map.removeLayer(window.tempMarker);
        window.tempMarker = L.marker(e.latlng, {
            icon: L.divIcon({
                className: 'temp-marker',
                html: '<div class="marker-pulse"></div>'
            })
        }).addTo(map);
    });
}

function handleEventSubmit(e) {
    e.preventDefault();
    
    if (!currentLocation) {
        alert('Please select a location by clicking on the map');
        return;
    }

    const newEvent = {
        id: 'event-' + Date.now(), // Add event- prefix for better ID handling
        title: document.getElementById('eventTitle').value,
        description: document.getElementById('eventDescription').value,
        date: document.getElementById('eventDate').value,
        location: {
            lat: currentLocation.lat,
            lng: currentLocation.lng
        }, // Store as serializable object
        creator: currentUser,
        interested: []
    };

    events.push(newEvent);
    localStorage.setItem('events', JSON.stringify(events));
    createMapMarker(newEvent);
    closeModal();
}

function createMapMarker(event) {
    const marker = L.marker([event.location.lat, event.location.lng], {
        eventId: event.id,  // Store event ID with marker
        icon: L.divIcon({
            className: 'marker-animation',
            html: `<div class="custom-marker">
                <div class="marker-pulse"></div>
                <div class="marker-center"></div>
            </div>`
        })
    }).addTo(map);

    marker.bindPopup(createPopupContent(event));
}

function showInterest(eventId) {
    if (!currentUser) {
        alert('Please login first!');
        return;
    }

    // Get fresh data
    events = JSON.parse(localStorage.getItem('events')) || [];
    const eventIndex = events.findIndex(e => e.id === eventId);
    
    if (eventIndex === -1) return;

    // Toggle interest
    const userIndex = events[eventIndex].interested.indexOf(currentUser);
    if (userIndex === -1) {
        events[eventIndex].interested.push(currentUser);
    } else {
        events[eventIndex].interested.splice(userIndex, 1);
    }

    // Update storage
    localStorage.setItem('events', JSON.stringify(events));

    // Update UI
    updateEventMarkers(eventId);
    showProfile(); // Refresh profile view
}

function updateEventMarkers(eventId) {
    // Get fresh data from storage
    const updatedEvents = JSON.parse(localStorage.getItem('events')) || [];
    const event = updatedEvents.find(e => e.id === eventId);
    
    if (!event) return;

    // Update all markers
    map.eachLayer(layer => {
        if (layer instanceof L.Marker && layer.options.eventId === eventId) {
            const newContent = `
                <div class="event-popup">
                    <h3>${event.title}</h3>
                    <p>${event.description}</p>
                    <p>📅 ${new Date(event.date).toLocaleString()}</p>
                    <button class="interest-btn" data-event-id="${event.id}">
                        👍 Interested (${event.interested.length})
                    </button>
                </div>
            `;
            layer.setPopupContent(newContent);
            if (layer.isPopupOpen()) {
                layer.closePopup().openPopup();
            }
        }
    });
}

function createPopupContent(event) {
    return `
        <div class="event-popup">
            <h3>${event.title}</h3>
            <p>${event.description}</p>
            <p>📅 ${new Date(event.date).toLocaleString()}</p>
            <button class="interest-btn" data-event-id="${event.id}">
                👍 Interested (${event.interested.length})
            </button>
        </div>
    `;
}

function updatePopupContent(eventId, newCount) {
    // Find the event data
    const event = events.find(e => e.id === eventId);
    if (!event) return;

    // Update all markers with this event ID
    map.eachLayer(layer => {
        if (layer instanceof L.Marker) {
            const popup = layer.getPopup();
            if (popup && layer.getLatLng().equals([event.location.lat, event.location.lng])) {
                layer.setPopupContent(`
                    <div class="event-popup">
                        <h3>${event.title}</h3>
                        <p>${event.description}</p>
                        <p>📅 ${new Date(event.date).toLocaleString()}</p>
                        <button onclick="showInterest('${eventId}')">
                            👍 Interested (${newCount})
                        </button>
                    </div>
                `);
                layer.openPopup();
            }
        }
    });
}

document.querySelector('.floating-controls').innerHTML = `
    <button onclick="showCreateEvent()">Create Event</button>
    <button onclick="showProfile()">Profile</button>
    <button onclick="logout()">Logout</button>
`;

function logout() {
    localStorage.removeItem('currentUser');
    location.reload();
}

// Check for existing user on load
window.addEventListener('load', () => {
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
        currentUser = savedUser;
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('map').style.display = 'block';
        document.querySelector('.floating-controls').style.display = 'flex';
        initMap();
    } else {
        // Explicitly show login screen if no user exists
        document.getElementById('loginScreen').style.display = 'flex';
        document.getElementById('loginScreen').style.opacity = '1';
    }
});

function showProfile() {
    // Force refresh from localStorage
    events = JSON.parse(localStorage.getItem('events')) || [];
    
    const createdEvents = events.filter(e => e.creator === currentUser);
    const interestedEvents = events.filter(e => e.interested.includes(currentUser));

    // Update DOM elements
    document.getElementById('createdEvents').innerHTML = createdEvents
        .map(event => `
            <div class="event-item">
                <h4>${event.title}</h4>
                <p>${event.description}</p>
                <small>${new Date(event.date).toLocaleString()}</small>
                <p>Interested: ${event.interested.length}</p>
            </div>
        `).join('');

    document.getElementById('interestedEvents').innerHTML = interestedEvents
        .map(event => `
            <div class="event-item">
                <h4>${event.title}</h4>
                <p>By: ${event.creator}</p>
                <small>${new Date(event.date).toLocaleString()}</small>
            </div>
        `).join('');

    // Show profile modal
    document.getElementById('profileView').classList.add('active');
}

function hideProfile() {
    document.getElementById('profileView').classList.remove('active');
}

console.log('Debugging Info:');
console.log('Current User:', localStorage.getItem('currentUser'));
console.log('Stored Events:', JSON.parse(localStorage.getItem('events')));
