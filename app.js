// Supabase resource names (kept here so a rename is a one-line change)
const PHOTOS_TABLE = "photos";
const PROMPTS_TABLE = "prompts";
const STORAGE_BUCKET = "scavenger-hunt";

// State variables
let currentPromptIndex = 1; // 1-based position in promptsList (drives navigation)
let currentPrompt = null;   // the resolved prompt object currently on screen
let currentGroupName = "";
let supabaseClient = null;
let realtimeChannel = null;
let promptsList = []; // Loaded from Supabase or prompts.js

// Mock database for Demo Mode
let mockPhotos = [];

// Initialize application
document.addEventListener("DOMContentLoaded", () => {
  initApp();
});

async function initApp() {
  // Check if group is logged in
  const savedGroup = localStorage.getItem("scavenger_group_name");
  
  // Render setup warning if Supabase is not configured
  checkSupabaseSetup();

  // Populate mock data if running in Demo Mode
  if (!isSupabaseConfigured()) {
    initMockData();
    promptsList = JSON.parse(JSON.stringify(SCAVENGER_PROMPTS));
  } else {
    // Initialize Supabase Client
    try {
      supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      await fetchPromptsList();
    } catch (e) {
      console.error("Failed to initialize Supabase:", e);
      promptsList = JSON.parse(JSON.stringify(SCAVENGER_PROMPTS));
    }
  }

  if (savedGroup) {
    currentGroupName = savedGroup;
    document.getElementById("badge-group-name").textContent = currentGroupName;
    showScreen("hunt-screen");
    loadPrompt(currentPromptIndex);
  } else {
    showScreen("join-screen");
  }

  // Setup Event Listeners
  setupEventListeners();
}

async function fetchPromptsList() {
  try {
    let { data, error } = await supabaseClient
      .from(PROMPTS_TABLE)
      .select('*')
      .order('id', { ascending: true });
      
    if (!error && data && data.length > 0) {
      promptsList = data;
    } else {
      promptsList = JSON.parse(JSON.stringify(SCAVENGER_PROMPTS));
    }
  } catch (e) {
    console.warn("Could not load prompts from Supabase, using defaults:", e);
    promptsList = JSON.parse(JSON.stringify(SCAVENGER_PROMPTS));
  }
}

// Display warning banner if configuration is missing
function checkSupabaseSetup() {
  const warningContainer = document.getElementById("setup-warning-container");
  if (!isSupabaseConfigured()) {
    warningContainer.innerHTML = `
      <div class="setup-warning">
        <strong>⚠️ Running in Demo Mode</strong>
        Supabase URL and Anon Key are not configured in <code style="font-weight: 600;">supabase-config.js</code>.
        Your uploads and progress will be saved locally. Check out the README.md to configure your live database!
      </div>
    `;
  } else {
    warningContainer.innerHTML = "";
  }
}

// Populate mock photos to make the UI look alive during local testing
function initMockData() {
  const storedMock = localStorage.getItem("scavenger_mock_photos");
  if (storedMock) {
    mockPhotos = JSON.parse(storedMock);
  } else {
    // Generate dummy photos for different teams to show real-time stream functionality
    const mockTeams = ["Blue Devils", "Neon Ninjas", "Firebirds", "Grave Digger"];
    const baseImages = [
      "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=500&auto=format&fit=crop&q=60",
      "https://images.unsplash.com/photo-1511632765486-a01980e01a18?w=500&auto=format&fit=crop&q=60",
      "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=500&auto=format&fit=crop&q=60"
    ];

    mockPhotos = [];
    
    // Add mock entries for various prompts
    for (let promptIdx = 1; promptIdx <= 15; promptIdx++) {
      // Add photos for some prompts from other teams
      if (promptIdx % 2 === 0 || promptIdx === 1) {
        const teamName = mockTeams[promptIdx % mockTeams.length];
        const imageUrl = baseImages[(promptIdx + teamName.length) % baseImages.length];
        mockPhotos.push({
          id: `mock-${promptIdx}-${teamName}`,
          group_name: teamName,
          prompt_index: promptIdx,
          photo_url: imageUrl,
          created_at: new Date(Date.now() - promptIdx * 3600000).toISOString()
        });
      }
    }
    localStorage.setItem("scavenger_mock_photos", JSON.stringify(mockPhotos));
  }
}

// Show/Hide Screens
function showScreen(screenId) {
  document.querySelectorAll(".screen").forEach(screen => {
    screen.classList.remove("active");
  });
  
  const target = document.getElementById(screenId);
  target.classList.add("active");

  // Show/Hide Sticky Navigation bar
  const navbar = document.getElementById("sticky-nav");
  if (screenId === "hunt-screen") {
    navbar.style.display = "flex";
  } else {
    navbar.style.display = "none";
  }
}

// Event Listeners Registration
function setupEventListeners() {
  // Join Group
  document.getElementById("join-form").addEventListener("submit", (e) => {
    e.preventDefault();
    // Normalize whitespace so "Blue  Devils" and "Blue Devils" are one team
    const groupNameInput = document.getElementById("group-name-input").value.trim().replace(/\s+/g, " ");
    if (groupNameInput) {
      currentGroupName = groupNameInput;
      localStorage.setItem("scavenger_group_name", currentGroupName);
      document.getElementById("badge-group-name").textContent = currentGroupName;
      showScreen("hunt-screen");
      loadPrompt(currentPromptIndex);
    }
  });

  // Nav buttons
  document.getElementById("btn-prev").addEventListener("click", () => {
    if (currentPromptIndex > 1) {
      currentPromptIndex--;
      loadPrompt(currentPromptIndex);
    }
  });

  document.getElementById("btn-next").addEventListener("click", () => {
    if (currentPromptIndex < promptsList.length) {
      currentPromptIndex++;
      loadPrompt(currentPromptIndex);
    }
  });

  // Camera file input trigger
  const fileInput = document.getElementById("camera-input");
  const uploadBox = document.getElementById("upload-trigger");
  
  uploadBox.addEventListener("click", () => {
    fileInput.click();
  });

  fileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
      processAndUploadPhoto(file);
    }
  });

  // Lightbox close
  document.getElementById("lightbox-close").addEventListener("click", () => {
    document.getElementById("lightbox").classList.remove("active");
  });
  
  document.getElementById("lightbox").addEventListener("click", (e) => {
    if (e.target.id === "lightbox") {
      document.getElementById("lightbox").classList.remove("active");
    }
  });

  // Dismiss the lightbox with the Escape key
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      document.getElementById("lightbox").classList.remove("active");
    }
  });
}

// Load Prompt Data and Photos.
// `index` is the 1-based navigation position; the prompt's own `id` is used as the
// stable key for photo records so navigation never breaks on non-contiguous ids.
async function loadPrompt(index) {
  // Update nav buttons disabled state
  document.getElementById("btn-prev").disabled = (index === 1);
  document.getElementById("btn-next").disabled = (index === promptsList.length);

  // Resolve prompt by position (robust even if DB ids have gaps)
  const prompt = promptsList[index - 1];
  if (!prompt) return;
  currentPrompt = prompt;
  const promptKey = prompt.id;

  // Render Prompt Info
  document.getElementById("prompt-num-badge").textContent = `Prompt ${index} of ${promptsList.length}`;
  document.getElementById("prompt-title").textContent = prompt.title;
  document.getElementById("prompt-desc").textContent = prompt.description;

  // Clear Feed Grid and preview
  document.getElementById("feed-grid").innerHTML = "";
  resetUploadBox();

  // Load photos for this prompt
  let photos = [];
  if (isSupabaseConfigured()) {
    photos = await fetchPhotosFromSupabase(promptKey);
    // Guard against a navigation race: if the user moved to another prompt while
    // this fetch was in flight, abandon this (now stale) render.
    if (index !== currentPromptIndex) return;
    subscribeToRealtime(promptKey);
  } else {
    // Demo mode: read from local array
    photos = mockPhotos.filter(p => p.prompt_index === promptKey);
    setupMockRealtimeSimulation(promptKey);
  }

  // Sort photos: newest first
  photos.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  // Check if our team has already uploaded a photo for this prompt
  const ourPhoto = photos.find(p => p.group_name.toLowerCase() === currentGroupName.toLowerCase());
  
  if (ourPhoto) {
    showPhotoPreview(ourPhoto.photo_url);
  }

  // Render other groups' photos to the feed
  const otherPhotos = photos.filter(p => p.group_name.toLowerCase() !== currentGroupName.toLowerCase());
  renderFeed(otherPhotos);
}

// Helper to reset upload box back to initial state
function resetUploadBox() {
  const uploadBox = document.getElementById("upload-trigger");
  uploadBox.className = "upload-box";
  uploadBox.innerHTML = `
    <span class="upload-icon">📸</span>
    <span class="upload-text">Tap to Open Camera</span>
    <span class="upload-subtext">Take and upload a picture</span>
  `;
}

// Render preview in upload box
function showPhotoPreview(url) {
  const uploadBox = document.getElementById("upload-trigger");
  uploadBox.className = "upload-box has-preview";
  uploadBox.replaceChildren();

  const img = document.createElement("img");
  img.className = "preview-image";
  img.src = url;
  img.alt = "My Group Upload";

  const label = document.createElement("div");
  label.className = "retake-label";
  label.textContent = "📸 Retake Photo";

  uploadBox.append(img, label);
}

// Fetch photos from Supabase
async function fetchPhotosFromSupabase(promptIdx) {
  try {
    let { data, error } = await supabaseClient
      .from(PHOTOS_TABLE)
      .select('*')
      .eq('prompt_index', promptIdx);
      
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error("Error fetching photos:", error.message);
    return [];
  }
}

// Subscribe to real-time insertions for the current prompt
function subscribeToRealtime(promptIdx) {
  // Clean up existing subscription
  if (realtimeChannel) {
    supabaseClient.removeChannel(realtimeChannel);
  }

  realtimeChannel = supabaseClient
    .channel(`public:photos:prompt_${promptIdx}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: PHOTOS_TABLE,
        filter: `prompt_index=eq.${promptIdx}`
      },
      (payload) => {
        const newPhoto = payload.new;
        // Verify it isn't our own photo (which we handle immediately)
        if (newPhoto.group_name.toLowerCase() !== currentGroupName.toLowerCase()) {
          addPhotoToFeed(newPhoto);
        }
      }
    )
    .subscribe();
}

// Simulate real-time updates in Demo/Mock Mode
let mockSimulationInterval = null;
function setupMockRealtimeSimulation(promptIdx) {
  if (mockSimulationInterval) {
    clearInterval(mockSimulationInterval);
  }

  // Every 20-30 seconds, simulate another team uploading a photo
  mockSimulationInterval = setInterval(() => {
    const randomChance = Math.random();
    if (randomChance > 0.4) { // 60% chance to simulate upload
      const mockTeams = ["Blue Devils", "Neon Ninjas", "Firebirds", "Grave Digger", "Shadow Syndicate"];
      // Choose team not equal to current group
      let randomTeam = mockTeams[Math.floor(Math.random() * mockTeams.length)];
      if (randomTeam.toLowerCase() === currentGroupName.toLowerCase()) {
        randomTeam = randomTeam + " Jr";
      }

      // Check if team already uploaded for this prompt
      const alreadyUploaded = mockPhotos.find(p => p.prompt_index === promptIdx && p.group_name === randomTeam);
      if (alreadyUploaded) return;

      const randomImages = [
        "https://images.unsplash.com/photo-1542838132-92c53300491e?w=500&auto=format&fit=crop&q=60",
        "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=500&auto=format&fit=crop&q=60",
        "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=500&auto=format&fit=crop&q=60",
        "https://images.unsplash.com/photo-1531482615713-2afd69097998?w=500&auto=format&fit=crop&q=60"
      ];
      const newMockPhoto = {
        id: `mock-realtime-${Date.now()}-${randomTeam}`,
        group_name: randomTeam,
        prompt_index: promptIdx,
        photo_url: randomImages[Math.floor(Math.random() * randomImages.length)],
        created_at: new Date().toISOString()
      };

      // Add to local array
      mockPhotos.push(newMockPhoto);
      localStorage.setItem("scavenger_mock_photos", JSON.stringify(mockPhotos));

      // Append to UI if we are still on this prompt
      if (currentPrompt && currentPrompt.id === promptIdx) {
        addPhotoToFeed(newMockPhoto);
      }
    }
  }, 25000);
}

// Render photo list to feed grid
function renderFeed(photos) {
  const feedGrid = document.getElementById("feed-grid");
  
  if (photos.length === 0) {
    feedGrid.innerHTML = `
      <div class="empty-feed">
        No other groups have uploaded photos for this prompt yet. Be the first to share, or wait for updates!
      </div>
    `;
    return;
  }

  photos.forEach(photo => {
    appendPhotoElement(photo, feedGrid);
  });
}

// Append single photo card to feed.
// Built with DOM APIs (not innerHTML) so group names — which are free text typed
// by any participant — can never inject markup/script into other players' devices.
function appendPhotoElement(photo, container) {
  const card = document.createElement("div");
  card.className = "feed-item";
  card.addEventListener("click", () => openLightbox(photo.photo_url));

  const img = document.createElement("img");
  img.className = "feed-img";
  img.src = photo.photo_url;
  img.alt = `${photo.group_name} Capture`;
  img.loading = "lazy";
  img.onerror = () => { card.style.display = "none"; };

  const overlay = document.createElement("div");
  overlay.className = "feed-overlay";

  const nameSpan = document.createElement("span");
  nameSpan.className = "feed-group-name";
  nameSpan.textContent = photo.group_name;

  const timeSpan = document.createElement("span");
  timeSpan.className = "feed-time";
  timeSpan.textContent = formatTime(photo.created_at);

  overlay.append(nameSpan, timeSpan);
  card.append(img, overlay);
  container.prepend(card);
}

// Add real-time photo to feed
function addPhotoToFeed(photo) {
  const feedGrid = document.getElementById("feed-grid");
  
  // Remove empty feed message if it exists
  const emptyFeed = feedGrid.querySelector(".empty-feed");
  if (emptyFeed) {
    feedGrid.innerHTML = "";
  }
  
  appendPhotoElement(photo, feedGrid);
}

// Format date relative to now
function formatTime(isoString) {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Lightbox controller
function openLightbox(url) {
  const lightbox = document.getElementById("lightbox");
  const img = document.getElementById("lightbox-img");
  img.src = url;
  lightbox.classList.add("active");
}

/* Image Optimization & Upload Controller */
function processAndUploadPhoto(file) {
  // Show spinner
  const uploadBox = document.getElementById("upload-trigger");
  uploadBox.className = "upload-box";
  uploadBox.innerHTML = `
    <div class="spinner"></div>
    <span class="upload-text" style="margin-top: 12px;">Optimizing Image...</span>
    <span class="upload-subtext">Compressing file for quick upload</span>
  `;

  // Recover gracefully if the file can't be read or decoded (e.g. corrupt or
  // an unsupported format) instead of leaving the spinner stuck forever.
  const failUpload = (msg) => {
    console.error(msg);
    alert(msg + " Please try a different photo.");
    resetUploadBox();
  };

  // Compress using Canvas API
  const reader = new FileReader();
  reader.onerror = () => failUpload("Could not read that image file.");
  reader.readAsDataURL(file);
  reader.onload = (event) => {
    const img = new Image();
    img.onerror = () => failUpload("Could not load that image — it may be corrupt or an unsupported format.");
    img.src = event.target.result;
    img.onload = () => {
      // Target max dimension
      const MAX_WIDTH = 1024;
      const MAX_HEIGHT = 1024;
      let width = img.width;
      let height = img.height;

      // Calculate scale ratio
      if (width > height) {
        if (width > MAX_WIDTH) {
          height = Math.round((height * MAX_WIDTH) / width);
          width = MAX_WIDTH;
        }
      } else {
        if (height > MAX_HEIGHT) {
          width = Math.round((width * MAX_HEIGHT) / height);
          height = MAX_HEIGHT;
        }
      }

      // Draw to canvas
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);

      // Export as high quality compressed JPEG
      const compressedDataUrl = canvas.toDataURL("image/jpeg", 0.85);

      if (isSupabaseConfigured()) {
        uploadToSupabase(compressedDataUrl);
      } else {
        // Save Mock Upload in Demo Mode
        setTimeout(() => {
          saveMockUpload(compressedDataUrl);
        }, 1000); // Small timeout to show spinner
      }
    };
  };
}

// Save photo details to local array (Demo Mode)
function saveMockUpload(dataUrl) {
  const promptKey = currentPrompt.id;
  const newPhoto = {
    id: `mock-upload-${Date.now()}`,
    group_name: currentGroupName,
    prompt_index: promptKey,
    photo_url: dataUrl,
    created_at: new Date().toISOString()
  };

  // Remove previous upload of our own for this prompt if exists
  mockPhotos = mockPhotos.filter(
    p => !(p.prompt_index === promptKey && p.group_name.toLowerCase() === currentGroupName.toLowerCase())
  );

  mockPhotos.push(newPhoto);
  localStorage.setItem("scavenger_mock_photos", JSON.stringify(mockPhotos));

  // Show UI changes
  showPhotoPreview(dataUrl);
  
  // Reload current feed (to fetch other groups correctly)
  loadPrompt(currentPromptIndex);
}

// Convert data URL to Blob for upload
function dataURLtoBlob(dataurl) {
  let arr = dataurl.split(','), mime = arr[0].match(/:(.*?);/)[1],
      bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);
  while(n--){
      u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], {type:mime});
}

// Upload Blob to Supabase Storage and Insert row to DB
async function uploadToSupabase(dataUrl) {
  try {
    const uploadBox = document.getElementById("upload-trigger");
    uploadBox.innerHTML = `
      <div class="spinner"></div>
      <span class="upload-text" style="margin-top: 12px;">Uploading to Server...</span>
      <span class="upload-subtext">Saving image to database</span>
    `;

    const promptKey = currentPrompt.id;
    const blob = dataURLtoBlob(dataUrl);
    // Deterministic path (no timestamp): upsert overwrites the group's prior
    // image for this prompt instead of leaving an orphaned file in the bucket.
    const groupSlug = currentGroupName.toLowerCase().replace(/[^a-z0-9]+/g, "_");
    const filePath = `photos/prompt_${promptKey}_${groupSlug}.jpg`;

    // Upload to Supabase Storage
    let { error: storageError } = await supabaseClient
      .storage
      .from(STORAGE_BUCKET)
      .upload(filePath, blob, {
        cacheControl: '3600',
        upsert: true,
        contentType: 'image/jpeg'
      });

    if (storageError) throw storageError;

    // Get Public URL. Because the path is now stable, append a cache-buster so the
    // uploader (and the CDN) fetch the freshly uploaded image rather than a cached one.
    const { data: { publicUrl } } = supabaseClient
      .storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(filePath);
    const freshUrl = `${publicUrl}?t=${Date.now()}`;

    // Delete existing record for our group on this prompt to allow overriding
    await supabaseClient
      .from(PHOTOS_TABLE)
      .delete()
      .eq('prompt_index', promptKey)
      .eq('group_name', currentGroupName);

    // Save record to DB
    const { error: dbError } = await supabaseClient
      .from(PHOTOS_TABLE)
      .insert([
        {
          group_name: currentGroupName,
          prompt_index: promptKey,
          photo_url: freshUrl
        }
      ]);

    if (dbError) throw dbError;

    // Success styling and load prompt
    showPhotoPreview(freshUrl);
    loadPrompt(currentPromptIndex);

  } catch (error) {
    console.error("Upload failed:", error);
    alert("Upload failed! Details: " + (error.message || error));
    resetUploadBox();
  }
}
