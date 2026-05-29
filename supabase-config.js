// Replace these with your actual Supabase Project details
// You can find these in your Supabase Dashboard -> Project Settings -> API
const SUPABASE_URL = "";
const SUPABASE_ANON_KEY = "";

// Helper to check if credentials are configured
function isSupabaseConfigured() {
  return SUPABASE_URL !== "" && SUPABASE_ANON_KEY !== "";
}
