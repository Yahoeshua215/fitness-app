-- Fitness App Database Schema
-- Run this in your Supabase SQL Editor

-- Ensure workouts table exists with correct structure
CREATE TABLE IF NOT EXISTS workouts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create exercises table with all required fields
CREATE TABLE IF NOT EXISTS exercises (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workout_id UUID REFERENCES workouts(id) ON DELETE CASCADE,
  exercise_order INTEGER DEFAULT 1,
  name TEXT NOT NULL,
  description TEXT,
  reps TEXT,
  speed TEXT,
  rest TEXT,
  sets INTEGER DEFAULT 1,
  video_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create exercise_progress table for tracking completed sets
CREATE TABLE IF NOT EXISTS exercise_progress (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  exercise_id UUID REFERENCES exercises(id) ON DELETE CASCADE,
  completed_sets INTEGER[] DEFAULT '{}',
  notes TEXT,
  session_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_exercises_workout_id ON exercises(workout_id);
CREATE INDEX IF NOT EXISTS idx_exercises_order ON exercises(workout_id, exercise_order);
CREATE INDEX IF NOT EXISTS idx_progress_exercise_id ON exercise_progress(exercise_id);
CREATE INDEX IF NOT EXISTS idx_progress_session_date ON exercise_progress(session_date);

-- Enable Row Level Security (recommended)
ALTER TABLE workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercise_progress ENABLE ROW LEVEL SECURITY;

-- Create policies to allow all operations (adjust as needed for your security requirements)
CREATE POLICY "Allow all operations on workouts" ON workouts FOR ALL USING (true);
CREATE POLICY "Allow all operations on exercises" ON exercises FOR ALL USING (true);
CREATE POLICY "Allow all operations on exercise_progress" ON exercise_progress FOR ALL USING (true);