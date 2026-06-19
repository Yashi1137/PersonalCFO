import React, { useState } from 'react';
import { Mail, Receipt, AlertTriangle, HelpCircle, CheckSquare, Square, CreditCard, ChevronDown, ChevronUp } from 'lucide-react';

export default function MascotFeed({ stats, emails, transactions, budgets, subscriptions, bills, roommateBalances = [], fetchAllData, addToast }) {
  const [filter, setFilter] = useState('ALL');
  const [expandedItems, setExpandedItems] = useState({});
  const [isUploading, setIsUploading] = useState(false);

  const toggleExpand = (id) => {
    setExpandedItems(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    setIsUploading(true);
    addToast("Parsing Receipt", "Gemini is analyzing your file...", "info");

    try {
      const response = await fetch('/api/process-file', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();
      if (response.ok) {
        if (data.bill) {
          addToast("Bill Logged", `Detected utility bill: ${data.parsed.merchant} for ₹${data.parsed.amount}`, "warning");
        } else {
          addToast("Transaction Logged", `Detected purchase: spent ₹${data.parsed.amount} at ${data.parsed.merchant}`, "success");
        }
        fetchAllData();
      } else {
        addToast("Upload Failed", data.error || "Could not parse document.", "critical");
      }
    } catch (err) {
      console.error(err);
      addToast("Upload Error", "Network or server error during upload.", "critical");
    } finally {
      setIsUploading(false);
      event.target.value = null;
    }
  };

  const handleSettleUp = async (roommate, amount) => {
    const paidBy = amount < 0 ? 'Me' : 'Roommate';
    
    try {
      addToast("Settling Up", `Logging payment with ${roommate}...`, "info");
      const response = await fetch('/api/roommates/settle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roommate, amount, paidBy })
      });

      if (response.ok) {
        addToast("Settlement Logged", `Successfully settled up with ${roommate}!`, "success");
        fetchAllData();
      } else {
        addToast("Settlement Failed", "Could not write settlement transaction.", "critical");
      }
    } catch (err) {
      console.error(err);
      addToast("Settlement Error", "Network error while settling up.", "critical");
    }
  };

  const handleSplitChange = async (txnId, updatedFields) => {
    try {
      const response = await fetch('/api/transactions/split', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: txnId,
          ...updatedFields
        })
      });

      if (response.ok) {
        fetchAllData();
      }
    } catch (err) {
      console.error("Failed to update split settings:", err);
    }
  };

  // 1. Choose Mascot Emoji & Quote based on Financial Health
  const getMascotState = () => {
    const totalSpent = stats.totalSpent || 0;
    const totalIncome = stats.totalIncome || 0;
    const healthScore = stats.healthScore || 100;
    const unpaidBills = stats.unpaidBills || 0;

    // Check if empty
    if (transactions.length === 0 && emails.length === 0) {
      return {
        emoji: '😴',
        quote: "Pika-CFO is sleeping. Wake me up by clicking 'Load Sandbox Mock Data' in Settings!",
        color: '#e8dbfc' // Pastel lavender
      };
    }

    // Check budget overruns
    const overBudgets = budgets.filter(b => b.spent >= b.limit);
    if (overBudgets.length > 0) {
      const cats = overBudgets.map(b => b.category).join(', ');
      return {
        emoji: '😱',
        quote: `Pika-CFO is sweating! We have exceeded our monthly limits in: [${cats}]. STOP spending money!`,
        color: '#fddcdb' // Pastel pink-red
      };
    }

    // Check negative cash flow
    if (totalSpent > totalIncome && totalIncome > 0) {
      return {
        emoji: '🥬',
        quote: `Pika-CFO is eating grass! We spent ₹${totalSpent.toFixed(0)} against an income of ₹${totalIncome.toFixed(0)}. Get ready to eat mud next week...`,
        color: '#ffd8be' // Pastel peach
      };
    }

    // Check unpaid bills
    if (unpaidBills > 0) {
      return {
        emoji: '⚠️',
        quote: `Pika-CFO says: You have ${unpaidBills} unpaid bills pending. Pay them before they hunt us down!`,
        color: '#ffe8d6' // Pastel peach
      };
    }

    // Default Happy State
    return {
      emoji: '🪙',
      quote: "Pika-CFO is happy! Our financial balance is green and budgets are under control. Good job, chief!",
      color: '#dcedc8' // Pastel mint
    };
  };

  const mascot = getMascotState();

  // 2. Compile Unified Chronological Timeline Feed
  const compileFeed = () => {
    const items = [];

    // Map emails
    emails.forEach(email => {
      items.push({
        id: email.id,
        date: new Date(email.date),
        type: 'EMAIL',
        title: email.subject,
        category: email.category,
        importance: email.importance,
        shortSummary: email.shortSummary,
        detailedSummary: email.detailedSummary,
        actionItems: email.actionItems,
        sender: email.sender,
        isTransaction: email.isTransaction
      });
    });

    // Map transactions (except manual ones that have matching emailId to prevent duplicate cards in feed)
    transactions.forEach(txn => {
      // If transaction is linked to an email already in the feed, we can combine or only show email.
      // To keep it simple, we show all transactions, but filter out ones that have emails if they represent the same.
      // Actually, showing transactions as distinct small ledger alerts is very nice.
      items.push({
        id: txn.id,
        date: new Date(txn.date),
        type: 'TRANSACTION',
        title: `${txn.type === 'DEBIT' ? 'Spent at' : 'Received from'} ${txn.merchant}`,
        amount: txn.amount,
        txnType: txn.type,
        category: txn.category,
        bank: txn.bank,
        refNo: txn.refNo,
        split: txn.split,
        roommate: txn.roommate,
        paidBy: txn.paidBy
      });
    });

    // Map bills (due alerts)
    bills.forEach(bill => {
      if (bill.status === 'Unpaid') {
        items.push({
          id: bill.id,
          date: new Date(bill.dueDate),
          type: 'BILL',
          title: `Bill Due: ${bill.name}`,
          amount: bill.amount,
          dueDate: bill.dueDate,
          rawBill: bill
        });
      }
    });

    // Sort descending by date
    return items.sort((a, b) => b.date - a.date);
  };

  const feedItems = compileFeed();

  // Filter feed items based on filter chips
  const filteredFeed = feedItems.filter(item => {
    if (filter === 'ALL') return true;
    if (filter === 'MAILS') return item.type === 'EMAIL';
    if (filter === 'SPEND') return item.type === 'TRANSACTION';
    if (filter === 'BILLS') return item.type === 'BILL';
    if (filter === 'CRITICAL') {
      if (item.type === 'EMAIL') {
        return item.importance === 'Critical' || item.importance === 'High';
      }
      if (item.type === 'TRANSACTION') {
        return item.amount >= 5000;
      }
      if (item.type === 'BILL') {
        return true;
      }
      return false;
    }
    return true;
  });

  // Category Override Handler
  const handleCategoryChange = async (txnId, newCategory, merchantName) => {
    try {
      const response = await fetch('/api/transactions/categorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: txnId,
          category: newCategory,
          merchant: merchantName
        })
      });

      if (response.ok) {
        addToast("Category Saved", `Learned preference: "${merchantName}" -> "${newCategory}"`, "success");
        fetchAllData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Mark Bill Paid Handler
  const handleToggleBillStatus = async (bill) => {
    try {
      const response = await fetch(`/api/bills/${bill.id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Paid' })
      });
      
      if (response.ok) {
        addToast("Bill Paid", `Payment logged for "${bill.name}"`, "success");
        // Log transaction automatically
        await fetch('/api/process-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subject: `Bill Paid: ${bill.name} of ₹${bill.amount}`,
            body: `Utility bill payment logged on ${new Date().toLocaleDateString()}`,
            sender: "billing@financial.os",
            date: new Date().toISOString()
          })
        });
        fetchAllData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const categories = [
    'Food', 'Transportation', 'Shopping', 'Utilities', 
    'Entertainment', 'Health', 'Education', 'Travel', 
    'Investments', 'Subscriptions', 'Transfers', 'Others'
  ];

  return (
    <>
      {/* 1. Playful Mascot Speech bubble */}
      <div className="mascot-box" style={{ backgroundColor: mascot.color }}>
        <span className="mascot-sprite">{mascot.emoji}</span>
        <div className="mascot-bubble">
          <p className="mascot-text">{mascot.quote}</p>
          <div className="mascot-subinfo">
            <span>Spent: ₹{stats.totalSpent.toFixed(0)}</span>
            <span>•</span>
            <span>Income: ₹{stats.totalIncome.toFixed(0)}</span>
            <span>•</span>
            <span>Health Score: {stats.healthScore}</span>
          </div>
        </div>
      </div>

      {/* 2. Mini Budget Progress Bar List (To stay simple and compact) */}
      <div className="pastel-card" style={{ padding: '16px 24px' }}>
        <h3 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '12px', fontWeight: 700 }}>
          Category Budgets Status
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '16px' }}>
          {budgets.slice(0, 4).map(b => {
            const percent = b.limit > 0 ? (b.spent / b.limit * 100) : 0;
            return (
              <div key={b.category} style={{ fontSize: '0.8rem' }}>
                <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', fontWeight: 700, marginBottom: '4px' }}>
                  <span>{b.category}</span>
                  <span style={{ color: percent >= 100 ? 'var(--fill-danger)' : 'var(--text-secondary)' }}>
                    {percent.toFixed(0)}%
                  </span>
                </div>
                <div className="progress-bar-container" style={{ height: '6px', marginTop: 0 }}>
                  <div 
                    className="progress-bar-fill" 
                    style={{ 
                      width: `${Math.min(100, percent)}%`,
                      backgroundColor: percent >= 100 ? 'var(--fill-danger)' : percent >= 80 ? 'var(--fill-warning)' : 'var(--fill-success)'
                    }} 
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Roommate Splitter Ledger Card */}
      <div className="pastel-card" style={{ padding: '16px 24px', backgroundColor: '#f3e5f5' }}>
        <h3 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span>👥</span> Roommate Splitter (50/50)
        </h3>
        {roommateBalances && roommateBalances.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {roommateBalances.map((bal) => (
              <div key={bal.roommate} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', padding: '8px 12px', backgroundColor: 'var(--bg-card, white)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <span style={{ fontWeight: 600, color: bal.amount === 0 ? 'var(--text-muted)' : bal.amount > 0 ? 'var(--fill-primary)' : 'var(--fill-danger)' }}>
                  {bal.status}
                </span>
                {bal.amount !== 0 && (
                  <button 
                    className="playful-btn" 
                    style={{ padding: '4px 12px', fontSize: '0.75rem', borderRadius: '6px', backgroundColor: 'var(--fill-success)', color: 'white', border: 'none' }}
                    onClick={() => handleSettleUp(bal.roommate, bal.amount)}
                  >
                    Settle Up
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            No shared roommate expenses yet. Check the <strong>Split</strong> box on any transaction below to start splitting!
          </div>
        )}
      </div>

      {/* 3. Consolidated Chronological Feed */}
      <div className="pastel-card" style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: '16px', overflow: 'hidden' }}>
        
        {/* Feed Header */}
        <div className="feed-header">
          <h2 style={{ fontFamily: 'var(--font-title)', fontSize: '1.25rem', fontWeight: 700 }}>
            Unified Activity Feed
          </h2>
          
          {/* Feed Filter Chips */}
          <div className="feed-filter-bar">
            <span className={`filter-chip ${filter === 'ALL' ? 'active' : ''}`} onClick={() => setFilter('ALL')}>All</span>
            <span className={`filter-chip ${filter === 'MAILS' ? 'active' : ''}`} onClick={() => setFilter('MAILS')}>Mails</span>
            <span className={`filter-chip ${filter === 'SPEND' ? 'active' : ''}`} onClick={() => setFilter('SPEND')}>Spent</span>
            <span className={`filter-chip ${filter === 'BILLS' ? 'active' : ''}`} onClick={() => setFilter('BILLS')}>Bills</span>
            <span className={`filter-chip ${filter === 'CRITICAL' ? 'active' : ''}`} style={{ borderColor: filter === 'CRITICAL' ? 'var(--fill-danger)' : 'var(--border-color)', color: filter === 'CRITICAL' ? 'white' : 'var(--fill-danger)', backgroundColor: filter === 'CRITICAL' ? 'var(--fill-danger)' : 'transparent' }} onClick={() => setFilter('CRITICAL')}>Critical</span>
          </div>
        </div>

        {/* File Upload Drop Zone */}
        <div className="upload-dropzone">
          <input 
            type="file" 
            id="receipt-upload-input" 
            style={{ display: 'none' }} 
            accept="image/*,application/pdf"
            onChange={handleFileUpload}
            disabled={isUploading}
          />
          <label htmlFor="receipt-upload-input" style={{ cursor: isUploading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px', width: '100%', justifyContent: 'center' }}>
            <span style={{ fontSize: '1.2rem' }}>📎</span>
            <span>{isUploading ? 'Pika-CFO is reading receipt...' : 'Upload Receipt / Invoice (Image/PDF)'}</span>
          </label>
        </div>

        {/* Timeline Container */}
        <div style={{ overflowY: 'auto', flexGrow: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filteredFeed.map((item, idx) => {
            const isExpanded = !!expandedItems[item.id];
            
            return (
              <div key={`${item.id}_${idx}`} className="feed-item">
                <div className="feed-item-header">
                  {/* Category Type Badge */}
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {item.type === 'EMAIL' && (
                      <>
                        <Mail size={14} style={{ color: 'var(--fill-primary)' }} />
                        <span className="pastel-badge mail">Email</span>
                        <span className={`pastel-badge ${item.importance.toLowerCase()}`}>{item.importance}</span>
                      </>
                    )}
                    {item.type === 'TRANSACTION' && (
                      <>
                        <Receipt size={14} style={{ color: item.txnType === 'DEBIT' ? 'var(--fill-danger)' : 'var(--fill-success)' }} />
                        <span className={`pastel-badge ${item.txnType === 'DEBIT' ? 'spend' : 'credit'}`}>
                          {item.txnType === 'DEBIT' ? 'Debit' : 'Credit'}
                        </span>
                      </>
                    )}
                    {item.type === 'BILL' && (
                      <>
                        <AlertTriangle size={14} style={{ color: 'var(--fill-warning)' }} />
                        <span className="pastel-badge bill">Utility Bill</span>
                      </>
                    )}
                    
                    <span style={{ fontWeight: 700, fontSize: '0.9rem', marginLeft: '4px' }}>
                      {item.title}
                    </span>
                  </div>

                  <span className="feed-item-date">
                    {item.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                {/* Email Body & Summary rendering */}
                {item.type === 'EMAIL' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <p className="feed-item-body">
                      AI Summary: <strong style={{ color: 'var(--text-primary)' }}>"{item.shortSummary}"</strong>
                    </p>
                    
                    {/* Collapsible details */}
                    {isExpanded && (
                      <div style={{ marginTop: '8px', padding: '12px', background: 'rgba(0,0,0,0.02)', borderLeft: '3px solid var(--border-color)', borderRadius: '4px', display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.85rem' }}>
                        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>{item.detailedSummary}</p>
                        {item.actionItems && item.actionItems.trim() && (
                          <div>
                            <span style={{ fontWeight: 700, color: 'var(--fill-danger)', display: 'block', marginBottom: '4px' }}>Action Items:</span>
                            {item.actionItems.split('\n').map((li, i) => (
                              <div key={i} style={{ padding: '4px 8px', backgroundColor: 'var(--color-danger)', borderRadius: '4px', marginBottom: '4px', borderLeft: '3px solid var(--fill-danger)' }}>{li}</div>
                            ))}
                          </div>
                        )}
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>From: {item.sender}</span>
                      </div>
                    )}

                    <div className="feed-item-expand-toggle" onClick={() => toggleExpand(item.id)}>
                      {isExpanded ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '2px' }}><ChevronUp size={12} /> Hide detail</span>
                      ) : (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '2px' }}><ChevronDown size={12} /> Read detailed AI summary</span>
                      )}
                    </div>
                  </div>
                )}

                {/* Transaction specifics */}
                {item.type === 'TRANSACTION' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
                    <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          Bank: <strong>{item.bank || 'UPI Wallet'}</strong>
                        </span>
                        <span>•</span>
                        {/* Interactive Categorization Correction dropdown */}
                        <span style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          Category:
                          <select 
                            className="category-feed-select"
                            value={item.category}
                            onChange={(e) => handleCategoryChange(item.id, e.target.value, item.title.replace(/Spent at|Received from/i, '').trim())}
                          >
                            {categories.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </span>
                      </div>

                      <span style={{ fontWeight: 'bold', fontSize: '1.05rem', color: item.txnType === 'DEBIT' ? 'var(--text-primary)' : 'var(--fill-success)' }}>
                        {item.txnType === 'DEBIT' ? '-' : '+'}₹{item.amount.toFixed(2)}
                      </span>
                    </div>
                    
                    {/* Split ledger controls row */}
                    <div className="split-controls-row" style={{ display: 'flex', alignItems: 'center', gap: '12px', borderTop: '1px dashed var(--border-color)', paddingTop: '6px', flexWrap: 'wrap' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', cursor: 'pointer', userSelect: 'none', fontWeight: 500 }}>
                        <input 
                          type="checkbox" 
                          checked={!!item.split}
                          onChange={(e) => handleSplitChange(item.id, { split: e.target.checked })}
                          style={{ accentColor: 'var(--fill-primary)' }}
                        />
                        Split 50/50
                      </label>

                      {item.split && (
                        <>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem' }}>
                            <span>with:</span>
                            <input 
                              type="text" 
                              placeholder="Name"
                              defaultValue={item.roommate || ''}
                              onBlur={(e) => handleSplitChange(item.id, { roommate: e.target.value })}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleSplitChange(item.id, { roommate: e.target.value });
                                  e.target.blur();
                                }
                              }}
                              style={{ 
                                padding: '2px 6px', 
                                fontSize: '0.75rem', 
                                border: '1px solid var(--border-color)', 
                                borderRadius: '4px', 
                                width: '80px',
                                outline: 'none',
                                backgroundColor: 'var(--bg-input, white)',
                                color: 'var(--text-primary)'
                              }}
                            />
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem' }}>
                            <span>paid by:</span>
                            <select
                              value={item.paidBy || 'Me'}
                              onChange={(e) => handleSplitChange(item.id, { paidBy: e.target.value })}
                              style={{
                                padding: '2px 4px',
                                fontSize: '0.75rem',
                                border: '1px solid var(--border-color)',
                                borderRadius: '4px',
                                outline: 'none',
                                backgroundColor: 'var(--bg-input, white)',
                                color: 'var(--text-primary)'
                              }}
                            >
                              <option value="Me">Me</option>
                              <option value="Roommate">Roommate</option>
                            </select>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* Bill specifics */}
                {item.type === 'BILL' && (
                  <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <div style={{ cursor: 'pointer', color: 'var(--text-secondary)' }} onClick={() => handleToggleBillStatus(item.rawBill)}>
                        <Square size={16} />
                      </div>
                      <span style={{ fontSize: '0.8rem', color: 'var(--fill-danger)', fontWeight: 600 }}>
                        Deadline: {new Date(item.dueDate).toLocaleDateString()}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontWeight: 'bold', fontSize: '0.95rem' }}>₹{item.amount.toFixed(2)}</span>
                      <button className="playful-btn" style={{ padding: '4px 10px', fontSize: '0.7rem', borderRadius: '4px' }} onClick={() => handleToggleBillStatus(item.rawBill)}>
                        Paid?
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {filteredFeed.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
              No activities found in this filter range.
            </div>
          )}
        </div>
      </div>
    </>
  );
}
