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

### 1. Create the Database Table
In your Supabase Dashboard, open the **SQL Editor** and execute the following SQL script to create the `photos` table and setup Row Level Security (RLS) allowing anyone to read/write:

```sql
-- Create the photos table
create table photos (
  id uuid default gen_random_uuid() primary key,
  group_name text not null,
  prompt_index integer not null,
  photo_url text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security (RLS)
alter table photos enable row level security;

-- Create policies for public access (perfect for a casual group event)
create policy "Allow public read access" on photos
  for select using (true);

create policy "Allow public insert access" on photos
  for insert with check (true);
  
create policy "Allow public delete access" on photos
  for delete using (true);
```

### 2. Create the Storage Bucket
We need a storage bucket to host the actual image uploads:
1. Navigate to **Storage** in the Supabase Sidebar.
2. Click **New Bucket**.
3. Name it exactly `scavenger-hunt`.
4. Make sure to toggle the bucket as **Public** (so anyone can view image links).
5. In **Bucket Policies**, create a policy that grants full read, write, and delete permissions to the public:
   - Under **Allowed Operations**, check `SELECT`, `INSERT`, and `DELETE`.
   - Set the policy target to `Public` or check `true` for all operations.

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
