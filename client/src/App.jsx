import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Sun, Moon, Sparkles, Terminal, BellRing } from 'lucide-react';

import MascotFeed from './components/MascotFeed';
import ChatAssistant from './components/ChatAssistant';
import Settings from './components/Settings';

export default function App() {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('financial-os-theme') || 'light';
  });
  
  const [showSettings, setShowSettings] = useState(false);
  const [emails, setEmails] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [bills, setBills] = useState([]);
  const [roommateBalances, setRoommateBalances] = useState([]);
  const [stats, setStats] = useState({
    totalSpent: 0,
    totalIncome: 0,
    unpaidBills: 0,
    activeSubs: 0,
    healthScore: 100,
    isMockMode: true
  });
  
  // Custom Toasts State
  const [toasts, setToasts] = useState([]);

  // Sync Theme class with body
  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark-theme');
    } else {
      root.classList.remove('dark-theme');
    }
    localStorage.setItem('financial-os-theme', theme);
  }, [theme]);

  // Fetch all database records
  const fetchAllData = async () => {
    try {
      const [emailsRes, txnsRes, budgetsRes, subsRes, billsRes, statsRes, balancesRes] = await Promise.all([
        fetch('/api/emails').then(r => r.json()),
        fetch('/api/transactions').then(r => r.json()),
        fetch('/api/budgets').then(r => r.json()),
        fetch('/api/subscriptions').then(r => r.json()),
        fetch('/api/bills').then(r => r.json()),
        fetch('/api/dashboard').then(r => r.json()),
        fetch('/api/roommates/balances').then(r => r.json())
      ]);

      setEmails(emailsRes || []);
      setTransactions(txnsRes || []);
      setBudgets(budgetsRes || []);
      setSubscriptions(subsRes || []);
      setBills(billsRes || []);
      setRoommateBalances(balancesRes || []);
      setStats(statsRes || {
        totalSpent: 0,
        totalIncome: 0,
        unpaidBills: 0,
        activeSubs: 0,
        healthScore: 100,
        isMockMode: true
      });
    } catch (err) {
      console.error("Error loading application database data:", err);
    }
  };

  useEffect(() => {
    fetchAllData();
    // Poll data every 8 seconds for real-time automatic updates
    const interval = setInterval(fetchAllData, 8000);
    return () => clearInterval(interval);
  }, []);

  // Monitor for new emails to show real-time notifications
  useEffect(() => {
    if (emails.length > 0) {
      const latestEmail = emails[0];
      const emailTime = new Date(latestEmail.date).getTime();
      const now = Date.now();
      
      if (now - emailTime < 15000) {
        let title = "New Email Received";
        let desc = latestEmail.shortSummary;
        let type = 'medium';

        if (latestEmail.category === 'Financial Transaction') {
          title = "💸 UPI Transaction Logged";
          type = 'spend';
        } else if (latestEmail.category === 'Bill') {
          title = "⚠️ Utility Bill Detected";
          type = 'bill';
        } else if (latestEmail.category === 'Subscription') {
          title = "🔄 Subscription Alert";
          type = 'sub';
        } else if (latestEmail.importance === 'Critical') {
          title = "🚨 Action Required";
          type = 'critical';
        }

        addToast(title, desc, type);
      }
    }
  }, [emails]);

  const addToast = (title, desc, type = 'medium') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, title, desc, type }]);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
      removeToast(id);
    }, 5000);
  };

  const removeToast = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const toggleTheme = () => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  };

  return (
    <div className="app-container-pastel">
      {/* Top Playful Header */}
      <header className="top-header-pastel">
        <div className="header-title-group">
          <span style={{ fontSize: '28px' }}>⚡</span>
          <div>
            <h1 className="app-title-pastel">Pikachu</h1>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700 }}>
              YOUR PERSONAL AI FINANCE MASCOT & CFO
            </span>
          </div>
        </div>

        <div className="header-actions">
          {/* Status Badge */}
          {stats.isMockMode ? (
            <span className="mode-badge mock" style={{ fontSize: '0.7rem' }}>SANDBOX MODE</span>
          ) : (
            <span className="mode-badge notion" style={{ fontSize: '0.7rem' }}>NOTION SYNCED</span>
          )}

          {/* Theme Switcher */}
          <button className="theme-toggle-btn" onClick={toggleTheme}>
            {theme === 'light' ? (
              <>
                <Moon size={14} /> <span>Dark Theme</span>
              </>
            ) : (
              <>
                <Sun size={14} /> <span>Light Theme</span>
              </>
            )}
          </button>

          {/* Settings Modal Button */}
          <button className="theme-toggle-btn" onClick={() => setShowSettings(true)}>
            <SettingsIcon size={14} /> <span>Config Settings</span>
          </button>
        </div>
      </header>

      {/* Main Split Layout */}
      <div className="main-layout-pastel">
        {/* Left Column: Mascot, Stats, and Unified Feed */}
        <section className="left-pane-pastel">
          <MascotFeed 
            stats={stats}
            emails={emails}
            transactions={transactions}
            budgets={budgets}
            subscriptions={subscriptions}
            bills={bills}
            roommateBalances={roommateBalances}
            fetchAllData={fetchAllData}
            addToast={addToast}
          />
        </section>

        {/* Right Column: AI Chat CFO Assistant */}
        <section className="right-pane-pastel">
          <div className="pastel-card" style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '16px' }}>
            <h2 style={{ fontFamily: 'var(--font-title)', fontSize: '1.2rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', paddingBottom: '10px', borderBottom: '2px dashed var(--border-color)' }}>
              <Sparkles size={18} style={{ color: 'var(--fill-primary)' }} /> Pika-CFO Assistant Chat
            </h2>
            <ChatAssistant />
          </div>
        </section>
      </div>

      {/* Settings Modal Overlay */}
      {showSettings && (
        <div className="settings-modal-overlay" onClick={() => setShowSettings(false)}>
          <div className="pastel-card settings-modal" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '2px dashed var(--border-color)', paddingBottom: '12px' }}>
              <h2 style={{ fontFamily: 'var(--font-title)', fontSize: '1.3rem', fontWeight: 700 }}>
                System Configurations
              </h2>
              <span className="toast-close" style={{ fontSize: '1.5rem' }} onClick={() => setShowSettings(false)}>×</span>
            </div>
            <Settings stats={stats} fetchAllData={fetchAllData} addToast={addToast} closeModal={() => setShowSettings(false)} />
          </div>
        </div>
      )}

      {/* Real-time Toaster */}
      <div className="toasts-area">
        {toasts.map(t => (
          <div key={t.id} className="toast" style={{ borderLeftColor: `var(--fill-${t.type === 'spend' ? 'danger' : t.type === 'bill' ? 'warning' : t.type === 'sub' ? 'info' : 'primary'})` }}>
            <div className="toast-content">
              <span className="toast-title">{t.title}</span>
              <span className="toast-desc">{t.desc}</span>
            </div>
            <span className="toast-close" onClick={() => removeToast(t.id)}>×</span>
          </div>
        ))}
      </div>
    </div>
  );
}
