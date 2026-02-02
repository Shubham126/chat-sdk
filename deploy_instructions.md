# How to Deploy Chatbot SDK to Vercel

Follow these steps to deploy your Chatbot SDK to Vercel's global CDN.

## Prerequisite
Ensure you have the Vercel CLI installed or use the Vercel Dashboard.

## Option 1: Deploy via CLI (Recommended for quick update)
1.  Open a terminal in the `chatbot-sdk` folder:
    ```bash
    cd chatbot-sdk
    ```
2.  Run the deploy command:
    ```bash
    npx vercel deploy --prod
    ```
3.  Follow the prompts (accept defaults).

## Option 2: Deploy via GitHub
1.  Push your code to GitHub.
2.  Go to [Vercel Dashboard](https://vercel.com/dashboard).
3.  Click **"Add New..."** -> **"Project"**.
4.  Import your repository.
5.  **Important**: configuring the "Root Directory".
    - If your repo only contains the SDK, leave it blank.
    - If your repo contains the whole project, select `chatbot-sdk` as the Root Directory by clicking "Edit" next to "Root Directory".
6.  Click **Deploy**.

## Usage
Once deployed, Vercel will give you a domain (e.g., `https://your-sdk.vercel.app`).
Structure your script tag like this:

```html
<script 
    src="https://your-sdk.vercel.app/chatbot-sdk.js" 
    data-api-key="YOUR_API_KEY"
></script>
```
