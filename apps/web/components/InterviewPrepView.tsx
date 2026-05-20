import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Sparkles, Lock, Loader2, Phone, Users, Code2, Star, HelpCircle, Printer, RotateCcw, Check, ChevronDown, Mic, Square, AlertTriangle, Scale } from 'lucide-react';
import { UserPlan, ResumeGroup, InterviewPrepKit, JobType, BackgroundJob } from '../types';
import { supabase } from '../lib/supabase';

interface Props { plan: UserPlan; history: ResumeGroup[]; user: any; onUpgrade: () => void; setView?: (v: any) => void; dispatchJob: (type: JobType, payload: any) => Promise<string>; activeJobs: Record<string, BackgroundJob>; }

const BEHAVIORAL_QS = [
  "Tell me about a conflict with a teammate",
  "Describe a failure and what you learned",
  "Tell me about your biggest success",
  "Describe a time you led without authority",
  "Tell me about handling ambiguity",
  "Describe meeting a critical deadline",
  "Tell me about receiving difficult feedback",
  "How have you influenced a decision you disagreed with?",
  "Tell me about adapting to significant change",
  "Describe taking initiative on something not assigned to you",
  "Tell me about a complex cross-team collaboration",
  "How have you grown in the last year?",
];

type QuestionFrequency = 'FAANG STAPLE' | 'VERY COMMON' | 'COMMON';

const BEHAVIORAL_FREQ: QuestionFrequency[] = [
  'FAANG STAPLE', // Tell me about a conflict
  'FAANG STAPLE', // Describe a failure
  'FAANG STAPLE', // Biggest success
  'VERY COMMON',  // Led without authority
  'VERY COMMON',  // Handling ambiguity
  'VERY COMMON',  // Critical deadline
  'VERY COMMON',  // Difficult feedback
  'COMMON',       // Influenced disagreed decision
  'COMMON',       // Adapting to change
  'COMMON',       // Taking initiative
  'VERY COMMON',  // Cross-team collaboration
  'COMMON',       // Grown in last year
];

const FreqBadge: React.FC<{ freq: QuestionFrequency }> = ({ freq }) => (
  <span className={`text-[7px] font-black px-2 py-0.5 rounded uppercase tracking-widest ${
    freq === 'FAANG STAPLE' ? 'bg-red-500/20 text-red-400' :
    freq === 'VERY COMMON' ? 'bg-amber-500/20 text-amber-400' :
    'bg-slate-700 text-slate-500'
  }`}>
    {freq}
  </span>
);

const COACHING_TIPS = [
  {
    title: "💰 The Calibrated Salary Anchor",
    tip: "When asked about compensation, anchor high with a precise range. Say: 'Based on the scope of this role and market rates, I targeting a base of $160,000 to $195,000. I'm flexible based on the total compensation package.'"
  },
  {
    title: "⚡ The 'I' Contribution Mandate",
    tip: "Never say 'we did this' when detailing technical accomplishments. Hiring managers evaluate YOUR individual signal contribution. Always use active singular verbs: 'I designed', 'I spearhead', or 'I refactored'."
  },
  {
    title: "📊 Quantitative Impact Grounding",
    tip: "Always end STAR answers with a hard metric. Instead of saying you 'improved latency', state: 'resulting in a 40% latency reduction (500ms to 300ms) and saving $15,000 in monthly database compute costs.'"
  },
  {
    title: "🎯 Filler Elimination Strategy",
    tip: "Our speech diagnostics scan for 'like', 'um', 'uh', and 'basically'. Pausing in silence for 1-2 seconds between ideas communicates elite executive presence and builds suspense for your next point."
  },
  {
    title: "🏗️ System Design Trade-Offs",
    tip: "For staff or senior roles, never pitch a single perfect design. Start by discussing trade-offs: 'We can optimize for write-heavy consistency or eventual consistency with high partition tolerance...'"
  }
];

const hashStr = (s: string) => {
  const key = `len${s.length}_${s.slice(0, 40)}_${s.slice(-20)}`;
  return key.replace(/\W/g, '_');
};

const VoicePracticeWidget: React.FC<{
  questionText: string;
  resumeText: string;
  user: any;
}> = ({ questionText, resumeText, user }) => {
  const [active, setActive] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isTypingMode, setIsTypingMode] = useState(false);
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedback, setFeedback] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showRubric, setShowRubric] = useState(true);

  const recognitionRef = useRef<any>(null);

  const isSpeechSupported = useMemo(() => {
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    return !!SpeechRec;
  }, []);

  useEffect(() => {
    if (!isSpeechSupported) {
      setIsTypingMode(true);
    }
  }, [isSpeechSupported]);

  // Safely stop recognition on unmount to prevent resource leaks or errors
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          // safe to ignore
        }
      }
    };
  }, []);

  useEffect(() => {
    let timer: any;
    if (isRecording) {
      timer = setInterval(() => {
        setSecondsElapsed(s => s + 1);
      }, 1000);
    } else {
      timer = 0;
    }
    return () => clearInterval(timer);
  }, [isRecording]);

  const fillerCounts = useMemo(() => {
    const fillers = { like: 0, um: 0, uh: 0, basically: 0, so: 0, actually: 0, "you know": 0 };
    const normalized = transcript.toLowerCase();
    Object.keys(fillers).forEach(word => {
      const regex = new RegExp(`\\b${word}\\b`, 'g');
      const matches = normalized.match(regex);
      fillers[word as keyof typeof fillers] = matches ? matches.length : 0;
    });
    return fillers;
  }, [transcript]);

  const totalFillers = useMemo(() => {
    return Object.values(fillerCounts).reduce((a, b) => a + b, 0);
  }, [fillerCounts]);

  const wpm = useMemo(() => {
    const wordCount = transcript.trim() ? transcript.split(/\s+/).length : 0;
    return secondsElapsed > 2 ? Math.round((wordCount / secondsElapsed) * 60) : 0;
  }, [transcript, secondsElapsed]);

  const startPractice = () => {
    setError(null);
    setFeedback(null);
    setTranscript('');
    setSecondsElapsed(0);

    if (isTypingMode) {
      setIsRecording(true);
      return;
    }

    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      setIsTypingMode(true);
      setIsRecording(true);
      return;
    }

    if (recognitionRef.current) recognitionRef.current.stop();

    const recognition = new SpeechRec();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: any) => {
      const text = Array.from(event.results)
        .map((result: any) => result[0].transcript)
        .join('');
      setTranscript(text);
    };

    recognition.onerror = (e: any) => {
      console.error(e);
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
  };

  const stopPractice = async () => {
    setIsRecording(false);
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }

    if (!transcript.trim() || transcript.length < 10) {
      setError('Please provide a longer answer before getting feedback.');
      return;
    }

    setFeedbackLoading(true);
    setError(null);

    try {
      let resultData;
      try {
        const { data, error: invokeError } = await supabase.functions.invoke('evaluate-voice-answer', {
          body: { question: questionText, transcript, resume_text: resumeText }
        });

        if (invokeError || !data) {
          throw new Error(invokeError?.message || 'Failed to communicate with secure evaluation server.');
        }
        resultData = data;
      } catch (invokeErr: any) {
        console.warn('Supabase Edge Function failed, falling back to direct Gemini audit:', invokeErr);
        const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
        if (!apiKey) {
          throw new Error('Failed to communicate with evaluation server, and no backup API key is configured.');
        }

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text:
                `You are an elite silicon valley mock interview speech coach.
Evaluate this spoken answer to the following interview question.

Question: "${questionText}"
Spoken Answer (Transcribed): "${transcript}"
User's Resume context for anchoring: "${String(resumeText || '').slice(0, 1000)}"

Analyze the response against standard professional rubrics:
1. STAR Framework Check: Did they state the Situation, Task, Action, and Result?
2. Score: 40-100 based on structure, technical specificity, ownership verbs, and measurable impact.
3. Strength: What was the absolute best element of their answer?
4. Gap: What critical detail is missing?
5. Suggested Addition: A precise, high-impact sentence they could say to instantly improve their answer.
6. Delivery / Structure critique: Feedback on flow and depth.

You MUST respond with a strict, valid JSON matching this schema:
{
  "score": <number 40-100>,
  "strength": "<string>",
  "gap": "<string>",
  "suggestedAddition": "<string>",
  "starCheck": {
    "situation": <boolean>,
    "task": <boolean>,
    "action": <boolean>,
    "result": <boolean>
  },
  "deliveryCritique": "<string>"
}

Do not return any markdown wrappers, just the raw JSON.`
              }] }],
              generationConfig: { responseMimeType: 'application/json', temperature: 0.3 },
            }),
          }
        );

        if (!response.ok) {
          throw new Error(`Direct audit failed (Status: ${response.status}).`);
        }

        const geminiRes = await response.json();
        const rawText = geminiRes.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';
        
        // Clean markdown formatting if returned
        const cleaned = rawText.replace(/```json/i, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleaned);
        
        if (typeof parsed.score !== 'number') {
          throw new Error('Invalid assessment response format.');
        }
        
        resultData = parsed;
      }

      setFeedback(resultData);

      // Save practice telemetry to localStorage
      try {
        const savedSessions = localStorage.getItem(`hiremax_practice_history_${user?.id || 'anon'}`);
        const historyList = savedSessions ? JSON.parse(savedSessions) : [];
        const newSession = {
          id: Math.random().toString(36).substring(2, 11),
          questionText,
          timestamp: new Date().toISOString(),
          score: resultData.score || 70,
          wpm: wpm || 0,
          fillers: totalFillers || 0,
          deliveryCritique: resultData.deliveryCritique || '',
          mode: isTypingMode ? 'Keyboard' : 'Voice',
          transcript,
          feedback: resultData
        };
        historyList.unshift(newSession);
        localStorage.setItem(`hiremax_practice_history_${user?.id || 'anon'}`, JSON.stringify(historyList.slice(0, 100)));
        
        // Dispatch custom event to notify parent view to reload
        window.dispatchEvent(new CustomEvent('hiremax_practice_added'));
      } catch (historyErr) {
        console.error('Failed to save practice history:', historyErr);
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during evaluation.');
    } finally {
      setFeedbackLoading(false);
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  if (!active) {
    return (
      <button
        onClick={() => setActive(true)}
        className="flex items-center gap-2 text-[9px] font-black text-slate-500 hover:text-blue-400 uppercase tracking-widest transition-colors bg-white/5 hover:bg-blue-500/5 border border-white/5 hover:border-blue-500/20 px-4 py-2.5 rounded-xl"
      >
        🎤 Practice Out Loud
      </button>
    );
  }

  return (
    <div className="bg-[#0D0D12] border border-white/10 rounded-2xl p-5 space-y-4 animate-in fade-in duration-300">
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes bounceBar {
          0%, 100% { transform: scaleY(0.15); }
          50% { transform: scaleY(1.0); }
        }
      `}} />
      <div className="flex items-center justify-between border-b border-white/5 pb-3">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Practice Terminal</p>
        <div className="flex gap-2">
          {isSpeechSupported && (
            <button
              onClick={() => {
                if (isRecording) return;
                setIsTypingMode(!isTypingMode);
                setTranscript('');
              }}
              className="text-[8px] font-black text-slate-500 hover:text-white uppercase tracking-wider bg-white/5 px-2.5 py-1 rounded-lg transition-all"
            >
              {isTypingMode ? '🎙️ Switch to Voice' : '⌨️ Switch to Keyboard'}
            </button>
          )}
          <button
            onClick={() => {
              setIsRecording(false);
              if (recognitionRef.current) recognitionRef.current.stop();
              setActive(false);
              setFeedback(null);
              setTranscript('');
            }}
            className="text-[8px] font-black text-red-400 hover:text-red-300 uppercase tracking-wider bg-red-500/10 px-2.5 py-1 rounded-lg transition-all"
          >
            Close
          </button>
        </div>
      </div>

      {/* Judgment Rubric Guide (High Startup Quality) */}
      {showRubric && (
        <div className="bg-blue-500/5 border border-blue-500/10 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs">⚖️</span>
              <p className="text-[10px] font-black text-blue-400 uppercase tracking-wider">How You Are Judged (Gemini 2.0 Rubric)</p>
            </div>
            <button 
              onClick={() => setShowRubric(false)}
              className="text-[8px] font-black text-slate-500 hover:text-white uppercase tracking-wider"
            >
              Hide
            </button>
          </div>
          <p className="text-[10px] text-slate-400 leading-relaxed">
            Our AI analysis matches real-world seed-to-scale criteria. Take note of these core grading pillars:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[9px] text-slate-300">
            <div className="space-y-1">
              <p className="font-bold text-white uppercase tracking-wide text-[8px] text-green-400">1. STAR Structure Rubric</p>
              <p className="leading-relaxed">Verify you specify a Situation, your clear Task, the exact Action you drove, and a quantitative, hard Result.</p>
            </div>
            <div className="space-y-1">
              <p className="font-bold text-white uppercase tracking-wide text-[8px] text-amber-400">2. Pacing Telemetry (120-160 WPM)</p>
              <p className="leading-relaxed">Keep your flow in the elite bracket of 120–160 WPM. Too fast can feel frantic; too slow lacks crisp executive presence.</p>
            </div>
            <div className="space-y-1">
              <p className="font-bold text-white uppercase tracking-wide text-[8px] text-red-400">3. Filler Counter Checks</p>
              <p className="leading-relaxed">We scan for <strong className="text-red-400">like, um, uh, basically, so, actually</strong>. Keep filler rates near zero.</p>
            </div>
            <div className="space-y-1">
              <p className="font-bold text-white uppercase tracking-wide text-[8px] text-blue-400">4. Executive Context Grounding</p>
              <p className="leading-relaxed">Your answers are matched against your uploaded resume credentials to evaluate signal strength and depth.</p>
            </div>
          </div>
        </div>
      )}

      {!showRubric && (
        <button 
          onClick={() => setShowRubric(true)}
          className="text-[8px] font-black text-blue-400 hover:text-blue-300 uppercase tracking-widest bg-blue-500/5 px-3 py-1.5 rounded-lg border border-blue-500/10 flex items-center gap-1.5"
        >
          <span>⚖️ Show Judgment Rubric</span>
        </button>
      )}

      {/* Recording State / Keyboard Practice State */}
      {isRecording ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
              <span className="text-[9px] font-black uppercase text-red-500 tracking-widest">
                {isTypingMode ? 'Typing Mode Active' : 'Recording Live'}
              </span>
            </div>
            {!isTypingMode && (
              <span className="text-xs font-mono text-slate-400 font-bold bg-white/5 px-3 py-1 rounded-lg">
                {formatTime(secondsElapsed)}
              </span>
            )}
          </div>

          {/* Visual Waveform for speech */}
          {!isTypingMode && (
            <div className="bg-[#121218] border border-white/5 rounded-xl p-4 flex flex-col items-center justify-center">
              <div className="flex items-end justify-center gap-1.5 h-10 w-full max-w-[200px]">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(bar => (
                  <div
                    key={bar}
                    className="w-1 bg-gradient-to-t from-blue-500 to-indigo-500 rounded-full transition-all"
                    style={{
                      height: '100%',
                      transformOrigin: 'bottom',
                      animation: `bounceBar ${0.5 + (bar % 3) * 0.15}s ease-in-out infinite alternate`,
                      animationDelay: `${bar * 0.04}s`
                    }}
                  />
                ))}
              </div>
              <p className="text-[8px] text-slate-500 font-black uppercase tracking-widest mt-2.5">micro-telemetry active</p>
            </div>
          )}

          {/* Transcript view / Textarea input */}
          <div className="space-y-2">
            <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest font-bold">Your Practice Response</label>
            {isTypingMode ? (
              <textarea
                value={transcript}
                onChange={e => setTranscript(e.target.value)}
                placeholder="Type your practice response here..."
                rows={4}
                className="w-full bg-[#07070A] border border-white/10 rounded-xl p-3 text-white text-xs outline-none focus:border-blue-500/40 resize-none transition-all"
              />
            ) : (
              <div className="bg-[#07070A] border border-white/10 rounded-xl p-4 min-h-[90px] text-slate-300 text-xs leading-relaxed italic">
                {transcript || 'Speak clearly. Your real-time transcript will stream here...'}
              </div>
            )}
          </div>

          {/* Real-time Filler Word Tracker */}
          {!isTypingMode && transcript.length > 0 && (
            <div className="bg-[#07070A] border border-white/5 rounded-xl p-3">
              <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-2">Live Filler Diagnostics</p>
              <div className="grid grid-cols-4 gap-2">
                {Object.entries(fillerCounts).map(([word, count]) => (
                  <div key={word} className={`flex items-center justify-between px-2 py-1 rounded-lg border text-[8px] font-black uppercase ${
                    count > 0 ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : 'bg-white/5 border-white/5 text-slate-600'
                  }`}>
                    <span>{word}</span>
                    <span className="font-mono text-[9px] font-bold">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* WPM Speedometer */}
          {!isTypingMode && secondsElapsed > 2 && (
            <div className="flex items-center justify-between px-3 py-2 bg-[#07070A] border border-white/5 rounded-xl">
              <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Pacing Speedometer</span>
              <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${
                wpm >= 120 && wpm <= 160 ? 'bg-green-500/20 text-green-400' : 'bg-amber-500/20 text-amber-400'
              }`}>
                {wpm} WPM ({wpm >= 120 && wpm <= 160 ? 'Optimal Zone' : wpm > 160 ? 'Too Fast' : 'Too Slow'})
              </span>
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={stopPractice}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white font-black text-[9px] uppercase tracking-widest px-4 py-2.5 rounded-xl transition-all"
            >
              ⏹ Complete & Analyze Response
            </button>
            {isTypingMode && (
              <button
                onClick={() => setIsRecording(false)}
                className="text-slate-500 hover:text-white text-[9px] font-black uppercase tracking-widest px-3 py-2 rounded-xl bg-white/5 transition-all"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {!isSpeechSupported && (
            <div className="bg-amber-500/15 border border-amber-500/25 rounded-xl p-3 flex gap-2">
              <span className="text-base">🎙️</span>
              <p className="text-[10px] text-amber-400 leading-normal">
                <strong>Typing Practice Mode Enabled.</strong> Voice practice requires Chrome or Edge browser. Get started by entering your answer below.
              </p>
            </div>
          )}

          {/* Feedback loading */}
          {feedbackLoading && (
            <div className="flex flex-col items-center justify-center p-6 bg-blue-500/5 border border-blue-500/10 rounded-xl space-y-3">
              <Loader2 size={20} className="text-blue-400 animate-spin" />
              <p className="text-blue-400 text-xs font-black uppercase tracking-widest animate-pulse">Running secure intelligence audit...</p>
            </div>
          )}

          {/* Error */}
          {error && (
            <p className="text-red-400 text-[11px] font-medium bg-red-500/10 border border-red-500/20 rounded-xl p-3.5">
              {error}
            </p>
          )}

          {/* Feedback details */}
          {feedback ? (
            <div className="space-y-3.5 bg-[#07070A] border border-white/10 rounded-xl p-5">
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <div>
                  <p className="text-[7px] font-black text-slate-500 uppercase tracking-widest">Coaching Report</p>
                  <p className="text-[10px] text-slate-400 font-bold mt-0.5">STAR Audit Complete</p>
                </div>
                <div className="flex flex-col items-end">
                  <span className={`font-black text-2xl leading-none ${
                    feedback.score >= 80 ? 'text-green-400' : feedback.score >= 60 ? 'text-amber-400' : 'text-red-400'
                  }`}>
                    {feedback.score}/100
                  </span>
                  <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest mt-1">SaaS score index</span>
                </div>
              </div>

              {/* STAR Framework Pill badges */}
              <div className="space-y-1.5">
                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Semantic Framework Alignment</p>
                <div className="flex gap-1.5 flex-wrap">
                  {['Situation', 'Task', 'Action', 'Result'].map(part => {
                    const detected = feedback.starCheck?.[part.toLowerCase() as 'situation'|'task'|'action'|'result'];
                    return (
                      <span key={part} className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-wider border ${
                        detected 
                          ? 'bg-green-500/10 border-green-500/20 text-green-400' 
                          : 'bg-red-500/5 border-red-500/15 text-slate-500'
                      }`}>
                        {detected ? '✓' : '✗'} {part}
                      </span>
                    );
                  })}
                </div>
              </div>

              {/* Strengths & Gaps */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                <div className="border-l-4 border-green-500 pl-4 py-1.5">
                  <p className="text-[7px] font-black text-green-400 uppercase tracking-widest mb-1">Elite Strength</p>
                  <p className="text-slate-300 text-[11px] leading-relaxed">{feedback.strength}</p>
                </div>
                <div className="border-l-4 border-red-500 pl-4 py-1.5">
                  <p className="text-[7px] font-black text-red-400 uppercase tracking-widest mb-1">Identified Gap</p>
                  <p className="text-slate-300 text-[11px] leading-relaxed">{feedback.gap}</p>
                </div>
              </div>

              {/* Suggested Addition */}
              <div className="border-l-4 border-blue-500 pl-4 py-1.5">
                <p className="text-[7px] font-black text-blue-400 uppercase tracking-widest mb-1">Silicon Valley Anchor (Say This)</p>
                <p className="text-white text-[11px] leading-relaxed font-medium italic">"{feedback.suggestedAddition}"</p>
              </div>

              {/* Delivery Critique */}
              {feedback.deliveryCritique && (
                <div className="border-l-4 border-violet-500 pl-4 py-1.5">
                  <p className="text-[7px] font-black text-violet-400 uppercase tracking-widest mb-1">Vocal Delivery & Flow Coaching</p>
                  <p className="text-slate-300 text-[11px] leading-relaxed">{feedback.deliveryCritique}</p>
                </div>
              )}

              {/* Speech Telemetry Results (Only when actually recording speech) */}
              {wpm > 0 && (
                <div className="bg-[#0D0D12] border border-white/5 rounded-lg p-3 text-[10px] text-slate-400 space-y-1.5">
                  <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Speech Diagnostics Telemetry</p>
                  <div className="flex justify-between">
                    <span>Speech Rate: <strong className="text-white">{wpm} WPM</strong></span>
                    <span>Filler Words Used: <strong className="text-white">{totalFillers}</strong></span>
                  </div>
                </div>
              )}

              <button
                onClick={startPractice}
                className="flex items-center gap-2 bg-[#1A1D26] hover:bg-white/5 text-white border border-white/10 font-black text-[9px] uppercase tracking-widest px-4 py-2.5 rounded-xl transition-all"
              >
                🔄 Practice Again
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-8 bg-[#07070A] border border-white/5 rounded-xl">
              <span className="text-3xl mb-3">{isTypingMode ? '⌨️' : '🎙️'}</span>
              <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mb-4">
                {isTypingMode ? 'Keyboard Practice Simulator' : 'Acoustic Speech Simulator'}
              </p>
              <button
                onClick={startPractice}
                className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-[10px] uppercase tracking-widest px-6 py-3.5 rounded-xl transition-all shadow-lg shadow-blue-500/20 animate-pulse"
              >
                {isTypingMode ? '⌨️ Start Typing Practice' : '🎤 Initialize Speech Capturer'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const InterviewPrepView: React.FC<Props> = ({ plan, history, user, onUpgrade, setView, dispatchJob, activeJobs }) => {
  const isElite = plan === 'Career Elite' || plan === 'Automation';
  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadMsg, setLoadMsg] = useState('');
  const [kit, setKit] = useState<InterviewPrepKit | null>(null);
  const [error, setError] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('');
  const [form, setForm] = useState({ jobDescription: '', companyStage: 'FAANG / Big Tech', roleLevel: 'Senior (IC5)' });
  const [stars, setStar] = useState<Record<number,{action:string;result:string}>>({});
  const [savedKeys, setSavedKeys] = useState<Set<number>>(new Set());
  const [trackingJobId, setTrackingJobId] = useState<string | null>(null);
  const [loadProgress, setLoadProgress] = useState(0);
  const [activeTip, setActiveTip] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [practiceHistory, setPracticeHistory] = useState<any[]>([]);
  const [prepHistory, setPrepHistory] = useState<any[]>([]);

  const loadHistories = useCallback(() => {
    try {
      const savedPrep = localStorage.getItem(`hiremax_prep_history_${user?.id || 'anon'}`);
      if (savedPrep) {
        setPrepHistory(JSON.parse(savedPrep));
      }
      const savedPractice = localStorage.getItem(`hiremax_practice_history_${user?.id || 'anon'}`);
      if (savedPractice) {
        setPracticeHistory(JSON.parse(savedPractice));
      }
    } catch (e) {
      console.error('Failed to load local history caches', e);
    }
  }, [user]);

  useEffect(() => {
    loadHistories();
    window.addEventListener('hiremax_practice_added', loadHistories);
    return () => {
      window.removeEventListener('hiremax_practice_added', loadHistories);
    };
  }, [loadHistories]);

  // Load last active prep session on mount
  useEffect(() => {
    try {
      const active = localStorage.getItem(`hiremax_active_prep_session_${user?.id || 'anon'}`);
      if (active) {
        const { kit: savedKit, formDetails, tab: savedTab } = JSON.parse(active);
        if (savedKit) {
          setKit(savedKit);
          if (formDetails) setForm(formDetails);
          if (typeof savedTab === 'number') setTab(savedTab);
        }
      }
    } catch (e) {
      console.error('Failed to load active prep session:', e);
    }
  }, [user]);

  const loadKit = useCallback((loadedKit: InterviewPrepKit, details: any, defaultTab: number = 0) => {
    setKit(loadedKit);
    setForm(details);
    setTab(defaultTab);
    try {
      localStorage.setItem(`hiremax_active_prep_session_${user?.id || 'anon'}`, JSON.stringify({
        kit: loadedKit,
        formDetails: details,
        tab: defaultTab
      }));
    } catch (err) {
      console.error('Failed to cache active prep session:', err);
    }
  }, [user]);

  const changeTab = useCallback((newTab: number) => {
    setTab(newTab);
    try {
      const active = localStorage.getItem(`hiremax_active_prep_session_${user?.id || 'anon'}`);
      if (active) {
        const parsed = JSON.parse(active);
        parsed.tab = newTab;
        localStorage.setItem(`hiremax_active_prep_session_${user?.id || 'anon'}`, JSON.stringify(parsed));
      }
    } catch {}
  }, [user]);

  const [debouncedJD, setDebouncedJD] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedJD(form.jobDescription), 800);
    return () => clearTimeout(timer);
  }, [form.jobDescription]);


  const resumeText = useMemo(() => {
    const g = history.find(h => h.id === selectedGroup) || history[0];
    const v = g?.versions?.[g.versions.length - 1];
    if (!v?.data) return '';
    const d = v.data;
    return [
      d.contact?.full_name,
      d.summary,
      ...(d.experience || []).map((e: any) =>
        `${e.title} at ${e.organization}: ${e.bullets?.join('; ')}`
      ),
      ...(d.skills ? Object.values(d.skills).flat() : []),
    ].filter(Boolean).join('\n');
  }, [history, selectedGroup]);

  const jdHash = hashStr(form.jobDescription);

  useEffect(() => {
    if (!debouncedJD) return;
    try {
      const cached = localStorage.getItem(`hiremax_prep_${jdHash}`);
      if (cached) {
        const { kit: k, ts } = JSON.parse(cached);
        if (Date.now() - ts < 4 * 3600000) { loadKit(k, form); }
      }
    } catch {}
  }, [debouncedJD]);

  useEffect(() => {
    if (!user) return;
    try {
      const saved = localStorage.getItem(`hiremax_star_${user.id}`);
      if (saved) setStar(JSON.parse(saved));
    } catch {}
  }, [user]);

  useEffect(() => {
    if (!trackingJobId) return;
    const activeJob = activeJobs[trackingJobId];
    if (!activeJob) return;

    if (activeJob.status === 'RUNNING') {
      setLoading(true);
    } else if (activeJob.status === 'COMPLETED' && activeJob.result) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      loadKit(activeJob.result, { ...form });
      localStorage.setItem(`hiremax_prep_${jdHash}`, JSON.stringify({ kit: activeJob.result, ts: Date.now() }));

      // Save prep run into persistent list of history
      try {
        const savedPrep = localStorage.getItem(`hiremax_prep_history_${user?.id || 'anon'}`);
        const list = savedPrep ? JSON.parse(savedPrep) : [];
        const cleanedList = list.filter((item: any) => item.hash !== jdHash);
        const newRecord = {
          id: Math.random().toString(36).substring(2, 11),
          hash: jdHash,
          roleTitle: form.roleLevel,
          companyName: form.companyStage,
          timestamp: new Date().toISOString(),
          kit: activeJob.result,
          formDetails: { ...form }
        };
        cleanedList.unshift(newRecord);
        localStorage.setItem(`hiremax_prep_history_${user?.id || 'anon'}`, JSON.stringify(cleanedList.slice(0, 50)));
        setPrepHistory(cleanedList);
      } catch (historyErr) {
        console.error('Failed to update prep history cache', historyErr);
      }

      setTrackingJobId(null);
      setLoading(false);
    } else if (activeJob.status === 'FAILED') {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setError(activeJob.error || 'Generation failed.');
      setTrackingJobId(null);
      setLoading(false);
    }
  }, [activeJobs, trackingJobId, jdHash]);

  useEffect(() => {
    let progressTimer: any;
    let tipTimer: any;

    if (loading) {
      setLoadProgress(0);
      setActiveTip(0);

      progressTimer = setInterval(() => {
        setLoadProgress(prev => {
          if (prev >= 98) return 98;
          const increment = Math.floor(Math.random() * 5) + 3; // 3% to 7%
          return Math.min(prev + increment, 98);
        });
      }, 1000);

      tipTimer = setInterval(() => {
        setActiveTip(prev => (prev + 1) % COACHING_TIPS.length);
      }, 4000);
    } else {
      setLoadProgress(0);
    }

    return () => {
      clearInterval(progressTimer);
      clearInterval(tipTimer);
    };
  }, [loading]);

  const generate = async () => {
    if (!isElite) { onUpgrade(); return; }
    if (!form.jobDescription.trim()) { setError('Paste a job description to continue.'); return; }
    setLoading(true); setError('');
    const msgs = ['Generating Prep Kit…', 'Building from your resume…', 'Calibrating for company stage…'];
    
    let i = 0;
    intervalRef.current = setInterval(() => {
      setLoadMsg(msgs[i++ % msgs.length]);
    }, 1800);

    try {
      const jobId = await dispatchJob('PREP', {
        job_description: form.jobDescription,
        resume_text: resumeText,
        company_stage: form.companyStage,
        role_level: form.roleLevel
      });
      setTrackingJobId(jobId);
    } catch (err: any) {
      setError(err.message || 'Generation failed.');
      setLoading(false);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
  };




  const saveStar = (idx: number, field: 'action'|'result', val: string) => {
    setStar(prev => {
      const current = prev[idx] || { action: '', result: '' };
      const next = { ...prev, [idx]: { ...current, [field]: val } };
      if (user) localStorage.setItem(`hiremax_star_${user.id}`, JSON.stringify(next));
      return next;
    });
  };

  const markSaved = (idx: number) => setSavedKeys(prev => new Set([...prev, idx]));

  const doneCount = Object.entries(stars).filter(([,v]) => v.action && v.result).length;

  const exportKit = () => {
    const w = window.open('','_blank'); if (!w) return;
    const c = document.getElementById('prep-export')?.innerHTML || '';
    w.document.write(`<html><head><title>Interview Prep Kit</title><style>body{font-family:sans-serif;padding:40px;max-width:800px;margin:0 auto;font-size:13px;line-height:1.7}h2{font-size:16px;font-weight:900;margin:28px 0 10px;border-bottom:2px solid #e5e7eb;padding-bottom:6px}</style></head><body>${c}<script>window.onload=()=>window.print()<\/script></body></html>`);
    w.document.close();
  };

  if (!isElite) return (
    <div className="max-w-[700px] mx-auto py-24 px-8 flex flex-col items-center gap-6 text-center">
      <div className="w-20 h-20 rounded-3xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center"><Lock size={32} className="text-amber-500" /></div>
      <h2 className="text-4xl font-black text-white uppercase tracking-tighter">Elite Feature</h2>
      <p className="text-slate-400 max-w-md">Interview Prep builds personalized answers from YOUR resume — not generic templates. Pre-fills STAR with your actual bullets. Available on Career Elite.</p>
      <button onClick={onUpgrade} className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black px-10 py-4 rounded-2xl uppercase tracking-widest text-sm shadow-xl shadow-blue-500/20 hover:opacity-90 transition-all">Upgrade to Elite →</button>
    </div>
  );

  return (
    <div className="max-w-[1400px] mx-auto py-14 px-8 animate-in fade-in duration-500">
      <div className="flex items-start justify-between mb-10">
        <div>
          <div className="flex items-center gap-2 mb-3"><Sparkles size={13} className="text-blue-400 animate-pulse" /><span className="text-[9px] font-black text-blue-400 uppercase tracking-widest bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/20">AI Interview Engine</span></div>
          <h2 className="text-5xl font-black tracking-tighter uppercase bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400 mb-2">Interview Prep Kit</h2>
          <p className="text-slate-400">Answers built from your actual resume. Not templates.</p>
        </div>
        {kit && <div className="flex gap-2">
          <button onClick={exportKit} className="flex items-center gap-2 bg-[#1A1D26] border border-white/10 text-white px-4 py-2.5 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-white/5 transition-all"><Printer size={13} />Export</button>
          <button onClick={() => { setKit(null); localStorage.removeItem(`hiremax_active_prep_session_${user?.id || 'anon'}`); }} className="flex items-center gap-2 bg-[#1A1D26] border border-white/10 text-slate-400 px-4 py-2.5 rounded-xl font-black text-[9px] uppercase tracking-widest hover:text-white transition-all"><RotateCcw size={13} />New Kit</button>
        </div>}
      </div>

      {!kit ? (
        loading ? (
          <div className="max-w-[700px] mx-auto py-16 px-8 bg-[#111118]/80 backdrop-blur-xl border border-white/5 rounded-[2.5rem] flex flex-col items-center gap-8 text-center relative overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-500">
            {/* Glowing Accent Orbs */}
            <div className="absolute -top-32 -left-32 w-64 h-64 bg-blue-500/10 rounded-full blur-[80px]" />
            <div className="absolute -bottom-32 -right-32 w-64 h-64 bg-indigo-500/10 rounded-full blur-[80px]" />

            {/* Pulsing Outer Circle */}
            <div className="relative w-24 h-24 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 p-[1px] animate-pulse">
              <div className="w-full h-full rounded-full bg-[#0A0A0F] flex items-center justify-center">
                <Loader2 size={36} className="text-blue-400 animate-spin" />
              </div>
            </div>

            {/* Status Tracking Header */}
            <div className="space-y-2 relative z-10">
              <h3 className="text-2xl font-black tracking-tight text-white uppercase">{loadMsg || 'Calibrating AI Copilot...'}</h3>
              <p className="text-[10px] font-bold text-blue-400 uppercase tracking-[0.25em]">Precision Calibration Sequence</p>
            </div>

            {/* Progress Telemetry Tracker */}
            <div className="w-full max-w-[450px] space-y-3 relative z-10">
              <div className="flex justify-between text-[9px] font-black text-slate-500 uppercase tracking-widest px-1">
                <span>ANALYZING SIGNAL LEVEL</span>
                <span className="text-blue-400 font-bold">{loadProgress}%</span>
              </div>
              <div className="w-full h-2 bg-[#0D0D12] rounded-full overflow-hidden border border-white/5 p-[1px]">
                <div 
                  className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-700 ease-out"
                  style={{ width: `${loadProgress}%` }}
                />
              </div>
            </div>

            {/* Carousel Divider */}
            <div className="w-full max-w-[150px] h-[1px] bg-white/5 my-2 relative z-10" />

            {/* Rotating Coaching Insights Carousel */}
            <div className="w-full max-w-[500px] bg-[#0A0A0F]/60 border border-white/5 rounded-2xl p-6 min-h-[140px] flex flex-col justify-center transition-all duration-500 relative z-10">
              <span className="text-[8px] font-black text-indigo-400 uppercase tracking-[0.3em] block mb-2">
                Silicon Valley Executive Insights
              </span>
              <h4 className="text-xs font-black text-white mb-2">
                {COACHING_TIPS[activeTip].title}
              </h4>
              <p className="text-[11px] text-slate-400 leading-relaxed italic">
                "{COACHING_TIPS[activeTip].tip}"
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-8">
              <div className="bg-[#111118] border border-white/5 rounded-[2rem] p-10 space-y-7">
                <div>
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] block mb-2">Job Description *</label>
                  <textarea value={form.jobDescription} onChange={e => setForm(f=>({...f,jobDescription:e.target.value}))} rows={10} placeholder="Paste the full job description…" className="w-full bg-[#0A0A0F] border border-white/8 rounded-2xl p-5 text-white text-sm outline-none focus:border-blue-500/40 resize-none placeholder:text-slate-700 transition-all" />
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] block mb-2">Select Resume</label>
                  <select value={selectedGroup} onChange={e => setSelectedGroup(e.target.value)} className="w-full bg-[#0A0A0F] border border-white/8 rounded-2xl p-4 text-white text-sm outline-none focus:border-blue-500/40 transition-all">
                    {history.length === 0 && <option value="">No resumes — paste job description only</option>}
                    {history.map(g => <option key={g.id} value={g.id}>{g.name} ({g.versions?.length||0} versions)</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] block mb-3">Company Stage</label>
                  <div className="flex flex-wrap gap-2">{['FAANG / Big Tech','Growth Startup (Series A-C)','Enterprise','Early Stage / Pre-seed'].map(s=>(
                    <button key={s} onClick={()=>setForm(f=>({...f,companyStage:s}))} className={`px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all border ${form.companyStage===s?'bg-blue-600 border-blue-600 text-white':'bg-[#0A0A0F] border-white/8 text-slate-500 hover:border-white/15 hover:text-white'}`}>{s}</button>
                  ))}</div>
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] block mb-3">Role Level</label>
                  <div className="flex flex-wrap gap-2">{['Junior (IC3)','Mid (IC4)','Senior (IC5)','Staff+ (IC6)','Manager'].map(s=>(
                    <button key={s} onClick={()=>setForm(f=>({...f,roleLevel:s}))} className={`px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all border ${form.roleLevel===s?'bg-indigo-600 border-indigo-600 text-white':'bg-[#0A0A0F] border-white/8 text-slate-500 hover:border-white/15 hover:text-white'}`}>{s}</button>
                  ))}</div>
                </div>
                {error && <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-2xl p-4">{error}</p>}
                <button onClick={generate} disabled={loading} className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white font-black py-5 rounded-2xl uppercase tracking-widest text-sm shadow-xl shadow-blue-500/20 flex items-center justify-center gap-3 transition-all">
                  {loading ? <><Loader2 size={18} className="animate-spin" />{loadMsg}</> : <><Sparkles size={18} />Generate Prep Kit</>}
                </button>
              </div>
            </div>
            <div className="lg:col-span-4 space-y-6">
              <div className="bg-[#16161E] border border-white/5 rounded-[2rem] p-7">
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] mb-6">What You Get</p>
                {[['📞 Recruiter Screen','5 questions + salary anchor script'],['🧑 HM Screen','6 JD-extracted questions + resume anchors'],['⚙️ Technical','Detected round type + calibrated questions'],['⭐ Behavioral (STAR)','12 questions pre-filled from YOUR resume'],['❓ Ask Them','10 smart questions that signal preparation']].map(([t,d])=>(
                  <div key={t} className="flex gap-3 mb-5 last:mb-0">
                    <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0"/>
                    <div><p className="text-white font-black text-xs">{t}</p><p className="text-slate-600 text-[10px] mt-0.5">{d}</p></div>
                  </div>
                ))}
              </div>

              {/* Mock Telemetry Summary Widget */}
              {practiceHistory.length > 0 && (
                <div className="bg-[#111118]/80 backdrop-blur-xl border border-white/5 rounded-[2rem] p-7 space-y-4 animate-in fade-in duration-300">
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em]">📊 Telemetry Summary</p>
                  {(() => {
                    const validWpms = practiceHistory.filter(h => h.wpm > 0);
                    const avgWpm = validWpms.length > 0 ? Math.round(validWpms.reduce((a,b) => a + b.wpm, 0) / validWpms.length) : 0;
                    const avgScore = Math.round(practiceHistory.reduce((a,b) => a + b.score, 0) / practiceHistory.length);
                    const totalUmUh = practiceHistory.reduce((a,b) => a + b.fillers, 0);
                    return (
                      <div className="space-y-4">
                        <div className="flex justify-between items-center bg-[#07070A] border border-white/5 p-4 rounded-2xl">
                          <div>
                            <p className="text-[7px] font-black text-slate-500 uppercase tracking-wider">Average Voice Score</p>
                            <p className="text-xl font-black text-green-400 mt-0.5">{avgScore}/100</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[7px] font-black text-slate-500 uppercase tracking-wider">Pacing Speed</p>
                            <p className={`text-xs font-black mt-0.5 px-2 py-0.5 rounded-full inline-block ${
                              avgWpm >= 120 && avgWpm <= 160 ? 'bg-green-500/20 text-green-400' : avgWpm === 0 ? 'text-slate-500' : 'bg-amber-500/20 text-amber-400'
                            }`}>
                              {avgWpm > 0 ? `${avgWpm} WPM` : 'Keyboard Mode'}
                            </p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-[10px] text-slate-400">
                          <div className="bg-[#07070A] p-3 rounded-xl border border-white/5">
                            <span className="block text-[7px] font-black text-slate-500 uppercase">Sessions Completed</span>
                            <strong className="text-white text-sm font-black mt-0.5 block">{practiceHistory.length}</strong>
                          </div>
                          <div className="bg-[#07070A] p-3 rounded-xl border border-white/5">
                            <span className="block text-[7px] font-black text-slate-500 uppercase">Filler Count (All)</span>
                            <strong className={`text-sm font-black mt-0.5 block ${totalUmUh > 5 ? 'text-amber-400' : 'text-green-400'}`}>{totalUmUh}</strong>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Historic Prep Kits */}
              {prepHistory.length > 0 && (
                <div className="bg-[#111118]/80 backdrop-blur-xl border border-white/5 rounded-[2rem] p-7 space-y-4 animate-in fade-in duration-300">
                  <div className="flex justify-between items-center">
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em]">📂 Historic Prep Kits ({prepHistory.length})</p>
                    <button
                      onClick={() => {
                        if (confirm('Clear preparation kit history?')) {
                          localStorage.removeItem(`hiremax_prep_history_${user?.id || 'anon'}`);
                          setPrepHistory([]);
                        }
                      }}
                      className="text-[8px] font-black text-red-500 hover:text-red-400 uppercase tracking-widest"
                    >
                      Clear
                    </button>
                  </div>
                  <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                    {prepHistory.map((item, idx) => (
                      <div key={item.id || idx} className="bg-[#07070A] border border-white/5 rounded-2xl p-4 flex justify-between items-center group hover:border-white/10 transition-all">
                        <div className="space-y-1">
                          <p className="text-white font-bold text-xs uppercase tracking-tight">{item.roleTitle || 'Senior Role'}</p>
                          <p className="text-[8px] font-black text-slate-500 uppercase">{item.companyName || 'SaaS Tech'}</p>
                          <span className="text-[8px] text-slate-600 block">{new Date(item.timestamp).toLocaleDateString()}</span>
                        </div>
                        <button
                          onClick={() => {
                            loadKit(item.kit, item.formDetails || { jobDescription: item.kit.jdText || '', companyStage: item.companyName, roleLevel: item.roleTitle });
                          }}
                          className="bg-blue-600 hover:bg-blue-500 text-white font-black text-[9px] uppercase tracking-widest px-3 py-2 rounded-xl transition-all"
                        >
                          Reload
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )
      ) : (
        <div id="prep-export">
          <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-1">
            {[`📞 Recruiter Screen`,`🧑 HM Screen`,`⚙️ Technical`,`⭐ Behavioral (${doneCount}/12)`,`❓ Ask Them`,`📊 Telemetry & History`].map((label,i)=>(
              <button key={i} onClick={()=>changeTab(i)} className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest whitespace-nowrap transition-all ${tab===i?'bg-blue-600 text-white shadow-lg shadow-blue-500/20':'bg-[#16161E] text-slate-400 border border-white/5 hover:text-white hover:border-white/10'}`}>{label}</button>
            ))}
          </div>

          {/* Judging System Banner / Guidelines */}
          {[0, 1, 3].includes(tab) && (
            <div className="bg-[#1C1C24] border border-blue-500/20 rounded-[2rem] p-7 mb-8 flex items-start gap-4 animate-in slide-in-from-top-4 duration-300">
              <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-2xl text-blue-400 shrink-0 mt-0.5">
                <Scale size={20} />
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-white font-black text-sm uppercase tracking-wider">How You Are Judged — Calibrated Evaluation System</h3>
                  <span className="text-[8px] font-black bg-blue-500/15 border border-blue-500/30 text-blue-400 px-2 py-0.5 rounded-full uppercase tracking-wider">T-1 / FAANG Standard</span>
                </div>
                <p className="text-slate-400 text-xs leading-relaxed max-w-4xl">
                  Our voice practices grade your answers using a calibrated evaluation matrix. Speak naturally and structure your answer logically, keeping these key dimensions in mind:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-3 mt-2 border-t border-white/5">
                  <div className="bg-[#111118] border border-white/5 rounded-2xl p-4">
                    <p className="text-white font-bold text-[10px] uppercase tracking-wider mb-1">🎯 1. Relevance & Focus (30%)</p>
                    <p className="text-slate-500 text-[10px] leading-relaxed">Directly address the question core early on. Avoid rambling, off-topic side stories, or excessive background details.</p>
                  </div>
                  <div className="bg-[#111118] border border-white/5 rounded-2xl p-4">
                    <p className="text-white font-bold text-[10px] uppercase tracking-wider mb-1">💪 2. Metric & Signal Density (40%)</p>
                    <p className="text-slate-500 text-[10px] leading-relaxed">Quantify impact with solid figures ($ revenue saved, % latency reduced, count of engineers led) and use strong active verbs.</p>
                  </div>
                  <div className="bg-[#111118] border border-white/5 rounded-2xl p-4">
                    <p className="text-white font-bold text-[10px] uppercase tracking-wider mb-1">⚡ 3. Brevity & Precision (30%)</p>
                    <p className="text-slate-500 text-[10px] leading-relaxed">Limit responses to 90–120 seconds. Calibrated scorers heavily penalize verbal filler and excessive speech duration.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 0 — Recruiter Screen */}
          {tab===0 && <div className="space-y-5">
            {kit.salaryAnchor && (
              <div className="bg-violet-500/10 border border-violet-500/30 rounded-[2rem] p-7">
                <p className="text-[8px] font-black text-violet-400 uppercase tracking-widest mb-2">💰 Salary Anchor — Say This Exactly</p>
                <p className="text-white font-black text-lg mb-1">{kit.salaryAnchor.range}</p>
                <p className="text-slate-300 text-sm leading-relaxed italic">"{kit.salaryAnchor.script}"</p>
              </div>
            )}
            {kit.recruiterScreen?.map((q,i)=>(
              <div key={i} className="bg-[#16161E] border border-white/5 rounded-[2rem] p-8 hover:border-white/10 transition-all">
                <p className="text-white font-black text-base mb-5">{q.question}</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="border-l-4 border-amber-500 pl-4 py-2"><p className="text-[7px] font-black text-amber-400 uppercase tracking-widest mb-1">Why They Ask</p><p className="text-slate-300 text-xs leading-relaxed italic">{q.whyAsked}</p></div>
                  <div className="border-l-4 border-blue-500 pl-4 py-2"><p className="text-[7px] font-black text-blue-400 uppercase tracking-widest mb-1">Coached Answer</p>{q.framework?.map((f,j)=><p key={j} className="text-slate-300 text-xs">• {f}</p>)}</div>
                  <div className="border-l-4 border-red-500 pl-4 py-2"><p className="text-[7px] font-black text-red-400 uppercase tracking-widest mb-1">Do Not Say</p>{q.avoid?.map((a,j)=><p key={j} className="text-slate-400 text-xs line-through">✗ {a}</p>)}</div>
                </div>
                {/* Voice Practice Button */}
                <div className="mt-4 pt-4 border-t border-white/5">
                  <VoicePracticeWidget questionText={q.question} resumeText={resumeText} user={user} />
                </div>
              </div>
            ))}
          </div>}

          {/* TAB 1 — HM Screen */}
          {tab===1 && <div className="space-y-5">
            {kit.hmScreen?.map((q,i)=>(
              <div key={i} className="bg-[#16161E] border border-white/5 rounded-[2rem] p-8 hover:border-white/10 transition-all">
                <p className="text-white font-black text-base mb-2">{q.question}</p>
                {q.followUp && <p className="text-indigo-300 text-[10px] font-bold bg-indigo-500/10 border border-indigo-500/20 rounded-xl px-3 py-1.5 inline-block mb-4">Follow-up: "{q.followUp}"</p>}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                  <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-4"><p className="text-[7px] font-black text-amber-400 uppercase tracking-widest mb-2">📌 Reference From Your Resume</p><p className="text-slate-300 text-xs leading-relaxed">{q.resumeAnchor}</p></div>
                  <div className="bg-blue-500/5 border border-blue-500/20 rounded-2xl p-4"><p className="text-[7px] font-black text-blue-400 uppercase tracking-widest mb-2">Answer Framework</p>{q.framework?.map((f,j)=><p key={j} className="text-slate-300 text-xs">• {f}</p>)}</div>
                </div>
                {/* Voice Practice Button */}
                <div className="mt-4 pt-4 border-t border-white/5">
                  <VoicePracticeWidget questionText={q.question} resumeText={resumeText} user={user} />
                </div>
              </div>
            ))}
          </div>}

          {/* TAB 2 — Technical */}
          {tab===2 && <div className="space-y-5">
            {kit.technical && (
              <div className={`rounded-[2rem] p-7 border flex items-center gap-5 ${kit.technical.detectedType==='CODING'?'bg-blue-500/10 border-blue-500/30':kit.technical.detectedType==='SYSTEM_DESIGN'?'bg-indigo-500/10 border-indigo-500/30':kit.technical.detectedType==='TAKE_HOME'?'bg-amber-500/10 border-amber-500/30':'bg-green-500/10 border-green-500/30'}`}>
                <span className="text-4xl">{kit.technical.detectedType==='CODING'?'💻':kit.technical.detectedType==='SYSTEM_DESIGN'?'🏗️':kit.technical.detectedType==='TAKE_HOME'?'🏠':'📊'}</span>
                <div><p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Detected Interview Type</p><p className="text-white font-black text-2xl">{kit.technical.detectedType?.replace('_',' ')}</p></div>
              </div>
            )}
            {kit.technical?.questions?.map((q,i)=>(
              <div key={i} className="bg-[#16161E] border border-white/5 rounded-[2rem] p-7 hover:border-white/10 transition-all">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <p className="text-white font-black text-sm">{q.question}</p>
                  <span className={`text-[7px] font-black px-2 py-0.5 rounded uppercase tracking-widest ${
                    q.likelihood >= 85 ? 'bg-green-500/20 text-green-400' :
                    q.likelihood >= 60 ? 'bg-amber-500/20 text-amber-400' :
                    'bg-slate-700 text-slate-400'
                  }`}>
                    {q.likelihood >= 85 ? 'VERY LIKELY' : q.likelihood >= 60 ? 'LIKELY' : 'POSSIBLE'}
                  </span>
                </div>
                {(q.keyPoints?.length ?? 0) > 0 && <div className="mb-3"><p className="text-[7px] font-black text-blue-400 uppercase tracking-widest mb-2">Key Points to Cover</p>{(q.keyPoints ?? []).map((k,j)=><p key={j} className="text-slate-300 text-xs">• {k}</p>)}</div>}
                {(q.tradeoffs?.length ?? 0) > 0 && <div className="bg-indigo-500/5 border border-indigo-500/10 rounded-xl p-4 mt-2"><p className="text-[7px] font-black text-indigo-400 uppercase tracking-widest mb-2">Tradeoffs to Mention</p>{(q.tradeoffs ?? []).map((t,j)=><p key={j} className="text-slate-300 text-xs">⇄ {t}</p>)}</div>}
              </div>
            ))}
          </div>}

          {/* TAB 3 — Behavioral STAR */}
          {tab===3 && <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">S+T pre-filled from your resume — you fill A+R</p>
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-full px-4 py-1.5"><span className="text-[10px] font-black text-blue-400">{doneCount}/12 complete</span></div>
            </div>
            {BEHAVIORAL_QS.map((q,i)=>{
              const pf = kit.behavioral?.[i]?.preFilled || { situation: '', task: '' };
              const ans = stars[i] || { action:'', result:'' };
              const done = !!(ans.action && ans.result);
              const saved = savedKeys.has(i);
              return (
                <div key={i} className={`bg-[#16161E] border rounded-[2rem] p-7 transition-all ${done?'border-green-500/30':saved?'border-blue-500/20':'border-white/5 hover:border-white/10'}`}>
                  <div className="flex items-center gap-3 mb-4 font-black">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${done?'bg-green-500/20 text-green-400':'bg-violet-500/10 text-violet-400'}`}>{done?'✓':i+1}</div>
                    <p className="text-white font-black text-sm">{q}</p>
                    <div className="ml-auto shrink-0 flex items-center gap-2">
                      <FreqBadge freq={BEHAVIORAL_FREQ[i] ?? 'COMMON'} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div className="bg-blue-500/5 border border-blue-500/10 rounded-xl p-4"><p className="text-[7px] font-black text-blue-400 uppercase tracking-widest mb-1">S — Situation (AI)</p><p className="text-slate-300 text-xs leading-relaxed">{pf.situation || 'Will be pre-filled from your resume after generation.'}</p></div>
                    <div className="bg-blue-500/5 border border-blue-500/10 rounded-xl p-4"><p className="text-[7px] font-black text-blue-400 uppercase tracking-widest mb-1">T — Task (AI)</p><p className="text-slate-300 text-xs leading-relaxed">{pf.task || 'Will be pre-filled from your resume after generation.'}</p></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div><p className="text-[7px] font-black text-green-400 uppercase tracking-widest mb-1.5">A — Your Action</p><textarea value={ans.action} onChange={e=>saveStar(i,'action',e.target.value)} rows={3} placeholder="What specific actions did YOU take?" className="w-full bg-[#0A0A0F] border border-white/8 rounded-xl p-3 text-white text-xs outline-none focus:border-green-500/30 resize-none placeholder:text-slate-700"/></div>
                    <div><p className="text-[7px] font-black text-amber-400 uppercase tracking-widest mb-1.5">R — Your Result</p><textarea value={ans.result} onChange={e=>saveStar(i,'result',e.target.value)} rows={3} placeholder="What was the measurable outcome?" className="w-full bg-[#0A0A0F] border border-white/8 rounded-xl p-3 text-white text-xs outline-none focus:border-amber-500/30 resize-none placeholder:text-slate-700"/></div>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <button onClick={()=>markSaved(i)} className={`flex items-center gap-2 py-2 px-4 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all ${saved?'bg-green-500/10 text-green-400 border border-green-500/20':'bg-white/5 text-slate-500 border border-white/5 hover:border-white/10 hover:text-white'}`}><Check size={12}/>{saved?'Saved':'Save Answer'}</button>
                  </div>
                  {/* Voice Practice Button */}
                  <div className="mt-4 pt-4 border-t border-white/5">
                    <VoicePracticeWidget questionText={q} resumeText={resumeText} user={user} />
                  </div>
                </div>
              );
            })}
          </div>}

          {/* TAB 4 — Questions to Ask */}
          {tab===4 && <div className="space-y-4">
            {['Role Clarity','Team Dynamics','Culture','Technical Direction','Growth'].map(cat=>{
              const qs = kit.questionsToAsk?.filter(q=>q.category===cat)||[];
              if(!qs.length) return null;
              return (
                <div key={cat} className="bg-[#16161E] border border-white/5 rounded-[2rem] p-7 hover:border-white/10 transition-all">
                  <p className="text-[8px] font-black text-slate-500 uppercase tracking-[0.25em] mb-4">{cat}</p>
                  <div className="space-y-4">
                    {qs.map((q,i)=>(
                      <div key={i}>
                        <div className="flex items-start gap-3">
                          {q.mustAsk && <span className="text-[7px] font-black bg-amber-500/20 text-amber-400 px-2 py-1 rounded uppercase tracking-widest shrink-0 mt-0.5">Must Ask</span>}
                          <p className="text-slate-200 text-sm">{q.question}</p>
                        </div>
                        {q.whyItWorks && <p className="text-slate-600 text-[10px] mt-1.5 ml-0 italic">{q.whyItWorks}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>}

          {/* TAB 5 — Practice Telemetry & History */}
          {tab===5 && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in duration-300">
              {/* Telemetry Speeder & Diagnostic KPI cards */}
              <div className="lg:col-span-8 space-y-6">
                <div className="bg-[#16161E] border border-white/5 rounded-[2rem] p-8 space-y-6">
                  <h3 className="text-white font-black text-base uppercase tracking-wider">Acoustic & Keyboard Practice Timeline</h3>
                  {practiceHistory.length === 0 ? (
                    <div className="bg-[#0D0D12] border border-white/5 p-8 rounded-[2rem] text-center space-y-3">
                      <span className="text-3xl block">🎤</span>
                      <p className="text-white font-black text-sm uppercase">No practice runs completed yet</p>
                      <p className="text-slate-500 text-xs leading-relaxed max-w-sm mx-auto">
                        Practice answering any of the Recruiter, HM, or Behavioral questions out loud to populate your real-time performance scores and pace analytics!
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div className="relative border-l-2 border-blue-500/20 pl-6 ml-3 space-y-6">
                        {practiceHistory.map((item, idx) => (
                          <div key={item.id || idx} className="relative group">
                            <div className={`absolute -left-[31px] top-1.5 w-4 h-4 rounded-full border-4 border-[#16161E] shrink-0 transition-all ${
                              item.score >= 80 ? 'bg-green-400 shadow-md shadow-green-500/20' : item.score >= 60 ? 'bg-amber-400' : 'bg-red-500'
                            }`} />
                            
                            <div className="bg-[#0D0D12] border border-white/5 hover:border-white/10 rounded-[1.5rem] p-5 space-y-3 transition-all">
                              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 pb-2">
                                <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">{new Date(item.timestamp).toLocaleString()}</span>
                                <div className="flex gap-2">
                                  <span className="text-[8px] font-black text-blue-400 bg-blue-500/10 border border-blue-500/20 rounded-md px-2 py-0.5 uppercase tracking-widest">
                                    {item.mode || 'Voice'}
                                  </span>
                                  <span className={`text-[10px] font-black leading-none ${
                                    item.score >= 80 ? 'text-green-400' : item.score >= 60 ? 'text-amber-400' : 'text-red-400'
                                  }`}>
                                    Score: {item.score}/100
                                  </span>
                                </div>
                              </div>
                              <p className="text-white font-bold text-xs">Q: "{item.questionText}"</p>
                              {item.wpm > 0 && (
                                <div className="flex gap-4 text-[9px] text-slate-400 font-bold bg-white/5 p-2.5 rounded-xl border border-white/5">
                                  <span>Speech Pacing: <strong className="text-white">{item.wpm} WPM</strong></span>
                                  <span>Filler Words: <strong className={item.fillers > 0 ? 'text-amber-400' : 'text-white'}>{item.fillers}</strong></span>
                                </div>
                              )}
                              {item.deliveryCritique && (
                                <p className="text-slate-400 text-[10px] leading-relaxed bg-white/5 p-3 rounded-xl border border-white/5 italic">
                                  "{item.deliveryCritique}"
                                </p>
                              )}
                              {item.transcript && (
                                <div className="mt-4 pt-4 border-t border-white/5 space-y-4">
                                  <div>
                                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Your Response</p>
                                    <p className="text-slate-300 text-[11px] leading-relaxed italic border-l-2 border-white/10 pl-3">"{item.transcript}"</p>
                                  </div>
                                  {item.feedback && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                                      {item.feedback.strength && (
                                        <div className="bg-green-500/5 border border-green-500/10 rounded-xl p-3">
                                          <p className="text-[7px] font-black text-green-400 uppercase tracking-widest mb-1">Strongest Point</p>
                                          <p className="text-slate-300 text-[10px]">{item.feedback.strength}</p>
                                        </div>
                                      )}
                                      {item.feedback.suggestedAddition && (
                                        <div className="bg-blue-500/5 border border-blue-500/10 rounded-xl p-3">
                                          <p className="text-[7px] font-black text-blue-400 uppercase tracking-widest mb-1">Suggested Addition</p>
                                          <p className="text-slate-300 text-[10px]">{item.feedback.suggestedAddition}</p>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Sidebar: Global telemetry stats & historical kits */}
              <div className="lg:col-span-4 space-y-6">
                <div className="bg-[#16161E] border border-white/5 rounded-[2rem] p-7 space-y-5">
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em]">📊 Global Telemetry Stats</p>
                  {(() => {
                    const validWpms = practiceHistory.filter(h => h.wpm > 0);
                    const avgWpm = validWpms.length > 0 ? Math.round(validWpms.reduce((a,b) => a + b.wpm, 0) / validWpms.length) : 0;
                    const avgScore = practiceHistory.length > 0 ? Math.round(practiceHistory.reduce((a,b) => a + b.score, 0) / practiceHistory.length) : 0;
                    const totalUmUh = practiceHistory.reduce((a,b) => a + b.fillers, 0);
                    return (
                      <div className="space-y-4">
                        <div className="bg-[#0D0D12] border border-white/5 rounded-2xl p-4 space-y-1">
                          <p className="text-[8px] font-black text-slate-500 uppercase">Average Mock Score</p>
                          <p className="text-3xl font-black text-green-400 leading-none">{avgScore || 0}</p>
                          <span className="text-[8px] text-slate-500 uppercase block tracking-wider font-bold">based on {practiceHistory.length} run(s)</span>
                        </div>
                        <div className="bg-[#0D0D12] border border-white/5 rounded-2xl p-4 space-y-1">
                          <p className="text-[8px] font-black text-slate-500 uppercase">Speech Pacing Rate</p>
                          <p className="text-xl font-black text-white leading-none">{avgWpm > 0 ? `${avgWpm} WPM` : '0 WPM'}</p>
                          <span className={`text-[8px] font-black uppercase tracking-wider block mt-1 ${
                            avgWpm >= 120 && avgWpm <= 160 ? 'text-green-400' : 'text-amber-500 font-bold'
                          }`}>
                            {avgWpm >= 120 && avgWpm <= 160 ? '✓ Optimal (120-160 WPM)' : avgWpm > 0 ? '⚠ Needs Calibration' : 'Keyboard Sessions Only'}
                          </span>
                        </div>
                        <div className="bg-[#0D0D12] border border-white/5 rounded-2xl p-4 space-y-1">
                          <p className="text-[8px] font-black text-slate-500 uppercase">Aggregate Filler count</p>
                          <p className={`text-xl font-black leading-none ${totalUmUh > 5 ? 'text-amber-400' : 'text-green-400'}`}>{totalUmUh}</p>
                          <span className="text-[8px] text-slate-500 uppercase block tracking-wider mt-1 font-bold">like, um, uh, basically, so, actually</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {prepHistory.length > 0 && (
                  <div className="bg-[#16161E] border border-white/5 rounded-[2rem] p-7 space-y-4 font-bold">
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em]">📂 Historic Prep Kits</p>
                    <div className="space-y-2.5 max-h-[350px] overflow-y-auto pr-1">
                      {prepHistory.map((item, idx) => (
                        <div key={item.id || idx} className="bg-[#0D0D12] border border-white/5 rounded-2xl p-4 flex justify-between items-center group hover:border-white/10 transition-all">
                          <div className="space-y-1">
                            <p className="text-white font-bold text-xs uppercase tracking-tight">{item.roleTitle || 'Senior Role'}</p>
                            <p className="text-[8px] font-black text-slate-500 uppercase">{item.companyName || 'SaaS Tech'}</p>
                            <span className="text-[8px] text-slate-600 block font-normal">{new Date(item.timestamp).toLocaleDateString()}</span>
                          </div>
                          <button
                            onClick={() => {
                              loadKit(item.kit, item.formDetails || { jobDescription: item.kit.jdText || '', companyStage: item.companyName, roleLevel: item.roleTitle });
                            }}
                            className="bg-blue-600 hover:bg-blue-500 text-white font-black text-[9px] uppercase tracking-widest px-3 py-2 rounded-xl transition-all"
                          >
                            Reload
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
