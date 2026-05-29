const SUPABASE_URL = "https://hilwjjykrmyzxjbnnrfx.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhpbHdqanlrcm15enhqYm5ucmZ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwMTI0MTIsImV4cCI6MjA5NTU4ODQxMn0.KvtY-Vba2NQ49uHtp3YUx5Tf23-yaryLJ-il7AAfy7E";

// Helper to check if credentials are configured
function isSupabaseConfigured() {
  return SUPABASE_URL !== "" && SUPABASE_ANON_KEY !== "";
}
