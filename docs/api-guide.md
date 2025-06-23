# API Integration Guide for Vokan

This guide explains how to add and use APIs in your Vokan app, whether you are calling external APIs or serving static data.

---

## 1. Calling External APIs

**Where:** Use in React components, hooks, or utility files.

**How:**
- Use the `fetch` API or a library like `axios`.
- Store your API base URL in an environment variable (e.g., `NEXT_PUBLIC_API_BASE_URL`).
- Example:
  ```js
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "https://your-api.example.com";
  fetch(`${API_BASE_URL}/api/your-endpoint`, { method: 'GET' })
    .then(res => res.json())
    .then(data => { /* handle data */ });
  ```

**Tips:**
- Always check for errors and handle loading states.
- Never hardcode secrets in the frontend.

---

## 2. Using Static Data (for Static Site Generation)

**Where:** For features like autocomplete or validation, use static JSON files in `public/wordlists/chunks/`.

**How:**
- Fetch static files directly:
  ```js
  fetch(`/wordlists/chunks/a.json`).then(res => res.json());
  ```
- This works both in the browser and during static site generation.

---

## 3. Using Firebase

**Where:** For user authentication and profile data.

**How:**
- Use Firebase SDK functions (not REST API):
  ```js
  import { getUserProfile } from '@/lib/firebase/userProfile';
  const profile = await getUserProfile(user.uid);
  ```

---

## 4. Adding a New API Call

1. Decide if your data comes from:
   - An external API server (use fetch/axios)
   - Static files (put JSON in `public/` and fetch it)
   - Firebase (use SDK)
2. Add your fetch/axios call in a React component, hook, or utility file.
3. Store API URLs in environment variables for flexibility.
4. Handle errors and loading states in your UI.

---

## 5. Example: Check Username Availability

```js
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
fetch(`${API_BASE_URL}/api/check-username?username=${encodeURIComponent(username)}`)
  .then(res => res.json())
  .then(data => {
    if (data.available) {
      // Username is available
    } else {
      // Username is taken
    }
  });
```

---

## 6. Tips
- Use environment variables for all API URLs.
- For static data, put files in `public/` so they are accessible at build and runtime.
- For server-side code (e.g., static generation), you can fetch from your external API at build time.

---

**For more advanced API usage (authentication, POST requests, etc.), see the Next.js and React docs.**
