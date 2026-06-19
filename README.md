# ⚡ Pikachu Personal CFO & Financial Operating System

Pikachu CFO is a playful, AI-powered Personal CFO and Expense Splitter. It reads bank transaction emails/alerts, parses uploaded invoices and PDF receipts using Gemini 2.5 Flash, and automatically logs everything into your private Notion Workspace. 

It also includes a flat-pastel dashboard with light/dark toggles, an AI Chat CFO Assistant, and a Roommate Splitter ledger.

---

## 🚀 Quick Setup Guide for Friends (Scenario B)

If you want to run your own copy of Pikachu CFO, follow these simple steps to link it to your own Notion and n8n workspaces.

### 📋 Prerequisites
1. **Node.js** (v18+) installed.
2. A **GitHub** account.
3. A **Notion** account.
4. A **Google AI Studio** account (for a free Gemini API Key).
5. An **n8n** account (for email automation triggers).

---

### 🛠️ Step 1: Fork & Clone the Repository
1. Go to `https://github.com/Yashi1137/PersonalCFO` and click **Fork** to create a copy in your own account.
2. Clone your forked repository:
   ```bash
   git clone https://github.com/YOUR_USERNAME/PersonalCFO.git
   cd PersonalCFO
   ```

---

### 🔑 Step 2: Notion Setup
1. Go to [Notion Integrations](https://developers.notion.com/) and click **+ New Integration**. Name it "Pikachu CFO Integration" and copy the **Internal Integration Token**.
2. Open your Notion account, create a new blank page named "My Financial OS", and **Share/Connect** it with your newly created integration.
3. Run the setup script to automatically build all databases (Emails, Transactions, Budgets, Subscriptions, Bills) on your Notion page:
   ```bash
   cd server
   npm install
   node setup-notion.js <YOUR_NOTION_INTEGRATION_TOKEN> <YOUR_PARENT_PAGE_ID>
   ```
   *(Note: The page ID is the 32-character code at the end of your Notion page URL).*
4. This script will automatically create the databases and save the credentials into a local `server/.env` file.

---

### 🧠 Step 3: Configure Gemini API
1. Get a free API Key from [Google AI Studio](https://aistudio.google.com/).
2. Open the `server/.env` file created in the previous step and set your key:
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   ```

---

### 🔄 Step 4: Configure n8n Ingestion Pipelines
1. Set up an n8n instance (you can use n8n Cloud or run it locally).
2. **Email Ingestion**: Import the [n8n_workflow.json](n8n_workflow.json) file at the root of the project into n8n. This workflow automatically checks your IMAP email account for bank alerts and forwards them (including PDF attachments) to your local server.
3. **Telegram Bot (Optional)**: Import [n8n_telegram_workflow.json](n8n_telegram_workflow.json) to chat with Pikachu and log expenses on the go.

---

### 💻 Step 5: Start the App
1. Go back to the project root and install all dependencies:
   ```bash
   npm run install-all
   ```
2. Start both the React client and Express server concurrently:
   ```bash
   npm run dev
   ```
3. Open your browser to [http://localhost:5173](http://localhost:5173) and start managing your finances!

---

## 🎨 Features
* **Pika-CFO Mascot**: Reacts visually to your financial health based on your budgets.
* **Timeline Feed**: Unified chronological list of transaction alerts, utility bills, and emails.
* **Roommate Splitter**: Toggle split checkbox on any transaction card, type a roommate's name, select who paid, and track net balances. Click **Settle Up** to log offset payments.
* **Multimodal Receipt Upload**: Upload image/PDF receipts directly in the UI. Gemini will extract values and log them automatically.
