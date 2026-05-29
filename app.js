// State variables
let currentPromptIndex = 1;
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
      .from('prompts')
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
        Supabase URL and Anon Key are not configured in <a href="file:///Users/joannasmith/.gemini/antigravity/scratch/photo-scavenger-hunt/supabase-config.js" style="color: inherit; font-weight: 600;">supabase-config.js</a>. 
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
    const groupNameInput = document.getElementById("group-name-input").value.trim();
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
}

// Load Prompt Data and Photos
async function loadPrompt(index) {
  // Update nav buttons disabled state
  document.getElementById("btn-prev").disabled = (index === 1);
  document.getElementById("btn-next").disabled = (index === promptsList.length);
  
  // Find prompt details
  const prompt = promptsList.find(p => p.id === index);
  if (!prompt) return;

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
    photos = await fetchPhotosFromSupabase(index);
    subscribeToRealtime(index);
  } else {
    // Demo mode: read from local array
    photos = mockPhotos.filter(p => p.prompt_index === index);
    setupMockRealtimeSimulation(index);
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
  uploadBox.innerHTML = `
    <img src="${url}" class="preview-image" alt="My Group Upload">
    <div style="position: absolute; bottom: 12px; background: rgba(0,0,0,0.75); padding: 6px 12px; border-radius: 12px; font-size: 0.8rem; font-weight: 600; color: #f472b6;">
      📸 Retake Photo
    </div>
  `;
}

// Fetch photos from Supabase
async function fetchPhotosFromSupabase(promptIdx) {
  try {
    let { data, error } = await supabaseClient
      .from('photos')
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
        table: 'photos',
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
      if (currentPromptIndex === promptIdx) {
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

// Append single photo card to feed
function appendPhotoElement(photo, container) {
  const card = document.createElement("div");
  card.className = "feed-item";
  card.addEventListener("click", () => openLightbox(photo.photo_url));

  const timeString = formatTime(photo.created_at);

  card.innerHTML = `
    <img src="${photo.photo_url}" class="feed-img" alt="${photo.group_name} Capture" loading="lazy">
    <div class="feed-overlay">
      <span class="feed-group-name">${photo.group_name}</span>
      <span class="feed-time">${timeString}</span>
    </div>
  `;
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

  // Compress using Canvas API
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = (event) => {
    const img = new Image();
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
  const newPhoto = {
    id: `mock-upload-${Date.now()}`,
    group_name: currentGroupName,
    prompt_index: currentPromptIndex,
    photo_url: dataUrl,
    created_at: new Date().toISOString()
  };

  // Remove previous upload of our own for this prompt if exists
  mockPhotos = mockPhotos.filter(
    p => !(p.prompt_index === currentPromptIndex && p.group_name.toLowerCase() === currentGroupName.toLowerCase())
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

    const blob = dataURLtoBlob(dataUrl);
    const fileName = `prompt_${currentPromptIndex}_${currentGroupName.replace(/\s+/g, '_')}_${Date.now()}.jpg`;
    const filePath = `photos/${fileName}`;

    // Upload to Supabase Storage
    let { error: storageError, data: storageData } = await supabaseClient
      .storage
      .from('scavenger-hunt')
      .upload(filePath, blob, {
        cacheControl: '3600',
        upsert: true,
        contentType: 'image/jpeg'
      });

    if (storageError) throw storageError;

    // Get Public URL
    const { data: { publicUrl } } = supabaseClient
      .storage
      .from('scavenger-hunt')
      .getPublicUrl(filePath);

    // Delete existing record for our group on this prompt to allow overriding
    await supabaseClient
      .from('photos')
      .delete()
      .eq('prompt_index', currentPromptIndex)
      .eq('group_name', currentGroupName);

    // Save record to DB
    const { error: dbError } = await supabaseClient
      .from('photos')
      .insert([
        { 
          group_name: currentGroupName, 
          prompt_index: currentPromptIndex, 
          photo_url: publicUrl 
        }
      ]);

    if (dbError) throw dbError;

    // Success styling and load prompt
    showPhotoPreview(publicUrl);
    loadPrompt(currentPromptIndex);

  } catch (error) {
    console.error("Upload failed:", error);
    alert("Upload failed! Details: " + (error.message || error));
    resetUploadBox();
  }
}
