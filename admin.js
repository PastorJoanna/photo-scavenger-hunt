let supabaseClient = null;
let activePrompts = [];

document.addEventListener("DOMContentLoaded", () => {
  initAdmin();
});

async function initAdmin() {
  if (isSupabaseConfigured()) {
    try {
      supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } catch (e) {
      console.error("Failed to initialize Supabase:", e);
    }
  }

  // Auth Form Submit — real Supabase email/password sign-in.
  document.getElementById("auth-form").addEventListener("submit", handleSignIn);
  document.getElementById("btn-logout").addEventListener("click", handleLogout);

  // Controls Event Listeners
  document.getElementById("btn-add-prompt").addEventListener("click", addNewPromptCard);
  document.getElementById("btn-save-prompts").addEventListener("click", savePromptsToCloud);
  document.getElementById("btn-reset-photos").addEventListener("click", resetPhotosDatabase);
  document.getElementById("btn-load-defaults").addEventListener("click", loadDefaultsInEditor);

  // If a valid session already exists (supabase-js persists it), skip the login screen.
  if (supabaseClient) {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
      showScreen("admin-screen");
      loadAdminData();
    }
  }
}

async function handleSignIn(e) {
  e.preventDefault();

  const errorEl = document.getElementById("auth-error");
  errorEl.style.display = "none";

  if (!supabaseClient) {
    errorEl.textContent = "Admin sign-in requires a live Supabase connection.";
    errorEl.style.display = "block";
    return;
  }

  const email = document.getElementById("admin-email-input").value.trim();
  const password = document.getElementById("admin-password-input").value;

  const btn = document.getElementById("btn-signin");
  btn.disabled = true;
  btn.textContent = "Signing in...";

  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });

  btn.disabled = false;
  btn.textContent = "Sign In 🔑";

  if (error) {
    errorEl.textContent = "Sign-in failed: " + error.message;
    errorEl.style.display = "block";
    return;
  }

  document.getElementById("admin-password-input").value = "";
  showScreen("admin-screen");
  loadAdminData();
}

async function handleLogout() {
  if (supabaseClient) {
    await supabaseClient.auth.signOut();
  }
  showScreen("auth-screen");
}

function showScreen(screenId) {
  document.querySelectorAll(".screen").forEach(screen => {
    screen.classList.remove("active");
  });
  document.getElementById(screenId).classList.add("active");
}

async function loadAdminData() {
  activePrompts = [];
  
  if (isSupabaseConfigured()) {
    try {
      let { data, error } = await supabaseClient
        .from('prompts')
        .select('*')
        .order('id', { ascending: true });
        
      if (!error && data && data.length > 0) {
        activePrompts = data;
      }
    } catch (e) {
      console.warn("Could not load prompts from Supabase, falling back to local defaults:", e);
    }
  }

  // Fallback to local prompts.js list if DB is empty or not configured
  if (activePrompts.length === 0) {
    activePrompts = JSON.parse(JSON.stringify(SCAVENGER_PROMPTS));
  }

  renderPromptsEditor();
}

function renderPromptsEditor() {
  const container = document.getElementById("prompts-list-container");
  container.innerHTML = "";
  
  activePrompts.forEach((prompt, index) => {
    createPromptEditorElement(prompt, index, container);
  });
}

function createPromptEditorElement(prompt, index, container) {
  const div = document.createElement("div");
  div.className = "admin-prompt-editor";
  div.dataset.index = index;

  div.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center;">
      <strong style="color: #a78bfa;">Prompt #${prompt.id || (index + 1)}</strong>
      <button onclick="removePromptCard(${index})" style="background: transparent; border: none; color: #ef4444; font-size: 0.8rem; font-weight: 600; cursor: pointer;">
        ❌ Remove
      </button>
    </div>
    
    <div>
      <label style="font-size: 0.8rem; color: var(--text-secondary); display: block; margin-bottom: 4px;">Prompt Title</label>
      <input type="text" class="prompt-title-input" value="${escapeHtml(prompt.title)}" placeholder="e.g. 1. The Selfie" required>
    </div>
    
    <div>
      <label style="font-size: 0.8rem; color: var(--text-secondary); display: block; margin-bottom: 4px;">Prompt Description</label>
      <textarea class="prompt-desc-input" placeholder="What the teams should snap a picture of..." required>${escapeHtml(prompt.description)}</textarea>
    </div>
  `;
  container.appendChild(div);
}

function addNewPromptCard() {
  // Capture current form inputs first so they aren't wiped out on re-render
  syncActivePromptsArray();

  const nextId = activePrompts.length > 0 ? Math.max(...activePrompts.map(p => p.id)) + 1 : 1;
  
  activePrompts.push({
    id: nextId,
    title: `${nextId}. New Scavenger Challenge`,
    description: "Describe what the team should capture."
  });

  renderPromptsEditor();
}

window.removePromptCard = function(index) {
  syncActivePromptsArray();
  activePrompts.splice(index, 1);
  // Re-normalize indices
  activePrompts.forEach((p, idx) => {
    p.id = idx + 1;
    // Auto rename prompt prefix number if user wants
    if (/^\d+\.\s/.test(p.title)) {
      p.title = p.title.replace(/^\d+\.\s/, `${idx + 1}. `);
    }
  });
  renderPromptsEditor();
};

function syncActivePromptsArray() {
  const container = document.getElementById("prompts-list-container");
  const editors = container.querySelectorAll(".admin-prompt-editor");
  
  activePrompts = Array.from(editors).map((editor, idx) => {
    return {
      id: idx + 1,
      title: editor.querySelector(".prompt-title-input").value.trim(),
      description: editor.querySelector(".prompt-desc-input").value.trim()
    };
  });
}

function loadDefaultsInEditor() {
  if (confirm("Reset current prompts editor back to the default 15 prompts? This will overwrite your inputs.")) {
    activePrompts = JSON.parse(JSON.stringify(SCAVENGER_PROMPTS));
    renderPromptsEditor();
  }
}

async function savePromptsToCloud() {
  syncActivePromptsArray();
  
  if (activePrompts.length === 0) {
    alert("You must have at least one prompt!");
    return;
  }

  if (!isSupabaseConfigured()) {
    alert("Supabase is not configured! Prompt customizations can only be saved to the database in live mode.");
    return;
  }

  const btn = document.getElementById("btn-save-prompts");
  btn.disabled = true;
  btn.textContent = "Saving...";

  try {
    // Delete existing prompts in the DB
    const { error: deleteError } = await supabaseClient
      .from('prompts')
      .delete()
      .gt('id', 0);

    if (deleteError) throw deleteError;

    // Bulk insert new prompts list
    const { error: insertError } = await supabaseClient
      .from('prompts')
      .insert(activePrompts);

    if (insertError) throw insertError;

    alert("Prompts saved successfully! The app will now serve your customized list.");
  } catch (error) {
    console.error("Save prompts failed:", error);
    alert("Failed to save prompts! Details: " + error.message);
  } finally {
    btn.disabled = false;
    btn.textContent = "💾 Save Prompts to Cloud";
  }
}

async function resetPhotosDatabase() {
  if (!confirm("⚠️ WARNING: This will permanently delete all uploaded photo records. Are you sure you want to restart the game?")) {
    return;
  }

  if (!isSupabaseConfigured()) {
    // Local demo reset
    localStorage.removeItem("scavenger_mock_photos");
    alert("Mock testing photos cleared successfully!");
    location.reload();
    return;
  }

  const btn = document.getElementById("btn-reset-photos");
  btn.disabled = true;
  btn.textContent = "Clearing...";

  try {
    const { error } = await supabaseClient
      .from('photos')
      .delete()
      .gt('prompt_index', 0); // Deletes all

    if (error) throw error;
    alert("All uploads cleared successfully! A fresh game is ready to begin.");
  } catch (error) {
    console.error("Reset failed:", error);
    alert("Failed to clear uploads! Details: " + error.message);
  } finally {
    btn.disabled = false;
    btn.textContent = "🗑️ Clear Uploaded Photos";
  }
}

// Utility HTML escape helper
function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
