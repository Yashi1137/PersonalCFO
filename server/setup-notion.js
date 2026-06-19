import { Client } from '@notionhq/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ENV_PATH = path.join(__dirname, '.env');

// Run this script using: node setup-notion.js <NOTION_TOKEN> <PARENT_PAGE_ID>
const args = process.argv.slice(2);
const token = args[0] || process.env.NOTION_INTEGRATION_TOKEN;
const parentPageId = args[1];

if (!token || !parentPageId) {
  console.error("Usage: node setup-notion.js <NOTION_INTEGRATION_TOKEN> <PARENT_PAGE_ID>");
  console.error("Please provide both your Notion integration token and the ID of the parent page.");
  process.exit(1);
}

const notion = new Client({ auth: token });

async function createDatabase(parentPageId, title, properties) {
  try {
    console.log(`Creating database "${title}"...`);
    const db = await notion.databases.create({
      parent: { page_id: parentPageId },
      title: [{ type: 'text', text: { content: title } }],
      properties
    });
    console.log(`✓ Created database "${title}" with ID: ${db.id}`);
    return db.id;
  } catch (err) {
    console.error(`Error creating database "${title}":`, err.message);
    throw err;
  }
}

async function run() {
  console.log("Connecting to Notion API...");
  
  try {
    // 1. Create Emails DB
    const emailsDbId = await createDatabase(parentPageId, "Pikachu Emails DB", {
      Name: { title: {} },
      Sender: { rich_text: {} },
      Date: { date: {} },
      Category: {
        select: {
          options: [
            { name: "Financial Transaction" },
            { name: "Bill" },
            { name: "Subscription" },
            { name: "Banking Alert" },
            { name: "Personal" },
            { name: "Work" },
            { name: "Shopping" },
            { name: "Travel" },
            { name: "Delivery/Order" },
            { name: "Promotional" },
            { name: "Spam" },
            { name: "Other" }
          ]
        }
      },
      Importance: {
        select: {
          options: [
            { name: "Critical" },
            { name: "High" },
            { name: "Medium" },
            { name: "Low" }
          ]
        }
      },
      ShortSummary: { rich_text: {} },
      DetailedSummary: { rich_text: {} },
      ActionItems: { rich_text: {} },
      IsTransaction: { checkbox: {} }
    });

    // 2. Create Transactions DB
    const transactionsDbId = await createDatabase(parentPageId, "Pikachu Transactions DB", {
      Name: { title: {} },
      Amount: { number: { format: "number" } },
      Type: {
        select: {
          options: [
            { name: "DEBIT" },
            { name: "CREDIT" }
          ]
        }
      },
      Category: {
        select: {
          options: [
            { name: "Food" },
            { name: "Transportation" },
            { name: "Shopping" },
            { name: "Utilities" },
            { name: "Entertainment" },
            { name: "Health" },
            { name: "Education" },
            { name: "Travel" },
            { name: "Investments" },
            { name: "Subscriptions" },
            { name: "Transfers" },
            { name: "Others" }
          ]
        }
      },
      Date: { date: {} },
      RefNo: { rich_text: {} },
      Bank: { rich_text: {} },
      // Link to Emails Database
      Email: {
        relation: {
          database_id: emailsDbId,
          single_property: {}
        }
      }
    });

    // 3. Create Budgets DB
    const budgetsDbId = await createDatabase(parentPageId, "Pikachu Budgets DB", {
      Name: { title: {} },
      Limit: { number: { format: "number" } },
      Spent: { number: { format: "number" } }
    });

    // 4. Create Subscriptions DB
    const subscriptionsDbId = await createDatabase(parentPageId, "Pikachu Subscriptions DB", {
      Name: { title: {} },
      Cost: { number: { format: "number" } },
      BillingCycle: {
        select: {
          options: [
            { name: "Monthly" },
            { name: "Yearly" }
          ]
        }
      },
      NextRenewal: { date: {} },
      Active: { checkbox: {} }
    });

    // 5. Create Bills DB
    const billsDbId = await createDatabase(parentPageId, "Pikachu Bills DB", {
      Name: { title: {} },
      Amount: { number: { format: "number" } },
      DueDate: { date: {} },
      Status: {
        select: {
          options: [
            { name: "Paid" },
            { name: "Unpaid" }
          ]
        }
      }
    });

    // Write database configurations to .env file
    console.log("Writing database configurations to .env file...");
    let envContent = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, 'utf8') : '';
    
    // Replace values
    const updates = {
      NOTION_INTEGRATION_TOKEN: token,
      NOTION_TRANSACTIONS_DB_ID: transactionsDbId,
      NOTION_EMAILS_DB_ID: emailsDbId,
      NOTION_BUDGETS_DB_ID: budgetsDbId,
      NOTION_SUBSCRIPTIONS_DB_ID: subscriptionsDbId,
      NOTION_BILLS_DB_ID: billsDbId
    };

    Object.entries(updates).forEach(([key, val]) => {
      const regex = new RegExp(`^#?\\s*${key}=.*$`, 'gm');
      if (envContent.match(regex)) {
        envContent = envContent.replace(regex, `${key}=${val}`);
      } else {
        envContent += `\n${key}=${val}`;
      }
    });

    fs.writeFileSync(ENV_PATH, envContent.trim() + '\n');
    console.log("✓ Successfully configured database settings in server/.env!");
    console.log("Your Pikachu CFO is fully connected to your Notion Cloud Workspace!");

    // Seed budgets DB default values
    const categories = ['Food', 'Transportation', 'Shopping', 'Utilities', 'Entertainment', 'Health', 'Travel', 'Investments', 'Subscriptions', 'Others'];
    console.log("Seeding default categories in Budgets DB...");
    for (const cat of categories) {
      await notion.pages.create({
        parent: { database_id: budgetsDbId },
        properties: {
          Name: { title: [{ text: { content: cat } }] },
          Limit: { number: 3000 },
          Spent: { number: 0 }
        }
      });
    }
    console.log("✓ Budgets seeded successfully.");

  } catch (err) {
    console.error("Database setup aborted:", err.message);
  }
}

run();
