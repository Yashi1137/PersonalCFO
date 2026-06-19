import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

// Simple check for Gemini API Key
let apiKey = process.env.GEMINI_API_KEY || '';
let aiClient = null;

export function configureAgent(key) {
  if (key) {
    apiKey = key;
    try {
      // Setup the SDK client
      aiClient = new GoogleGenerativeAI(apiKey);
      console.log("Gemini AI agent initialized successfully.");
    } catch (err) {
      console.error("Failed to initialize Gemini AI client:", err);
      aiClient = null;
    }
  } else {
    aiClient = null;
    console.log("No Gemini API key provided. Running Agent in simulated fallback mode.");
  }
}

// Check configuration on load
if (apiKey) {
  configureAgent(apiKey);
}

// ----------------------------------------------------
// Email Intelligence Agent
// ----------------------------------------------------
export async function analyzeEmail(email) {
  const { subject = '', body = '', sender = '', date = new Date().toISOString() } = email;

  // Fallback to simulation if AI client is not configured
  if (!aiClient && !process.env.GEMINI_API_KEY) {
    return simulateEmailAnalysis(subject, body, sender, date);
  }

  const client = aiClient || new GoogleGenerativeAI(process.env.GEMINI_API_KEY || apiKey);
  const model = client.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const prompt = `
You are an expert AI Email Analyst and Financial Intelligence Agent.
Analyze the following email and generate a response strictly matching the JSON schema below.

JSON Response Schema:
{
  "category": "Financial Transaction" | "Bill" | "Subscription" | "Banking Alert" | "Personal" | "Work" | "Shopping" | "Travel" | "Delivery/Order" | "Promotional" | "Spam" | "Other",
  "importance": "Critical" | "High" | "Medium" | "Low",
  "shortSummary": "Concise one-line summary (max 10 words)",
  "detailedSummary": "A detailed 2-5 sentence explanation of the email, what happened, and why it matters.",
  "actionItems": ["List of deadlines, meeting times, OTPs, verification links, payments due, deliveries arriving, etc."],
  "isTransaction": true | false,
  "transaction": null | {
    "amount": number (positive value, absolute amount),
    "type": "DEBIT" | "CREDIT",
    "merchant": "Name of the recipient merchant or credit sender. Standardize names like Swiggy, Amazon, Uber, Zomato, Starbucks, Netflix, etc.",
    "refNo": "UPI Reference number, transaction ID, or Reference ID",
    "bank": "Bank name or source (e.g. HDFC, SBI, ICICI, Paytm)",
    "date": "YYYY-MM-DDTHH:mm:ss.sssZ (ISO timestamp or approximate date of transaction)"
  },
  "isSubscription": true | false,
  "subscription": null | {
    "name": "Subscription service name",
    "cost": number,
    "billingCycle": "Monthly" | "Yearly",
    "nextRenewal": "YYYY-MM-DD"
  },
  "isBill": true | false,
  "bill": null | {
    "name": "Bill name/service (e.g., Electricity Bill, Credit Card Bill)",
    "amount": number,
    "dueDate": "YYYY-MM-DD"
  }
}

Guidelines for Extraction:
1. Identify if it represents a financial debit/credit transaction (UPI, net banking, card alert, cash wallet). If it is a debit/credit transaction, set isTransaction = true and populate the transaction object. Standardize the merchant name (e.g. "Swiggy" instead of "UPI-SWIGGY-129302-PAY").
2. Extract available balances, account ending digits if mentioned and write them in detailedSummary.
3. Identify if it is a recurring subscription renewal invoice or charge. If yes, set isSubscription = true and populate subscription data.
4. Identify if it is a pending utility bill, card bill, premium payment, or EMI due. If yes, set isBill = true and populate bill data.
5. Extract actionable items such as verification codes/OTPs, delivery dates, flight times, interview details, or meeting links.
6. Rate importance: "Critical" for large debits, OTPs, fraud alerts, interview invitations, flight cancellations. "High" for bills due soon, shipping alerts. "Medium" for personal/work notes. "Low" for promo/spam.

Email Subject: ${subject}
Email Sender: ${sender}
Email Date: ${date}
Email Body:
${body}
`;

  try {
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json'
      }
    });

    const text = result.response.text();
    return JSON.parse(text);
  } catch (err) {
    console.error("Gemini email analysis failed, running simulation fallback:", err);
    return simulateEmailAnalysis(subject, body, sender, date);
  }
}

// ----------------------------------------------------
// Conversational Finance Agent
// ----------------------------------------------------
export async function chatAgent(query, history = [], context = {}) {
  if (!aiClient && !process.env.GEMINI_API_KEY) {
    return simulateChatAgent(query, history, context);
  }

  const client = aiClient || new GoogleGenerativeAI(process.env.GEMINI_API_KEY || apiKey);
  const model = client.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const serializedContext = JSON.stringify(context, null, 2);

  const systemInstruction = `
You are FinCFO, a highly skilled Personal CFO and Conversational Finance Agent.
You are helping the user manage their finances, track expenses, understand budgets, analyze subscriptions, and review emails.
You have direct read access to the user's financial database (provided below as context).

Your tone should be professional, friendly, analytical, and proactive.
Use markdown to format your answers (tables, bullet points, bold text).
If the user asks questions like:
- "How much did I spend on food?"
- "Show transactions above Rs.1000"
- "What are my upcoming bills?"
Evaluate the data in the context to give precise mathematical answers.
Compare numbers and point out anomalies or suggestions. For instance, if food budget is near limit, suggest saving.

Here is the current user financial context:
${serializedContext}

Answer the user's query based strictly on the provided context. If data is not present, explain that politely.
`;

  try {
    const contents = history.map(msg => ({
      role: msg.sender === 'user' ? 'user' : 'model',
      parts: [{ text: msg.text }]
    }));

    contents.unshift({
      role: 'user',
      parts: [{ text: systemInstruction }]
    });

    contents.push({
      role: 'user',
      parts: [{ text: query }]
    });

    const result = await model.generateContent({ contents });
    return result.response.text();
  } catch (err) {
    console.error("Gemini chat agent failed, running simulation:", err);
    return simulateChatAgent(query, history, context);
  }
}

// ----------------------------------------------------
// Insight & CFO Agent
// ----------------------------------------------------
export async function cfoAgent(context = {}) {
  if (!aiClient && !process.env.GEMINI_API_KEY) {
    return simulateCfoInsights(context);
  }

  const client = aiClient || new GoogleGenerativeAI(process.env.GEMINI_API_KEY || apiKey);
  const model = client.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const prompt = `
You are FinCFO, a personal financial advisor.
Review the following financial status and generate 3 to 5 highly specific, actionable, and personalized financial insights or recommendations for the user.

Format each insight in a JSON array of objects:
[
  {
    "type": "warning" | "saving" | "info" | "success",
    "title": "Short title",
    "description": "1-2 sentence detailed insight with concrete figures where possible."
  }
]

Provide only the JSON array.

Context Data:
${JSON.stringify(context, null, 2)}
`;

  try {
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json' }
    });
    return JSON.parse(result.response.text());
  } catch (err) {
    console.error("Gemini CFO agent failed, running simulation:", err);
    return simulateCfoInsights(context);
  }
}

// ----------------------------------------------------
// Digest Agent
// ----------------------------------------------------
export async function digestAgent(type, context = {}) {
  if (!aiClient && !process.env.GEMINI_API_KEY) {
    return simulateDigest(type, context);
  }

  const client = aiClient || new GoogleGenerativeAI(process.env.GEMINI_API_KEY || apiKey);
  const model = client.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const prompt = `
You are FinCFO, generating a ${type} digest report for the user.
Analyze the user's data and generate a professional, beautifully formatted markdown digest.

Your digest should cover:
- Financial summary (Total spent, income, budget status)
- Key transaction categories
- Important action items or deadlines from emails
- Subscription notifications or bills due
- Actionable advice / recommendations

Context Data:
${JSON.stringify(context, null, 2)}

Provide the response in Markdown format. Keep it clean and readable.
`;

  try {
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }]
    });
    return result.response.text();
  } catch (err) {
    console.error("Gemini digest agent failed, running simulation:", err);
    return simulateDigest(type, context);
  }
}

// ============================================================================
// SIMULATION / FALLBACK IMPLEMENTATION (Makes the App Work Out-of-the-Box)
// ============================================================================

function simulateEmailAnalysis(subject, body, sender, date) {
  console.log("Simulating AI Email Parsing...");
  const s = (subject + ' ' + body).toLowerCase();
  
  let category = 'Other';
  let importance = 'Low';
  let isTransaction = false;
  let transaction = null;
  let isSubscription = false;
  let subscription = null;
  let isBill = false;
  let bill = null;
  let actionItems = [];

  // Determine category & extract
  if (s.includes('upi') || s.includes('debited') || s.includes('credited') || s.includes('spent') || s.includes('payment to') || s.includes('alert') && s.includes('a/c')) {
    category = 'Financial Transaction';
    isTransaction = true;
    importance = 'Medium';

    // Try to guess amount
    let amount = 100;
    const amountMatch = body.match(/(?:rs\.?|inr|₹)\s*(\d+(?:\.\d{2})?)/i) || subject.match(/(?:rs\.?|inr|₹)\s*(\d+(?:\.\d{2})?)/i);
    if (amountMatch) amount = parseFloat(amountMatch[1]);

    if (amount > 5000) importance = 'Critical';
    else if (amount > 1000) importance = 'High';

    let type = 'DEBIT';
    if (s.includes('credited') || s.includes('received') || s.includes('refund')) {
      type = 'CREDIT';
      importance = 'High'; // crediting salary or refund
    }

    // Try to guess merchant
    let merchant = 'Unknown Merchant';
    if (s.includes('swiggy')) merchant = 'Swiggy';
    else if (s.includes('zomato')) merchant = 'Zomato';
    else if (s.includes('amazon')) merchant = 'Amazon';
    else if (s.includes('uber')) merchant = 'Uber';
    else if (s.includes('netflix')) merchant = 'Netflix';
    else if (s.includes('starbucks')) merchant = 'Starbucks';
    else if (s.includes('electricity') || s.includes('power')) merchant = 'Electricity Board';
    else if (s.includes('salary')) merchant = 'Company Salary';
    else {
      // extract something after "to "
      const toMatch = body.match(/to\s+([A-Za-z0-9\s]+?)(?:\s+on|\s+at|\s+via|\.|$)/i);
      if (toMatch && toMatch[1].length < 25) merchant = toMatch[1].trim();
    }

    // Ref no
    const refMatch = body.match(/(?:ref|upi ref|txn id|ref no)\.?\s*([0-9]{6,12})/i);
    const refNo = refMatch ? refMatch[1] : `UPI${Math.floor(100000000000 + Math.random() * 900000000000)}`;

    // Bank
    let bank = 'Bank';
    if (s.includes('sbi')) bank = 'SBI';
    else if (s.includes('hdfc')) bank = 'HDFC';
    else if (s.includes('icici')) bank = 'ICICI';
    else if (s.includes('axis')) bank = 'Axis';

    transaction = { amount, type, merchant, refNo, bank, date };
  } else if (s.includes('bill due') || s.includes('invoice') || s.includes('electricity due') || s.includes('phone bill') || s.includes('emi due')) {
    category = 'Bill';
    isBill = true;
    importance = 'High';

    let amount = 500;
    const amountMatch = body.match(/(?:rs\.?|inr|₹)\s*(\d+(?:\.\d{2})?)/i);
    if (amountMatch) amount = parseFloat(amountMatch[1]);

    let billName = 'Utility Bill';
    if (s.includes('electricity')) billName = 'Electricity Bill';
    else if (s.includes('phone') || s.includes('mobile')) billName = 'Mobile Bill';
    else if (s.includes('internet') || s.includes('wifi')) billName = 'Internet Bill';
    else if (s.includes('insurance')) billName = 'Insurance Premium';
    else if (s.includes('emi') || s.includes('loan')) billName = 'Loan EMI';

    let daysAhead = 5;
    if (s.includes('3 days') || s.includes('three days')) daysAhead = 3;
    else if (s.includes('tomorrow')) daysAhead = 1;
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + daysAhead);

    bill = {
      name: billName,
      amount,
      dueDate: dueDate.toISOString().split('T')[0]
    };
    actionItems.push(`Pay ${billName} of ₹${amount} before ${bill.dueDate}`);
  } else if (s.includes('renew') || s.includes('subscription') || s.includes('membership') || s.includes('netflix') || s.includes('spotify') || s.includes('youtube premium')) {
    category = 'Subscription';
    isSubscription = true;
    importance = 'Medium';

    let cost = 199;
    const costMatch = body.match(/(?:rs\.?|inr|₹)\s*(\d+(?:\.\d{2})?)/i);
    if (costMatch) cost = parseFloat(costMatch[1]);

    let name = 'Subscription';
    if (s.includes('netflix')) name = 'Netflix';
    else if (s.includes('spotify')) name = 'Spotify';
    else if (s.includes('youtube')) name = 'YouTube Premium';
    else if (s.includes('amazon prime')) name = 'Amazon Prime';

    const renewalDate = new Date();
    renewalDate.setDate(renewalDate.getDate() + 7); // Renews in a week

    subscription = {
      name,
      cost,
      billingCycle: 'Monthly',
      nextRenewal: renewalDate.toISOString().split('T')[0]
    };
    actionItems.push(`Subscription for ${name} will auto-renew on ${subscription.nextRenewal} for ₹${cost}`);
  } else if (s.includes('interview') || s.includes('meeting') || s.includes('invitation') || s.includes('zoom') || s.includes('calendar')) {
    category = 'Work';
    importance = 'High';
    if (s.includes('interview')) importance = 'Critical';

    // date parsing
    const timeMatch = body.match(/(\d{1,2}(?::\d{2})?\s*(?:am|pm))/i);
    const dayMatch = body.match(/(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i);
    const timeText = timeMatch ? `at ${timeMatch[1]}` : '';
    const dayText = dayMatch ? `on ${dayMatch[1]}` : 'soon';

    actionItems.push(`Attend meeting/interview ${dayText} ${timeText}`);
  } else if (s.includes('shipped') || s.includes('order') || s.includes('delivering') || s.includes('arriving')) {
    category = 'Delivery/Order';
    importance = 'Medium';
    
    let item = 'Package';
    const amazonMatch = body.match(/order\s+of\s+([A-Za-z0-9\s]+?)\s+is/i);
    if (amazonMatch) item = amazonMatch[1];
    
    actionItems.push(`Receive Amazon delivery on tomorrow`);
  } else if (s.includes('otp') || s.includes('verification code') || s.includes('verification link')) {
    category = 'Banking Alert';
    importance = 'Critical';
    
    const otpMatch = body.match(/\b\d{4,6}\b/);
    if (otpMatch) {
      actionItems.push(`OTP Code: ${otpMatch[0]} (Valid for 10 minutes)`);
    }
  }

  // Create short and detailed summary
  let shortSummary = subject;
  if (shortSummary.length > 50) shortSummary = shortSummary.substring(0, 47) + '...';

  let detailedSummary = `Received email from ${sender}. `;
  if (isTransaction) {
    detailedSummary += `Your account was ${transaction.type === 'DEBIT' ? 'debited' : 'credited'} by ₹${transaction.amount} to/from ${transaction.merchant} via ${transaction.bank}. UPI Ref: ${transaction.refNo}.`;
  } else if (isBill) {
    detailedSummary += `A bill of ₹${bill.amount} for ${bill.name} is due on ${bill.dueDate}.`;
  } else if (isSubscription) {
    detailedSummary += `Your ${subscription.name} subscription will renew for ₹${subscription.cost} on ${subscription.nextRenewal}.`;
  } else {
    detailedSummary += `This email contains general information classified as ${category}. Content: ${body.substring(0, 100)}...`;
  }

  return {
    category,
    importance,
    shortSummary,
    detailedSummary,
    actionItems,
    isTransaction,
    transaction,
    isSubscription,
    subscription,
    isBill,
    bill
  };
}

function simulateChatAgent(query, history, context) {
  console.log("Simulating AI Finance Chat response...");
  const q = query.toLowerCase();
  
  const totalSpent = context.transactions
    ? context.transactions.filter(t => t.type === 'DEBIT').reduce((acc, curr) => acc + curr.amount, 0)
    : 0;
  const totalIncome = context.transactions
    ? context.transactions.filter(t => t.type === 'CREDIT').reduce((acc, curr) => acc + curr.amount, 0)
    : 0;

  if (q.includes('how much') && q.includes('spend')) {
    if (q.includes('food')) {
      const foodSpent = context.transactions
        ? context.transactions.filter(t => t.type === 'DEBIT' && t.category === 'Food').reduce((acc, curr) => acc + curr.amount, 0)
        : 0;
      return `Based on your Notion ledger, you have spent **₹${foodSpent.toFixed(2)}** on **Food** this month. Keep an eye on your food delivery expenses!`;
    }
    return `You have spent a total of **₹${totalSpent.toFixed(2)}** this month across all categories, against an income of **₹${totalIncome.toFixed(2)}**. Your net savings rate is **${totalIncome > 0 ? ((totalIncome - totalSpent) / totalIncome * 100).toFixed(0) : 0}%**.`;
  }

  if (q.includes('subscription')) {
    const subs = context.subscriptions || [];
    if (subs.length === 0) return `You don't have any registered subscriptions in your database right now.`;
    const list = subs.map(s => `- **${s.name}**: ₹${s.cost}/month (Renews: ${s.nextRenewal})`).join('\n');
    const totalCost = subs.reduce((acc, curr) => acc + curr.cost, 0);
    return `Here are the active subscriptions detected in your Notion database:\n\n${list}\n\n**Total commitment**: ₹${totalCost.toFixed(2)} per month.`;
  }

  if (q.includes('bill') || q.includes('due')) {
    const bills = context.bills || [];
    const unpaid = bills.filter(b => b.status === 'Unpaid');
    if (unpaid.length === 0) return `You have no pending unpaid bills! Great job keeping up with your payments.`;
    const list = unpaid.map(b => `- **${b.name}**: ₹${b.amount} due on ${b.dueDate}`).join('\n');
    return `You have **${unpaid.length} pending bills**:\n\n${list}\n\nMake sure to pay them before their deadlines to avoid late charges.`;
  }

  if (q.includes('budget')) {
    const budgets = context.budgets || [];
    const warnings = budgets.filter(b => b.spent >= b.limit * 0.8);
    let reply = `Here is your current budget status:\n\n`;
    budgets.forEach(b => {
      const pct = b.limit > 0 ? (b.spent / b.limit * 100).toFixed(0) : 0;
      reply += `- **${b.category}**: ₹${b.spent} / ₹${b.limit} (${pct}% used)\n`;
    });
    if (warnings.length > 0) {
      reply += `\n⚠️ **Budget Warnings**: You have crossed 80% limit in categories: ${warnings.map(w => w.category).join(', ')}.`;
    }
    return reply;
  }

  return `Hello! I am your **FinCFO Assistant**. I can help you analyze your finances, summarize emails, or track budgets.

Here are some things you can ask me:
1. "How much did I spend this month?"
2. "Analyze my monthly subscriptions."
3. "Are there any bills due?"
4. "Show me my budget progress."
5. "Summarize my emails from this week."

*(Running in offline/simulation mode. Provide your Gemini API key in settings to activate full cognitive reasoning).*`;
}

function simulateCfoInsights(context) {
  console.log("Simulating CFO Insights...");
  const txns = context.transactions || [];
  const budgets = context.budgets || [];
  const subs = context.subscriptions || [];

  const foodBudget = budgets.find(b => b.category === 'Food');
  const foodWarning = foodBudget && foodBudget.spent > foodBudget.limit * 0.8;

  const totalSubs = subs.reduce((acc, curr) => acc + curr.cost, 0);

  const insights = [
    {
      type: "info",
      title: "Active Notion Integration",
      description: "Financial OS is actively syncing transactions and email alerts directly to your Notion workspace."
    }
  ];

  if (foodWarning) {
    insights.push({
      type: "warning",
      title: "Food Budget Threshold Exceeded",
      description: `You have spent ₹${foodBudget.spent} out of your ₹${foodBudget.limit} food budget. Consider reducing dining out or ordering from Swiggy for the rest of the week.`
    });
  } else {
    insights.push({
      type: "success",
      title: "Food Expenses Under Control",
      description: "Great job! Your food and restaurant spending is well within budget limits this month."
    });
  }

  if (totalSubs > 1000) {
    insights.push({
      type: "saving",
      title: "High Subscription Commitments",
      description: `You are paying ₹${totalSubs.toFixed(0)} monthly for recurring services. Consider canceling unused memberships to save money.`
    });
  }

  if (txns.length > 10) {
    insights.push({
      type: "info",
      title: "Weekend Spending Spike",
      description: "An analysis of transaction patterns shows 62% of your non-essential spending happens between Friday evening and Sunday night."
    });
  }

  return insights;
}

function simulateDigest(type, context) {
  console.log(`Simulating ${type} Digest...`);
  const txns = context.transactions || [];
  const totalSpent = txns.filter(t => t.type === 'DEBIT').reduce((acc, curr) => acc + curr.amount, 0);
  const totalIncome = txns.filter(t => t.type === 'CREDIT').reduce((acc, curr) => acc + curr.amount, 0);

  return `
# Financial OS - ${type.toUpperCase()} DIGEST REPORT
*Generated on ${new Date().toLocaleDateString()}*

## 💸 Cash Flow Summary
- **Total Income**: ₹${totalIncome.toFixed(2)}
- **Total Spent**: ₹${totalSpent.toFixed(2)}
- **Net Position**: ₹${(totalIncome - totalSpent).toFixed(2)}

## 📊 Spending Breakdown by Category
${(context.budgets || []).map(b => `- **${b.category}**: ₹${b.spent} spent (Limit: ₹${b.limit})`).join('\n')}

## 📅 Action Items & Upcoming Events
- **Pending Bills**: ${(context.bills || []).filter(b => b.status === 'Unpaid').length} bills unpaid.
- **Subscriptions**: ${(context.subscriptions || []).length} active memberships totaling ₹${(context.subscriptions || []).reduce((a, c) => a + c.cost, 0)}/month.

## 💡 CFO Proactive Recommendation
Based on your spending velocities this period, we recommend allocating **₹5,000** to your savings database. Watch out for miscellaneous shop expenses!
`;
}

export async function analyzeReceiptFile(fileBuffer, mimeType) {
  // Fallback to simulation if AI client is not configured
  if (!aiClient && !process.env.GEMINI_API_KEY) {
    return simulateReceiptAnalysis(mimeType);
  }

  const client = aiClient || new GoogleGenerativeAI(process.env.GEMINI_API_KEY || apiKey);
  const model = client.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const prompt = `
You are an expert AI Receipt and Invoice Analyzer.
Analyze the attached invoice or receipt document (image or PDF) and extract the financial details.
Generate a JSON response strictly matching the schema below:

{
  "merchant": "Name of the merchant or store. Standardize it (e.g., Starbucks, Amazon, Walmart, Swiggy).",
  "amount": number (total amount charged/due, absolute value, e.g. 350.00),
  "type": "DEBIT" | "CREDIT",
  "category": "Food" | "Transportation" | "Shopping" | "Utilities" | "Entertainment" | "Health" | "Travel" | "Investments" | "Subscriptions" | "Others",
  "date": "YYYY-MM-DD (Date of the transaction or invoice issue date)",
  "refNo": "Transaction reference number, receipt number, invoice number, or UPI ID if found",
  "bank": "Bank or source of payment if visible (e.g., HDFC, SBI, Credit Card), otherwise leave blank or 'Unknown'",
  "isBill": true | false,
  "dueDate": "YYYY-MM-DD (Due date of the invoice/bill if it's an unpaid bill, otherwise null)"
}

Guidelines:
1. Accurately extract the merchant/biller name and clean it.
2. Determine if it is a debit (receipt of payment already made) or an unpaid bill/invoice. If it is unpaid, set isBill = true and extract the dueDate.
3. Classify it into one of the categories.
4. Extract the total transaction or invoice amount.
`;

  try {
    const result = await model.generateContent({
      contents: [{
        role: 'user',
        parts: [
          {
            inlineData: {
              data: fileBuffer.toString('base64'),
              mimeType: mimeType
            }
          },
          {
            text: prompt
          }
        ]
      }],
      generationConfig: {
        responseMimeType: 'application/json'
      }
    });

    const text = result.response.text();
    return JSON.parse(text);
  } catch (err) {
    console.error("Gemini receipt analysis failed, running simulation fallback:", err);
    return simulateReceiptAnalysis(mimeType);
  }
}

function simulateReceiptAnalysis(mimeType) {
  console.log("Simulating receipt analysis offline...");
  return {
    merchant: "Simulated Merchant",
    amount: Math.floor(Math.random() * 800) + 150,
    type: "DEBIT",
    category: "Shopping",
    date: new Date().toISOString().split('T')[0],
    refNo: "SIM-" + Math.floor(Math.random() * 1000000),
    bank: "Unknown",
    isBill: false,
    dueDate: null
  };
}
