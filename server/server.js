import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import multer from 'multer';

import { 
  configureDatabase, 
  getEmails, 
  addEmail, 
  getTransactions, 
  addTransaction, 
  deleteTransaction, 
  updateTransactionCategory,
  updateTransactionSplit,
  getRoommateBalances,
  getBudgets,
  updateBudget,
  getSubscriptions,
  addSubscription,
  deleteSubscription,
  getBills,
  addBill,
  deleteBill,
  updateBillStatus,
  clearAllLocalDb,
  loadMockDataset,
  getMockModeStatus
} from './notion.js';

import { 
  configureAgent, 
  analyzeEmail, 
  analyzeReceiptFile,
  chatAgent, 
  cfoAgent, 
  digestAgent 
} from './agent.js';

dotenv.config();

const upload = multer({ storage: multer.memoryStorage() });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const RULES_FILE_PATH = path.join(__dirname, 'category_rules.json');

// Initialize Express
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Category rules database (keeps track of category correction learning)
let categoryRules = {};
if (fs.existsSync(RULES_FILE_PATH)) {
  try {
    categoryRules = JSON.parse(fs.readFileSync(RULES_FILE_PATH, 'utf8'));
  } catch (err) {
    console.error("Error reading category rules, using empty object:", err);
  }
}

function saveCategoryRules() {
  try {
    fs.writeFileSync(RULES_FILE_PATH, JSON.stringify(categoryRules, null, 2));
  } catch (err) {
    console.error("Error saving category rules:", err);
  }
}

// ----------------------------------------------------
// Core Integration routes
// ----------------------------------------------------

app.post('/api/process-email', upload.any(), async (req, res) => {
  const { subject = 'No Subject', body = '', sender = 'Unknown', date = new Date().toISOString() } = req.body;
  
  try {
    console.log(`Processing incoming email: "${subject}" from ${sender}`);
    let savedEmail = null;
    let savedTxn = null;
    let savedSub = null;
    let savedBill = null;
    let analysis = null;

    const file = req.files && req.files[0];
    if (file) {
      console.log(`Email has attachment: ${file.originalname} (${file.mimetype}). Parsing attachment...`);
      // 1. Analyze PDF/image attachment using Gemini Receipt Agent
      const parsedReceipt = await analyzeReceiptFile(file.buffer, file.mimetype);
      console.log("Gemini parsed receipt from attachment:", parsedReceipt);

      // 2. Add a simple Email record for logging
      savedEmail = await addEmail({
        subject,
        sender,
        date,
        category: 'Financial Transaction',
        importance: 'High',
        shortSummary: `Receipt processed: ${parsedReceipt.merchant}`,
        detailedSummary: `Automatically processed receipt attachment "${file.originalname}". Merchant: ${parsedReceipt.merchant}, Amount: ₹${parsedReceipt.amount}.`,
        actionItems: parsedReceipt.isBill ? `Pay invoice from ${parsedReceipt.merchant} by ${parsedReceipt.dueDate}` : '',
        isTransaction: !parsedReceipt.isBill
      });

      // 3. Process Transaction or Bill based on parser results
      if (parsedReceipt.isBill) {
        savedBill = await addBill({
          name: parsedReceipt.merchant || 'Unknown Merchant',
          amount: parsedReceipt.amount || 0,
          dueDate: parsedReceipt.dueDate || new Date().toISOString().split('T')[0],
          status: 'Unpaid'
        });
      } else {
        let txnCategory = parsedReceipt.category || 'Others';
        const merchantKey = (parsedReceipt.merchant || '').toLowerCase();
        
        // Apply categorization preference
        if (categoryRules[merchantKey]) {
          txnCategory = categoryRules[merchantKey];
        }

        savedTxn = await addTransaction({
          merchant: parsedReceipt.merchant || 'Unknown Merchant',
          amount: parsedReceipt.amount || 0,
          type: parsedReceipt.type || 'DEBIT',
          category: txnCategory,
          date: parsedReceipt.date || date,
          refNo: parsedReceipt.refNo || '',
          bank: parsedReceipt.bank || 'Email Attachment',
          emailId: savedEmail.id
        });
      }

      analysis = {
        category: 'Financial Transaction',
        importance: 'High',
        shortSummary: `Receipt processed: ${parsedReceipt.merchant}`,
        detailedSummary: `Successfully extracted financial details from attachment.`,
        isTransaction: !parsedReceipt.isBill,
        transaction: parsedReceipt.isBill ? null : parsedReceipt,
        isBill: parsedReceipt.isBill,
        bill: parsedReceipt.isBill ? parsedReceipt : null
      };

    } else {
      // Fallback to text email analysis
      if (!subject && !body) {
        return res.status(400).json({ error: "Missing subject or body in request payload." });
      }

      // 1. Run Email Intelligence Agent
      analysis = await analyzeEmail({ subject, body, sender, date });
      
      // 2. Add Email record
      savedEmail = await addEmail({
        subject,
        sender,
        date,
        category: analysis.category,
        importance: analysis.importance,
        shortSummary: analysis.shortSummary,
        detailedSummary: analysis.detailedSummary,
        actionItems: analysis.actionItems,
        isTransaction: analysis.isTransaction
      });

      // 3. Process Transaction if detected
      if (analysis.isTransaction && analysis.transaction) {
        let txnCategory = analysis.transaction.category || 'Others';
        const merchantName = analysis.transaction.merchant.toLowerCase();
        
        if (categoryRules[merchantName]) {
          txnCategory = categoryRules[merchantName];
        }

        savedTxn = await addTransaction({
          merchant: analysis.transaction.merchant,
          amount: analysis.transaction.amount,
          type: analysis.transaction.type,
          category: txnCategory,
          date: analysis.transaction.date || date,
          refNo: analysis.transaction.refNo,
          bank: analysis.transaction.bank,
          emailId: savedEmail.id
        });
      }

      // 4. Process Subscription if detected
      if (analysis.isSubscription && analysis.subscription) {
        savedSub = await addSubscription({
          name: analysis.subscription.name,
          cost: analysis.subscription.cost,
          billingCycle: analysis.subscription.billingCycle,
          nextRenewal: analysis.subscription.nextRenewal
        });
      }

      // 5. Process Bill if detected
      if (analysis.isBill && analysis.bill) {
        savedBill = await addBill({
          name: analysis.bill.name,
          amount: analysis.bill.amount,
          dueDate: analysis.bill.dueDate,
          status: 'Unpaid'
        });
      }
    }

    res.json({
      success: true,
      email: savedEmail,
      transaction: savedTxn,
      subscription: savedSub,
      bill: savedBill,
      analysis
    });
  } catch (err) {
    console.error("Error processing email webhook:", err);
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// UI Data APIs
// ----------------------------------------------------

app.get('/api/dashboard', async (req, res) => {
  try {
    const transactions = await getTransactions();
    const budgets = await getBudgets();
    const subscriptions = await getSubscriptions();
    const bills = await getBills();
    
    // Group categories spent for SVG Chart
    const totalSpent = transactions.filter(t => t.type === 'DEBIT').reduce((acc, c) => acc + c.amount, 0);
    const totalIncome = transactions.filter(t => t.type === 'CREDIT').reduce((acc, c) => acc + c.amount, 0);
    const unpaidBills = bills.filter(b => b.status === 'Unpaid').length;
    const activeSubs = subscriptions.filter(s => s.active).length;

    // Calculate budget health score
    let healthScore = 100;
    budgets.forEach(b => {
      if (b.limit > 0) {
        const usage = b.spent / b.limit;
        if (usage > 1.0) healthScore -= 15;
        else if (usage > 0.8) healthScore -= 5;
      }
    });
    healthScore = Math.max(10, healthScore);

    res.json({
      totalSpent,
      totalIncome,
      unpaidBills,
      activeSubs,
      healthScore,
      isMockMode: getMockModeStatus()
    });
  } catch (err) {
    console.error("Dashboard aggregation failed:", err);
    res.status(500).json({ error: err.message });
  }
});

// Ledger routes
app.get('/api/transactions', async (req, res) => {
  try {
    const data = await getTransactions();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/transactions/categorize', async (req, res) => {
  const { id, category, merchant } = req.body;
  if (!id || !category) return res.status(400).json({ error: "Missing id or category." });

  try {
    const updated = await updateTransactionCategory(id, category);
    
    // Learn User Category correction
    if (merchant) {
      const merchantKey = merchant.toLowerCase();
      categoryRules[merchantKey] = category;
      saveCategoryRules();
      console.log(`User Category Learning Updated: "${merchantKey}" -> "${category}"`);
    }

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/transactions/:id', async (req, res) => {
  try {
    const response = await deleteTransaction(req.params.id);
    res.json(response);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Roommate Split routes
app.get('/api/roommates/balances', async (req, res) => {
  try {
    const balances = await getRoommateBalances();
    res.json(balances);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/transactions/split', async (req, res) => {
  const { id, split, roommate, paidBy } = req.body;
  if (!id) return res.status(400).json({ error: "Missing transaction id." });

  try {
    const updated = await updateTransactionSplit(id, { split, roommate, paidBy });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/roommates/settle', async (req, res) => {
  const { roommate, amount, paidBy } = req.body;
  if (!roommate) return res.status(400).json({ error: "Missing roommate name." });
  
  try {
    const txn = await addTransaction({
      merchant: `Settle Up: ${paidBy === 'Me' ? 'Paid' : 'Received from'} ${roommate}`,
      amount: Math.abs(amount) * 2,
      type: paidBy === 'Me' ? 'DEBIT' : 'CREDIT',
      category: 'Others',
      date: new Date().toISOString(),
      split: true,
      roommate: roommate,
      paidBy: paidBy
    });
    res.json({ success: true, transaction: txn });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Receipt File Ingestion route
app.post('/api/process-file', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded." });
  }

  try {
    console.log(`Processing uploaded file: ${req.file.originalname} (${req.file.mimetype})`);
    
    // Parse using Gemini
    const parsed = await analyzeReceiptFile(req.file.buffer, req.file.mimetype);
    console.log("Gemini parsed receipt file:", parsed);

    let savedTxn = null;
    let savedBill = null;

    if (parsed.isBill) {
      savedBill = await addBill({
        name: parsed.merchant || 'Unknown Merchant',
        amount: parsed.amount || 0,
        dueDate: parsed.dueDate || new Date().toISOString().split('T')[0],
        status: 'Unpaid'
      });
    } else {
      savedTxn = await addTransaction({
        merchant: parsed.merchant || 'Unknown Merchant',
        amount: parsed.amount || 0,
        type: parsed.type || 'DEBIT',
        category: parsed.category || 'Others',
        date: parsed.date || new Date().toISOString(),
        refNo: parsed.refNo || '',
        bank: parsed.bank || 'Receipt Upload'
      });
    }

    res.json({
      success: true,
      parsed,
      transaction: savedTxn,
      bill: savedBill
    });
  } catch (err) {
    console.error("Error processing file upload:", err);
    res.status(500).json({ error: err.message });
  }
});

// Emails routes
app.get('/api/emails', async (req, res) => {
  try {
    const data = await getEmails();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Budgets routes
app.get('/api/budgets', async (req, res) => {
  try {
    const data = await getBudgets();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/budgets', async (req, res) => {
  const { category, limit } = req.body;
  try {
    const updated = await updateBudget(category, limit);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Subscriptions routes
app.get('/api/subscriptions', async (req, res) => {
  try {
    const data = await getSubscriptions();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/subscriptions', async (req, res) => {
  try {
    const data = await addSubscription(req.body);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/subscriptions/:id', async (req, res) => {
  try {
    const response = await deleteSubscription(req.params.id);
    res.json(response);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Bills routes
app.get('/api/bills', async (req, res) => {
  try {
    const data = await getBills();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/bills', async (req, res) => {
  try {
    const data = await addBill(req.body);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/bills/:id/status', async (req, res) => {
  const { status } = req.body;
  try {
    const data = await updateBillStatus(req.params.id, status);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/bills/:id', async (req, res) => {
  try {
    const response = await deleteBill(req.params.id);
    res.json(response);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Settings Config routes
app.post('/api/settings', async (req, res) => {
  const { geminiApiKey, notionToken, databaseIds } = req.body;
  
  try {
    // Reconfigure database connections
    configureDatabase({
      notionToken,
      databaseIds
    });
    
    // Reconfigure Gemini agent
    configureAgent(geminiApiKey);
    
    res.json({ success: true, isMockMode: getMockModeStatus() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// Agent Cognitive APIs
// ----------------------------------------------------

app.post('/api/chat', async (req, res) => {
  const { query, history } = req.body;
  
  try {
    const transactions = await getTransactions();
    const budgets = await getBudgets();
    const subscriptions = await getSubscriptions();
    const bills = await getBills();
    const emails = await getEmails();

    const context = {
      transactions: transactions.slice(0, 50), // Send last 50 transactions to save tokens
      budgets,
      subscriptions,
      bills,
      recentEmails: emails.slice(0, 15)
    };

    const reply = await chatAgent(query, history, context);
    res.json({ reply });
  } catch (err) {
    console.error("Chat agent request failed:", err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/insights', async (req, res) => {
  try {
    const transactions = await getTransactions();
    const budgets = await getBudgets();
    const subscriptions = await getSubscriptions();
    const bills = await getBills();

    const context = { transactions, budgets, subscriptions, bills };
    const insights = await cfoAgent(context);
    res.json(insights);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/digest', async (req, res) => {
  const { type = 'weekly' } = req.query;
  
  try {
    const transactions = await getTransactions();
    const budgets = await getBudgets();
    const subscriptions = await getSubscriptions();
    const bills = await getBills();
    const emails = await getEmails();

    const context = { transactions, budgets, subscriptions, bills, emails };
    const digest = await digestAgent(type, context);
    res.json({ digest });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// Demo Simulation APIs
// ----------------------------------------------------

app.post('/api/simulate-bulk', async (req, res) => {
  const mockDataset = {
    emails: [
      {
        id: "m_email_1",
        subject: "Alert: UPI Transaction of Rs 450.00 done on SBI A/c 1234 to Swiggy",
        sender: "alerts@sbi.co.in",
        date: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
        category: "Financial Transaction",
        importance: "Medium",
        shortSummary: "₹450 spent on Swiggy.",
        detailedSummary: "Your SBI account ending in 1234 was debited by ₹450 through UPI to Swiggy. Remaining balance: ₹15,670.",
        actionItems: "",
        isTransaction: true
      },
      {
        id: "m_email_2",
        subject: "Your Electricity Bill of Rs 2,450.00 is due on 28-06-2026",
        sender: "billing@bescom.org",
        date: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), // 1 day ago
        category: "Bill",
        importance: "High",
        shortSummary: "Electricity bill of ₹2,450 due soon.",
        detailedSummary: "Electricity bill for consumer no 89302 amounting to ₹2,450 is due on 28-06-2026.",
        actionItems: "Pay electricity bill of ₹2,450 before 2026-06-28.",
        isTransaction: false
      },
      {
        id: "m_email_3",
        subject: "Netflix Subscription Renewal Confirmation",
        sender: "info@netflix.com",
        date: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(), // 2 days ago
        category: "Subscription",
        importance: "Medium",
        shortSummary: "Netflix subscription renewed.",
        detailedSummary: "Your Netflix Premium membership was auto-renewed for ₹649. Next billing date: 2026-07-19.",
        actionItems: "Netflix subscription will auto-renew on 2026-07-19 for ₹649.",
        isTransaction: true
      },
      {
        id: "m_email_4",
        subject: "Invitation to interview: Software Engineer at Stripe",
        sender: "recruiting@stripe.com",
        date: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(), // 3 days ago
        category: "Work",
        importance: "Critical",
        shortSummary: "Interview invitation from Stripe.",
        detailedSummary: "You are invited for a technical panel interview on Monday at 3:00 PM IST via Google Meet.",
        actionItems: "Attend interview on Monday at 3:00 PM via Google Meet link.",
        isTransaction: false
      },
      {
        id: "m_email_5",
        subject: "Your Amazon.in order of Rs 1,299.00 has been shipped",
        sender: "auto-confirm@amazon.in",
        date: new Date(Date.now() - 1000 * 60 * 60 * 96).toISOString(), // 4 days ago
        category: "Delivery/Order",
        importance: "Medium",
        shortSummary: "Amazon order shipped.",
        detailedSummary: "Your order containing 'Wireless Ergonomic Mouse' has been shipped and is scheduled to arrive tomorrow.",
        actionItems: "Receive Amazon package tomorrow.",
        isTransaction: false
      },
      {
        id: "m_email_6",
        subject: "Transaction Alert: ₹1,500.00 debited from HDFC A/c 5678 to Uber India",
        sender: "alerts@hdfcbank.com",
        date: new Date(Date.now() - 1000 * 60 * 60 * 120).toISOString(), // 5 days ago
        category: "Financial Transaction",
        importance: "Medium",
        shortSummary: "₹1,500 spent on Uber.",
        detailedSummary: "Account ending 5678 debited ₹1,500 via UPI to Uber India. Ref: 6182903.",
        actionItems: "",
        isTransaction: true
      },
      {
        id: "m_email_7",
        subject: "SBI Card: Alert! ₹8,990.00 spent on Amazon India",
        sender: "alerts@sbicard.com",
        date: new Date(Date.now() - 1000 * 60 * 60 * 150).toISOString(), // 6 days ago
        category: "Financial Transaction",
        importance: "High",
        shortSummary: "₹8,990 spent on Amazon via SBI Card.",
        detailedSummary: "SBI Credit card ending in 7890 debited for ₹8,990 on Amazon India. Remaining limit: ₹1,42,000.",
        actionItems: "",
        isTransaction: true
      },
      {
        id: "m_email_8",
        subject: "Salary credited: ₹75,000.00 credited to SBI A/c 1234",
        sender: "alerts@sbi.co.in",
        date: new Date(Date.now() - 1000 * 60 * 60 * 200).toISOString(), // 8 days ago
        category: "Financial Transaction",
        importance: "High",
        shortSummary: "Salary of ₹75,000 credited.",
        detailedSummary: "Your monthly salary of ₹75,000 was credited to your SBI account. Remaining balance: ₹90,220.",
        actionItems: "",
        isTransaction: true
      }
    ],
    transactions: [
      {
        id: "m_txn_1",
        merchant: "Swiggy",
        amount: 450.00,
        type: "DEBIT",
        category: "Food",
        date: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
        refNo: "UPI893209382901",
        bank: "SBI",
        emailId: "m_email_1"
      },
      {
        id: "m_txn_2",
        merchant: "Netflix",
        amount: 649.00,
        type: "DEBIT",
        category: "Subscriptions",
        date: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
        refNo: "UPI617290382912",
        bank: "HDFC",
        emailId: "m_email_3"
      },
      {
        id: "m_txn_3",
        merchant: "Uber India",
        amount: 1500.00,
        type: "DEBIT",
        category: "Transportation",
        date: new Date(Date.now() - 1000 * 60 * 60 * 120).toISOString(),
        refNo: "UPI618290382900",
        bank: "HDFC",
        emailId: "m_email_6"
      },
      {
        id: "m_txn_4",
        merchant: "Amazon India",
        amount: 8990.00,
        type: "DEBIT",
        category: "Shopping",
        date: new Date(Date.now() - 1000 * 60 * 60 * 150).toISOString(),
        refNo: "SBI993029302930",
        bank: "SBI Card",
        emailId: "m_email_7"
      },
      {
        id: "m_txn_5",
        merchant: "Company Salary",
        amount: 75000.00,
        type: "CREDIT",
        category: "Others",
        date: new Date(Date.now() - 1000 * 60 * 60 * 200).toISOString(),
        refNo: "SBISAL893029302",
        bank: "SBI",
        emailId: "m_email_8"
      },
      {
        id: "m_txn_6",
        merchant: "Starbucks Coffee",
        amount: 320.00,
        type: "DEBIT",
        category: "Food",
        date: new Date(Date.now() - 1000 * 60 * 60 * 250).toISOString(),
        refNo: "UPI419203920392",
        bank: "SBI",
        emailId: null
      },
      {
        id: "m_txn_7",
        merchant: "Spotify Premium",
        amount: 119.00,
        type: "DEBIT",
        category: "Subscriptions",
        date: new Date(Date.now() - 1000 * 60 * 60 * 300).toISOString(),
        refNo: "UPI419039209382",
        bank: "SBI",
        emailId: null
      }
    ],
    budgets: [
      { category: 'Food', limit: 5000, spent: 770 },
      { category: 'Transportation', limit: 3000, spent: 1500 },
      { category: 'Shopping', limit: 10000, spent: 8990 },
      { category: 'Utilities', limit: 4000, spent: 0 },
      { category: 'Entertainment', limit: 3000, spent: 0 },
      { category: 'Health', limit: 1500, spent: 0 },
      { category: 'Travel', limit: 5000, spent: 0 },
      { category: 'Investments', limit: 10000, spent: 0 },
      { category: 'Subscriptions', limit: 2000, spent: 768 },
      { category: 'Others', limit: 5000, spent: 0 }
    ],
    subscriptions: [
      {
        id: "m_sub_1",
        name: "Netflix",
        cost: 649.00,
        billingCycle: "Monthly",
        nextRenewal: "2026-07-19",
        active: true
      },
      {
        id: "m_sub_2",
        name: "Spotify Premium",
        cost: 119.00,
        billingCycle: "Monthly",
        nextRenewal: "2026-07-08",
        active: true
      }
    ],
    bills: [
      {
        id: "m_bill_1",
        name: "Electricity Bill",
        amount: 2450.00,
        dueDate: "2026-06-28",
        status: "Unpaid"
      }
    ]
  };

  try {
    await loadMockDataset(mockDataset);
    console.log("Bulk Mock sandbox loaded successfully.");
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/clear-db', async (req, res) => {
  try {
    await clearAllLocalDb();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start Express Server
app.listen(PORT, () => {
  console.log(`Financial OS Backend Server running on http://localhost:${PORT}`);
});
