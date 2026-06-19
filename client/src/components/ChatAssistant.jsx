import React, { useState, useRef, useEffect } from 'react';
import { Send, Sparkles } from 'lucide-react';

export default function ChatAssistant() {
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      sender: 'assistant',
      text: "Hello! I am your **Pika-CFO Assistant**. I have loaded your budget limits, active subscriptions database, and transaction history from Notion.\n\nAsk me anything! For example:\n- *How much did I spend this month?*\n- *Show me my subscription costs.*\n- *Are there any bills due?*\n- *Am I over budget on food?*"
    }
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (textToSend) => {
    const queryText = textToSend || input;
    if (!queryText.trim()) return;

    const userMsg = { id: `user_${Date.now()}`, sender: 'user', text: queryText };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setSending(true);

    try {
      const historyPayload = messages.slice(-10).map(m => ({
        sender: m.sender,
        text: m.text
      }));

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: queryText,
          history: historyPayload
        })
      });

      if (response.ok) {
        const data = await response.json();
        setMessages(prev => [...prev, {
          id: `assistant_${Date.now()}`,
          sender: 'assistant',
          text: data.reply
        }]);
      } else {
        throw new Error("Chat api failed");
      }
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, {
        id: `err_${Date.now()}`,
        sender: 'assistant',
        text: "⚠️ Sorry, I had trouble connecting to the AI brain. Check your Gemini API key in settings."
      }]);
    } finally {
      setSending(false);
    }
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    handleSend();
  };

  const formatBubbleText = (md) => {
    if (!md) return '';
    return md
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\*\*(.*?)\*\*/g, '<strong style="font-weight: 700; color: var(--text-primary);">$1</strong>')
      .replace(/\*(.*?)\*/g, '<em style="font-style: italic;">$1</em>')
      .replace(/^- (.*$)/gim, '<li style="margin-left: 18px; margin-bottom: 4px;">$1</li>')
      .replace(/`(.*?)`/g, '<code style="font-family: monospace; background: rgba(0,0,0,0.05); padding: 2px 4px; border-radius: 4px; color: var(--fill-primary);">$1</code>')
      // Simple tables support
      .replace(/\|(.*?)\|/g, (match, p1) => {
        const cells = p1.split('|').map(c => c.trim());
        return `<tr>${cells.map(c => `<td style="border-bottom: 1px solid var(--border-color); padding: 6px 10px; font-size: 0.85rem;">${c}</td>`).join('')}</tr>`;
      })
      .replace(/\n/g, '<br/>');
  };

  const quickPrompts = [
    "How much did I spend this month?",
    "List active subscriptions",
    "Am I over budget on Food?",
    "Are there any bills due?"
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Messages */}
      <div className="pastel-chat-messages">
        {messages.map(m => (
          <div 
            key={m.id} 
            className={`pastel-chat-bubble ${m.sender}`}
            dangerouslySetInnerHTML={{ __html: formatBubbleText(m.text) }}
          />
        ))}
        {sending && (
          <div className="pastel-chat-bubble assistant" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={14} style={{ animation: 'spin 1.5s linear infinite', color: 'var(--fill-primary)' }} />
            <span>Pika-CFO is thinking...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Prompts */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', margin: '12px 0 8px 0' }}>
        {quickPrompts.map((p, idx) => (
          <button 
            key={idx} 
            className="filter-chip" 
            style={{ fontSize: '0.75rem', padding: '6px 12px' }}
            disabled={sending}
            onClick={() => handleSend(p)}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Input Form */}
      <form onSubmit={handleFormSubmit} style={{ display: 'flex', gap: '8px' }}>
        <input 
          type="text" 
          placeholder="Ask a financial question e.g. Did I pay my electricity bill?" 
          className="playful-input"
          value={input}
          disabled={sending}
          onChange={e => setInput(e.target.value)}
        />
        <button type="submit" className="playful-btn primary" disabled={sending}>
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}
