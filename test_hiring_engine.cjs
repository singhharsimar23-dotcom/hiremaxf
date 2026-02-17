
const { createClient } = require('@supabase/supabase-js');

// These should be set in your environment or replaced with actual values for testing
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://ssuknybhzcuusjardsve.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNzdWtueWJoemN1dXNqYXJkc3ZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxNDY1MTIsImV4cCI6MjA4NDcyMjUxMn0.9XaUxtMi3btKZIA_sXQCNJI20-iwruxXISr2J1Kmr-g';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testHiringEngine() {
    console.log("Testing Hiring Engine...");

    try {
        const { data, error } = await supabase.functions.invoke('hiring-engine', {
            body: {
                action: '/intent/resolve',
                role_normalized: 'Software Engineer',
                seniority: 'Senior',
                location_raw: 'Remote'
            },
            headers: {
                'x-action': '/intent/resolve',
                'x-client-info': 'hiremax-test-script'
            },
        });

        if (error) {
            console.error("Function Invocation Error:", error);
        } else {
            console.log("Function Response:", data);
        }
    } catch (err) {
        console.error("Unexpected Error:", err);
    }
}

testHiringEngine();
