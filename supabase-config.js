// Initialize Supabase client
const supabaseUrl = 'https://kzyceeqstjerepiyoorg.supabase.co'  // Replace with your project URL
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt6eWNlZXFzdGplcmVwaXlvb3JnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDAyMzIzMzgsImV4cCI6MjA1NTgwODMzOH0.41MZt1GBamJPP7e5LiSoU7_CKBMm2nnNtar1rnzjGy8'     // Replace with your anon key
const supabase = supabaseClient.createClient(supabaseUrl, supabaseKey)

// Database service
const DB = {
    async createUser(userData) {
        try {
            const { data, error } = await supabase
                .from('users')
                .insert([{
                    name: userData.name,
                    created_events: [],
                    interested_events: []
                }])
                .select()
            
            if (error) {
                console.error('Error creating user:', error)
                throw error
            }
            return data[0]
        } catch (error) {
            console.error('Error in createUser:', error)
            throw error
        }
    },

    async getUserByName(name) {
        const { data, error } = await supabase
            .from('users')
            .select()
            .eq('name', name)
            .single()
        
        if (error && error.code !== 'PGRST116') throw error
        return data
    },

    async createEvent(eventData) {
        const { data, error } = await supabase
            .from('events')
            .insert([{
                title: eventData.title,
                description: eventData.description,
                date: eventData.date,
                time: eventData.time,
                category: eventData.category,
                lat: eventData.lat,
                lng: eventData.lng,
                creator_id: eventData.creator,
                creator_name: eventData.creatorName,
                interested_users: []
            }])
            .select()
        
        if (error) throw error
        return data[0]
    },

    async getEvents() {
        const { data, error } = await supabase
            .from('events')
            .select()
        
        if (error) throw error
        return data
    },

    async updateUserEvents(userId, updates) {
        const { data, error } = await supabase
            .from('users')
            .update(updates)
            .eq('id', userId)
            .select()
        
        if (error) throw error
        return data[0]
    },

    async showInterest(eventId, userId, interested) {
        const { data: event, error: eventError } = await supabase
            .from('events')
            .select('interested_users')
            .eq('id', eventId)
            .single()

        if (eventError) throw eventError

        let interestedUsers = event.interested_users || []
        
        if (interested) {
            interestedUsers.push(userId)
        } else {
            interestedUsers = interestedUsers.filter(id => id !== userId)
        }

        const { error: updateError } = await supabase
            .from('events')
            .update({ interested_users: interestedUsers })
            .eq('id', eventId)

        if (updateError) throw updateError
    },

    async signUp(email, password, name) {
        try {
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: { name } // Store name in auth metadata
                }
            });

            if (authError) throw authError;

            if (authData.user && !authData.user.confirmed_at) {
                return {
                    needsEmailConfirmation: true,
                    email: email
                };
            }

            // Create user profile only after email confirmation
            const { data: userData, error: userError } = await supabase
                .from('users')
                .insert([{
                    id: authData.user.id,
                    name: name,
                    created_events: [],
                    interested_events: []
                }])
                .select()
                .single();

            if (userError) throw userError;
            return userData;
        } catch (error) {
            throw error;
        }
    },

    async login(email, password) {
        try {
            const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
                email,
                password
            });

            if (authError) {
                if (authError.message.includes('Email not confirmed')) {
                    throw new Error('Please confirm your email before logging in');
                }
                throw authError;
            }

            // Get user profile
            const { data: userData, error: userError } = await supabase
                .from('users')
                .select()
                .eq('id', authData.user.id)
                .single();

            if (userError) throw userError;
            return userData;
        } catch (error) {
            throw error;
        }
    },

    async logout() {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
    }
} 
