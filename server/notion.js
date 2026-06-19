import { Client } from '@notionhq/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });
const DB_FILE_PATH = path.join(__dirname, 'db.json');

// In-Memory / File Fallback Database Structure
const defaultDb = {
  emails: [],
  transactions: [],
  budgets: [
    { category: 'Food', limit: 5000, spent: 0 },
    { category: 'Transportation', limit: 2000, spent: 0 },
    { category: 'Shopping', limit: 8000, spent: 0 },
    { category: 'Utilities', limit: 4000, spent: 0 },
    { category: 'Entertainment', limit: 3000, spent: 0 },
    { category: 'Health', limit: 1500, spent: 0 },
    { category: 'Travel', limit: 5000, spent: 0 },
    { category: 'Investments', limit: 10000, spent: 0 },
    { category: 'Subscriptions', limit: 1500, spent: 0 },
    { category: 'Others', limit: 3000, spent: 0 }
  ],
  subscriptions: [],
  bills: []
};

// Ensure db.json exists
if (!fs.existsSync(DB_FILE_PATH)) {
  fs.writeFileSync(DB_FILE_PATH, JSON.stringify(defaultDb, null, 2));
}

// Local File DB Helper
function readLocalDb() {
  try {
    const data = fs.readFileSync(DB_FILE_PATH, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error("Error reading local db, resetting to default:", err);
    return defaultDb;
  }
}

function writeLocalDb(data) {
  try {
    fs.writeFileSync(DB_FILE_PATH, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Error writing local db:", err);
  }
}

// Notion client references
let notion = null;
let dbIds = {
  transactions: '',
  emails: '',
  budgets: '',
  subscriptions: '',
  bills: ''
};
let isMockMode = true;

async function ensureNotionSchema() {
  if (isMockMode || !notion || !dbIds.transactions) return;
  try {
    console.log("Checking and updating Notion Transactions DB schema for split properties...");
    await notion.databases.update({
      database_id: dbIds.transactions,
      properties: {
        Split: { checkbox: {} },
        Roommate: { rich_text: {} },
        PaidBy: {
          select: {
            options: [
              { name: 'Me' },
              { name: 'Roommate' }
            ]
          }
        }
      }
    });
    console.log("✓ Notion Transactions DB schema updated/verified successfully.");
  } catch (err) {
    console.warn("Could not auto-verify/update Notion Transactions DB schema. Ensure properties 'Split' (Checkbox), 'Roommate' (Text), and 'PaidBy' (Select) exist in your Notion table.", err.message);
  }
}

export function configureDatabase(config) {
  if (config.notionToken && config.databaseIds && config.databaseIds.transactions) {
    try {
      notion = new Client({ auth: config.notionToken });
      dbIds = config.databaseIds;
      isMockMode = false;
      console.log("Notion client configured successfully. Switching to Notion Mode.");
      ensureNotionSchema();
    } catch (err) {
      console.error("Failed to initialize Notion client, running in Mock Mode:", err);
      isMockMode = true;
    }
  } else {
    isMockMode = true;
    console.log("No Notion credentials provided. Running in Local Mock Database Mode.");
  }
}

// Check configuration on load (using process.env as default)
configureDatabase({
  notionToken: process.env.NOTION_INTEGRATION_TOKEN,
  databaseIds: {
    transactions: process.env.NOTION_TRANSACTIONS_DB_ID,
    emails: process.env.NOTION_EMAILS_DB_ID,
    budgets: process.env.NOTION_BUDGETS_DB_ID,
    subscriptions: process.env.NOTION_SUBSCRIPTIONS_DB_ID,
    bills: process.env.NOTION_BILLS_DB_ID
  }
});

export function getMockModeStatus() {
  return isMockMode;
}

// ----------------------------------------------------
// Emails Database APIs
// ----------------------------------------------------
export async function getEmails() {
  if (isMockMode) {
    return readLocalDb().emails;
  }

  try {
    const response = await notion.databases.query({
      database_id: dbIds.emails,
      sorts: [{ property: 'Date', direction: 'descending' }]
    });

    return response.results.map(page => ({
      id: page.id,
      subject: page.properties.Name?.title[0]?.plain_text || 'No Subject',
      sender: page.properties.Sender?.rich_text[0]?.plain_text || 'Unknown',
      date: page.properties.Date?.date?.start || '',
      category: page.properties.Category?.select?.name || 'Other',
      importance: page.properties.Importance?.select?.name || 'Low',
      shortSummary: page.properties.ShortSummary?.rich_text[0]?.plain_text || '',
      detailedSummary: page.properties.DetailedSummary?.rich_text[0]?.plain_text || '',
      actionItems: page.properties.ActionItems?.rich_text[0]?.plain_text || '',
      isTransaction: page.properties.IsTransaction?.checkbox || false
    }));
  } catch (err) {
    console.error("Error querying Notion Emails DB, falling back to local:", err);
    return readLocalDb().emails;
  }
}

export async function addEmail(email) {
  const localDb = readLocalDb();
  const id = isMockMode ? `email_${Date.now()}` : null;
  const newEmail = {
    id: id || '',
    subject: email.subject || 'No Subject',
    sender: email.sender || 'Unknown',
    date: email.date || new Date().toISOString(),
    category: email.category || 'Other',
    importance: email.importance || 'Low',
    shortSummary: email.shortSummary || '',
    detailedSummary: email.detailedSummary || '',
    actionItems: Array.isArray(email.actionItems) ? email.actionItems.join('\n') : (email.actionItems || ''),
    isTransaction: !!email.isTransaction
  };

  // Always write to local db as backup/cache
  localDb.emails.unshift(newEmail);
  writeLocalDb(localDb);

  if (isMockMode) {
    return newEmail;
  }

  try {
    const response = await notion.pages.create({
      parent: { database_id: dbIds.emails },
      properties: {
        Name: { title: [{ text: { content: newEmail.subject } }] },
        Sender: { rich_text: [{ text: { content: newEmail.sender } }] },
        Date: { date: { start: newEmail.date } },
        Category: { select: { name: newEmail.category } },
        Importance: { select: { name: newEmail.importance } },
        ShortSummary: { rich_text: [{ text: { content: newEmail.shortSummary } }] },
        DetailedSummary: { rich_text: [{ text: { content: newEmail.detailedSummary } }] },
        ActionItems: { rich_text: [{ text: { content: newEmail.actionItems } }] },
        IsTransaction: { checkbox: newEmail.isTransaction }
      }
    });
    newEmail.id = response.id;
    return newEmail;
  } catch (err) {
    console.error("Error adding page to Notion Emails DB:", err);
    return newEmail;
  }
}

// ----------------------------------------------------
// Transactions Database APIs
// ----------------------------------------------------
export async function getTransactions() {
  if (isMockMode) {
    return readLocalDb().transactions;
  }

  try {
    const response = await notion.databases.query({
      database_id: dbIds.transactions,
      sorts: [{ property: 'Date', direction: 'descending' }]
    });

    return response.results.map(page => ({
      id: page.id,
      merchant: page.properties.Name?.title?.[0]?.plain_text || 'Unknown',
      amount: page.properties.Amount?.number || 0,
      type: page.properties.Type?.select?.name || 'DEBIT',
      category: page.properties.Category?.select?.name || 'Others',
      date: page.properties.Date?.date?.start || '',
      refNo: page.properties.RefNo?.rich_text?.[0]?.plain_text || '',
      bank: page.properties.Bank?.rich_text?.[0]?.plain_text || '',
      emailId: page.properties.Email?.relation?.[0]?.id || null,
      split: page.properties.Split?.checkbox || false,
      roommate: page.properties.Roommate?.rich_text?.[0]?.plain_text || '',
      paidBy: page.properties.PaidBy?.select?.name || page.properties.PaidBy?.rich_text?.[0]?.plain_text || 'Me'
    }));
  } catch (err) {
    console.error("Error querying Notion Transactions DB, falling back to local:", err);
    return readLocalDb().transactions;
  }
}

export async function addTransaction(txn) {
  const localDb = readLocalDb();
  
  // Deduplication check
  const duplicate = localDb.transactions.find(t => 
    (txn.refNo && t.refNo === txn.refNo) || 
    (Math.abs(t.amount - txn.amount) < 0.01 && t.merchant === txn.merchant && Math.abs(new Date(t.date) - new Date(txn.date)) < 1000 * 60 * 30) // 30 min window same amount/merchant
  );
  
  if (duplicate) {
    console.log("Duplicate transaction detected. Skipping insert.", txn.merchant, txn.amount);
    return duplicate;
  }

  const id = isMockMode ? `txn_${Date.now()}` : null;
  const newTxn = {
    id: id || '',
    merchant: txn.merchant || 'Unknown',
    amount: parseFloat(txn.amount) || 0,
    type: txn.type || 'DEBIT',
    category: txn.category || 'Others',
    date: txn.date || new Date().toISOString(),
    refNo: txn.refNo || '',
    bank: txn.bank || '',
    emailId: txn.emailId || null,
    split: txn.split !== undefined ? !!txn.split : false,
    roommate: txn.roommate || '',
    paidBy: txn.paidBy || 'Me'
  };

  localDb.transactions.unshift(newTxn);
  
  // Update local budget spent
  if (newTxn.type === 'DEBIT') {
    const budget = localDb.budgets.find(b => b.category.toLowerCase() === newTxn.category.toLowerCase());
    if (budget) {
      budget.spent += newTxn.amount;
    } else {
      const otherBudget = localDb.budgets.find(b => b.category === 'Others');
      if (otherBudget) otherBudget.spent += newTxn.amount;
    }
  }

  writeLocalDb(localDb);

  if (isMockMode) {
    return newTxn;
  }

  try {
    const properties = {
      Name: { title: [{ text: { content: newTxn.merchant } }] },
      Amount: { number: newTxn.amount },
      Type: { select: { name: newTxn.type } },
      Category: { select: { name: newTxn.category } },
      Date: { date: { start: newTxn.date } },
      RefNo: { rich_text: [{ text: { content: newTxn.refNo } }] },
      Bank: { rich_text: [{ text: { content: newTxn.bank } }] },
      Split: { checkbox: newTxn.split },
      Roommate: { rich_text: [{ text: { content: newTxn.roommate } }] },
      PaidBy: { select: { name: newTxn.paidBy } }
    };

    if (newTxn.emailId) {
      properties.Email = { relation: [{ id: newTxn.emailId }] };
    }

    const response = await notion.pages.create({
      parent: { database_id: dbIds.transactions },
      properties
    });
    newTxn.id = response.id;
    
    // Write local db again to capture the notion id
    writeLocalDb(localDb);
    
    // Attempt to update Notion budgets database if exists
    await syncNotionBudgets();

    return newTxn;
  } catch (err) {
    console.error("Error adding page to Notion Transactions DB:", err);
    return newTxn;
  }
}

export async function updateTransactionSplit(id, { split, roommate, paidBy }) {
  const localDb = readLocalDb();
  const txn = localDb.transactions.find(t => t.id === id);
  if (txn) {
    if (split !== undefined) txn.split = !!split;
    if (roommate !== undefined) txn.roommate = roommate;
    if (paidBy !== undefined) txn.paidBy = paidBy;
    writeLocalDb(localDb);
  }

  if (isMockMode) {
    return txn;
  }

  try {
    const properties = {};
    if (split !== undefined) properties.Split = { checkbox: !!split };
    if (roommate !== undefined) properties.Roommate = { rich_text: [{ text: { content: roommate } }] };
    if (paidBy !== undefined) properties.PaidBy = { select: { name: paidBy } };

    const response = await notion.pages.update({
      page_id: id,
      properties
    });
    
    const result = {
      id: response.id,
      merchant: txn ? txn.merchant : 'Unknown',
      amount: txn ? txn.amount : 0,
      type: txn ? txn.type : 'DEBIT',
      category: txn ? txn.category : 'Others',
      date: txn ? txn.date : new Date().toISOString(),
      refNo: txn ? txn.refNo : '',
      bank: txn ? txn.bank : '',
      emailId: txn ? txn.emailId : null,
      split: split !== undefined ? !!split : (txn ? txn.split : false),
      roommate: roommate !== undefined ? roommate : (txn ? txn.roommate : ''),
      paidBy: paidBy !== undefined ? paidBy : (txn ? txn.paidBy : 'Me')
    };

    // If local txn didn't have ID, update it now in memory and local db
    if (!txn) {
      const updatedLocalDb = readLocalDb();
      // Try to find by date and amount
      const t = updatedLocalDb.transactions.find(x => 
        !x.id && 
        x.merchant === result.merchant && 
        Math.abs(x.amount - result.amount) < 0.01
      );
      if (t) {
        t.id = response.id;
        t.split = result.split;
        t.roommate = result.roommate;
        t.paidBy = result.paidBy;
        writeLocalDb(updatedLocalDb);
      }
    }

    return result;
  } catch (err) {
    console.error("Error updating Notion transaction split properties:", err);
    return txn;
  }
}

export async function getRoommateBalances() {
  const transactions = await getTransactions();
  const roommateBalances = {};

  for (const txn of transactions) {
    if (txn.split && txn.roommate) {
      const roommateName = txn.roommate.trim();
      if (!roommateName) continue;
      
      const amount = txn.amount || 0;
      const share = amount / 2;
      const paidBy = txn.paidBy || 'Me';
      
      if (!roommateBalances[roommateName]) {
        roommateBalances[roommateName] = 0;
      }
      
      if (paidBy === 'Me') {
        // Roommate owes you 50%
        roommateBalances[roommateName] += share;
      } else if (paidBy === 'Roommate') {
        // You owe roommate 50%
        roommateBalances[roommateName] -= share;
      }
    }
  }

  // Format into a list of balances
  return Object.entries(roommateBalances).map(([roommate, amount]) => {
    return {
      roommate,
      amount, // positive means roommate owes me, negative means I owe roommate
      status: amount > 0 
        ? `${roommate} owes you ₹${amount.toFixed(2)}` 
        : amount < 0 
          ? `You owe ${roommate} ₹${Math.abs(amount).toFixed(2)}` 
          : `${roommate} and you are settled up`
    };
  });
}

export async function deleteTransaction(id) {
  const localDb = readLocalDb();
  const index = localDb.transactions.findIndex(t => t.id === id);
  if (index !== -1) {
    const deletedTxn = localDb.transactions[index];
    localDb.transactions.splice(index, 1);
    
    // Deduct from budget spent
    if (deletedTxn.type === 'DEBIT') {
      const budget = localDb.budgets.find(b => b.category.toLowerCase() === deletedTxn.category.toLowerCase());
      if (budget) {
        budget.spent = Math.max(0, budget.spent - deletedTxn.amount);
      }
    }
    
    writeLocalDb(localDb);
  }

  if (isMockMode) {
    return { success: true };
  }

  try {
    await notion.pages.update({
      page_id: id,
      archived: true
    });
    await syncNotionBudgets();
    return { success: true };
  } catch (err) {
    console.error("Error deleting Notion transaction page:", err);
    return { success: false, error: err.message };
  }
}

export async function updateTransactionCategory(id, category) {
  const localDb = readLocalDb();
  const txn = localDb.transactions.find(t => t.id === id);
  if (txn) {
    const oldCategory = txn.category;
    txn.category = category;

    // Adjust budgets
    if (txn.type === 'DEBIT') {
      const oldBudget = localDb.budgets.find(b => b.category.toLowerCase() === oldCategory.toLowerCase());
      if (oldBudget) oldBudget.spent = Math.max(0, oldBudget.spent - txn.amount);
      
      const newBudget = localDb.budgets.find(b => b.category.toLowerCase() === category.toLowerCase());
      if (newBudget) newBudget.spent += txn.amount;
    }

    writeLocalDb(localDb);
  }

  if (isMockMode) {
    return txn;
  }

  try {
    const response = await notion.pages.update({
      page_id: id,
      properties: {
        Category: { select: { name: category } }
      }
    });
    await syncNotionBudgets();
    return { ...txn, id: response.id };
  } catch (err) {
    console.error("Error updating Notion transaction category:", err);
    return txn;
  }
}

// ----------------------------------------------------
// Budgets Database APIs
// ----------------------------------------------------
export async function getBudgets() {
  const localDb = readLocalDb();
  if (isMockMode) {
    return localDb.budgets;
  }

  try {
    if (!dbIds.budgets) return localDb.budgets;
    const response = await notion.databases.query({
      database_id: dbIds.budgets
    });

    return response.results.map(page => ({
      id: page.id,
      category: page.properties.Name?.title[0]?.plain_text || '',
      limit: page.properties.Limit?.number || 0,
      spent: page.properties.Spent?.number || 0
    }));
  } catch (err) {
    console.error("Error querying Notion Budgets DB, returning local cache:", err);
    return localDb.budgets;
  }
}

export async function updateBudget(category, limit) {
  const localDb = readLocalDb();
  const budget = localDb.budgets.find(b => b.category.toLowerCase() === category.toLowerCase());
  if (budget) {
    budget.limit = parseFloat(limit);
    writeLocalDb(localDb);
  } else {
    localDb.budgets.push({ category, limit: parseFloat(limit), spent: 0 });
    writeLocalDb(localDb);
  }

  if (isMockMode) {
    return { category, limit };
  }

  try {
    if (!dbIds.budgets) return { category, limit };
    // Find page ID of budget category
    const query = await notion.databases.query({
      database_id: dbIds.budgets,
      filter: {
        property: 'Name',
        title: { equals: category }
      }
    });

    if (query.results.length > 0) {
      const pageId = query.results[0].id;
      await notion.pages.update({
        page_id: pageId,
        properties: {
          Limit: { number: parseFloat(limit) }
        }
      });
    } else {
      // Create new budget page
      await notion.pages.create({
        parent: { database_id: dbIds.budgets },
        properties: {
          Name: { title: [{ text: { content: category } }] },
          Limit: { number: parseFloat(limit) },
          Spent: { number: 0 }
        }
      });
    }
    return { category, limit };
  } catch (err) {
    console.error("Error updating Notion budget:", err);
    return { category, limit };
  }
}

async function syncNotionBudgets() {
  if (isMockMode || !dbIds.budgets) return;
  try {
    // Recalculate spent per category from transactions
    const txns = await getTransactions();
    const debits = txns.filter(t => t.type === 'DEBIT');
    
    const categoryTotals = {};
    debits.forEach(t => {
      categoryTotals[t.category] = (categoryTotals[t.category] || 0) + t.amount;
    });

    const budgetQuery = await notion.databases.query({ database_id: dbIds.budgets });
    
    for (const page of budgetQuery.results) {
      const cat = page.properties.Name?.title[0]?.plain_text;
      const spent = categoryTotals[cat] || 0;
      
      await notion.pages.update({
        page_id: page.id,
        properties: {
          Spent: { number: spent }
        }
      });
    }
  } catch (err) {
    console.error("Error syncing Notion budgets with transactions:", err);
  }
}

// ----------------------------------------------------
// Subscriptions Database APIs
// ----------------------------------------------------
export async function getSubscriptions() {
  const localDb = readLocalDb();
  if (isMockMode) {
    return localDb.subscriptions;
  }

  try {
    if (!dbIds.subscriptions) return localDb.subscriptions;
    const response = await notion.databases.query({
      database_id: dbIds.subscriptions
    });

    return response.results.map(page => ({
      id: page.id,
      name: page.properties.Name?.title[0]?.plain_text || '',
      cost: page.properties.Cost?.number || 0,
      billingCycle: page.properties.BillingCycle?.select?.name || 'Monthly',
      nextRenewal: page.properties.NextRenewal?.date?.start || '',
      active: page.properties.Active?.checkbox || false
    }));
  } catch (err) {
    console.error("Error querying Notion Subscriptions DB, returning local cache:", err);
    return localDb.subscriptions;
  }
}

export async function addSubscription(sub) {
  const localDb = readLocalDb();
  
  // Check if exists
  const existingIndex = localDb.subscriptions.findIndex(s => s.name.toLowerCase() === sub.name.toLowerCase());
  
  const id = isMockMode ? `sub_${Date.now()}` : null;
  const newSub = {
    id: id || '',
    name: sub.name || '',
    cost: parseFloat(sub.cost) || 0,
    billingCycle: sub.billingCycle || 'Monthly',
    nextRenewal: sub.nextRenewal || '',
    active: sub.active !== undefined ? sub.active : true
  };

  if (existingIndex !== -1) {
    localDb.subscriptions[existingIndex] = { ...localDb.subscriptions[existingIndex], ...newSub };
  } else {
    localDb.subscriptions.push(newSub);
  }

  writeLocalDb(localDb);

  if (isMockMode) {
    return newSub;
  }

  try {
    if (!dbIds.subscriptions) return newSub;
    // Check if subscription page already exists in Notion
    const query = await notion.databases.query({
      database_id: dbIds.subscriptions,
      filter: {
        property: 'Name',
        title: { equals: newSub.name }
      }
    });

    if (query.results.length > 0) {
      const pageId = query.results[0].id;
      const response = await notion.pages.update({
        page_id: pageId,
        properties: {
          Cost: { number: newSub.cost },
          BillingCycle: { select: { name: newSub.billingCycle } },
          NextRenewal: { date: { start: newSub.nextRenewal } },
          Active: { checkbox: newSub.active }
        }
      });
      newSub.id = response.id;
    } else {
      const response = await notion.pages.create({
        parent: { database_id: dbIds.subscriptions },
        properties: {
          Name: { title: [{ text: { content: newSub.name } }] },
          Cost: { number: newSub.cost },
          BillingCycle: { select: { name: newSub.billingCycle } },
          NextRenewal: { date: { start: newSub.nextRenewal } },
          Active: { checkbox: newSub.active }
        }
      });
      newSub.id = response.id;
    }
    return newSub;
  } catch (err) {
    console.error("Error adding/updating page in Notion Subscriptions DB:", err);
    return newSub;
  }
}

export async function deleteSubscription(id) {
  const localDb = readLocalDb();
  const index = localDb.subscriptions.findIndex(s => s.id === id);
  if (index !== -1) {
    localDb.subscriptions.splice(index, 1);
    writeLocalDb(localDb);
  }

  if (isMockMode) {
    return { success: true };
  }

  try {
    if (!dbIds.subscriptions) return { success: true };
    await notion.pages.update({
      page_id: id,
      archived: true
    });
    return { success: true };
  } catch (err) {
    console.error("Error deleting Notion subscription page:", err);
    return { success: false, error: err.message };
  }
}

// ----------------------------------------------------
// Bills Database APIs
// ----------------------------------------------------
export async function getBills() {
  const localDb = readLocalDb();
  if (isMockMode) {
    return localDb.bills;
  }

  try {
    if (!dbIds.bills) return localDb.bills;
    const response = await notion.databases.query({
      database_id: dbIds.bills,
      sorts: [{ property: 'DueDate', direction: 'ascending' }]
    });

    return response.results.map(page => ({
      id: page.id,
      name: page.properties.Name?.title[0]?.plain_text || '',
      amount: page.properties.Amount?.number || 0,
      dueDate: page.properties.DueDate?.date?.start || '',
      status: page.properties.Status?.select?.name || 'Unpaid'
    }));
  } catch (err) {
    console.error("Error querying Notion Bills DB, returning local cache:", err);
    return localDb.bills;
  }
}

export async function addBill(bill) {
  const localDb = readLocalDb();
  
  // Check if exists
  const existingIndex = localDb.bills.findIndex(b => b.name.toLowerCase() === bill.name.toLowerCase() && b.dueDate === bill.dueDate);
  
  const id = isMockMode ? `bill_${Date.now()}` : null;
  const newBill = {
    id: id || '',
    name: bill.name || '',
    amount: parseFloat(bill.amount) || 0,
    dueDate: bill.dueDate || '',
    status: bill.status || 'Unpaid'
  };

  if (existingIndex !== -1) {
    localDb.bills[existingIndex] = { ...localDb.bills[existingIndex], ...newBill };
  } else {
    localDb.bills.push(newBill);
  }

  writeLocalDb(localDb);

  if (isMockMode) {
    return newBill;
  }

  try {
    if (!dbIds.bills) return newBill;
    
    // Check if identical active bill exists
    const query = await notion.databases.query({
      database_id: dbIds.bills,
      filter: {
        and: [
          { property: 'Name', title: { equals: newBill.name } },
          { property: 'DueDate', date: { equals: newBill.dueDate } }
        ]
      }
    });

    if (query.results.length > 0) {
      const pageId = query.results[0].id;
      const response = await notion.pages.update({
        page_id: pageId,
        properties: {
          Amount: { number: newBill.amount },
          Status: { select: { name: newBill.status } }
        }
      });
      newBill.id = response.id;
    } else {
      const response = await notion.pages.create({
        parent: { database_id: dbIds.bills },
        properties: {
          Name: { title: [{ text: { content: newBill.name } }] },
          Amount: { number: newBill.amount },
          DueDate: { date: { start: newBill.dueDate } },
          Status: { select: { name: newBill.status } }
        }
      });
      newBill.id = response.id;
    }
    return newBill;
  } catch (err) {
    console.error("Error adding/updating page in Notion Bills DB:", err);
    return newBill;
  }
}

export async function deleteBill(id) {
  const localDb = readLocalDb();
  const index = localDb.bills.findIndex(b => b.id === id);
  if (index !== -1) {
    localDb.bills.splice(index, 1);
    writeLocalDb(localDb);
  }

  if (isMockMode) {
    return { success: true };
  }

  try {
    if (!dbIds.bills) return { success: true };
    await notion.pages.update({
      page_id: id,
      archived: true
    });
    return { success: true };
  } catch (err) {
    console.error("Error deleting Notion bill page:", err);
    return { success: false, error: err.message };
  }
}

export async function updateBillStatus(id, status) {
  const localDb = readLocalDb();
  const bill = localDb.bills.find(b => b.id === id);
  if (bill) {
    bill.status = status;
    writeLocalDb(localDb);
  }

  if (isMockMode) {
    return bill;
  }

  try {
    const response = await notion.pages.update({
      page_id: id,
      properties: {
        Status: { select: { name: status } }
      }
    });
    return { ...bill, id: response.id };
  } catch (err) {
    console.error("Error updating Notion bill status:", err);
    return bill;
  }
}

// ----------------------------------------------------
// Admin APIs
// ----------------------------------------------------
export async function clearAllLocalDb() {
  writeLocalDb(defaultDb);
  return { success: true };
}

export async function loadMockDataset(mockData) {
  writeLocalDb(mockData);
  return { success: true };
}

export async function setupNotionDatabases(token, parentPageId) {
  const notionClient = new Client({ auth: token });

  // 1. Create Emails DB
  console.log("Creating Pikachu Emails DB...");
  const emailsDb = await notionClient.databases.create({
    parent: { page_id: parentPageId },
    title: [{ type: 'text', text: { content: "Pikachu Emails DB" } }],
    properties: {
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
    }
  });

  // 2. Create Transactions DB
  console.log("Creating Pikachu Transactions DB...");
  const transactionsDb = await notionClient.databases.create({
    parent: { page_id: parentPageId },
    title: [{ type: 'text', text: { content: "Pikachu Transactions DB" } }],
    properties: {
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
      Split: { checkbox: {} },
      Roommate: { rich_text: {} },
      PaidBy: {
        select: {
          options: [
            { name: "Me" },
            { name: "Roommate" }
          ]
        }
      },
      Email: {
        relation: {
          database_id: emailsDb.id,
          single_property: {}
        }
      }
    }
  });

  // 3. Create Budgets DB
  console.log("Creating Pikachu Budgets DB...");
  const budgetsDb = await notionClient.databases.create({
    parent: { page_id: parentPageId },
    title: [{ type: 'text', text: { content: "Pikachu Budgets DB" } }],
    properties: {
      Name: { title: {} },
      Limit: { number: { format: "number" } },
      Spent: { number: { format: "number" } }
    }
  });

  // 4. Create Subscriptions DB
  console.log("Creating Pikachu Subscriptions DB...");
  const subscriptionsDb = await notionClient.databases.create({
    parent: { page_id: parentPageId },
    title: [{ type: 'text', text: { content: "Pikachu Subscriptions DB" } }],
    properties: {
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
    }
  });

  // 5. Create Bills DB
  console.log("Creating Pikachu Bills DB...");
  const billsDb = await notionClient.databases.create({
    parent: { page_id: parentPageId },
    title: [{ type: 'text', text: { content: "Pikachu Bills DB" } }],
    properties: {
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
    }
  });

  // Seed default budgets categories
  const categories = ['Food', 'Transportation', 'Shopping', 'Utilities', 'Entertainment', 'Health', 'Travel', 'Investments', 'Subscriptions', 'Others'];
  for (const cat of categories) {
    await notionClient.pages.create({
      parent: { database_id: budgetsDb.id },
      properties: {
        Name: { title: [{ text: { content: cat } }] },
        Limit: { number: 3000 },
        Spent: { number: 0 }
      }
    });
  }

  // Return the configured IDs
  return {
    transactions: transactionsDb.id,
    emails: emailsDb.id,
    budgets: budgetsDb.id,
    subscriptions: subscriptionsDb.id,
    bills: billsDb.id
  };
}
