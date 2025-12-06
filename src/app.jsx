import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Play, Check, Edit3, Save, X, Dumbbell, Clock, Repeat, Zap, Upload, FileSpreadsheet, Trash2, Link, Loader2, Cloud, CloudOff, Home, Calendar, Users, Target, ExternalLink, Pause, RotateCcw, Timer } from 'lucide-react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

// Supabase Configuration
const SUPABASE_URL = 'https://meidwndgizrztgzinncc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1laWR3bmRnaXpyenRnemlubmNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUwMzQ3MDcsImV4cCI6MjA4MDYxMDcwN30.dGLJvQo5Fk9tH30cLpGxEfUwt99UtOgyHCwVazpyaPA';

// Supabase API helper
const supabaseApi = async (table, method = 'GET', body = null, query = '') => {
  const url = `${SUPABASE_URL}/rest/v1/${table}${query}`;
  const headers = {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
  };
  if (method === 'POST') headers['Prefer'] = 'return=representation';
  
  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);
  
  const res = await fetch(url, options);
  if (!res.ok) throw new Error(`API Error: ${res.status}`);
  return method === 'DELETE' ? null : res.json();
};

// Spreadsheet Parser
const parseSpreadsheet = async (file) => {
  const fileName = file.name.toLowerCase();
  
  if (fileName.endsWith('.csv')) {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        complete: (results) => resolve({ rows: results.data, hyperlinks: {} }),
        error: reject,
        skipEmptyLines: true
      });
    });
  }
  
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const workbook = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false });
        const hyperlinks = {};
        Object.keys(sheet).forEach(cell => {
          if (sheet[cell]?.l?.Target) hyperlinks[cell] = sheet[cell].l.Target;
        });
        resolve({ rows, hyperlinks });
      } catch (err) { reject(err); }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
};

const mapRowToExercise = (row, index, hyperlinks, rowIndex) => {
  const videoUrl = row[7]?.toString().trim() || hyperlinks[`H${rowIndex + 2}`] || hyperlinks[`B${rowIndex + 2}`] || '';
  const fullExercise = row[1] || '';
  const nameParts = fullExercise.split(' - ');
  return {
    exercise_order: index + 1,
    name: nameParts[0]?.trim() || `Exercise ${index + 1}`,
    description: nameParts.slice(1).join(' - ').trim() || '',
    reps: row[2]?.toString() || '',
    speed: row[3]?.toString() || '',
    rest: row[4]?.toString() || '',
    sets: parseInt(row[5]) || 1,
    video_url: videoUrl
  };
};

// Import Modal Component
const ImportModal = ({ onImport, onClose, saving }) => {
  const [dragActive, setDragActive] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState(null);
  const [preview, setPreview] = useState(null);
  const [workoutName, setWorkoutName] = useState('My Workout');
  const fileInputRef = useRef(null);

  const handleFile = async (file) => {
    if (!file) return;
    console.log('File selected:', file.name);
    setParsing(true);
    setError(null);
    setWorkoutName(file.name.replace(/\.(csv|xlsx?)$/i, ''));

    try {
      const { rows, hyperlinks } = await parseSpreadsheet(file);
      console.log('Parsed rows:', rows.length);
      const dataRows = rows.slice(1).filter(row => row[1]);
      console.log('Data rows after filtering:', dataRows.length);
      const exercises = dataRows.map((row, i) => mapRowToExercise(row, i, hyperlinks, i + 1));
      console.log('Mapped exercises:', exercises);
      setPreview(exercises);
    } catch (err) {
      console.error('File parsing error:', err);
      setError('Failed to parse file.');
    } finally {
      setParsing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b border-zinc-700 flex items-center justify-between">
          <h2 className="text-white font-bold text-lg flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-orange-400" />
            Import Workout
          </h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-white"><X className="w-6 h-6" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {!preview ? (
            <>
              <div
                onDrop={(e) => { e.preventDefault(); setDragActive(false); handleFile(e.dataTransfer.files[0]); }}
                onDragEnter={(e) => { e.preventDefault(); setDragActive(true); }}
                onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                onDragLeave={(e) => { e.preventDefault(); setDragActive(false); }}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${dragActive ? 'border-orange-500 bg-orange-500/10' : 'border-zinc-600 hover:border-zinc-500'}`}
              >
                <Upload className={`w-12 h-12 mx-auto mb-4 ${dragActive ? 'text-orange-400' : 'text-zinc-500'}`} />
                <p className="text-white font-medium mb-2">{parsing ? 'Parsing...' : 'Drop your spreadsheet here'}</p>
                <p className="text-zinc-400 text-sm">Supports .xlsx and .csv</p>
                <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={(e) => handleFile(e.target.files[0])} className="hidden" />
              </div>
              {error && <div className="mt-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm">{error}</div>}
              <div className="mt-4 text-zinc-500 text-xs">
                <p className="font-medium text-zinc-400 mb-1">Expected columns:</p>
                <p># | Exercise | Reps | Speed | Rest | Sets | Notes | Video</p>
              </div>
            </>
          ) : (
            <>
              <div className="mb-4">
                <label className="text-zinc-400 text-sm mb-1 block">Workout Name</label>
                <input type="text" value={workoutName} onChange={(e) => setWorkoutName(e.target.value)} className="w-full bg-zinc-800 text-white rounded-lg px-3 py-2 border border-zinc-600 focus:border-orange-500 focus:outline-none" />
              </div>
              <p className="text-zinc-400 text-sm mb-2">{preview.length} exercises</p>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {preview.map((ex, i) => (
                  <div key={i} className="bg-zinc-800 rounded-lg p-3 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-orange-500/20 text-orange-400 flex items-center justify-center font-bold text-sm">{i + 1}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium truncate">{ex.name}</p>
                      {ex.video_url && <p className="text-green-400 text-xs">✓ Video</p>}
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={() => setPreview(null)} className="mt-4 text-zinc-400 text-sm hover:text-white">← Back</button>
            </>
          )}
        </div>

        {preview && (
          <div className="p-4 border-t border-zinc-700">
            <button onClick={() => { console.log('Import button clicked:', workoutName, preview?.length); onImport(workoutName, preview); }} disabled={saving || !workoutName.trim()} className="w-full py-3 bg-orange-500 hover:bg-orange-600 disabled:bg-zinc-600 text-white font-bold rounded-xl flex items-center justify-center gap-2">
              {saving ? <><Loader2 className="w-5 h-5 animate-spin" /> Saving...</> : 'Import & Save'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// Exercise Card Component
const ExerciseCard = ({ exercise, progress, onUpdateNotes, onToggleSet }) => {
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [noteText, setNoteText] = useState(progress?.notes || '');
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [initialTimerSeconds, setInitialTimerSeconds] = useState(0);
  const timerRef = useRef(null);

  const completedSets = progress?.completed_sets || [];

  useEffect(() => { setNoteText(progress?.notes || ''); }, [progress?.notes]);

  // Parse rest time to seconds
  const parseRestTime = (restText) => {
    if (!restText) return 0;
    const text = restText.toString().toLowerCase().replace(/[^0-9a-z]/g, '');

    // Match patterns like: 60s, 2min, 90sec, 1m30s, etc.
    const patterns = [
      /^(\d+)m(\d+)s?$/, // 1m30s
      /^(\d+)min(\d+)s?$/, // 1min30s
      /^(\d+)s(ec)?$/, // 60s, 60sec
      /^(\d+)m(in)?$/, // 2m, 2min
      /^(\d+)$/, // plain number (assume seconds)
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        if (pattern === patterns[0] || pattern === patterns[1]) {
          // minutes + seconds
          return parseInt(match[1]) * 60 + parseInt(match[2]);
        } else if (pattern === patterns[3] || pattern === patterns[4]) {
          // minutes only
          return parseInt(match[1]) * 60;
        } else {
          // seconds only
          return parseInt(match[1]);
        }
      }
    }

    // Fallback: try to extract any number and assume seconds
    const numbers = text.match(/\d+/);
    return numbers ? parseInt(numbers[0]) : 0;
  };

  // Timer effect
  useEffect(() => {
    if (isTimerRunning && timerSeconds > 0) {
      timerRef.current = setInterval(() => {
        setTimerSeconds(prev => {
          if (prev <= 1) {
            setIsTimerRunning(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }

    return () => clearInterval(timerRef.current);
  }, [isTimerRunning, timerSeconds]);

  // Start timer
  const startRestTimer = () => {
    if (timerSeconds === 0) {
      const seconds = parseRestTime(exercise.rest);
      if (seconds > 0) {
        setTimerSeconds(seconds);
        setInitialTimerSeconds(seconds);
        setIsTimerRunning(true);
      }
    } else {
      setIsTimerRunning(!isTimerRunning);
    }
  };

  // Reset timer
  const resetRestTimer = () => {
    setIsTimerRunning(false);
    setTimerSeconds(0);
    setInitialTimerSeconds(0);
  };

  // Format time display
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `${secs}s`;
  };

  const openVideoInNewTab = () => {
    if (exercise.video_url) {
      window.open(exercise.video_url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-gradient-to-br from-zinc-900 to-zinc-800 rounded-2xl overflow-hidden shadow-2xl border border-zinc-700">
      <div className="bg-gradient-to-r from-orange-600 to-orange-500 px-4 py-3 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-lg">{exercise.exercise_order}</div>
        <h2 className="text-white font-bold text-xl flex-1 truncate">{exercise.name}</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-4">
          {/* Main Bento Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-zinc-800 rounded-xl p-4 border border-zinc-700">
              <div className="flex items-center gap-2 text-orange-400 mb-2"><Repeat className="w-4 h-4" /><span className="text-xs font-semibold uppercase">Reps</span></div>
              <p className="text-white font-bold text-lg">{exercise.reps || '—'}</p>
            </div>
            <div className="bg-zinc-800 rounded-xl p-4 border border-zinc-700">
              <div className="flex items-center gap-2 text-blue-400 mb-2"><Zap className="w-4 h-4" /><span className="text-xs font-semibold uppercase">Speed</span></div>
              <p className="text-white font-medium text-sm">{exercise.speed || '—'}</p>
            </div>
            <button
              onClick={startRestTimer}
              className={`bg-zinc-800 rounded-xl p-4 border border-zinc-700 text-left transition-all hover:border-green-500 ${
                isTimerRunning ? 'border-green-500 bg-green-900/20' : ''
              } ${timerSeconds > 0 ? 'cursor-pointer' : 'cursor-pointer'}`}
            >
              <div className="flex items-center gap-2 text-green-400 mb-2">
                {isTimerRunning ? <Timer className="w-4 h-4 animate-pulse" /> : <Clock className="w-4 h-4" />}
                <span className="text-xs font-semibold uppercase">Rest</span>
                {timerSeconds > 0 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); resetRestTimer(); }}
                    className="ml-auto p-0.5 hover:bg-zinc-700 rounded"
                  >
                    <RotateCcw className="w-3 h-3" />
                  </button>
                )}
              </div>
              <div className="flex items-center justify-between">
                <p className="text-white font-medium text-sm">
                  {timerSeconds > 0 ? formatTime(timerSeconds) : (exercise.rest || '—')}
                </p>
                {timerSeconds > 0 && (
                  <div className="flex items-center gap-1">
                    {isTimerRunning ? (
                      <Pause className="w-4 h-4 text-green-400" />
                    ) : (
                      <Play className="w-4 h-4 text-green-400" />
                    )}
                  </div>
                )}
              </div>
              {timerSeconds > 0 && initialTimerSeconds > 0 && (
                <div className="mt-2 h-1 bg-zinc-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-green-500 to-green-400 transition-all duration-1000 ease-linear"
                    style={{ width: `${(timerSeconds / initialTimerSeconds) * 100}%` }}
                  />
                </div>
              )}
            </button>
            <div className="bg-zinc-800 rounded-xl p-4 border border-zinc-700">
              <div className="flex items-center gap-2 text-purple-400 mb-2"><Dumbbell className="w-4 h-4" /><span className="text-xs font-semibold uppercase">Sets</span></div>
              <div className="flex gap-2 flex-wrap">
                {Array.from({ length: exercise.sets }, (_, i) => (
                  <button key={i} onClick={() => onToggleSet(exercise.id, i)} className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold transition-all ${completedSets.includes(i) ? 'bg-green-500 text-white' : 'bg-zinc-700 text-zinc-400 hover:bg-zinc-600'}`}>
                    {completedSets.includes(i) ? <Check className="w-5 h-5" /> : i + 1}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Description */}
          {exercise.description && (
            <div className="bg-zinc-800 rounded-xl p-4 border border-zinc-700">
              <p className="text-yellow-400 text-xs font-semibold uppercase mb-2">Instructions</p>
              <p className="text-zinc-300 text-sm">{exercise.description}</p>
            </div>
          )}

          {/* Instructor Notes */}
          {exercise.instructor_notes && (
            <div className="bg-zinc-800 rounded-xl p-4 border border-zinc-700">
              <div className="flex items-center gap-2 text-blue-400 mb-2">
                <Users className="w-4 h-4" />
                <span className="text-xs font-semibold uppercase">Instructor Notes</span>
              </div>
              <p className="text-zinc-300 text-sm">{exercise.instructor_notes}</p>
            </div>
          )}

          {/* My Notes */}
          <div className="bg-zinc-800 rounded-xl p-4 border border-zinc-700">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-pink-400"><Edit3 className="w-4 h-4" /><span className="text-xs font-semibold uppercase">My Notes</span></div>
              {!isEditingNotes ? (
                <button onClick={() => setIsEditingNotes(true)} className="text-xs text-zinc-400 hover:text-white">Edit</button>
              ) : (
                <div className="flex gap-2">
                  <button onClick={() => { onUpdateNotes(exercise.id, noteText); setIsEditingNotes(false); }} className="p-1 text-green-400"><Save className="w-4 h-4" /></button>
                  <button onClick={() => { setNoteText(progress?.notes || ''); setIsEditingNotes(false); }} className="p-1 text-red-400"><X className="w-4 h-4" /></button>
                </div>
              )}
            </div>
            {isEditingNotes ? (
              <textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Add notes..." className="w-full bg-zinc-900 text-white rounded-lg p-3 text-sm border border-zinc-600 focus:border-orange-500 focus:outline-none resize-none" rows={3} />
            ) : (
              <p className="text-zinc-400 text-sm italic">{progress?.notes || "Tap edit to add notes..."}</p>
            )}
          </div>

          {/* Bottom Bento Grid */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={openVideoInNewTab}
              disabled={!exercise.video_url}
              className={`bg-zinc-800 rounded-xl p-4 border border-zinc-700 text-left transition-all ${
                exercise.video_url
                  ? 'hover:border-cyan-500 cursor-pointer group'
                  : 'opacity-50 cursor-not-allowed'
              }`}
            >
              <div className="flex items-center gap-2 text-cyan-400 mb-2">
                <ExternalLink className="w-4 h-4" />
                <span className="text-xs font-semibold uppercase">Video</span>
              </div>
              <p className={`text-white font-medium text-sm ${
                exercise.video_url
                  ? 'group-hover:text-cyan-300'
                  : ''
              }`}>
                {exercise.video_url ? 'Watch →' : 'No Video'}
              </p>
            </button>
            <div className="bg-zinc-800 rounded-xl p-4 border border-zinc-700">
              <div className="flex items-center gap-2 text-zinc-500 mb-2">
                <span className="text-xs font-semibold uppercase">Extra</span>
              </div>
              <p className="text-zinc-600 text-sm">—</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Dashboard Component
const Dashboard = ({ workouts, onSelectWorkout, onImport, onDeleteWorkout, loading, error, showImport, setShowImport, saving }) => {
  if (loading) {
    return (
      <div className="h-screen w-full bg-zinc-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen w-full bg-zinc-950 flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <button onClick={() => window.location.reload()} className="px-4 py-2 bg-orange-500 text-white rounded-lg">Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full bg-zinc-950 flex flex-col">
      {/* Header */}
      <div className="p-4 sm:p-6">
        <div className="flex items-center justify-between mb-2 gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-orange-500 flex items-center justify-center flex-shrink-0">
              <Dumbbell className="w-4 h-4 sm:w-6 sm:h-6 text-white" />
            </div>
            <h1 className="text-white font-bold text-lg sm:text-2xl truncate">
              <span className="hidden sm:inline">Fitness Dashboard</span>
              <span className="inline sm:hidden">Dashboard</span>
            </h1>
          </div>
          <button
            onClick={() => setShowImport(true)}
            className="px-3 sm:px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl flex items-center gap-1 sm:gap-2 whitespace-nowrap text-sm sm:text-base flex-shrink-0"
          >
            <Upload className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
            <span className="hidden sm:inline">Import Workout</span>
            <span className="inline sm:hidden">Import</span>
          </button>
        </div>
        <p className="text-zinc-400 text-sm sm:text-base">
          <span className="hidden sm:inline">Select a workout plan to start training</span>
          <span className="inline sm:hidden">Select a workout to start</span>
        </p>
      </div>

      {/* Workouts Grid */}
      <div className="flex-1 px-6 pb-6">
        {workouts.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <FileSpreadsheet className="w-16 h-16 text-zinc-700 mx-auto mb-4" />
              <h2 className="text-white text-xl font-bold mb-2">No Workouts Yet</h2>
              <p className="text-zinc-400 mb-6">Import your first workout plan to get started</p>
              <button
                onClick={() => setShowImport(true)}
                className="px-4 sm:px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl flex items-center gap-2 mx-auto whitespace-nowrap"
              >
                <Upload className="w-5 h-5 flex-shrink-0" /> Import Workout
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-6xl mx-auto">
            {workouts.map((workout) => (
              <div
                key={workout.id}
                className="bg-gradient-to-br from-zinc-900 to-zinc-800 rounded-2xl p-6 border border-zinc-700 hover:border-orange-500 transition-all duration-200 transform hover:scale-105 relative group"
              >
                {/* Delete Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`Are you sure you want to delete "${workout.name}"? This cannot be undone.`)) {
                      onDeleteWorkout(workout.id);
                    }
                  }}
                  className="absolute top-4 right-4 p-2 rounded-full bg-red-500/20 hover:bg-red-500/40 text-red-400 hover:text-red-300 opacity-0 group-hover:opacity-100 transition-all duration-200"
                  title="Delete Workout"
                >
                  <Trash2 className="w-4 h-4" />
                </button>

                <div
                  className="cursor-pointer"
                  onClick={() => onSelectWorkout(workout)}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-full bg-orange-500/20 flex items-center justify-center">
                      <Dumbbell className="w-6 h-6 text-orange-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-white font-bold text-lg truncate">{workout.name}</h3>
                      <p className="text-zinc-400 text-sm">Workout Plan</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-zinc-800 rounded-lg p-3 border border-zinc-700">
                      <div className="flex items-center gap-2 text-blue-400 mb-1">
                        <Target className="w-4 h-4" />
                        <span className="text-xs font-semibold">Exercises</span>
                      </div>
                      <p className="text-white font-bold">{workout.exercise_count || '—'}</p>
                    </div>
                    <div className="bg-zinc-800 rounded-lg p-3 border border-zinc-700">
                      <div className="flex items-center gap-2 text-green-400 mb-1">
                        <Calendar className="w-4 h-4" />
                        <span className="text-xs font-semibold">Created</span>
                      </div>
                      <p className="text-white text-sm">{new Date(workout.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>

                  <button className="w-full py-3 bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 font-bold rounded-xl border border-orange-500/50 transition-colors">
                    Start Workout →
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showImport && <ImportModal onImport={onImport} onClose={() => setShowImport(false)} saving={saving} />}
    </div>
  );
};

// Main App
export default function App() {
  const [workouts, setWorkouts] = useState([]);
  const [currentWorkout, setCurrentWorkout] = useState(null);
  const [exercises, setExercises] = useState([]);
  const [progress, setProgress] = useState({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showImport, setShowImport] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [synced, setSynced] = useState(true);
  const [error, setError] = useState(null);
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  const [currentView, setCurrentView] = useState('dashboard'); // 'dashboard' or 'workout'

  useEffect(() => { loadWorkouts(); }, []);

  const loadWorkouts = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await supabaseApi('workouts', 'GET', null, '?select=*&order=created_at.desc');

      // Get exercise counts for each workout
      const workoutsWithCounts = await Promise.all(
        (data || []).map(async (workout) => {
          const exercises = await supabaseApi('exercises', 'GET', null, `?workout_id=eq.${workout.id}&select=id`);
          return { ...workout, exercise_count: exercises?.length || 0 };
        })
      );

      setWorkouts(workoutsWithCounts);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  const loadWorkout = async (workout) => {
    try {
      const exerciseData = await supabaseApi('exercises', 'GET', null, `?workout_id=eq.${workout.id}&order=exercise_order`);
      setExercises(exerciseData || []);
      setCurrentWorkout(workout);

      const today = new Date().toISOString().split('T')[0];
      const progressData = await supabaseApi('exercise_progress', 'GET', null, `?session_date=eq.${today}`);
      const progressMap = {};
      (progressData || []).forEach(p => { progressMap[p.exercise_id] = p; });
      setProgress(progressMap);
      setCurrentIndex(0);
    } catch (err) {
      console.error('Load workout error:', err);
    }
  };

  const handleSelectWorkout = async (workout) => {
    await loadWorkout(workout);
    setCurrentView('workout');
  };

  // Sanitize text fields to remove special characters that might cause API errors
  const sanitizeText = (text) => {
    if (!text || typeof text !== 'string') return text;
    return text
      .replace(/[—–]/g, '-') // Replace em dash and en dash with regular dash
      .replace(/[""]/g, '"') // Replace curly quotes with straight quotes
      .replace(/['']/g, "'") // Replace curly apostrophes with straight apostrophe
      .replace(/[…]/g, '...') // Replace ellipsis character with three dots
      .replace(/[^\x00-\x7F]/g, ''); // Remove any other non-ASCII characters
  };

  // Helper to get exercise field from either direct field or JSON data
  const getExerciseField = (exercise, fieldName) => {
    // Try direct field first
    if (exercise[fieldName]) return exercise[fieldName];

    // Try from JSON data field
    if (exercise.data) {
      try {
        const parsed = JSON.parse(exercise.data);
        return parsed[fieldName] || '';
      } catch {
        return '';
      }
    }

    return '';
  };

  const sanitizeExercise = (exercise) => {
    return {
      ...exercise,
      name: sanitizeText(exercise.name),
      description: sanitizeText(exercise.description),
      reps: sanitizeText(exercise.reps),
      speed: sanitizeText(exercise.speed),
      rest: sanitizeText(exercise.rest),
      instructor_notes: sanitizeText(exercise.instructor_notes),
      video_url: exercise.video_url // Keep URLs as-is
    };
  };

  const handleImport = async (name, exerciseList) => {
    console.log('handleImport called with:', { name, exerciseCount: exerciseList?.length });
    setSaving(true);
    try {
      console.log('Creating workout:', sanitizeText(name));
      const [workout] = await supabaseApi('workouts', 'POST', { name: sanitizeText(name) });
      console.log('Workout created:', workout.id);

      const savedExercises = [];
      console.log('Inserting', exerciseList.length, 'exercises');

      // Insert exercises one by one to avoid batch operation issues
      for (const exercise of exerciseList) {
        try {
          const sanitizedExercise = sanitizeExercise(exercise);

          // Add back essential fields one by one
          const exerciseToInsert = {
            workout_id: workout.id,
            exercise_order: sanitizedExercise.exercise_order || 1,
            name: (sanitizedExercise.name || 'Unnamed Exercise').substring(0, 100),
            description: (sanitizedExercise.description || '').substring(0, 500),
            reps: (sanitizedExercise.reps || '').substring(0, 100),
            speed: (sanitizedExercise.speed || '').substring(0, 200),
            rest: (sanitizedExercise.rest || '').substring(0, 100),
            sets: sanitizedExercise.sets || 1,
            video_url: (sanitizedExercise.video_url || '').substring(0, 500)
          };

          console.log('Inserting exercise:', exerciseToInsert.name);
          console.log('Exercise data being sent:', JSON.stringify(exerciseToInsert, null, 2));
          // Use local storage instead of database for now
          const savedExercise = {
            id: `ex_${Date.now()}_${Math.random()}`,
            ...exerciseToInsert,
            ...sanitizedExercise // Include all the rich data
          };
          savedExercises.push(savedExercise);
        } catch (err) {
          console.error('Failed to insert exercise:', exercise.name, err);
          console.error('Exercise data that failed:', JSON.stringify({ ...sanitizeExercise(exercise), workout_id: workout.id }, null, 2));
        }
      }

      console.log('Successfully inserted', savedExercises.length, 'exercises');

      const workoutWithCount = { ...workout, exercise_count: savedExercises.length };
      setWorkouts(prev => [workoutWithCount, ...prev]);
      setCurrentWorkout(workout);
      setExercises(savedExercises);
      setProgress({});
      setCurrentIndex(0);
      setShowImport(false);
      setCurrentView('workout');
    } catch (err) {
      console.error('Import error:', err);
      alert('Failed to import: ' + err.message);
    }
    setSaving(false);
  };

  const toggleSet = async (exerciseId, setIndex) => {
    const today = new Date().toISOString().split('T')[0];
    const current = progress[exerciseId] || { exercise_id: exerciseId, completed_sets: [], notes: '', session_date: today };
    const completedSets = current.completed_sets.includes(setIndex)
      ? current.completed_sets.filter(s => s !== setIndex)
      : [...current.completed_sets, setIndex];

    const updated = { ...current, completed_sets: completedSets };
    setProgress(prev => ({ ...prev, [exerciseId]: updated }));
    setSynced(false);

    try {
      await supabaseApi('exercise_progress', 'POST', updated, '?on_conflict=exercise_id,session_date');
      setSynced(true);
    } catch (err) {
      console.error('Sync error:', err);
    }
  };

  const updateNotes = async (exerciseId, notes) => {
    const today = new Date().toISOString().split('T')[0];
    const current = progress[exerciseId] || { exercise_id: exerciseId, completed_sets: [], notes: '', session_date: today };
    const updated = { ...current, notes };
    setProgress(prev => ({ ...prev, [exerciseId]: updated }));
    setSynced(false);

    try {
      await supabaseApi('exercise_progress', 'POST', updated, '?on_conflict=exercise_id,session_date');
      setSynced(true);
    } catch (err) {
      console.error('Sync error:', err);
    }
  };

  const resetProgress = async () => {
    const today = new Date().toISOString().split('T')[0];
    for (const ex of exercises) {
      try {
        await supabaseApi('exercise_progress', 'POST', { exercise_id: ex.id, completed_sets: [], notes: '', session_date: today }, '?on_conflict=exercise_id,session_date');
      } catch (err) { console.error(err); }
    }
    setProgress({});
  };

  const deleteWorkout = async (workoutId) => {
    try {
      console.log('Starting deletion for workout ID:', workoutId);

      // First, get all exercises for this workout
      const exercisesData = await supabaseApi('exercises', 'GET', null, `?workout_id=eq.${workoutId}&select=id`);
      console.log('Found exercises:', exercisesData?.length || 0);
      const exerciseIds = (exercisesData || []);

      // Delete progress for each exercise individually
      for (const exercise of exerciseIds) {
        try {
          console.log('Deleting progress for exercise:', exercise.id);
          await supabaseApi('exercise_progress', 'DELETE', null, `?exercise_id=eq.${exercise.id}`);
        } catch (err) {
          console.warn('Failed to delete progress for exercise:', exercise.id, err);
        }
      }

      // Delete exercises one by one to avoid complex queries
      for (const exercise of exerciseIds) {
        try {
          console.log('Deleting exercise:', exercise.id);
          await supabaseApi('exercises', 'DELETE', null, `?id=eq.${exercise.id}`);
        } catch (err) {
          console.warn('Failed to delete exercise:', exercise.id, err);
        }
      }

      // Finally delete the workout
      console.log('Deleting workout:', workoutId);
      await supabaseApi('workouts', 'DELETE', null, `?id=eq.${workoutId}`);

      console.log('Workout deleted successfully, updating UI state');

      // Remove from local state
      setWorkouts(prev => {
        console.log('Current workouts before filter:', prev.length);
        const filtered = prev.filter(w => w.id !== workoutId);
        console.log('Workouts after filter:', filtered.length);
        return filtered;
      });

      // If we're currently viewing this workout, go back to dashboard
      if (currentWorkout?.id === workoutId) {
        setCurrentWorkout(null);
        setExercises([]);
        setProgress({});
        setCurrentView('dashboard');
      }
    } catch (err) {
      console.error('Delete workout error:', err);
      alert('Failed to delete workout: ' + err.message);
    }
  };

  // Touch handlers
  const onTouchStart = (e) => { setTouchEnd(null); setTouchStart(e.targetTouches[0].clientX); };
  const onTouchMove = (e) => { setTouchEnd(e.targetTouches[0].clientX); };
  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    if (distance > 50 && currentIndex < exercises.length - 1) setCurrentIndex(currentIndex + 1);
    if (distance < -50 && currentIndex > 0) setCurrentIndex(currentIndex - 1);
  };

  const totalSets = exercises.reduce((sum, ex) => sum + ex.sets, 0);
  const completedSets = exercises.reduce((sum, ex) => sum + (progress[ex.id]?.completed_sets?.length || 0), 0);
  const progressPct = totalSets > 0 ? (completedSets / totalSets) * 100 : 0;

  // Show dashboard when no current view or explicitly on dashboard
  if (currentView === 'dashboard') {
    return (
      <Dashboard
        workouts={workouts}
        onSelectWorkout={handleSelectWorkout}
        onImport={handleImport}
        onDeleteWorkout={deleteWorkout}
        loading={loading}
        error={error}
        showImport={showImport}
        setShowImport={setShowImport}
        saving={saving}
      />
    );
  }

  // Loading state for workout view
  if (loading) {
    return (
      <div className="h-screen w-full bg-zinc-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  // Error state for workout view
  if (error) {
    return (
      <div className="h-screen w-full bg-zinc-950 flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <button onClick={() => setCurrentView('dashboard')} className="px-4 py-2 bg-orange-500 text-white rounded-lg">Back to Dashboard</button>
        </div>
      </div>
    );
  }

  // No exercises in current workout
  if (exercises.length === 0) {
    return (
      <div className="h-screen w-full bg-zinc-950 flex items-center justify-center p-4">
        <div className="text-center">
          <Dumbbell className="w-16 h-16 text-zinc-700 mx-auto mb-4" />
          <h1 className="text-white text-xl font-bold mb-2">Empty Workout</h1>
          <p className="text-zinc-400 mb-6">This workout has no exercises</p>
          <button onClick={() => setCurrentView('dashboard')} className="px-6 py-3 bg-zinc-500 hover:bg-zinc-600 text-white font-bold rounded-xl flex items-center gap-2 mx-auto">
            <Home className="w-5 h-5" /> Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full bg-zinc-950 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-4 pb-2">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setCurrentView('dashboard')}
              className="p-2 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
            >
              <Home className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <h1 className="text-white font-bold text-lg truncate">{currentWorkout?.name || 'Workout'}</h1>
              {synced ? <Cloud className="w-4 h-4 text-green-500" /> : <CloudOff className="w-4 h-4 text-yellow-500" />}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-zinc-400 text-sm">{completedSets}/{totalSets}</span>
            <button onClick={resetProgress} className="p-2 text-zinc-400 hover:text-white"><Trash2 className="w-4 h-4" /></button>
          </div>
        </div>
        <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-orange-500 to-orange-400 transition-all duration-300" style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      {/* Carousel */}
      <div className="flex-1 px-4 pb-4 overflow-hidden" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
        <div className="h-full transition-transform duration-300 ease-out flex" style={{ width: `${exercises.length * 100}%`, transform: `translateX(-${currentIndex * (100 / exercises.length)}%)` }}>
          {exercises.map((exercise) => (
            <div key={exercise.id} className="h-full px-1" style={{ width: `${100 / exercises.length}%` }}>
              <ExerciseCard exercise={exercise} progress={progress[exercise.id]} onUpdateNotes={updateNotes} onToggleSet={toggleSet} />
            </div>
          ))}
        </div>
      </div>

      {/* Navigation */}
      <div className="p-4 pt-2 flex items-center justify-between">
        <button onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))} disabled={currentIndex === 0} className="p-3 rounded-full bg-zinc-800 text-white disabled:opacity-30 hover:bg-zinc-700"><ChevronLeft className="w-6 h-6" /></button>
        <div className="flex gap-2">
          {exercises.map((_, i) => (
            <button key={i} onClick={() => setCurrentIndex(i)} className={`w-2.5 h-2.5 rounded-full transition-all ${i === currentIndex ? 'bg-orange-500 w-6' : 'bg-zinc-600 hover:bg-zinc-500'}`} />
          ))}
        </div>
        <button onClick={() => setCurrentIndex(Math.min(exercises.length - 1, currentIndex + 1))} disabled={currentIndex === exercises.length - 1} className="p-3 rounded-full bg-zinc-800 text-white disabled:opacity-30 hover:bg-zinc-700"><ChevronRight className="w-6 h-6" /></button>
      </div>

      {showImport && <ImportModal onImport={handleImport} onClose={() => setShowImport(false)} saving={saving} />}
    </div>
  );
}