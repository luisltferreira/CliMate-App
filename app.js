// Constants and state management
const STATE = {
    map: null,
    events: [],
    user: {
        id: null,
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
        localStorage.setItem('sharedEvents', JSON.stringify(STATE.events));
        localStorage.setItem(`userData_${STATE.user.id}`, JSON.stringify(STATE.user));
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
    eventMarkers: [],

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
        this.eventMarkers.forEach(marker => {
            marker.remove();
        });
        this.eventMarkers = [];
    },

    renderEvents() {
        try {
            // Clear existing markers
            this.clearEventMarkers();
            
            // Add markers for each event
            if (STATE.events && STATE.events.length > 0) {
                console.log('Event details:', STATE.events.map(event => ({
                    lat: event.lat,
                    lng: event.lng,
                    title: event.title,
                    category: event.category
                })));
                console.log('Rendering events:', STATE.events); // Debug log

                STATE.events.forEach(event => {
                    try {
                        const marker = L.marker([parseFloat(event.lat), parseFloat(event.lng)], {
                            icon: this.createEventIcon(event.category)
                        }).addTo(STATE.map);

                        marker.bindPopup(this.createEventPopup(event));
                        this.eventMarkers.push(marker);
                    } catch (err) {
                        console.error('Error creating marker for event:', event, err);
                    }
                });
            } else {
                console.log('No events to render'); // Debug log
            }
        } catch (error) {
            console.error('Failed to render events:', error);
        }
    },

    createEventIcon(category) {
        return L.divIcon({
            className: 'custom-marker',
            html: `
                <div class="marker-pin ${category}">
                    <i class="fas fa-map-marker-alt"></i>
                </div>
            `,
            iconSize: [30, 42],
            iconAnchor: [15, 42],
            popupAnchor: [0, -42]
        });
    },

    createEventPopup(event) {
        const isInterested = STATE.user.interestedEvents.includes(event.id);
        const isCreator = event.creator_id === STATE.user.id;
        
        const interestButton = isCreator ? '' : `
            <button 
                onclick="UI.showInterest('${event.id}')" 
                class="interest-btn${isInterested ? ' interested' : ''}"
            >
                ${isInterested ? 'Remove Interest' : 'Show Interest'}
            </button>
        `;
        
        return `
            <div class="event-popup">
                <h3>${UI.escapeHtml(event.title)}</h3>
                <p>${UI.escapeHtml(event.description)}</p>
                <p>
                    <strong>When:</strong> ${UI.escapeHtml(event.date)} at ${UI.escapeHtml(event.time)}<br>
                    <strong>Category:</strong> ${UI.escapeHtml(event.category)}<br>
                    <strong>Created by:</strong> ${UI.escapeHtml(event.creator_name)}
                </p>
                ${interestButton}
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

    async createEvent() {
        try {
            const newEvent = {
                title: STATE.eventData.title,
                description: STATE.eventData.description,
                date: STATE.eventData.date,
                time: STATE.eventData.time,
                category: STATE.eventData.category,
                lat: STATE.selectedLocation.lat,
                lng: STATE.selectedLocation.lng,
                creator: STATE.user.id,
                creatorName: STATE.user.name
            };

            // Create event in database
            const createdEvent = await DB.createEvent(newEvent);
            
            // Update local state
            STATE.events.push(createdEvent);
            STATE.user.createdEvents.push(createdEvent.id);
            
            // Update user's created events in database
            await DB.updateUserEvents(STATE.user.id, {
                created_events: STATE.user.createdEvents
            });

            MapManager.renderEvents();
            this.closeModals();
            this.showToast('Event created successfully!', 'success');
        } catch (error) {
            console.error('Failed to create event:', error);
            this.showToast('Failed to create event. Please try again.', 'error');
        }
    },

    async showInterest(eventId) {
        try {
            const event = STATE.events.find(e => e.id === eventId);
            if (!event) return;

            const isInterested = STATE.user.interestedEvents.includes(eventId);
            
            if (isInterested) {
                STATE.user.interestedEvents = STATE.user.interestedEvents.filter(id => id !== eventId);
            } else {
                STATE.user.interestedEvents.push(eventId);
            }

            // Update database
            await DB.showInterest(eventId, STATE.user.id, !isInterested);
            await DB.updateUserEvents(STATE.user.id, {
                interested_events: STATE.user.interestedEvents
            });

            // Update UI
            MapManager.renderEvents();
            this.showProfile(); // Refresh profile view
            
        } catch (error) {
            console.error('Failed to update interest:', error);
            this.showToast('Failed to update interest. Please try again.', 'error');
        }
    },

    showProfile() {
        this.toggleModal('profile', true);
        this.renderProfileEvents();
    },

    async renderProfileEvents() {
        try {
            const createdEventsContainer = document.getElementById('createdEvents');
            const interestedEventsContainer = document.getElementById('interestedEvents');
            
            // Get fresh data from database
            const events = await DB.getEvents();
            
            // Filter created events
            const createdEvents = events.filter(event => 
                STATE.user.createdEvents.includes(event.id)
            );
            
            // Filter interested events
            const interestedEvents = events.filter(event => 
                STATE.user.interestedEvents.includes(event.id)
            );

            // Render created events
            createdEventsContainer.innerHTML = createdEvents.length ? 
                createdEvents.map(event => this.createProfileEventItem(event, 'created')).join('') :
                '<div class="no-events">No created events yet</div>';

            // Render interested events
            interestedEventsContainer.innerHTML = interestedEvents.length ?
                interestedEvents.map(event => this.createProfileEventItem(event, 'interested')).join('') :
                '<div class="no-events">No interested events yet</div>';

        } catch (error) {
            console.error('Failed to render profile events:', error);
            this.showToast('Failed to load profile events', 'error');
        }
    },

    createProfileEventItem(event, type) {
        if (!event || !event.title) return '';
        
        const isInterested = STATE.user.interestedEvents.includes(event.id);
        const isCreator = event.creator_id === STATE.user.id;
        
        const interestButton = type === 'created' ? '' : `
            <button onclick="UI.showInterest('${event.id}')" class="interest-btn ${isInterested ? 'interested' : ''}">
                ${isInterested ? 'Remove Interest' : 'Show Interest'}
            </button>
        `;

        const creatorInfo = isCreator ? `<div class="event-creator">Created by you</div>` : '';

        return `
            <div class="event-list-item">
                <div class="event-title">${this.escapeHtml(event.title)}</div>
                ${creatorInfo}
                <div class="event-details">
                    <div class="event-info">
                        <div>${this.escapeHtml(event.date)} at ${this.escapeHtml(event.time || '')}</div>
                        <div class="event-category">${this.escapeHtml(event.category || 'No category')}</div>
                    </div>
                    <div class="event-actions">
                        <button onclick="UI.showEventOnMap('${event.id}')" class="view-map-btn">
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
            // Show loading screen first
            const loadingScreen = document.getElementById('loadingScreen');
            loadingScreen.classList.add('show');
            
            // Then hide welcome screen
            document.getElementById('welcomeScreen').classList.remove('show');

            // Check for existing user or create new one
            let user = await DB.getUserByName(name);
            
            if (!user) {
                user = await DB.createUser({ name });
            }

            // Update STATE with proper array types
            STATE.user = {
                id: user.id,
                name: user.name,
                createdEvents: Array.isArray(user.created_events) ? user.created_events : [],
                interestedEvents: Array.isArray(user.interested_events) ? user.interested_events : []
            };

            const position = await this.requestLocationPermission();

            // Load events from database
            const events = await DB.getEvents();
            console.log('Loaded events:', events); // Debug log
            STATE.events = events;

            // Before showing the map, wait for the loading screen animation
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Show map and menu
            const map = document.getElementById('map');
            const menu = document.querySelector('.menu');
            
            map.style.visibility = 'visible';
            menu.style.display = 'flex';
            menu.classList.add('show');
            loadingScreen.classList.remove('show');
            
            STATE.map.setView([position.coords.latitude, position.coords.longitude], 13);
            STATE.map.invalidateSize();
            this.showToast(`Welcome${user ? ' back' : ''}, ${name}!`, 'success');
            MapManager.renderEvents();

        } catch (error) {
            console.error('Error in startApp:', error);
            document.getElementById('loadingScreen').classList.remove('show');
            this.showToast('An error occurred. Please try again.', 'error');
        }
    },

    async logout() {
        try {
            // Reset state
            STATE.user = {
                id: null,
                name: '',
                createdEvents: [],
                interestedEvents: []
            };
            STATE.locationPermission = false;
            STATE.events = [];
            
            // Close profile modal
            this.closeModals();
            
            // Show welcome screen
            const welcomeScreen = document.getElementById('welcomeScreen');
            welcomeScreen.classList.add('show');
            
            // Hide menu and map
            document.querySelector('.menu').classList.remove('show');
            document.getElementById('map').style.visibility = 'hidden';
            
            this.showToast('You have been logged out', 'info');
        } catch (error) {
            console.error('Logout failed:', error);
            this.showToast('Failed to logout. Please try again.', 'error');
        }
    },

    toggleAuthForm(type) {
        document.getElementById('loginForm').classList.toggle('active', type === 'login');
        document.getElementById('signupForm').classList.toggle('active', type === 'signup');
    },

    async handleSignup(event) {
        event.preventDefault();
        const name = document.getElementById('signupName').value.trim();
        const email = document.getElementById('signupEmail').value.trim();
        const password = document.getElementById('signupPassword').value;

        try {
            const result = await DB.signUp(email, password, name);
            
            if (result.needsEmailConfirmation) {
                this.showToast(
                    'Please check your email to confirm your account before logging in',
                    'info',
                    10000 // Show for 10 seconds
                );
                // Switch to login form
                this.toggleAuthForm('login');
                return;
            }

            STATE.user = result;
            this.startApp();
        } catch (error) {
            console.error('Signup failed:', error);
            this.showToast(error.message, 'error');
        }
    },

    async handleLogin(event) {
        event.preventDefault();
        const email = document.getElementById('loginEmail').value.trim();
        const password = document.getElementById('loginPassword').value;

        try {
            const user = await DB.login(email, password);
            if (!user) {
                this.showToast('Invalid login credentials', 'error');
                return;
            }
            STATE.user = user;
            this.startApp();
        } catch (error) {
            console.error('Login failed:', error);
            this.showToast(
                error.message === 'Invalid login credentials'
                    ? 'Invalid email or password'
                    : error.message,
                'error'
            );
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

// Update the loadSavedData function
const loadSavedData = async () => {
    try {
        // Load all events
        const events = await DB.getEvents();
        STATE.events = events || [];

        // Reset user state
        STATE.user = {
            id: null,
            name: '',
            createdEvents: [],
            interestedEvents: []
        };
        STATE.locationPermission = false;
    } catch (error) {
        console.error('Error loading saved data:', error);
        STATE.events = [];
    }
};

// Initialize the app
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await loadSavedData();
        await MapManager.init();
        
        const welcomeScreen = document.getElementById('welcomeScreen');
        const map = document.getElementById('map');
        const menu = document.querySelector('.menu');
        
        // Always show welcome screen on initial load
        welcomeScreen.classList.add('show');
        map.style.visibility = 'hidden';
        menu.style.display = 'none';
        
    } catch (error) {
        console.error('App initialization failed:', error);
    }
});

// Handle errors globally
window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    alert('An error occurred. Please refresh the page.');
});

// Add event listeners
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('signupForm').addEventListener('submit', (e) => UI.handleSignup(e));
    document.getElementById('loginForm').addEventListener('submit', (e) => UI.handleLogin(e));
});
