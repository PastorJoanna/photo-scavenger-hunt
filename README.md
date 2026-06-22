# 📸 Photo Scavenger Hunt PWA

A mobile-responsive, multi-user Progressive Web Application (PWA) with real-time syncing for photo scavenger hunt events. Built with Vanilla HTML, CSS, JS, and powered by Supabase.

## Features

- **PWA Ready**: Installable on Android and iOS devices, with offline-ready static asset caching.
- **Native Camera Access**: Clicking the camera zone prompts the device's native camera application.
- **Client-Side Image Optimization**: Heavy mobile photos are compressed (using HTML5 Canvas) to ~150-250KB before upload, ensuring lightning-fast uploads even on weak mobile networks.
- **Real-Time Sync**: Using Supabase's Realtime subscriptions, groups immediately see photo uploads from other teams for their active prompt.
- **Demo Mode Fallback**: Runs immediately out of the box with simulated live teams and local state if Supabase credentials are not yet entered.

---

## 🛠️ Supabase Configuration Setup

To enable real-time synchronization and database storage, you will need a free Supabase account. Follow these steps:

### 1. Create the Database Tables
In your Supabase Dashboard, open the **SQL Editor** and execute the following SQL. It creates the `photos` and `prompts` tables with **hardened** Row Level Security: anyone can play (read prompts, read/add photos), but only a signed-in admin can edit prompts or delete photos.

```sql
-- Create the photos table
create table photos (
  id uuid default gen_random_uuid() primary key,
  group_name text not null,
  prompt_index integer not null,
  photo_url text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS for photos
alter table photos enable row level security;

-- Players: read the feed and add their own photos. Retakes are insert-only, so
-- no public delete is needed (and the game can't be wiped by a participant).
create policy "photos_public_read"   on photos for select using (true);
create policy "photos_public_insert" on photos for insert with check (true);
-- Only a signed-in admin can clear photos.
create policy "photos_admin_delete"  on photos for delete to authenticated using (true);

-- Create the prompts table
create table prompts (
  id integer primary key,
  title text not null,
  description text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS for prompts
alter table prompts enable row level security;

-- Players: read-only. Only a signed-in admin can add/edit/remove prompts.
create policy "prompts_public_read"  on prompts for select using (true);
create policy "prompts_admin_insert" on prompts for insert to authenticated with check (true);
create policy "prompts_admin_update" on prompts for update to authenticated using (true) with check (true);
create policy "prompts_admin_delete" on prompts for delete to authenticated using (true);
```

### 2. Create the Storage Bucket
The actual image files live in a storage bucket:
1. Navigate to **Storage** in the Supabase sidebar.
2. Click **New Bucket**, name it exactly `scavenger-hunt`, and toggle it **Public** (so image links are viewable).
3. Open the **SQL Editor** and run the following so players can upload (and overwrite their own retakes) but **cannot delete** other groups' image files — only a signed-in admin can:

```sql
-- View images (public)
create policy "scavenger_obj_read" on storage.objects
  for select using (bucket_id = 'scavenger-hunt');
-- Upload images (public)
create policy "scavenger_obj_insert" on storage.objects
  for insert with check (bucket_id = 'scavenger-hunt');
-- Overwrite on retake (public) — the app uploads with upsert
create policy "scavenger_obj_update" on storage.objects
  for update using (bucket_id = 'scavenger-hunt') with check (bucket_id = 'scavenger-hunt');
-- Only a signed-in admin can delete image files
create policy "scavenger_obj_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'scavenger-hunt');
```

### 3. Edit App Configuration
Find your API keys under **Project Settings** -> **API**:
1. Open the file `supabase-config.js` in this folder.
2. Insert your `Project URL` in `SUPABASE_URL`.
3. Insert your `anon public API key` in `SUPABASE_ANON_KEY`.

---

## 🚀 Running Locally

Since the project uses a service worker, you must serve it over an HTTP server (opening `index.html` directly as a file will block service workers). 

You can run the built-in Ruby web server in your terminal:
```bash
ruby -run -e httpd . -p 8080
```
Then open `http://localhost:8080` in your web browser.

---

## ☁️ Deployment to Vercel

Vercel makes deploying static HTML/CSS/JS websites extremely easy:

### Method 1: Vercel CLI (Fastest)
1. Install Vercel CLI globally if you have npm (`npm i -g vercel`) or run directly via `npx vercel`.
2. Run the command:
   ```bash
   vercel
   ```
3. Follow the CLI prompt instructions.

### Method 2: Git Repository (Recommended)
1. Push this folder to a GitHub, GitLab, or Bitbucket repository.
2. Log into [Vercel](https://vercel.com).
3. Click **Add New** -> **Project** and import your repository.
4. Keep the default settings (it will automatically detect the static project) and click **Deploy**.

---

## 🔑 Admin Dashboard

A password-protected admin dashboard is included in the project at `admin.html` (or `your-vercel-domain.com/admin.html` when deployed).

### Features
- **Real Authentication**: The admin panel is gated by Supabase Auth (email + password), not a client-side password. Saving prompts and clearing photos require a signed-in admin, enforced by the database RLS policies above.
- **Customize Prompts**: Change challenge titles and descriptions dynamically.
- **Dynamic Prompt Count**: Add new prompts or remove existing ones. The main PWA dynamically adjusts navigation based on how many prompts are saved.
- **Reset Game**: Delete all current photo uploads to start a fresh game.
- **Initialize Defaults**: Pre-populate the editor with the 15 default prompts.

### Creating the admin user
There is no password to edit in code. Instead, create exactly one admin account in Supabase:
1. In the Supabase Dashboard, go to **Authentication → Users → Add user**.
2. Enter the admin's email and a strong password, and check **Auto Confirm User** so they can sign in immediately.
3. Go to **Authentication → Providers → Email** (or **Sign In / Providers**) and **disable "Allow new users to sign up"**, so no one else can ever create an account that would gain write access.
4. Visit `admin.html`, sign in with that email and password, and you're in. The session persists, so you stay signed in until you choose **Log out**.
