// Constants and state management
const STATE = {
    map: null,
    events: [],
    user: {
        id: 'user1',
        name: '',
        createdEvents: [],
        interestedEvents: []
    },
    selectedLocation: null,
    locationMarker: null,
    currentStep: 1,
    eventData: {
        title: '',
        description: '',
        date: '',
        time: '',
        category: '',
        location: null
    },
    locationPermission: localStorage.getItem('locationPermission') === 'granted'
};

// Event handlers
const EventHandlers = {
    saveEvents() {
        localStorage.setItem('events', JSON.stringify(STATE.events));
        localStorage.setItem('user', JSON.stringify(STATE.user));
    },

    validateEventForm(title, description, date, time, category, location) {
        const errors = [];
        if (!title?.trim()) errors.push('Title is required');
        if (!description?.trim()) errors.push('Description is required');
        if (!date) errors.push('Date is required');
        if (!time) errors.push('Time is required');
        if (!category) errors.push('Category is required');
        if (!location) errors.push('Location is required');
        
        if (errors.length > 0) {
            throw new Error(errors.join('\n'));
        }
    },

    resetForm() {
        ['eventTitle', 'eventDesc', 'eventDate', 'eventTime', 'eventCategory'].forEach(id => {
            const element = document.getElementById(id);
            if (element) element.value = '';
        });
    }
};

// Map functionality
const MapManager = {
    async init() {
        try {
            STATE.map = L.map('map', {
                zoomControl: false,
                attributionControl: false,
                doubleClickZoom: false,
                dragging: true,
                scrollWheelZoom: true,
                touchZoom: true,
                tap: false
            }).setView([0, 0], 2);
            
            // Add grabbing cursor styles
            const mapElement = STATE.map.getContainer();
            mapElement.style.cursor = 'default';
            
            // Add mousedown/mouseup listeners for cursor change
            mapElement.addEventListener('mousedown', () => {
                mapElement.style.cursor = 'grabbing';
            });
            
            mapElement.addEventListener('mouseup', () => {
                mapElement.style.cursor = 'default';
            });
            
            // Basic map style
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '©OpenStreetMap',
                maxZoom: 19
            }).addTo(STATE.map);

            // Create a custom marker icon with your brand colors
            const customIcon = L.divIcon({
                className: 'custom-marker',
                html: `
                    <div class="marker-pin">
                        <i class="fas fa-map-marker-alt"></i>
                    </div>
                `,
                iconSize: [30, 42],
                iconAnchor: [15, 42],
                popupAnchor: [0, -42]
            });

            STATE.locationMarker = L.marker([0, 0], {
                icon: customIcon,
                interactive: false
            }).addTo(STATE.map);
            STATE.locationMarker.setOpacity(0);

            // Try to get user's location
            await this.centerOnUserLocation();

            this.setupMapListeners();
            this.renderEvents();
        } catch (error) {
            console.error('Map initialization failed:', error);
            this.showToast('Failed to load map. Please refresh the page.', 'error');
        }
    },

    async centerOnUserLocation() {
        try {
            // Check if we have stored permission
            if (STATE.locationPermission) {
                try {
                    const position = await UI.getCurrentPosition();
                    const userLocation = L.latLng(
                        position.coords.latitude,
                        position.coords.longitude
                    );
                    STATE.map.setView(userLocation, 13);
                    return;
                } catch (error) {
                    // If getting location fails despite having permission, reset permission
                    STATE.locationPermission = false;
                    localStorage.setItem('locationPermission', 'denied');
                }
            }
            
            // Fallback to default view
            STATE.map.setView([51.505, -0.09], 13);
        } catch (error) {
            console.warn('Could not get user location:', error);
            STATE.map.setView([51.505, -0.09], 13);
        }
    },

    setupMapListeners() {
        if (!STATE.map) return;
        
        STATE.map.on('click', (e) => {
            if (document.getElementById('step2')?.classList.contains('active')) {
                STATE.selectedLocation = e.latlng;
                STATE.locationMarker.setLatLng(STATE.selectedLocation);
                STATE.locationMarker.setOpacity(1); // Show marker
                UI.updateLocationPreview();
                UI.toggleModal('createEventModal', true); // Show modal again
            }
        });
    },

    clearEventMarkers() {
        if (!STATE.map) return;
        
        STATE.map.eachLayer(layer => {
            if (layer instanceof L.Marker && layer !== STATE.locationMarker) {
                STATE.map.removeLayer(layer);
            }
        });
    },

    renderEvents() {
        this.clearEventMarkers();
        STATE.events.forEach(event => {
            try {
                const eventIcon = L.divIcon({
                    className: 'custom-marker event-marker',
                    html: `
                        <div class="marker-pin ${event.category}">
                            <i class="fas fa-map-marker-alt"></i>
                        </div>
                    `,
                    iconSize: [30, 42],
                    iconAnchor: [15, 42],
                    popupAnchor: [0, -42]
                });

                const marker = L.marker([event.lat, event.lng], { icon: eventIcon }).addTo(STATE.map);
                const popup = L.popup().setContent(this.createEventPopup(event));
                marker.bindPopup(popup);
            } catch (error) {
                console.error('Failed to render event:', event, error);
            }
        });
    },

    createEventPopup(event) {
        const isInterested = event.interestedUsers && event.interestedUsers.includes(STATE.user.id);
        return `
            <div class="event-popup">
                <h3>${this.escapeHtml(event.title)}</h3>
                <p>${this.escapeHtml(event.description)}</p>
                <p>Date: ${this.escapeHtml(event.date)} at ${this.escapeHtml(event.time)}</p>
                <p>Category: ${this.escapeHtml(event.category)}</p>
                <button onclick="UI.showInterest(${event.id}); return false;" class="interest-btn ${isInterested ? 'interested' : ''}">
                    ${isInterested ? 'Remove Interest' : 'Show Interest'}
                </button>
            </div>
        `;
    },

    escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    },

    enableMapInteraction() {
        STATE.map.dragging.enable();
        STATE.map.getContainer().style.cursor = 'crosshair';
    },

    disableMapInteraction() {
        STATE.map.getContainer().style.cursor = 'default';
    }
};

// UI Management
const UI = {
    showCreateEvent() {
        try {
            this.resetEventCreation();
            this.toggleModal('createEventModal', true);
            this.updateStepDisplay();
        } catch (error) {
            console.error('Failed to show create event modal:', error);
            alert('An error occurred. Please try again.');
        }
    },

    resetEventCreation() {
        STATE.currentStep = 1;
        STATE.eventData = {
            title: '',
            description: '',
            date: '',
            time: '',
            category: '',
            location: null
        };
        STATE.selectedLocation = null;
        if (STATE.locationMarker) STATE.locationMarker.setOpacity(0);
        
        const form = document.getElementById('eventDetailsForm');
        if (form) form.reset();
        
        this.resetStepDisplay();
    },

    resetStepDisplay() {
        document.querySelectorAll('.step').forEach(step => {
            step.classList.toggle('active', step.dataset.step === '1');
        });
        
        document.querySelectorAll('.step-pane').forEach((pane, index) => {
            pane.classList.toggle('active', index === 0);
        });
        
        const prevBtn = document.getElementById('prevStep');
        const nextBtn = document.getElementById('nextStep');
        const createBtn = document.getElementById('createEventBtn');
        
        if (prevBtn) prevBtn.style.display = 'none';
        if (nextBtn) nextBtn.style.display = 'block';
        if (createBtn) createBtn.style.display = 'none';
    },

    updateStepDisplay() {
        // Update step indicators
        document.querySelectorAll('.step').forEach(step => {
            const stepNum = parseInt(step.dataset.step);
            step.classList.toggle('active', stepNum === STATE.currentStep);
        });

        // Update step panes
        document.querySelectorAll('.step-pane').forEach((pane, index) => {
            pane.classList.toggle('active', index + 1 === STATE.currentStep);
        });

        // Update buttons
        document.getElementById('prevStep').style.display = STATE.currentStep > 1 ? 'block' : 'none';
        document.getElementById('nextStep').style.display = STATE.currentStep < 3 ? 'block' : 'none';
        document.getElementById('createEventBtn').style.display = STATE.currentStep === 3 ? 'block' : 'none';
    },

    validateStep() {
        try {
            switch(STATE.currentStep) {
                case 1:
                    const form = document.getElementById('eventDetailsForm');
                    if (!form) throw new Error('Form not found');
                    
                    if (!form.checkValidity()) {
                        form.reportValidity();
                        return false;
                    }
                    
                    // Save form data
                    STATE.eventData = {
                        ...STATE.eventData,
                        title: document.getElementById('eventTitle').value.trim(),
                        description: document.getElementById('eventDesc').value.trim(),
                        date: document.getElementById('eventDate').value,
                        time: document.getElementById('eventTime').value,
                        category: document.getElementById('eventCategory').value
                    };
                    return true;

                case 2:
                    if (!STATE.selectedLocation) {
                        alert('Please select a location for your event');
                        return false;
                    }
                    return true;

                case 3:
                    return true;

                default:
                    return false;
            }
        } catch (error) {
            console.error('Validation error:', error);
            alert('An error occurred during validation. Please try again.');
            return false;
        }
    },

    nextStep() {
        if (!this.validateStep()) return;
        
        if (STATE.currentStep < 3) {
            STATE.currentStep++;
            this.updateStepDisplay();
            
            if (STATE.currentStep === 3) {
                this.updatePreview();
            }
        }
    },

    prevStep() {
        if (STATE.currentStep > 1) {
            STATE.currentStep--;
            this.updateStepDisplay();
        }
    },

    async updatePreview() {
        try {
            const preview = document.getElementById('previewContent');
            if (!preview) return;

            let locationText = 'No location selected';
            
            if (STATE.selectedLocation) {
                // Show "Loading..." while fetching the address
                locationText = 'Loading address...';
                preview.innerHTML = this.generatePreviewHTML(locationText);
                
                // Get the actual address
                locationText = await this.getAddressFromCoordinates(
                    STATE.selectedLocation.lat,
                    STATE.selectedLocation.lng
                );
            }

            preview.innerHTML = this.generatePreviewHTML(locationText);
        } catch (error) {
            console.error('Preview update failed:', error);
            alert('Failed to update preview. Please try again.');
        }
    },

    generatePreviewHTML(locationText) {
        return `
            <div class="preview-item">
                <strong>Title:</strong> ${this.escapeHtml(STATE.eventData.title)}
            </div>
            <div class="preview-item">
                <strong>Category:</strong> ${this.escapeHtml(STATE.eventData.category)}
            </div>
            <div class="preview-item">
                <strong>Date:</strong> ${this.escapeHtml(STATE.eventData.date)} at ${this.escapeHtml(STATE.eventData.time)}
            </div>
            <div class="preview-item">
                <strong>Description:</strong> ${this.escapeHtml(STATE.eventData.description)}
            </div>
            <div class="preview-item">
                <strong>Location:</strong> ${this.escapeHtml(locationText)}
            </div>
        `;
    },

    createEvent() {
        try {
            const newEvent = {
                id: Date.now(),
                title: STATE.eventData.title,
                description: STATE.eventData.description,
                date: STATE.eventData.date,
                time: STATE.eventData.time,
                category: STATE.eventData.category,
                lat: STATE.selectedLocation.lat,
                lng: STATE.selectedLocation.lng,
                creator: STATE.user.id,
                interestedUsers: []
            };

            STATE.events.push(newEvent);
            STATE.user.createdEvents.push(newEvent.id);
            EventHandlers.saveEvents();
            MapManager.renderEvents();
            this.closeModals();
            this.showToast('Event created successfully!', 'success');
        } catch (error) {
            console.error('Failed to create event:', error);
            this.showToast('Failed to create event. Please try again.', 'error');
        }
    },

    showInterest(eventId) {
        try {
            const event = STATE.events.find(e => e.id === eventId);
            if (!event) {
                console.error('Event not found:', eventId);
                return;
            }

            const isCurrentlyInterested = event.interestedUsers.includes(STATE.user.id);

            if (isCurrentlyInterested) {
                event.interestedUsers = event.interestedUsers.filter(id => id !== STATE.user.id);
                STATE.user.interestedEvents = STATE.user.interestedEvents.filter(id => id !== eventId);
                this.showToast('You are no longer interested in this event.', 'success');
            } else {
                event.interestedUsers.push(STATE.user.id);
                STATE.user.interestedEvents.push(eventId);
                this.showToast('You are now interested in this event!', 'success');
            }

            EventHandlers.saveEvents();
            MapManager.renderEvents();
            
            if (document.getElementById('profile').style.display === 'block') {
                this.renderProfileEvents();
            }
        } catch (error) {
            console.error('Error toggling interest:', error);
            this.showToast('Failed to update interest. Please try again.', 'error');
        }
    },

    showProfile() {
        this.toggleModal('profile', true);
        this.renderProfileEvents();
    },

    renderProfileEvents() {
        const createdEventsDiv = document.getElementById('createdEvents');
        const interestedEventsDiv = document.getElementById('interestedEvents');
        const profileTitle = document.querySelector('#profile h2');

        if (profileTitle) {
            profileTitle.textContent = `${STATE.user.name}'s Profile`;
        }

        if (!createdEventsDiv || !interestedEventsDiv) {
            console.error('Profile containers not found');
            return;
        }

        try {
            // Ensure events array exists
            if (!Array.isArray(STATE.events)) {
                STATE.events = [];
            }

            // Get created events
            const createdEvents = STATE.events
                .filter(e => e && e.creator === STATE.user.id)
                .map(e => this.createProfileEventItem(e, 'created'))
                .join('');

            // Get interested events
            const interestedEvents = STATE.events
                .filter(e => e && e.interestedUsers && e.interestedUsers.includes(STATE.user.id))
                .map(e => this.createProfileEventItem(e, 'interested'))
                .join('');

            // Set content with fallback for empty lists
            createdEventsDiv.innerHTML = createdEvents || '<div class="no-events">No events created yet</div>';
            interestedEventsDiv.innerHTML = interestedEvents || '<div class="no-events">No events marked as interested</div>';
        } catch (error) {
            console.error('Error rendering profile events:', error);
            createdEventsDiv.innerHTML = '<div class="error-message">Failed to load events</div>';
            interestedEventsDiv.innerHTML = '<div class="error-message">Failed to load events</div>';
        }
    },

    createProfileEventItem(event, type) {
        if (!event || !event.title) return '';
        
        const isInterested = event.interestedUsers && event.interestedUsers.includes(STATE.user.id);
        const interestButton = type === 'created' ? '' : `
            <button onclick="UI.showInterest(${event.id})" class="interest-btn ${isInterested ? 'interested' : ''}">
                ${isInterested ? 'Remove Interest' : 'Show Interest'}
            </button>
        `;

        return `
            <div class="event-list-item">
                <div class="event-title">${this.escapeHtml(event.title)}</div>
                <div class="event-details">
                    <div class="event-info">
                        <div>${this.escapeHtml(event.date)} at ${this.escapeHtml(event.time || '')}</div>
                        <div class="event-category">${this.escapeHtml(event.category || 'No category')}</div>
                    </div>
                    <div class="event-actions">
                        <button onclick="UI.showEventOnMap(${event.id})" class="view-map-btn">
                            <i class="fas fa-map-marker-alt"></i> View on Map
                        </button>
                        ${interestButton}
                    </div>
                </div>
            </div>
        `;
    },

    showEventOnMap(eventId) {
        const event = STATE.events.find(e => e.id === eventId);
        if (!event) return;

        this.closeModals();
        STATE.map.flyTo([event.lat, event.lng], 15);
        
        // Find and open the popup for this event
        STATE.map.eachLayer(layer => {
            if (layer instanceof L.Marker && layer !== STATE.locationMarker) {
                const latLng = layer.getLatLng();
                if (latLng.lat === event.lat && latLng.lng === event.lng) {
                    layer.openPopup();
                }
            }
        });
    },

    toggleModal(modalId, show) {
        const backdrop = document.getElementById('backdrop');
        const modal = document.getElementById(modalId);
        
        if (!backdrop || !modal) {
            console.error('Modal elements not found');
            return;
        }

        const display = show ? 'block' : 'none';
        backdrop.style.display = display;
        modal.style.display = display;
    },

    closeModals() {
        this.toggleModal('createEventModal', false);
        this.toggleModal('profile', false);
        MapManager.disableMapInteraction();
        if (STATE.locationMarker) {
            STATE.locationMarker.setOpacity(0);
        }
        STATE.selectedLocation = null;
    },

    toggleMapSelection() {
        this.toggleModal('createEventModal', false);
        MapManager.enableMapInteraction();
        setTimeout(() => {
            this.showToast('Click on the map to select your event location', 'info');
        }, 100);
    },

    async useCurrentLocation() {
        try {
            const position = await this.getCurrentPosition();
            STATE.selectedLocation = L.latLng(
                position.coords.latitude,
                position.coords.longitude
            );
            STATE.map.flyTo(STATE.selectedLocation, 15);
            STATE.locationMarker.setLatLng(STATE.selectedLocation);
            STATE.locationMarker.setOpacity(1);
            this.updateLocationPreview();
        } catch (error) {
            alert('Error getting location: ' + error.message);
        }
    },

    getCurrentPosition() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('Geolocation is not supported by your browser'));
                return;
            }

            // Use cached position if available and recent (less than 5 minutes old)
            const cachedPosition = localStorage.getItem('lastPosition');
            if (cachedPosition) {
                const { position, timestamp } = JSON.parse(cachedPosition);
                const fiveMinutes = 5 * 60 * 1000;
                if (Date.now() - timestamp < fiveMinutes) {
                    resolve(position);
                    return;
                }
            }

            // Get fresh position
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    // Cache the position
                    localStorage.setItem('lastPosition', JSON.stringify({
                        position,
                        timestamp: Date.now()
                    }));
                    resolve(position);
                },
                reject,
                {
                    enableHighAccuracy: true,
                    timeout: 5000,
                    maximumAge: 0
                }
            );
        });
    },

    async updateLocationPreview() {
        const preview = document.getElementById('locationPreview');
        if (!preview) return;

        if (STATE.selectedLocation) {
            preview.innerHTML = '<p>Loading address...</p>';
            const address = await this.getAddressFromCoordinates(
                STATE.selectedLocation.lat,
                STATE.selectedLocation.lng
            );
            preview.innerHTML = `
                <p><strong>Selected Location:</strong></p>
                <p>${this.escapeHtml(address)}</p>
            `;
        } else {
            preview.innerHTML = '<p>No location selected</p>';
        }
    },

    escapeHtml(unsafe) {
        if (!unsafe) return '';
        return unsafe
            .toString()
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    },

    async getAddressFromCoordinates(lat, lng) {
        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`
            );
            const data = await response.json();
            return data.display_name || 'Address not found';
        } catch (error) {
            console.error('Error getting address:', error);
            return 'Could not retrieve address';
        }
    },

    async searchAddress(address) {
        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`
            );
            const data = await response.json();
            
            if (data && data[0]) {
                const location = L.latLng(data[0].lat, data[0].lon);
                STATE.selectedLocation = location;
                STATE.map.flyTo(location, 15);
                STATE.locationMarker.setLatLng(location);
                STATE.locationMarker.setOpacity(1);
                this.updateLocationPreview();
            } else {
                this.showToast('Address not found. Please try again or select location on map.', 'error');
            }
        } catch (error) {
            console.error('Error searching address:', error);
            this.showToast('Failed to search address. Please try again.', 'error');
        }
    },

    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        let icon = 'info-circle';
        if (type === 'success') icon = 'check-circle';
        if (type === 'error') icon = 'exclamation-circle';
        
        toast.innerHTML = `
            <i class="fas fa-${icon}"></i>
            <span>${message}</span>
        `;
        
        const container = document.getElementById('toastContainer');
        container.appendChild(toast);
        
        // Remove toast after 3 seconds
        setTimeout(() => {
            toast.style.animation = 'toastSlideOut 0.3s ease forwards';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    },

    async requestLocationPermission() {
        try {
            const position = await this.getCurrentPosition();
            STATE.locationPermission = true;
            localStorage.setItem('locationPermission', 'granted');
            return position;
        } catch (error) {
            STATE.locationPermission = false;
            localStorage.setItem('locationPermission', 'denied');
            throw error;
        }
    },

    async startApp() {
        const nameInput = document.getElementById('userName');
        const name = nameInput.value.trim();
        
        if (!name) {
            this.showToast('Please enter your name', 'error');
            return;
        }

        try {
            STATE.user.name = name;
            EventHandlers.saveEvents();
            
            const startBtn = nameInput.closest('.welcome-form').querySelector('.start-btn');
            const originalText = startBtn.innerHTML;
            startBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
            startBtn.disabled = true;

            const position = await this.requestLocationPermission();
            
            // Hide welcome screen
            document.getElementById('welcomeScreen').style.display = 'none';
            
            setTimeout(() => {
                STATE.map.setView([position.coords.latitude, position.coords.longitude], 13);
                this.showToast(`Welcome, ${name}! You can now explore events in your area.`, 'success');
                startBtn.innerHTML = originalText;
                startBtn.disabled = false;
            }, 500);

        } catch (error) {
            this.showToast('We need your location to show nearby events. Please enable location access and try again.', 'error');
            const startBtn = nameInput.closest('.welcome-form').querySelector('.start-btn');
            startBtn.innerHTML = originalText;
            startBtn.disabled = false;
        }
    }
};

// Add CSS for the location marker and popup
const style = document.createElement('style');
style.textContent = `
    .location-marker {
        color: var(--primary-color);
        font-size: 24px;
    }
    .event-popup {
        min-width: 200px;
    }
    .interest-btn {
        width: 100%;
        margin-top: 10px;
    }
`;
document.head.appendChild(style);

// Add this function to load saved data
const loadSavedData = () => {
    try {
        const savedEvents = localStorage.getItem('events');
        const savedUser = localStorage.getItem('user');
        
        if (savedEvents) {
            STATE.events = JSON.parse(savedEvents);
        }
        
        if (savedUser) {
            STATE.user = JSON.parse(savedUser);
        }
    } catch (error) {
        console.error('Error loading saved data:', error);
        // Initialize with empty arrays if loading fails
        STATE.events = [];
        STATE.user = {
            id: 'user1',
            name: '',
            createdEvents: [],
            interestedEvents: []
        };
    }
};

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
    try {
        loadSavedData();
        MapManager.init();
        
        const welcomeScreen = document.getElementById('welcomeScreen');
        
        // Show welcome screen if needed
        if (!STATE.user.name || !STATE.locationPermission) {
            welcomeScreen.style.display = 'flex';
            setTimeout(() => {
                welcomeScreen.classList.add('show');
            }, 100);
        } else {
            welcomeScreen.style.display = 'none';
        }
        
    } catch (error) {
        console.error('App initialization failed:', error);
    }
});

// Handle errors globally
window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    alert('An error occurred. Please refresh the page.');
});
