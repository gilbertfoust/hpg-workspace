-- Fix security warnings: tighten permissive RLS policies

-- Drop overly permissive policies
DROP POLICY IF EXISTS "Anyone can create submissions" ON public.form_submissions;
DROP POLICY IF EXISTS "System can insert audit log" ON public.audit_log;

-- Create more restrictive form submission policy
CREATE POLICY "Authenticated users can create submissions" ON public.form_submissions 
FOR INSERT TO authenticated 
WITH CHECK (submitted_by_user_id = auth.uid());

-- Audit log should only be inserted by internal system
CREATE POLICY "Internal users can log actions" ON public.audit_log 
FOR INSERT TO authenticated 
WITH CHECK (actor_user_id = auth.uid());

-- Fix function search path for update_updated_at_column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;