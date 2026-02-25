import React, { useMemo, useRef, useState, useEffect } from 'react';
import { getGeminiResponse, isGeminiConfigured, getFPAContext, parseFPACommand } from '../utils/geminiAPI';

const STATUS_LABELS = [
  'In Decision Window',
  'Approved',
  'Withdrawn',
  'Disapproved',
  'Closed Out'
];

const normalize = (value) => (value || '').toLowerCase();

const normalizeId = (value) => normalize(value).replace(/[^a-z0-9]/g, '');

const findFpaMatch = (text, fpas) => {
  const normalizedText = normalizeId(text);
  if (!normalizedText) return null;

  for (const fpa of fpas) {
    const candidate = normalizeId(fpa.fpaNumber);
    if (candidate && normalizedText.includes(candidate)) {
      return fpa;
    }
  }

  const explicitMatch = text.match(/fpa\s*[-#:]*\s*([a-z0-9-]+)/i);
  if (explicitMatch) {
    const guessed = explicitMatch[1];
    const guessedNormalized = normalizeId(guessed);
    return fpas.find((fpa) => normalizeId(fpa.fpaNumber) === guessedNormalized) || null;
  }

  return null;
};

const extractStatus = (text) => {
  const lowered = normalize(text);
  if (lowered.includes('in decision window') || lowered.includes('decision window') || lowered.includes('in decision')) {
    return 'In Decision Window';
  }
  if (lowered.includes('pending')) return 'In Decision Window';
  if (lowered.includes('decision')) return 'In Decision Window';
  if (lowered.includes('approved')) return 'Approved';
  if (lowered.includes('started') && lowered.includes('fpa')) return 'Approved';  // "started" in FPA context = activity has started = approved
  if (lowered.includes('withdrawn')) return 'Withdrawn';
  if (lowered.includes('disapproved')) return 'Disapproved';
  if (lowered.includes('closed')) return 'Closed Out';
  return '';
};

const extractValue = (text, patterns) => {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  return '';
};

const extractDate = (text, label) => {
  const regex = new RegExp(`${label}[^0-9]*([0-9]{4}-[0-9]{2}-[0-9]{2})`, 'i');
  const match = text.match(regex);
  return match ? match[1] : '';
};

const extractLandownerFilter = (text) => {
  const match = text.match(/landowner\s*(?:is|=|named)?\s*([^,;.]+)/i);
  return match && match[1] ? match[1].trim() : '';
};

const buildHelp = () => (
  'I can help with FPA management and calendar events! Try natural language like:\n' +
  '• "Add a new FPA 256"\n' +
  '• "Set the landowner to John Smith"\n' +
  '• "Change the timber sale name to Oak Forest"\n' +
  '• "Update status to approved"\n' +
  '• "Add a note saying needs paperwork"\n' +
  '• "Open FPA 256"\n' +
  '• "What\'s the expiration date for 256?"\n' +
  '• "Add meeting on March 15th"\n' +
  '• "Schedule FPA review tomorrow"'
);

const isSpeechSupported = () => {
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
};

function ChatAssistant({
  fpas,
  editingFPA,
  selectedFPA,
  onCreateFPA,
  onUpdateFPA,
  onDeleteFPA,
  onSelectFPA,
  onStartEditFPA,
  onNavigate,
  onSetFormData,
  onSetHighlightFields,
  onApplyListFilter,
  userId,
  onAddCalendarEvent,
  isOpen,
  setIsOpen
}) {
  const currentFPA = editingFPA || selectedFPA; // Use editing FPA if available, otherwise use selected (viewing) FPA
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [showTip, setShowTip] = useState(false);
  const [pending, setPending] = useState(null);
  const [listening, setListening] = useState(false);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const recognitionRef = useRef(null);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  const supported = useMemo(() => isSpeechSupported(), []);

  // Debug: Log when component mounts
  useEffect(() => {
    return () => {
      console.log('🤖 ChatAssistant component unmounted');
    };
  }, []);

  // Force re-render on window resize for responsive layout
  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const appendMessage = (role, text) => {
    console.log(`[ChatBot] ${role}: ${text}`);
    setMessages((prev) => [...prev, { role, text }]);
  };

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const geminiStatus = isGeminiConfigured() ? '🤖 AI-powered' : '📋 Rule-based';
      console.log('[ChatBot] Gemini configured:', isGeminiConfigured());
      console.log('[ChatBot] API Key present:', !!process.env.REACT_APP_GEMINI_API_KEY);
      appendMessage('assistant', `Hi! I can help you manage FPAs (${geminiStatus}). Just chat naturally - tell me what you'd like to do!`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setMessages([]);
    }
  }, [isOpen]);

  // Auto-resize textarea based on content
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [input]);

  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  const parseFieldValue = (text, fieldName) => {
    let cleaned = text.trim();
    const lowerText = cleaned.toLowerCase();
    
    if (fieldName === 'landowner') {
      // Remove "landowner is", "owner is", etc. - extract just the name
      cleaned = cleaned.replace(/^(?:landowner\s+(?:is|of|:)?\s*|owner\s+(?:is|of|:)?\s*|lo\s*(?:is|of|:)?\s*)/i, '').trim();
    } else if (fieldName === 'timberSaleName') {
      // Remove "timber sale is", "sale name is", "timbersale is", etc. - extract just the name
      cleaned = cleaned.replace(/^(?:(?:timber\s*sale|timbersale|ts)\s+(?:is|of|name|:)?\s*|sale\s+(?:name)?\s*(?:is|of|:)?\s*)/i, '').trim();
    } else if (fieldName === 'landownerType') {
      // Keep only "small" or "large"
      if (lowerText.includes('large')) return 'Large';
      if (lowerText.includes('small')) return 'Small';
    } else if (fieldName === 'approvedActivity') {
      // Keep only valid approved activity statuses - check "not started" first
      if (lowerText.includes('not started')) return 'Not Started';
      if (lowerText.includes('completed')) return 'Completed';
      if (lowerText.includes('started') && !lowerText.includes('not started')) return 'Started';
    } else if (fieldName === 'decisionDeadline' || fieldName === 'expirationDate') {
      // Extract date in YYYY-MM-DD format or convert from various formats
      const dateMatch = cleaned.match(/(\d{4})-(\d{2})-(\d{2})/);
      if (dateMatch) return dateMatch[0];
      
      // Try M/D/YYYY or M-D-YYYY or similar
      const mdyMatch = cleaned.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
      if (mdyMatch) {
        const [, month, day, year] = mdyMatch;
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      }
      
      // Try just year (e.g., "2029")
      const yearMatch = cleaned.match(/^(\d{4})$/);
      if (yearMatch) {
        const year = yearMatch[1];
        return `${year}-01-01`;
      }
      
      // Try to parse text dates like "june 20 2045" or "june 20, 2045" with or without comma
      const textDateMatch = cleaned.match(/([a-z]+)\s+(\d{1,2}),?\s+(\d{4})/i);
      if (textDateMatch) {
        const [, month, day, year] = textDateMatch;
        const dateWithComma = `${month} ${day}, ${year}`;
        try {
          const date = new Date(dateWithComma);
          if (!isNaN(date.getTime())) {
            const isoDate = date.toISOString().split('T')[0];
            // Verify the year matches what was input
            if (isoDate.includes(year)) {
              return isoDate;
            }
          }
        } catch (e) {
          // Date parsing failed, continue
        }
      }
      
      // Try to parse common date formats - but prevent wrong century
      const parseDate = (dateStr) => {
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
          const isoDate = date.toISOString().split('T')[0];
          // Check if year looks wrong (e.g. 2001 when we expected 2029)
          const yearInInput = cleaned.match(/20(\d{2})/);
          if (yearInInput && !isoDate.includes(yearInInput[0])) {
            // Date parsing went wrong, return empty
            return '';
          }
          return isoDate;
        }
        return '';
      };
      return parseDate(cleaned);
    } else if (fieldName === 'notes') {
      // Support shorthand note prefixes
      cleaned = cleaned.replace(/^(?:notes?|n)\s*(?:is|of|:)?\s*/i, '').trim();
      return cleaned;
    }
    
    return cleaned || text.trim();
  };

  const formatFpaSummary = (fpa) => {
    if (!fpa) return 'I could not find that FPA.';
    const status = fpa.applicationStatus || 'Unassigned';
    return `FPA ${fpa.fpaNumber}: ${fpa.landowner || 'Unknown landowner'} - ${fpa.timberSaleName || 'Unknown timber sale'} (${status}).`;
  };

  const listFpasByStatus = (statusLabel) => {
    const matches = fpas.filter((fpa) => (fpa.applicationStatus || '').toLowerCase() === statusLabel.toLowerCase());
    if (!matches.length) {
      return `No FPAs found with status ${statusLabel}.`;
    }
    const numbers = matches.map((fpa) => fpa.fpaNumber).join(', ');
    return `${statusLabel}: ${numbers}`;
  };

  const buildStatusSummary = () => {
    if (!fpas.length) return 'No FPAs available to summarize.';
    const counts = STATUS_LABELS.reduce((acc, label) => {
      acc[label] = fpas.filter((fpa) => (fpa.applicationStatus || '').toLowerCase() === label.toLowerCase()).length;
      return acc;
    }, {});
    const unassigned = fpas.filter((fpa) => !fpa.applicationStatus).length;
    const total = fpas.length;
    return `Total: ${total}. Unassigned: ${unassigned}. ${STATUS_LABELS.map((label) => `${label}: ${counts[label]}`).join(' | ')}.`;
  };

  const startListening = () => {
    if (!supported || listening) return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      // Append to existing input instead of replacing it
      setInput(prev => prev ? `${prev} ${transcript}` : transcript);
      // Don't auto-submit - let user review and press Enter/Send manually
      appendMessage('assistant', '🎤 Voice captured! Click mic again to add more, or press Send.');
    };

    recognition.onerror = (event) => {
      console.error('Voice recognition error:', event.error);
      appendMessage('assistant', 'Voice input failed. Please try again.');
      setListening(false);
    };

    recognition.onend = () => {
      setListening(false);
    };

    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  };

  const handlePending = async (text) => {
    const updated = { ...pending };
    const lowered = normalize(text);
    const optionalFieldsBase = ['landownerType', 'applicationStatus', 'notes'];
    const isOptionalMissing = (field) => {
      const value = updated.data[field];
      return value === undefined || value === null || value === '';
    };
    const sanitizeOptional = (value) => (value === '__skipped__' || value === '__manually_filled__' ? '' : value);

    // === Use Gemini AI to parse pending responses (handles natural language better) ===
    let geminiExtracted = {};
    if (isGeminiConfigured()) {
      console.log('[ChatBot] 🤖 Using Gemini to parse pending response:', text);
      try {
        const aiParsed = await parseFPACommand(text, fpas);
        console.log('[ChatBot] 🤖 Gemini returned:', aiParsed);
        if (!aiParsed.error && aiParsed.fields) {
          // Extract non-null fields from Gemini's response
          Object.keys(aiParsed.fields).forEach(key => {
            if (aiParsed.fields[key]) {
              geminiExtracted[key] = aiParsed.fields[key];
            }
          });
          // Also check for FPA number in top-level
          if (aiParsed.fpaNumber) {
            geminiExtracted.fpaNumber = aiParsed.fpaNumber;
          }
          console.log('[ChatBot] ✅ Gemini extracted from pending:', geminiExtracted);
        } else if (aiParsed.error) {
          console.warn('[ChatBot] ⚠️ Gemini error in pending:', aiParsed.error);
        }
      } catch (err) {
        console.warn('[ChatBot] ❌ Gemini parsing failed in pending, using fallback:', err);
      }
    } else {
      console.log('[ChatBot] ⚠️ Gemini NOT configured, using rule-based extraction');
    }

    // Extract all possible field values from user's response (they might answer multiple fields at once)
    const extractAllFieldsFromText = (text) => {
      const extracted = {};
      const lowerText = normalize(text);
      
      // Extract landowner - be careful with word boundaries
      const landownerMatch = text.match(/(?:(?:landowner|owner|lo)\s+(?:is|of|:)?\s*)([^,;.]+?)(?:\s*(?:,|;|\s+and\s+|\s+timber|\s+sale|\s+status|\s+type|\s+expir|\s+exp|\s+decision|\s+note|$))/i);
      if (landownerMatch && landownerMatch[1].trim()) {
        extracted.landowner = landownerMatch[1].trim();
      }
      
      // Extract timber sale name - be more careful not to split words
      const timberMatch = text.match(/(?:(?:timber\s*sale|timbersale|ts)\s+(?:is|of|name|:)?\s*)([^,;.]+?)(?:\s*(?:,|;|\s+and\s+|\s+landowner|\s+owner|\s+status|\s+type|\s+expir|\s+exp|\s+decision|\s+note|$))/i);
      if (timberMatch && timberMatch[1].trim()) {
        extracted.timberSaleName = timberMatch[1].trim();
      }
      
      // Extract landowner type
      if (lowerText.includes('large')) extracted.landownerType = 'Large';
      if (lowerText.includes('small')) extracted.landownerType = 'Small';
      
      // Extract status
      const statusExtracted = extractStatus(text);
      if (statusExtracted) extracted.applicationStatus = statusExtracted;
      
      // Extract dates
      // Match expiration date - support numeric dates (6/29/1993) and text dates (june 29, 1993)
      const expirationMatch = text.match(/(?:(?:expir(?:ation)?|exp)\s+(?:date)?(?:is|of|:)?\s*)([a-z0-9\s,/-]+?)(?:\s*(?:,|;|and|\.|$))/i);
      if (expirationMatch && expirationMatch[1].trim()) {
        const parsedDate = parseFieldValue(expirationMatch[1].trim(), 'expirationDate');
        if (parsedDate) extracted.expirationDate = parsedDate;
      }
      
      // Match decision deadline
      const decisionMatch = text.match(/(?:(?:decision|dec)\s+(?:deadline)?(?:is|of|:)?\s*)([a-z0-9\s,/-]+?)(?:\s*(?:,|;|and|\.|$))/i);
      if (decisionMatch && decisionMatch[1].trim()) {
        const parsedDate = parseFieldValue(decisionMatch[1].trim(), 'decisionDeadline');
        if (parsedDate) extracted.decisionDeadline = parsedDate;
      }
      
      // Extract approved activity - check "not started" first to avoid false positives
      if (lowerText.includes('not started')) {
        extracted.approvedActivity = 'Not Started';
      } else if (lowerText.includes('completed')) {
        extracted.approvedActivity = 'Completed';
      } else if (lowerText.includes('started') && !lowerText.includes('not started')) {
        extracted.approvedActivity = 'Started';
      }

      // Extract notes/comments - ALWAYS require explicit trigger words (e.g., "note", "add note", "comment")
      // This prevents capturing other field data (like "exp date") as notes
      const notesMatch = text.match(/(?:add\s+)?(?:notes?|comments?)(?:\s+(?:is|are|of|:))?\s+(.+?)(?:\s*[,;]|$)/i);
      if (notesMatch && notesMatch[1].trim()) {
        extracted.notes = notesMatch[1].trim();
      }
      
      return extracted;
    };

    // Handle "leave blank", "skip", or "already entered" for fields
    if (lowered.includes('leave blank') || lowered.includes('skip') || lowered.includes('none') ||
        lowered.includes('already') || lowered.includes('entered it') || lowered.includes('filled it') || 
        lowered.includes('done')) {
      if (updated.expectingField && updated.intent === 'create') {
        const optionalFields = ['landownerType', 'applicationStatus', 'decisionDeadline', 'expirationDate', 'notes', 'approvedActivity'];
        const requiredFields = ['fpaNumber', 'landowner', 'timberSaleName'];
        
        if (optionalFields.includes(updated.expectingField)) {
          appendMessage('assistant', `Okay, skipping ${updated.expectingField}.`);
          updated.data[updated.expectingField] = '__skipped__';
          updated.expectingField = null;
        } else if (requiredFields.includes(updated.expectingField) && 
                   (lowered.includes('already') || lowered.includes('entered') || lowered.includes('filled') || lowered.includes('done'))) {
          // User says they already filled required field - trust them and move on
          appendMessage('assistant', `Got it! I'll check the form.`);
          updated.data[updated.expectingField] = '__manually_filled__';
          updated.expectingField = null;
        }
      }
    }

    // Handle cancel command
    if (lowered.includes('cancel') || lowered.includes('stop') || lowered.includes('abort')) {
      if (updated.intent === 'create') {
        appendMessage('assistant', '❌ FPA creation cancelled. Clearing the form.');
        setPending(null);
        if (onSetFormData) onSetFormData(null);
        if (onNavigate) onNavigate('dashboard');
        return;
      } else if (updated.intent === 'delete') {
        appendMessage('assistant', 'Delete cancelled.');
        setPending(null);
        return;
      }
    }

    // Handle submit command for create intent
    if (updated.intent === 'create' && (lowered.includes('submit') || lowered.includes('create it') || lowered.includes('save it'))) {
      const requiredFields = ['fpaNumber', 'landowner', 'timberSaleName'];
      const missingRequired = requiredFields.filter((field) => !updated.data[field]);
      
      if (missingRequired.length) {
        const fieldLabels = missingRequired.map(f => f === 'timberSaleName' ? 'timber sale name' : f).join(', ');
        appendMessage('assistant', `⚠️ Cannot submit yet. Missing required fields: ${fieldLabels}`);
        return;
      }

      // All required fields present, submit the form
      appendMessage('assistant', '✅ Submitting the form...');
      await sleep(800);
      
      await onCreateFPA({
        fpaNumber: updated.data.fpaNumber,
        landowner: updated.data.landowner,
        timberSaleName: updated.data.timberSaleName,
        landownerType: sanitizeOptional(updated.data.landownerType) || '',
        applicationStatus: sanitizeOptional(updated.data.applicationStatus) || '',
        decisionDeadline: sanitizeOptional(updated.data.decisionDeadline) || '',
        expirationDate: sanitizeOptional(updated.data.expirationDate) || '',
        approvedActivity: sanitizeOptional(updated.data.approvedActivity) || '',
        notes: sanitizeOptional(updated.data.notes) || ''
      });
      
      appendMessage('assistant', `✅ Created FPA ${updated.data.fpaNumber} successfully!`);
      
      // Clear form and return to dashboard
      await sleep(1000);
      if (onSetFormData) onSetFormData(null);
      if (onNavigate) onNavigate('dashboard');
      
      setPending(null);
      return;
    }

    if (updated.intent === 'delete') {
      if (!updated.fpa) {
        appendMessage('assistant', 'I could not find that FPA.');
        setPending(null);
        return;
      }
      if (!updated.needsConfirm) {
        appendMessage('assistant', `Are you sure you want to delete ${updated.fpa.fpaNumber}? Reply yes to confirm.`);
        setPending({ ...updated, needsConfirm: true });
        return;
      }
      if (normalize(text).includes('yes') || normalize(text).includes('delete')) {
        await onDeleteFPA(updated.fpa.id);
        appendMessage('assistant', `Deleted ${updated.fpa.fpaNumber}.`);
      } else {
        appendMessage('assistant', 'Delete cancelled.');
      }
      setPending(null);
      return;
    }

    // Extract all mentioned fields from the user's response (any order)
    const extracted = extractAllFieldsFromText(text);
    
    // Merge Gemini's extraction (if available) - Gemini takes priority for cleaner extraction
    if (Object.keys(geminiExtracted).length > 0) {
      console.log('[ChatBot] Prioritizing Gemini extraction over rule-based');
      Object.assign(extracted, geminiExtracted);
    }
    
    // Merge extracted fields into updated.data
    // For create flow, allow user to revise previously entered values before final submit.
    Object.keys(extracted).forEach(key => {
      const shouldOverwrite = updated.intent === 'create';
      if (shouldOverwrite || !updated.data[key] || updated.data[key] === '') {
        updated.data[key] = extracted[key];
      }
    });
    
    // Update form with extracted fields merged into existing form data
    if (onSetFormData && Object.keys(extracted).length > 0) {
      onSetFormData(prev => ({ ...(prev || {}), ...extracted }));
    }

    // Check if we were expecting a specific field
    if (updated.expectingField) {
      // Check if the user actually provided the field we were expecting (or said to skip it)
      const gotExpectedField = updated.data[updated.expectingField] && updated.data[updated.expectingField] !== '' && updated.data[updated.expectingField] !== '__skipped__';
      const saidToSkip = lowered.includes('leave blank') || lowered.includes('skip');
      
      if (updated.expectingField === 'fpaNumber') {
        // Try to find existing FPA or extract FPA number from text
        const match = findFpaMatch(text, fpas);
        if (match) {
          updated.fpa = match;
          updated.expectingField = null;
        } else if (geminiExtracted.fpaNumber) {
          // Gemini extracted an FPA number - use it
          updated.data.fpaNumber = geminiExtracted.fpaNumber;
          updated.expectingField = null;
          if (onSetFormData) {
            onSetFormData(prev => ({ ...prev, fpaNumber: geminiExtracted.fpaNumber }));
          }
        } else {
          // Fallback: Check if text looks like an FPA number - handle natural language responses
          const fpaNumMatch = text.match(/(?:fpa\s*(?:number|#)?\s*(?:is|i)\s*)?([0-9][a-z0-9-]*)\b/i) || text.match(/^([a-z0-9-]+)$/i);
          if (fpaNumMatch) {
            const extractedNum = fpaNumMatch[1].trim();
            // Only accept if starts with digit
            if (/^[0-9]/.test(extractedNum)) {
              updated.data.fpaNumber = extractedNum;
              updated.expectingField = null;
              if (onSetFormData) {
                onSetFormData(prev => ({ ...prev, fpaNumber: extractedNum }));
              }
            }
          }
        }
      } else if (gotExpectedField || saidToSkip) {
        // User provided the expected field (or wants to skip it), so clear expectingField
        updated.expectingField = null;
      } else if (Object.keys(extracted).length > 0) {
        // User provided OTHER fields, but not the one we were expecting
        // Acknowledge what we got and ask again for the missing field
        const fieldNames = Object.keys(extracted).map(key => {
          if (key === 'timberSaleName') return 'timber sale name';
          if (key === 'landownerType') return 'landowner type';
          if (key === 'applicationStatus') return 'application status';
          if (key === 'decisionDeadline') return 'decision deadline';
          if (key === 'expirationDate') return 'expiration date';
          if (key === 'approvedActivity') return 'approved activity';
          return key;
        }).join(', ');
        
        const expectedFieldLabel = updated.expectingField === 'timberSaleName' ? 'timber sale name' : 
                                   updated.expectingField === 'fpaNumber' ? 'FPA number' : updated.expectingField;
        
        appendMessage('assistant', `✅ Got ${fieldNames}! Now, what is the ${expectedFieldLabel}?`);
        setPending(updated);
        return;
      } else {
        // User didn't provide the expected field and didn't provide any other fields
        // Try to extract it from the raw text
        const fieldName = updated.expectingField;
        const parsedValue = parseFieldValue(text, fieldName);
        if (parsedValue && parsedValue.trim() !== '') {
          updated.data[fieldName] = parsedValue;
          updated.expectingField = null;
          // Update form field
          if (onSetFormData) {
            onSetFormData(prev => ({ ...(prev || {}), [fieldName]: parsedValue }));
          }
        }
      }
    }

    if (updated.intent === 'create') {
      const requiredFields = ['fpaNumber', 'landowner', 'timberSaleName'];
      const optionalFields = [...optionalFieldsBase];
      if (updated.data.applicationStatus === 'In Decision Window') {
        optionalFields.push('decisionDeadline');
      }
      if (updated.data.applicationStatus === 'Approved') {
        optionalFields.push('expirationDate');
        optionalFields.push('approvedActivity');
      }
      
      // Check for duplicate FPA number
      if (updated.data.fpaNumber) {
        const duplicate = fpas.find(fpa => normalizeId(fpa.fpaNumber) === normalizeId(updated.data.fpaNumber));
        if (duplicate) {
          appendMessage('assistant', `⚠️ FPA number ${updated.data.fpaNumber} already exists! Please provide a different FPA number, or say "cancel" to stop.`);
          updated.data.fpaNumber = ''; // Clear the duplicate number
          updated.expectingField = 'fpaNumber';
          if (onSetFormData) {
            onSetFormData(prev => ({ ...prev, fpaNumber: '' }));
          }
          setPending(updated);
          return;
        }
      }
      
      const missingRequired = requiredFields.filter((field) => !updated.data[field]);
      
      if (missingRequired.length) {
        const nextField = missingRequired[0];
        updated.expectingField = nextField;
        setPending(updated);
        const fieldLabel = nextField === 'timberSaleName' ? 'timber sale name' : 
                          nextField === 'fpaNumber' ? 'FPA number' : nextField;
        
        // Highlight the missing field
        if (onSetHighlightFields) {
          const currentHighlights = ['fpaNumber', 'landowner', 'timberSaleName'];
          if (!currentHighlights.includes(nextField)) currentHighlights.push(nextField);
          onSetHighlightFields(currentHighlights);
        }
        
        appendMessage('assistant', `What is the ${fieldLabel}? (Required)`);
        return;
      }

      // Ask for optional fields one by one
      const missingOptional = optionalFields.filter((field) => isOptionalMissing(field));
      if (missingOptional.length && !updated.skipOptional) {
        const nextField = missingOptional[0];
        updated.expectingField = nextField;
        setPending(updated);
        const fieldLabel = nextField === 'landownerType' ? 'landowner type (Small/Large)' :
                          nextField === 'applicationStatus' ? 'application status' :
                          nextField === 'decisionDeadline' ? 'decision deadline (YYYY-MM-DD)' :
                          nextField === 'expirationDate' ? 'expiration date (YYYY-MM-DD)' :
                          nextField === 'approvedActivity' ? 'approved activity (Not Started/Started/Completed)' :
                          'notes';
        
        // Highlight the missing optional field
        if (onSetHighlightFields) {
          const currentHighlights = ['fpaNumber', 'landowner', 'timberSaleName'];
          // Add status-dependent fields
          if (updated.data.applicationStatus === 'In Decision Window') currentHighlights.push('decisionDeadline');
          if (updated.data.applicationStatus === 'Approved') {
            currentHighlights.push('expirationDate');
            currentHighlights.push('approvedActivity');
          }
          // Add the field we're asking for
          if (!currentHighlights.includes(nextField)) currentHighlights.push(nextField);
          onSetHighlightFields(currentHighlights);
        }
        
        appendMessage('assistant', `What is the ${fieldLabel}? (Optional - say "leave blank" to skip, or "submit" to create now)`);
        return;
      }

      // All fields collected, ready to submit
      // Check if user just provided additional data (extracted fields exist)
      if (Object.keys(extracted).length > 0) {
        const extractedFieldNames = Object.keys(extracted).map(key => {
          if (key === 'timberSaleName') return 'timber sale name';
          if (key === 'landownerType') return 'landowner type';
          if (key === 'applicationStatus') return 'application status';
          if (key === 'decisionDeadline') return 'decision deadline';
          if (key === 'expirationDate') return 'expiration date';
          if (key === 'approvedActivity') return 'approved activity';
          return key;
        }).join(', ');
        appendMessage('assistant', `✅ Updated ${extractedFieldNames}! Say "submit" to create the FPA, or continue adding details.`);
      } else {
        appendMessage('assistant', '✅ All fields collected! Say "submit" to create the FPA, or continue providing more details.');
      }
      setPending(updated);
      return;
    }

    if (updated.intent === 'update') {
      if (!updated.fpa) {
        updated.expectingField = 'fpaNumber';
        setPending(updated);
        appendMessage('assistant', 'Which FPA should I update?');
        return;
      }
      
      // Check if we're expecting a specific field value
      if (updated.expectingField && updated.expectingField !== 'fpaNumber') {
        const fieldType = updated.expectingField;
        let extractedValue = '';
        let fieldData = {};
        
        // Extract value based on field type
        if (fieldType === 'approvedActivity') {
          if (lowered.includes('not started')) extractedValue = 'Not Started';
          else if (lowered.includes('complete')) extractedValue = 'Completed';
          else if (lowered.includes('start')) extractedValue = 'Started';
          if (extractedValue) fieldData.approvedActivity = extractedValue;
        } else if (fieldType === 'applicationStatus') {
          extractedValue = extractStatus(text);
          if (extractedValue) fieldData.applicationStatus = extractedValue;
        } else if (fieldType === 'landowner') {
          extractedValue = text.trim();
          if (extractedValue) fieldData.landowner = extractedValue;
        } else if (fieldType === 'timberSaleName') {
          extractedValue = text.trim();
          if (extractedValue) fieldData.timberSaleName = extractedValue;
        } else if (fieldType === 'expirationDate') {
          extractedValue = parseFieldValue(text, 'expirationDate');
          if (extractedValue) fieldData.expirationDate = extractedValue;
        } else if (fieldType === 'decisionDeadline') {
          extractedValue = parseFieldValue(text, 'decisionDeadline');
          if (extractedValue) fieldData.decisionDeadline = extractedValue;
        } else if (fieldType === 'landownerType') {
          if (lowered.includes('large')) extractedValue = 'Large';
          else if (lowered.includes('small')) extractedValue = 'Small';
          if (extractedValue) fieldData.landownerType = extractedValue;
        } else if (fieldType === 'notes') {
          extractedValue = text.trim();
          const timestamp = new Date().toLocaleString();
          const existingNotes = updated.fpa.notes || '';
          const combined = existingNotes ? `${existingNotes}\n[${timestamp}] ${extractedValue}` : `[${timestamp}] ${extractedValue}`;
          fieldData.notes = combined;
        }
        
        if (extractedValue) {
          // Open edit form with the field set
          if (onStartEditFPA) {
            const formData = {
              ...updated.fpa,
              ...fieldData
            };
            onStartEditFPA(formData);
            if (onSetFormData) {
              onSetFormData(formData);
            }
            if (onSetHighlightFields) {
              onSetHighlightFields([fieldType]);
            }
            const fieldLabel = fieldType === 'timberSaleName' ? 'timber sale name' :
                              fieldType === 'approvedActivity' ? 'harvest status' :
                              fieldType;
            appendMessage('assistant', `Opened FPA ${updated.fpa.fpaNumber} in the editor with ${fieldLabel} updated.`);
            setPending(null);
            return;
          }
          
          // Fallback: direct update
          await onUpdateFPA(updated.fpa.id, fieldData);
          const fieldLabel = fieldType === 'timberSaleName' ? 'timber sale name' :
                            fieldType === 'approvedActivity' ? 'harvest status' :
                            fieldType;
          appendMessage('assistant', `Updated FPA ${updated.fpa.fpaNumber} ${fieldLabel}.`);
          setPending(null);
          return;
        }
      }
      
      await onUpdateFPA(updated.fpa.id, updated.data);
      appendMessage('assistant', `Updated ${updated.fpa.fpaNumber}.`);
      setPending(null);
      return;
    }

    if (updated.intent === 'comment') {
      if (!updated.fpa) {
        updated.expectingField = 'fpaNumber';
        setPending(updated);
        appendMessage('assistant', 'Which FPA should I add the note to?');
        return;
      }
      const timestamp = new Date().toLocaleString();
      const existingNotes = updated.fpa.notes || '';
      const combined = existingNotes ? `${existingNotes}\n[${timestamp}] ${updated.data.notes}` : `[${timestamp}] ${updated.data.notes}`;
      await onUpdateFPA(updated.fpa.id, { notes: combined });
      appendMessage('assistant', `Added a note to ${updated.fpa.fpaNumber}.`);
      setPending(null);
      return;
    }

    setPending(null);
  };

  // === GEMINI AI HANDLERS ===
  const handleAICreateFPA = async (aiParsed) => {
    console.log('[ChatBot] handleAICreateFPA called with:', aiParsed);
    
    const data = {
      fpaNumber: aiParsed.fpaNumber || '',
      landowner: aiParsed.fields?.landowner || '',
      timberSaleName: aiParsed.fields?.timberSaleName || '',
      landownerType: aiParsed.fields?.landownerType || '',
      applicationStatus: aiParsed.fields?.applicationStatus || '',
      decisionDeadline: aiParsed.fields?.decisionDeadline || '',
      expirationDate: aiParsed.fields?.expirationDate || '',
      approvedActivity: aiParsed.fields?.approvedActivity || '',
      notes: aiParsed.fields?.notes || ''
    };
    
    console.log('[ChatBot] Extracted form data:', data);
    console.log('[ChatBot] approvedActivity value:', data.approvedActivity);

    // Check for duplicate FPA number
    if (data.fpaNumber) {
      const duplicate = fpas.find((fpa) => normalizeId(fpa.fpaNumber) === normalizeId(data.fpaNumber));
      if (duplicate) {
        appendMessage('assistant', `⚠️ FPA number ${data.fpaNumber} already exists! Please use a different number.`);
        return;
      }
    }

    // Show what was extracted
    const extractedFields = [];
    if (data.fpaNumber) extractedFields.push('FPA #');
    if (data.landowner) extractedFields.push('landowner');
    if (data.timberSaleName) extractedFields.push('timber sale');
    if (data.landownerType) extractedFields.push('type');
    if (data.applicationStatus) extractedFields.push('status');
    if (data.approvedActivity) extractedFields.push('activity');
    if (data.expirationDate) extractedFields.push('expiration');
    if (data.decisionDeadline) extractedFields.push('deadline');
    if (data.notes) extractedFields.push('notes');

    const extractedMsg = extractedFields.length > 0 
      ? `Captured: ${extractedFields.join(', ')}.`
      : 'Starting FPA creation.';
    
    appendMessage('assistant', `📝 ${aiParsed.response || extractedMsg}`);

    // Navigate to add view
    if (onNavigate) onNavigate('add');
    await sleep(400);

    // Set form data
    if (onSetFormData) onSetFormData(data);

    // Highlight fields
    const highlightFields = ['fpaNumber', 'landowner', 'timberSaleName'];
    if (data.applicationStatus) {
      highlightFields.push('applicationStatus');
      if (data.applicationStatus === 'In Decision Window') highlightFields.push('decisionDeadline');
      if (data.applicationStatus === 'Approved') {
        highlightFields.push('expirationDate');
        highlightFields.push('approvedActivity');
      }
    }
    if (onSetHighlightFields) onSetHighlightFields(highlightFields);

    // Check for missing required fields
    const requiredFields = ['fpaNumber', 'landowner', 'timberSaleName'];
    const missingRequired = requiredFields.filter((field) => !data[field]);
    
    if (missingRequired.length) {
      const nextField = missingRequired[0];
      const fieldLabel = nextField === 'timberSaleName' ? 'timber sale name' : 
                        nextField === 'fpaNumber' ? 'FPA number' : nextField;
      setPending({ intent: 'create', data, expectingField: nextField });
      appendMessage('assistant', `What is the ${fieldLabel}? (Required)`);
      return;
    }

    // All required - prompt for optional or submit
    appendMessage('assistant', '✅ All required fields captured! Review and click Submit, or tell me any additional details.');
    setPending({ intent: 'create', data, expectingField: null });
  };

  const handleAIUpdateFPA = async (aiParsed) => {
    // Find FPA
    let targetFPA = null;
    if (aiParsed.fpaNumber) {
      targetFPA = fpas.find(fpa => normalizeId(fpa.fpaNumber) === normalizeId(aiParsed.fpaNumber));
    } else {
      targetFPA = editingFPA || selectedFPA;
    }

    if (!targetFPA) {
      appendMessage('assistant', aiParsed.response || 'Which FPA should I update?');
      return;
    }

    // Build update data
    const updateData = {};
    if (aiParsed.fields) {
      Object.keys(aiParsed.fields).forEach(key => {
        if (aiParsed.fields[key]) {
          updateData[key] = aiParsed.fields[key];
        }
      });
    }

    if (Object.keys(updateData).length === 0) {
      appendMessage('assistant', 'What would you like to update?');
      return;
    }

    // Open edit form
    if (onStartEditFPA) {
      const formData = { ...targetFPA, ...updateData };
      onStartEditFPA(formData);
      if (onSetFormData) onSetFormData(formData);
      if (onSetHighlightFields) onSetHighlightFields(Object.keys(updateData));
    } else {
      await onUpdateFPA(targetFPA.id, updateData);
    }

    appendMessage('assistant', aiParsed.response || `✅ Updated FPA ${targetFPA.fpaNumber}!`);
  };

  const handleAIDeleteFPA = async (aiParsed) => {
    const targetFPA = aiParsed.fpaNumber 
      ? fpas.find(fpa => normalizeId(fpa.fpaNumber) === normalizeId(aiParsed.fpaNumber))
      : null;

    if (!targetFPA) {
      appendMessage('assistant', aiParsed.response || 'Which FPA should I delete?');
      return;
    }

    appendMessage('assistant', `⚠️ Delete FPA ${targetFPA.fpaNumber}? Type "yes" to confirm.`);
    setPending({ intent: 'delete', needsConfirm: true, fpa: targetFPA });
  };

  const handleAIViewFPA = async (aiParsed) => {
    const targetFPA = aiParsed.fpaNumber 
      ? fpas.find(fpa => normalizeId(fpa.fpaNumber) === normalizeId(aiParsed.fpaNumber))
      : null;

    if (!targetFPA) {
      appendMessage('assistant', aiParsed.response || 'Which FPA would you like to view?');
      return;
    }

    appendMessage('assistant', `📂 Opening FPA ${targetFPA.fpaNumber}...`);
    await sleep(500);
    onSelectFPA(targetFPA.id);
    appendMessage('assistant', aiParsed.response || `✅ Opened ${targetFPA.fpaNumber}!`);
  };

  const handleAIListFPAs = async (aiParsed) => {
    appendMessage('assistant', aiParsed.response || '📋 Showing FPAs...');
    await sleep(300);
    if (onNavigate) onNavigate('list');
  };

  const handleAINavigate = async (aiParsed) => {
    appendMessage('assistant', aiParsed.response || 'Navigating...');
    await sleep(300);
    
    // Parse destination from response
    const resp = (aiParsed.response || '').toLowerCase();
    if (resp.includes('dashboard')) onNavigate('dashboard');
    else if (resp.includes('list') || resp.includes('fpas')) onNavigate('list');
    else if (resp.includes('report')) onNavigate('reports');
    else if (resp.includes('add')) onNavigate('add');
  };

  const handleUserMessage = async (text) => {
    if (!text.trim()) return;
    console.log('[ChatBot] User message:', text);
    appendMessage('user', text);

    const lowered = normalize(text);

    // Handle pending state first (ongoing conversation)
    if (pending) {
      console.log('[ChatBot] Handling pending state:', pending);
      await handlePending(text);
      return;
    }

    // === GEMINI AI PRIMARY PROCESSOR ===
    // Try Gemini first for all FPA commands - handles misspellings, natural language
    if (isGeminiConfigured()) {
      console.log('[ChatBot] Using Gemini AI to parse command...');
      const aiParsed = await parseFPACommand(text, fpas);
      
      // If Gemini parsed successfully, process the structured command
      if (!aiParsed.error && !aiParsed.useRuleBased) {
        console.log('[ChatBot] Gemini parsed:', aiParsed);
        
        // Handle based on intent
        if (aiParsed.intent === 'create') {
          await handleAICreateFPA(aiParsed);
          return;
        }
        
        if (aiParsed.intent === 'update') {
          await handleAIUpdateFPA(aiParsed);
          return;
        }
        
        if (aiParsed.intent === 'delete') {
          await handleAIDeleteFPA(aiParsed);
          return;
        }
        
        if (aiParsed.intent === 'view') {
          await handleAIViewFPA(aiParsed);
          return;
        }
        
        if (aiParsed.intent === 'list') {
          await handleAIListFPAs(aiParsed);
          return;
        }
        
        if (aiParsed.intent === 'navigate') {
          await handleAINavigate(aiParsed);
          return;
        }
        
        // For questions or general chat
        if (aiParsed.response) {
          appendMessage('assistant', aiParsed.response);
          return;
        }
      } else if (aiParsed.error) {
        console.warn('[ChatBot] Gemini error, falling back to rule-based:', aiParsed.error);
        appendMessage('assistant', `⚠️ ${aiParsed.error}`);
        // Continue to rule-based fallback below
      }
    }
    
    console.log('[ChatBot] Processing command with rule-based system (Gemini fallback)...');
    
    // === RULE-BASED FALLBACK (original code) ===
    
    // Check for calendar commands first
    const isCalendarCommand = /(?:add|create|schedule)\s+(?:a\s+|an\s+)?(?:new\s+)?(?:event|meeting|calendar|reminder|deadline)/i.test(text);
    const isCalendarSchedule = /schedule\s+(?:fpa\s+)?(?:review|meeting)/i.test(text);
    
    if ((isCalendarCommand || isCalendarSchedule) && onAddCalendarEvent && userId) {
      console.log('[ChatBot] Detected calendar command');
      
      // Extract event type
      let eventType = 'other';
      if (/meeting/i.test(text)) eventType = 'meeting';
      else if (/fpa.*review|review.*fpa/i.test(text)) eventType = 'fpa_review';
      else if (/deadline/i.test(text)) eventType = 'deadline';
      else if (/reminder/i.test(text)) eventType = 'reminder';
      
      // Extract title
      let title = '';
      const titleMatch = text.match(/(?:add|create|schedule)\s+(?:a\s+|an\s+)?(?:new\s+)?(?:event|meeting|calendar|reminder|deadline)\s+(?:for|about|:)?\s+(.+?)(?:\s+on|\s+for|\s+at|$)/i);
      if (titleMatch && titleMatch[1]) {
        title = titleMatch[1].trim();
      } else {
        // Default title based on type
        if (eventType === 'meeting') title = 'Meeting';
        else if (eventType === 'fpa_review') title = 'FPA Review';
        else if (eventType === 'deadline') title = 'Deadline';
        else if (eventType === 'reminder') title = 'Reminder';
        else title = 'Event';
      }
      
      // Extract date - support various patterns
      let eventDate = null;
      
      // Try "on [date]" pattern
      const onDateMatch = text.match(/\bon\s+([a-z]+\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+\d{4})?)/i);
      if (onDateMatch) {
        eventDate = new Date(onDateMatch[1]);
      }
      
      // Try "[date]" in YYYY-MM-DD format
      if (!eventDate) {
        const isoMatch = text.match(/(\d{4}-\d{2}-\d{2})/);
        if (isoMatch) {
          eventDate = new Date(isoMatch[1]);
        }
      }
      
      // Try "tomorrow", "next week", etc.
      if (!eventDate) {
        const today = new Date();
        if (/tomorrow/i.test(text)) {
          eventDate = new Date(today);
          eventDate.setDate(eventDate.getDate() + 1);
        } else if (/next\s+week/i.test(text)) {
          eventDate = new Date(today);
          eventDate.setDate(eventDate.getDate() + 7);
        } else if (/next\s+month/i.test(text)) {
          eventDate = new Date(today);
          eventDate.setMonth(eventDate.getMonth() + 1);
        }
      }
      
      if (eventDate && !isNaN(eventDate.getTime())) {
        const success = await onAddCalendarEvent({
          title: title,
          date: eventDate.toISOString(),
          type: eventType,
          description: `Created via AI: ${text}`
        });
        
        if (success) {
          const dateStr = eventDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
          appendMessage('assistant', `✅ Added ${eventType.replace('_', ' ')} "${title}" on ${dateStr} to your calendar!`);
          return;
        } else {
          appendMessage('assistant', '❌ Failed to add event to calendar. Please try again.');
          return;
        }
      } else {
        appendMessage('assistant', 'I detected a calendar command but couldn\'t parse the date. Try: "Add meeting on March 15th" or "Schedule FPA review on 2025-03-15"');
        return;
      }
    }
    
    const isCreateRequest = /(?:add|create|make|new)\s+(?:a\s+|an\s+)?(?:new\s+)?fpa/i.test(text);

    if (pending && isCreateRequest) {
      setPending(null);
      appendMessage('assistant', 'Starting a new FPA entry.');
    }

    console.log('[ChatBot] Processing command:', lowered);

    // Check for FPA creation FIRST - before field editing, navigation, and status checks
    // This ensures messages like "add fpa for landowner brandon and change status" create the FPA
    if (isCreateRequest) {
      // Extract FPA number - try multiple patterns, only capture digits or proper alphanumerics (not words like 'for')
      let fpaNumber = extractValue(text, [
        /add\s+fpa\s+([0-9][a-z0-9-]*)/i,
        /create\s+fpa\s+([0-9][a-z0-9-]*)/i,
        /new\s+fpa\s+([0-9][a-z0-9-]*)/i,
        /fpa[\s#-]*([0-9][a-z0-9-]*)/i
      ]);
      
      // Only accept FPA numbers that start with a digit (reject words like 'for', 'the', etc.)
      if (fpaNumber && !/^[0-9]/.test(fpaNumber)) {
        fpaNumber = '';  // Clear invalid FPA number
      }
      
      // Extract all fields from the command
      const statusRe = extractStatus(text);
      const landownerRe = extractValue(text, [
        /(?:for\s+)?(?:the\s+)?landowner\s+([a-z\s]+?)(?:\.?\s+(?:timber|timbersale|ts|sale)|$)/i,  // "for the landowner brandon"
        /landowner\s*(?:is|of|:)\s*([a-z\s]+?)(?:\.?\s+|,|$)/i,                        // "landowner is john"
        /owner\s*(?:is|of|:)\s*([a-z\s]+?)(?:\.?\s+|,|$)/i,                             // "owner is john"
        /\blo\b\s*(?:is|of|:)\s*([a-z\s]+?)(?:\.?\s+|,|$)/i                            // "lo: john"
      ]);
      const timberSaleNameRe = extractValue(text, [
        /(?:with\s+)?(?:the\s+)?(?:ts|timber\s*sale)\s+(?:name\s+)?(?:of|is)\s+([^,;.]+?)(?:\s+(?:lo|landowner|status|exp|dec|note|activity)|$)/i,  // "with ts name of xxxx" or "ts of xxxx"
        /timber\s*sale\s*(?:name)?\s*(?:is|of|:)?\s*([^;.]+?)\s*(?:,\s*(?:large|small|approved|withdrawn|disapproved|in decision|closed|pending|lo|ts|exp|dec|note|activity)|$)/i,
        /timbersale\s*(?:name)?\s*(?:is|of|:)?\s*([^;.]+?)\s*(?:,\s*(?:large|small|approved|withdrawn|disapproved|in decision|closed|pending|lo|ts|exp|dec|note|activity)|$)/i,
        /sale\s*name\s*(?:is|of|:)?\s*([^;.]+?)\s*(?:,\s*(?:large|small|approved|withdrawn|disapproved|in decision|closed|pending|lo|ts|exp|dec|note|activity)|$)/i,
        /\bts\b\s*(?:name)?\s*(?:is|of|:)?\s*([^;.]+?)\s*(?:,\s*(?:large|small|approved|withdrawn|disapproved|in decision|closed|pending|lo|ts|exp|dec|note|activity)|$)/i
      ]);
      const landownerTypeRe = text.toLowerCase().includes('large') ? 'Large' : text.toLowerCase().includes('small') ? 'Small' : '';
      
      // Extract dates - allow dates to include commas (e.g., "june 30, 2045")
      const decisionRawRe = extractValue(text, [
        /decision\s*deadline\s*(?:is|of|:)?\s*([^;.]+?)\s*(?:,\s*(?:approved|withdrawn|lo|ts|exp|note|activity)|$)/i,
        /dec\s*date\s*(?:is|of|:)?\s*([^;.]+?)\s*(?:,\s*(?:approved|withdrawn|lo|ts|exp|note|activity)|$)/i
      ]);
      const decisionDeadlineRe = decisionRawRe && parseFieldValue(decisionRawRe.trim(), 'decisionDeadline');
      
      const expirationRawRe = extractValue(text, [
        /exp(?:iration)?\s*date\s*(?:is|of|:)?\s*([0-9\/\-\s,a-z]+?)(?:\.?\s*(?:the\s+)?(?:activity|note|comment|approved activity)|$)/i,
        /exp\s*(?:is|of|:)?\s*([0-9\/\-\s,]+?)(?:\.?\s|,|$)/i
      ]);
      const expirationDateRe = expirationRawRe && parseFieldValue(expirationRawRe.trim(), 'expirationDate');
      
      // Extract approved activity
      let approvedActivityRe = '';
      if (lowered.includes('not started') || lowered.includes('activity not started')) approvedActivityRe = 'Not Started';
      else if (lowered.includes('complete') || lowered.includes('activity complete')) approvedActivityRe = 'Completed';
      else if ((lowered.includes('start') || lowered.includes('has started') || lowered.includes('already started')) && lowered.includes('activity')) approvedActivityRe = 'Started';
      
      // Extract notes - look for various note patterns
      const notesRe = extractValue(text, [
        /(?:add\s+)?(?:a\s+)?note\s*(?:that|saying)?\s+(.+?)$/i,
        /(?:add\s+)?(?:a\s+)?notes\s*(?:that|saying)?\s+(.+?)$/i,
        /note\s*(?:is|of|:)\s*(.+?)$/i,
        /notes\s*(?:is|of|:)\s*(.+?)$/i,
        /comment\s*(?:is|of|:)\s*(.+?)$/i
      ]);

      const data = {
        fpaNumber,
        landowner: landownerRe || '',
        timberSaleName: timberSaleNameRe || '',
        landownerType: landownerTypeRe || '',
        applicationStatus: statusRe || '',
        decisionDeadline: decisionDeadlineRe || '',
        expirationDate: expirationDateRe || '',
        approvedActivity: approvedActivityRe || '',
        notes: notesRe || ''
      };

      // Check for duplicate FPA number
      if (data.fpaNumber) {
        const duplicate = fpas.find((fpa) => normalizeId(fpa.fpaNumber) === normalizeId(data.fpaNumber));
        if (duplicate) {
          appendMessage('assistant', `⚠️ FPA number ${data.fpaNumber} already exists! Please use a different number.`);
          return;
        }
      }

      // Build list of what was extracted
      const extractedFields = [];
      if (data.fpaNumber) extractedFields.push('FPA #');
      if (data.landowner) extractedFields.push('landowner');
      if (data.timberSaleName) extractedFields.push('timber sale');
      if (data.landownerType) extractedFields.push('type');
      if (data.applicationStatus) extractedFields.push('status');
      if (data.approvedActivity) extractedFields.push('activity');
      if (data.expirationDate) extractedFields.push('expiration');
      if (data.decisionDeadline) extractedFields.push('deadline');
      if (data.notes) extractedFields.push('notes');
      
      const extractedMsg = extractedFields.length > 0 
        ? `Captured: ${extractedFields.join(', ')}.`
        : 'Starting FPA creation.';
      
      appendMessage('assistant', `📝 Opening Add FPA form... ${extractedMsg}`);

      // Highlight fields that were captured or need attention
      const highlightFields = ['fpaNumber', 'landowner', 'timberSaleName'];
      if (data.landownerType) highlightFields.push('landownerType');
      if (data.applicationStatus) {
        highlightFields.push('applicationStatus');
        if (data.applicationStatus === 'In Decision Window') {
          highlightFields.push('decisionDeadline');
        }
        if (data.applicationStatus === 'Approved') {
          highlightFields.push('expirationDate');
          highlightFields.push('approvedActivity');
        }
      }
      if (data.notes) highlightFields.push('notes');

      // Set highlight fields for form
      if (onSetHighlightFields) {
        onSetHighlightFields(highlightFields);
      }

      // Navigate to add view
      if (onNavigate) {
        onNavigate('add');
      }

      await sleep(400);

      // Set form data with extracted values
      if (onSetFormData) {
        onSetFormData(data);
      }

      // Continue in conversational mode - check for missing fields and prompt
      const requiredFields = ['fpaNumber', 'landowner', 'timberSaleName'];
      const missingRequired = requiredFields.filter((field) => !data[field]);
      
      if (missingRequired.length) {
        const nextField = missingRequired[0];
        const fieldLabel = nextField === 'timberSaleName' ? 'timber sale name' : 
                          nextField === 'fpaNumber' ? 'FPA number' : nextField;
        setPending({ intent: 'create', data, expectingField: nextField });
        appendMessage('assistant', `What is the ${fieldLabel}? (Required)`);
        return;
      }

      // All required fields present, check for optional fields
      const optionalFieldsBase = ['landownerType', 'applicationStatus'];
      const optionalFields = [...optionalFieldsBase];
      
      // Add status-specific fields
      if (data.applicationStatus === 'In Decision Window') {
        optionalFields.push('decisionDeadline');
      }
      if (data.applicationStatus === 'Approved') {
        optionalFields.push('expirationDate');
        optionalFields.push('approvedActivity');
      }
      
      // Only add notes as always-optional (not approved activity for non-approved FPAs)
      optionalFields.push('notes');

      const missingOptional = optionalFields.filter((field) => !data[field] || data[field] === '');
      if (missingOptional.length) {
        const nextField = missingOptional[0];
        const fieldLabel = nextField === 'landownerType' ? 'landowner type (Small/Large)' :
                          nextField === 'applicationStatus' ? 'application status' :
                          nextField === 'decisionDeadline' ? 'decision deadline' :
                          nextField === 'expirationDate' ? 'expiration date' :
                          nextField === 'approvedActivity' ? 'approved activity (Not Started/Started/Completed)' :
                          'notes';
        setPending({ intent: 'create', data, expectingField: nextField });
        
        // Add the missing field to highlight list
        if (onSetHighlightFields && !highlightFields.includes(nextField)) {
          highlightFields.push(nextField);
          onSetHighlightFields(highlightFields);
        }
        
        appendMessage('assistant', `What is the ${fieldLabel}? (Optional - say "leave blank" or "skip" to continue)`);
        return;
      }

      // All fields collected, ready to submit
      appendMessage('assistant', '✅ All fields captured! Review the form and click Submit to create the FPA.');
      setPending({ intent: 'create', data, expectingField: null });
      return;
    }

    const fpaMatch = findFpaMatch(text, fpas);
    const status = extractStatus(text);
    
    // Only do simple extraction for non-edit commands
    // Edit commands will use their own more sophisticated extraction
    const isEditCommand = lowered.includes('change') || lowered.includes('update') || 
                          lowered.includes('set') || lowered.includes('modify') ||
                          (lowered.includes('add') && !lowered.includes('add fpa'));
    
    const landowner = !isEditCommand ? extractValue(text, [
      /landowner\s*(?:is|of|:)?\s*([^,;.]+)/i,
      /owner\s*(?:is|of|:)?\s*([^,;.]+)/i
    ]) : '';
    const timberSaleName = !isEditCommand ? extractValue(text, [
      /timber\s*sale\s*(?:name)?\s*(?:is|of|:)?\s*([^,;.]+)/i,
      /timbersale\s*(?:name)?\s*(?:is|of|:)?\s*([^,;.]+)/i,
      /sale\s*name\s*(?:is|of|:)?\s*([^,;.]+)/i
    ]) : '';
    const landownerType = lowered.includes('large') ? 'Large' : lowered.includes('small') ? 'Small' : '';
    const decisionRaw = extractValue(text, [
      /decision\s*(?:deadline)?\s*(?:is|of|:)?\s*([^,;.]+)/i,
      /\bdec\b\s*(?:is|of|:)?\s*([^,;.]+)/i
    ]);
    const expirationRaw = extractValue(text, [
      /expir(?:ation)?\s*(?:date)?\s*(?:is|of|:)?\s*([^,;.]+)/i,
      /\bexp\b\s*(?:is|of|:)?\s*([^,;.]+)/i
    ]);
    const decisionDeadline = (decisionRaw && parseFieldValue(decisionRaw, 'decisionDeadline')) || extractDate(text, 'decision');
    const expirationDate = (expirationRaw && parseFieldValue(expirationRaw, 'expirationDate')) || extractDate(text, 'expir');
    const approvedActivity = lowered.includes('not started') ? 'Not Started' : 
                             lowered.includes('completed') ? 'Completed' : 
                             (lowered.includes('started') && !lowered.includes('not started')) ? 'Started' : '';
    const notes = extractValue(text, [
      /comment\s*(?:to|on)?\s*fpa[^:]*:\s*(.+)$/i,
      /note\s*(?:to|on)?\s*fpa[^:]*:\s*(.+)$/i,
      /notes?\s*(?:is|of|:)?\s*(.+)$/i,
      /\bn\s*:\s*(.+)$/i
    ]);

    const openListWithFilter = async (filter) => {
      if (onApplyListFilter) {
        onApplyListFilter(filter || { type: 'all', label: 'All FPAs' });
      } else if (onNavigate) {
        onNavigate('list');
      }
      await sleep(300);
    };

    if (lowered.includes('help')) {
      appendMessage('assistant', buildHelp() + ' You can also say "go to dashboard", "go to list", or "go to reports".');
      return;
    }

    if (lowered.includes('report') && onNavigate) {
      appendMessage('assistant', '📊 Opening reports...');
      await sleep(300);
      onNavigate('reports');
      return;
    }

    if (lowered.includes('summary')) {
      if (status) {
        appendMessage('assistant', listFpasByStatus(status));
      } else if (fpaMatch) {
        appendMessage('assistant', formatFpaSummary(fpaMatch));
      } else {
        appendMessage('assistant', buildStatusSummary());
      }
      return;
    }

    const hasListVerb =
      lowered.includes('list') ||
      lowered.includes('show') ||
      lowered.includes('display') ||
      lowered.includes('give me');
    const hasFpaTarget =
      lowered.includes('fpa') ||
      lowered.includes('fpas') ||
      lowered.includes('applications');
    const hasFilterLanguage =
      lowered.includes('approved') ||
      lowered.includes('withdrawn') ||
      lowered.includes('disapproved') ||
      lowered.includes('closed') ||
      lowered.includes('decision') ||
      lowered.includes('small landowner') ||
      lowered.includes('large landowner') ||
      lowered.includes('landowner');

    const wantsListView =
      lowered.includes('show all fpas') ||
      lowered.includes('give me a list of fpas') ||
      lowered.includes('same landowner') ||
      (hasListVerb && hasFpaTarget) ||
      (hasListVerb && hasFilterLanguage);

    if (wantsListView) {
      const explicitLandowner = extractLandownerFilter(text);
      if (fpaMatch && lowered.includes('same landowner')) {
        await openListWithFilter({
          type: 'landowner',
          value: fpaMatch.landowner || '',
          label: `Landowner: ${fpaMatch.landowner || 'Unknown'}`
        });
        appendMessage('assistant', `Showing FPAs for ${fpaMatch.landowner || 'that landowner'}.`);
        return;
      }
      if (status) {
        await openListWithFilter({ type: 'status', value: status, label: `${status} FPAs` });
        appendMessage('assistant', `Showing ${status} FPAs.`);
        return;
      }
      if (landownerType) {
        await openListWithFilter({
          type: 'landownerType',
          value: landownerType,
          label: `${landownerType} landowner FPAs`
        });
        appendMessage('assistant', `Showing ${landownerType.toLowerCase()} landowner FPAs.`);
        return;
      }
      if (explicitLandowner) {
        await openListWithFilter({ type: 'landowner', value: explicitLandowner, label: `Landowner: ${explicitLandowner}` });
        appendMessage('assistant', `Showing FPAs for landowner ${explicitLandowner}.`);
        return;
      }

      await openListWithFilter({ type: 'all', label: 'All FPAs' });
      appendMessage('assistant', 'Showing all FPAs.');
      return;
    }

    // Navigation commands
    if (lowered.includes('go to dashboard') || lowered.includes('show dashboard') || lowered.includes('dashboard')) {
      appendMessage('assistant', '🏠 Going to dashboard...');
      if (onNavigate) {
        await sleep(400);
        onNavigate('dashboard');
      }
      appendMessage('assistant', 'You\'re now on the dashboard!');
      return;
    }

    if (lowered.includes('go to list') || lowered.includes('show all fpas') || lowered.includes('list fpas')) {
      appendMessage('assistant', '📋 Going to All FPAs list...');
      await openListWithFilter({ type: 'all', label: 'All FPAs' });
      appendMessage('assistant', 'You\'re now viewing all FPAs!');
      return;
    }

    if (lowered.includes('go to reports') || lowered.includes('show reports')) {
      appendMessage('assistant', '📊 Going to reports...');
      if (onNavigate) {
        await sleep(400);
        onNavigate('reports');
      }
      appendMessage('assistant', 'You\'re now in the reports section!');
      return;
    }

    if (lowered.includes('delete') || lowered.includes('remove')) {
      if (!fpaMatch) {
        appendMessage('assistant', 'Which FPA should I delete?');
        setPending({ intent: 'delete', needsConfirm: false, fpa: null, expectingField: 'fpaNumber' });
        return;
      }
      appendMessage('assistant', `⚠️ Are you sure you want to delete FPA ${fpaMatch.fpaNumber}? Type "yes" to confirm.`);
      setPending({ intent: 'delete', needsConfirm: true, fpa: fpaMatch });
      return;
    }

    if (lowered.includes('open fpa') || lowered.includes('open') && fpaMatch) {
      if (!fpaMatch) {
        appendMessage('assistant', 'Which FPA should I open? Tell me the FPA number.');
        return;
      }
      appendMessage('assistant', `📂 Opening FPA ${fpaMatch.fpaNumber}...`);
      await sleep(500);
      onSelectFPA(fpaMatch.id);
      appendMessage('assistant', `✅ Opened ${fpaMatch.fpaNumber}!`);
      return;
    }

    // Detect edit/update requests by action words + field references (without requiring "edit" command)
    const hasEditAction = lowered.includes('change') || lowered.includes('update') || 
                          lowered.includes('set') || lowered.includes('modify') ||
                          ((lowered.includes('add') && !isCreateRequest)); // "add" but not "add fpa"
    
    // Helper to check for word boundaries (avoid matching "lo" in "application")
    const hasWord = (word) => new RegExp(`\\b${word}\\b`, 'i').test(lowered);
    
    // Check for field references - more specific terms first
    let detectedField = null;
    if (lowered.includes('timber sale') || lowered.includes('timber name') || lowered.includes('sale name') || hasWord('ts')) {
      detectedField = 'timberSaleName';
    } else if (lowered.includes('landowner type') || lowered.includes('owner type')) {
      detectedField = 'landownerType';
    } else if (lowered.includes('landowner') || lowered.includes('land owner') || hasWord('owner') || hasWord('lo')) {
      detectedField = 'landowner';
    } else if (lowered.includes('exp date') || lowered.includes('expiration date') || lowered.includes('expiration')) {
      detectedField = 'expirationDate';
    } else if (lowered.includes('decision deadline') || lowered.includes('decision date') || lowered.includes('dec date')) {
      detectedField = 'decisionDeadline';
    } else if (lowered.includes('harvest status') || lowered.includes('harvest activity') || 
               lowered.includes('approved activity') || lowered.includes('activity status')) {
      detectedField = 'approvedActivity';
    } else if (lowered.includes('application status') || lowered.includes('app status') || lowered.includes('fpa status')) {
      detectedField = 'applicationStatus';
    } else if (hasWord('note') || hasWord('comment')) {
      detectedField = 'notes';
    }
    
    if (hasEditAction && detectedField) {
      // Extract the new value based on field type
      let extractedValue = '';
      let updateData = {};
      
      if (detectedField === 'approvedActivity') {
        if (lowered.includes('not started')) extractedValue = 'Not Started';
        else if (lowered.includes('complete')) extractedValue = 'Completed';
        else if (lowered.includes('start')) extractedValue = 'Started';
        if (extractedValue) updateData.approvedActivity = extractedValue;
      } else if (detectedField === 'applicationStatus') {
        // Handle "from X to Y" pattern - extract the target status (Y)
        const fromToMatch = text.match(/from\s+(?:approved|disapproved|withdrawn|in decision|pending|closed)\s+to\s+(approved|disapproved|withdrawn|in decision|pending|closed|in decision window)/i);
        if (fromToMatch) {
          const targetStatus = fromToMatch[1].toLowerCase();
          if (targetStatus.includes('in decision') || targetStatus === 'pending') extractedValue = 'In Decision Window';
          else if (targetStatus === 'approved') extractedValue = 'Approved';
          else if (targetStatus === 'withdrawn') extractedValue = 'Withdrawn';
          else if (targetStatus === 'disapproved') extractedValue = 'Disapproved';
          else if (targetStatus === 'closed') extractedValue = 'Closed Out';
        } else {
          // Try "to X" pattern
          const toMatch = text.match(/(?:status|app status|application status)\s+(?:for\s+fpa\s+\d+\s+)?to\s+(approved|disapproved|withdrawn|in decision|pending|closed|in decision window)/i);
          if (toMatch) {
            const targetStatus = toMatch[1].toLowerCase();
            if (targetStatus.includes('in decision') || targetStatus === 'pending') extractedValue = 'In Decision Window';
            else if (targetStatus === 'approved') extractedValue = 'Approved';
            else if (targetStatus === 'withdrawn') extractedValue = 'Withdrawn';
            else if (targetStatus === 'disapproved') extractedValue = 'Disapproved';
            else if (targetStatus === 'closed') extractedValue = 'Closed Out';
          } else {
            extractedValue = extractStatus(text);
          }
        }
        if (extractedValue) updateData.applicationStatus = extractedValue;
      } else if (detectedField === 'landowner') {
        extractedValue = extractValue(text, [
          /(?:landowner|owner|lo)\s+for\s+fpa\s+\d+\s+to\s+([^,;.]+)/i,  // "landowner for fpa 213 to john doe"
          /(?:landowner|owner|lo)\s+to\s+([^,;.]+)/i,                     // "landowner to john doe"
          /(?:landowner|owner|lo)\s+(?:is|of|:)\s+([^,;.]+)/i            // "landowner: john doe"
        ]);
        if (extractedValue) updateData.landowner = extractedValue.trim();
      } else if (detectedField === 'timberSaleName') {
        extractedValue = extractValue(text, [
          /(?:timber\s*sale|sale|ts)\s+name\s+for\s+fpa\s+\d+\s+to\s+([^,;.]+)/i,   // "ts name for fpa 256 to not cool"
          /(?:timber\s*sale|sale|ts)\s+name\s+to\s+([^,;.]+)/i,                     // "ts name to false"
          /(?:timber\s*sale|sale\s*name|ts)\s+for\s+fpa\s+\d+\s+to\s+([^,;.]+)/i,  // "timber sale for fpa 213 to oak ridge"
          /(?:timber\s*sale|sale\s*name|ts)\s+to\s+([^,;.]+)/i,                     // "timber sale to oak ridge"
          /(?:timber\s*sale|sale\s*name|ts)\s+(?:is|of|:)\s+([^,;.]+)/i             // "timber sale: oak ridge" (removed "name" from this pattern)
        ]);
        if (extractedValue) updateData.timberSaleName = extractedValue.trim();
      } else if (detectedField === 'expirationDate') {
        const expirationRaw = extractValue(text, [
          /exp(?:iration)?\s*date\s+for\s+fpa\s+\d+\s+to\s+([^,;.]+)/i,  // "exp date for fpa 213 to june 20 2045"
          /exp(?:iration)?\s*date\s+to\s+([^,;.]+)/i,                     // "exp date to june 20 2045"
          /exp(?:iration)?\s*date\s+(?:is|of|:)\s+([^,;.]+)/i,           // "exp date: june 20 2045"
          /exp\s+to\s+([^,;.]+)/i                                         // "exp to june 20"
        ]);
        extractedValue = expirationRaw && parseFieldValue(expirationRaw.trim(), 'expirationDate');
        if (extractedValue) updateData.expirationDate = extractedValue;
      } else if (detectedField === 'decisionDeadline') {
        const decisionRaw = extractValue(text, [
          /decision\s*(?:deadline|date)\s+for\s+fpa\s+\d+\s+to\s+([^,;.]+)/i,  // "decision date for fpa 213 to march 1"
          /decision\s*(?:deadline|date)\s+to\s+([^,;.]+)/i,                     // "decision date to march 1"
          /decision\s*(?:deadline|date)\s+(?:is|of|:)\s+([^,;.]+)/i,           // "decision date: march 1"
          /dec\s*date\s+to\s+([^,;.]+)/i                                        // "dec date to march 1"
        ]);
        extractedValue = decisionRaw && parseFieldValue(decisionRaw.trim(), 'decisionDeadline');
        if (extractedValue) updateData.decisionDeadline = extractedValue;
      } else if (detectedField === 'landownerType') {
        if (lowered.includes('large')) extractedValue = 'Large';
        else if (lowered.includes('small')) extractedValue = 'Small';
        if (extractedValue) updateData.landownerType = extractedValue;
      } else if (detectedField === 'notes') {
        // For notes, extract everything after the trigger
        // Support "add a note to fpa 345 saying this will be mine"  
        extractedValue = extractValue(text, [
          /(?:add|set)\s+(?:a\s+)?(?:note|comment)\s+to\s+fpa\s+\d+\s+(?:saying|that|about|:)?\s*(.+?)$/i,  // "add a note to fpa 345 saying..."
          /(?:note|comment)\s+(?:for|to)\s+fpa\s+\d+\s+(?:saying|that|about|:)?\s*(.+?)$/i,  // "note for fpa 213 saying..."
          /(?:add|set)\s+(?:a\s+)?(?:note|comment)\s+(?:for|to)\s+fpa\s+\d+\s+(?:saying|that|about|:)?\s*(.+?)$/i,  // "add a note for fpa 213 saying..."
          /(?:note|comment)\s+(?:saying|that|about|to|:)\s*(.+?)$/i,                         // "note: harvest started"
          /(?:add|set)\s+(?:a\s+)?(?:note|comment)\s+(?:saying|that|about|:)?\s*(.+?)$/i    // "add a note saying harvest started"
        ]);
        if (extractedValue) updateData.notes = extractedValue.trim();
      }
      
      // Check if we found the FPA and extracted a value
      // If no FPA mentioned in text, use the currently editing or viewing FPA if available
      const targetFPA = fpaMatch || currentFPA;
      
      if (!targetFPA) {
        const fieldLabel = detectedField === 'timberSaleName' ? 'timber sale name' :
                          detectedField === 'approvedActivity' ? 'harvest status' :
                          detectedField === 'applicationStatus' ? 'application status' :
                          detectedField === 'expirationDate' ? 'expiration date' :
                          detectedField === 'decisionDeadline' ? 'decision deadline' :
                          detectedField === 'landownerType' ? 'landowner type' :
                          detectedField;
        appendMessage('assistant', `Which FPA should I update the ${fieldLabel} for?`);
        setPending({
          intent: 'update',
          fpa: null,
          data: updateData,
          expectingField: 'fpaNumber'
        });
        return;
      }
      
      if (!extractedValue) {
        const fieldLabel = detectedField === 'timberSaleName' ? 'timber sale name' :
                          detectedField === 'approvedActivity' ? 'harvest status (Not Started/Started/Completed)' :
                          detectedField === 'applicationStatus' ? 'application status' :
                          detectedField === 'expirationDate' ? 'expiration date' :
                          detectedField === 'decisionDeadline' ? 'decision deadline' :
                          detectedField === 'landownerType' ? 'landowner type (Small/Large)' :
                          detectedField;
        appendMessage('assistant', `What should the ${fieldLabel} be?`);
        setPending({
          intent: 'update',
          fpa: targetFPA,
          data: {},
          expectingField: detectedField
        });
        return;
      }
      
      // Handle notes specially - append instead of replace
      if (detectedField === 'notes') {
        const timestamp = new Date().toLocaleString();
        const existingNotes = targetFPA.notes || '';
        const combined = existingNotes ? `${existingNotes}\n[${timestamp}] ${extractedValue}` : `[${timestamp}] ${extractedValue}`;
        updateData.notes = combined;
      }
      
      // Open edit form with the updated data
      if (onStartEditFPA) {
        const formData = {
          ...targetFPA,
          ...updateData
        };
        onStartEditFPA(formData);
        if (onSetFormData) {
          onSetFormData(formData);
        }
        if (onSetHighlightFields) {
          onSetHighlightFields([detectedField]);
        }
        const fieldLabel = detectedField === 'timberSaleName' ? 'timber sale name' :
                          detectedField === 'approvedActivity' ? 'harvest status' :
                          detectedField;
        appendMessage('assistant', `Opened FPA ${targetFPA.fpaNumber} in the editor with ${fieldLabel} updated.`);
        return;
      }
      
      // Fallback: direct update
      await onUpdateFPA(targetFPA.id, updateData);
      const fieldLabel = detectedField === 'timberSaleName' ? 'timber sale name' :
                        detectedField === 'approvedActivity' ? 'harvest status' :
                        detectedField;
      appendMessage('assistant', `Updated FPA ${targetFPA.fpaNumber} ${fieldLabel}.`);
      return;
    }
    
    if (!isCreateRequest && (lowered.includes('status') || STATUS_LABELS.some((label) => lowered.includes(normalize(label))))) {
      const targetFPA = fpaMatch || currentFPA;
      if (!targetFPA || !status) {
        const nextPrompt = !targetFPA ? 'Which FPA should I update?' : 'What status should I set?';
        setPending({
          intent: 'update',
          fpa: targetFPA || null,
          data: status ? { applicationStatus: status } : {},
          expectingField: !targetFPA ? 'fpaNumber' : (!status ? 'applicationStatus' : null)
        });
        appendMessage('assistant', nextPrompt);
        return;
      }

      if (onStartEditFPA) {
        const formData = {
          ...targetFPA,
          applicationStatus: status,
          decisionDeadline: decisionDeadline || targetFPA.decisionDeadline || '',
          expirationDate: expirationDate || targetFPA.expirationDate || ''
        };
        onStartEditFPA(formData);
        if (onSetFormData) {
          onSetFormData(formData);
        }
        if (onSetHighlightFields) {
          const fields = ['applicationStatus'];
          if (status === 'In Decision Window') fields.push('decisionDeadline');
          if (status === 'Approved') fields.push('expirationDate', 'approvedActivity');
          onSetHighlightFields(fields);
        }
        appendMessage('assistant', `Opened ${targetFPA.fpaNumber} in the editor with status set to ${status}.`);
        return;
      }

      await onUpdateFPA(targetFPA.id, { applicationStatus: status, decisionDeadline, expirationDate });
      appendMessage('assistant', `Updated ${targetFPA.fpaNumber} to ${status}.`);
      return;
    }

    if (!isCreateRequest && (lowered.includes('comment') || lowered.includes('note'))) {
      const targetFPA = fpaMatch || currentFPA;
      if (!targetFPA || !notes) {
        setPending({
          intent: 'comment',
          fpa: targetFPA || null,
          data: { notes: notes || '' },
          expectingField: !notes ? 'notes' : (!targetFPA ? 'fpaNumber' : null)
        });
        appendMessage('assistant', notes ? 'Which FPA should I add this note to?' : 'What note should I add?');
        return;
      }
      const timestamp = new Date().toLocaleString();
      const existingNotes = targetFPA.notes || '';
      const combined = existingNotes ? `${existingNotes}\n[${timestamp}] ${notes}` : `[${timestamp}] ${notes}`;
      await onUpdateFPA(targetFPA.id, { notes: combined });
      appendMessage('assistant', `Added a note to ${targetFPA.fpaNumber}.`);
      return;
    }

    if (!isCreateRequest && (lowered.includes('edit') || lowered.includes('update'))) {
      const targetFPA = fpaMatch || currentFPA;
      if (!targetFPA) {
        appendMessage('assistant', 'Which FPA should I update?');
        return;
      }

      const updatePayload = {
        ...(landowner ? { landowner } : {}),
        ...(timberSaleName ? { timberSaleName } : {}),
        ...(landownerType ? { landownerType } : {}),
        ...(decisionDeadline ? { decisionDeadline } : {}),
        ...(expirationDate ? { expirationDate } : {}),
        ...(status ? { applicationStatus: status } : {})
      };

      if (!Object.keys(updatePayload).length) {
        if (onStartEditFPA) {
          onStartEditFPA(targetFPA);
          
          // Set highlight fields for editing (highlight all fields)
          const editHighlightFields = ['fpaNumber', 'landowner', 'timberSaleName', 'landownerType', 'applicationStatus', 'notes'];
          if (targetFPA.applicationStatus === 'In Decision Window') {
            editHighlightFields.push('decisionDeadline');
          }
          if (targetFPA.applicationStatus === 'Approved') {
            editHighlightFields.push('expirationDate');
            editHighlightFields.push('approvedActivity');
          }
          if (onSetHighlightFields) {
            onSetHighlightFields(editHighlightFields);
          }
          
          appendMessage('assistant', `Opened ${targetFPA.fpaNumber} for editing.`);
        } else {
          onSelectFPA(targetFPA.id);
          appendMessage('assistant', `Opened ${targetFPA.fpaNumber} so you can edit it.`);
        }
        return;
      }

      if (onStartEditFPA) {
        const formData = {
          ...targetFPA,
          ...updatePayload
        };
        onStartEditFPA(formData);
        if (onSetFormData) {
          onSetFormData(formData);
        }
        if (onSetHighlightFields) {
          onSetHighlightFields(Object.keys(updatePayload));
        }
        appendMessage('assistant', `Opened ${targetFPA.fpaNumber} in the editor with your requested updates.`);
        return;
      }

      await onUpdateFPA(targetFPA.id, updatePayload);
      appendMessage('assistant', `Updated ${targetFPA.fpaNumber}.`);
      return;
    }

    // If no FPA command matched, use AI for general conversation
    if (isGeminiConfigured()) {
      try {
        const context = getFPAContext(fpas);
        const aiResponse = await getGeminiResponse(text, messages, context);
        appendMessage('assistant', aiResponse);
        return;
      } catch (error) {
        console.error('AI error:', error);
        appendMessage('assistant', `Sorry, I couldn't process that. For FPA commands, ${buildHelp()}`);
        return;
      }
    }

    // Fallback if AI not configured
    appendMessage('assistant', `I can help with FPA management. ${buildHelp()}`);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const value = input.trim();
    if (!value) return;
    setInput('');
    handleUserMessage(value);
  };

  if (!isOpen) {
    return null;
  }

  const latestMessage = messages.length > 0 ? messages[messages.length - 1] : null;

  // Responsive sizing based on viewport
  const isMobile = windowWidth < 768;
  const isTablet = windowWidth < 1024;
  const showUserMessages = !isMobile;
  const panelGridRows = showUserMessages ? 'auto 1fr 62px' : 'auto 52px';
  const inputHeight = isMobile ? '52px' : '62px';
  const headerHeight = isMobile ? '46px' : '54px';
  const outputMaxHeight = isMobile ? '96px' : '80px';
  
  const panelWidth = isMobile ? Math.min(windowWidth - 16, 320) : isTablet ? 360 : 380;
  const panelHeight = isMobile ? Math.min(window.innerHeight - 80, 260) : isTablet ? 500 : 520;
  const bottomPosition = isMobile ? 8 : 24;
  const rightPosition = isMobile ? 8 : 24;

  return (
    <div className="assistant" style={{ 
      position: 'fixed', 
      bottom: `${bottomPosition}px`, 
      right: `${rightPosition}px`, 
      zIndex: 9999, 
      width: `${panelWidth}px`, 
      height: `${panelHeight}px`
    }}>
      <div className="assistant-panel" style={{ 
        width: '100%', 
        height: '100%',
        display: 'grid',
        gridTemplateRows: panelGridRows,
        background: 'var(--bg-secondary)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
        borderRadius: '12px',
        boxSizing: 'border-box',
        overflow: 'hidden'
      }}>
        {/* HEADER + RESPONSE - TOP */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--header-bg)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          boxSizing: 'border-box'
        }}>
          <div className="assistant-header" style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            color: 'var(--text-primary)',
            padding: isMobile ? '8px 12px' : '10px 16px',
            fontWeight: '600',
            borderTopLeftRadius: '12px',
            borderTopRightRadius: '12px',
            height: headerHeight,
            minHeight: headerHeight,
            flexShrink: 0,
            boxSizing: 'border-box'
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: isMobile ? '13px' : '15px' }}>
              <span style={{ fontSize: isMobile ? '16px' : '18px' }}>🤖</span> {!isMobile && 'AI Assistant'}
              <div
                onMouseEnter={() => setShowTip(true)}
                onMouseLeave={() => setShowTip(false)}
                style={{ position: 'relative', marginLeft: '8px' }}
              >
                <button
                  type="button"
                  style={{
                    padding: '4px 8px',
                    background: 'rgba(111, 160, 80, 0.2)',
                    border: '1px solid rgba(111, 160, 80, 0.4)',
                    borderRadius: '3px',
                    color: 'var(--accent-color)',
                    fontSize: '11px',
                    fontWeight: '500',
                    cursor: 'help',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(111, 160, 80, 0.4)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(111, 160, 80, 0.2)'}
                >
                  💡
                </button>
                {showTip && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: '0',
                    marginTop: '6px',
                    background: 'rgba(0, 0, 0, 0.9)',
                    color: 'white',
                    padding: '10px 12px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    lineHeight: '1.4',
                    whiteSpace: 'normal',
                    width: '240px',
                    zIndex: 1000,
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)'
                  }}>
                    {buildHelp()}
                  </div>
                )}
              </div>
            </span>
            <button 
              onClick={() => {
                console.log('🔴 Closing chatbot');
                setIsOpen(false);
              }}
              style={{ 
                background: 'rgba(255, 255, 255, 0.1)', 
                border: '1px solid rgba(255, 255, 255, 0.1)', 
                color: 'var(--text-primary)', 
                fontSize: '20px', 
                cursor: 'pointer',
                padding: '2px 8px',
                borderRadius: '4px',
                fontWeight: 'bold',
                transition: 'all 0.2s ease'
              }}
              onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'}
              onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
              title="Close"
            >
              ×
            </button>
          </div>

          {/* AI RESPONSE BUBBLE */}
          {latestMessage && latestMessage.role === 'assistant' && (
            <div style={{
              padding: isMobile ? '6px 10px' : '8px 12px',
              background: 'rgba(70, 70, 70, 0.7)',
              color: 'var(--text-primary)',
              fontSize: isMobile ? '11px' : '12px',
              lineHeight: '1.4',
              borderTop: '1px solid rgba(255, 255, 255, 0.05)',
              maxHeight: outputMaxHeight,
              overflow: 'auto',
              whiteSpace: 'normal',
              wordWrap: 'break-word',
              overflowWrap: 'break-word',
              wordBreak: 'break-word'
            }}>
              {latestMessage.text}
            </div>
          )}
        </div>
        
        {/* USER MESSAGES - MIDDLE */}
        {showUserMessages && (
          <div className="assistant-messages" style={{
            overflow: 'auto',
            padding: '12px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-start',
            alignItems: 'stretch',
            gap: '8px',
            background: 'var(--bg-secondary)',
            width: '100%',
            boxSizing: 'border-box',
            minHeight: 0
          }}>
            {messages.filter((message) => message.role === 'user').map((message, index) => (
              <div key={`${message.role}-${index}`} className="assistant-msg user" style={{
                padding: '8px 10px',
                borderRadius: '8px',
                fontSize: isMobile ? '12px' : '13px',
                lineHeight: '1.4',
                wordWrap: 'break-word',
                overflowWrap: 'break-word',
                wordBreak: 'break-word',
                maxWidth: '90%',
                whiteSpace: 'normal',
                alignSelf: 'flex-end',
                background: 'var(--accent-color)',
                color: 'white',
                marginLeft: 'auto'
              }}>
                {message.text}
              </div>
            ))}
            <div ref={messagesEndRef} style={{ height: 0 }} />
          </div>
        )}

        {/* INPUT - FIXED 62px BOTTOM */}
        <div className="assistant-input-container" style={{
          display: 'flex',
          gap: '6px',
          padding: isMobile ? '8px 10px' : '10px 12px',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          alignItems: 'flex-end',
          background: 'var(--bg-secondary)',
          minHeight: inputHeight,
          flexShrink: 0,
          boxSizing: 'border-box'
        }}>
          <form onSubmit={handleSubmit} className="assistant-input" style={{ display: 'flex', gap: '6px', flex: 1, alignItems: 'flex-end' }}>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
              placeholder="Tell me..."
              rows="1"
              style={{
                flex: 1,
                padding: isMobile ? '6px 10px' : '8px 12px',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '6px',
                background: 'rgba(0, 0, 0, 0.3)',
                color: 'var(--text-primary)',
                fontSize: isMobile ? '12px' : '13px',
                outline: 'none',
                boxSizing: 'border-box',
                resize: 'none',
                overflow: 'hidden',
                whiteSpace: 'pre-wrap',
                wordWrap: 'break-word',
                maxHeight: '120px',
                overflowY: 'auto',
                fontFamily: 'inherit',
                lineHeight: '1.4'
              }}
            />
            <button type="submit" style={{
              padding: isMobile ? '6px 10px' : '8px 14px',
              background: 'var(--accent-color)',
              border: 'none',
              borderRadius: '6px',
              color: 'white',
              fontWeight: '500',
              cursor: 'pointer',
              fontSize: isMobile ? '11px' : '12px',
              transition: 'opacity 0.2s',
              flexShrink: 0,
              whiteSpace: 'nowrap'
            }}
            onMouseOver={(e) => e.currentTarget.style.opacity = '0.85'}
            onMouseOut={(e) => e.currentTarget.style.opacity = '1'}>
              {isMobile ? 'Send' : 'Send'}
            </button>
          </form>
          {supported && (
            <button 
              type="button" 
              className={`assistant-voice-external ${listening ? 'listening' : ''}`}
              onClick={startListening}
              title="Voice input"
              disabled={listening}
              style={{
                background: listening ? 'rgba(255, 100, 100, 0.3)' : 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '6px',
                padding: isMobile ? '4px 6px' : '6px 8px',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <svg width={isMobile ? "16" : "18"} height={isMobile ? "16" : "18"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1a3 3 0 0 0-3 3v12a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                <line x1="12" y1="19" x2="12" y2="23"></line>
                <line x1="8" y1="23" x2="16" y2="23"></line>
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default ChatAssistant;
