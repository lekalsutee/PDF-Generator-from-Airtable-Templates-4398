-- Enhanced database schema with security and filename tracking

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Templates table with enhanced security
CREATE TABLE IF NOT EXISTS templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  config JSONB NOT NULL,
  encrypted_credentials TEXT, -- AES-256 encrypted sensitive credentials
  status VARCHAR(50) DEFAULT 'draft',
  user_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_used TIMESTAMP WITH TIME ZONE,
  usage_count INTEGER DEFAULT 0,
  
  -- Security metadata
  encryption_version VARCHAR(10) DEFAULT 'v1',
  credentials_last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User configurations table
CREATE TABLE IF NOT EXISTS user_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  config JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Enhanced PDF generations table with filename tracking
CREATE TABLE IF NOT EXISTS pdf_generations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID,
  template_id UUID REFERENCES templates(id) ON DELETE CASCADE,
  record_id VARCHAR(255),
  filename VARCHAR(500), -- Dynamic filename generated
  status VARCHAR(50) NOT NULL,
  file_size INTEGER,
  generation_time INTEGER,
  generation_method VARCHAR(50), -- 'google-api', 'backend-copy', 'fallback'
  access_method VARCHAR(50), -- Method used to access document
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Security and audit fields
  user_agent TEXT,
  ip_address INET
);

-- Enhanced user activities table
CREATE TABLE IF NOT EXISTS user_activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID,
  action VARCHAR(100) NOT NULL,
  details JSONB,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_agent TEXT,
  ip_address INET,
  
  -- Security tracking
  session_id VARCHAR(255),
  security_level VARCHAR(20) DEFAULT 'normal' -- 'normal', 'sensitive', 'critical'
);

-- Security audit log table
CREATE TABLE IF NOT EXISTS security_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID,
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50), -- 'template', 'credentials', 'pdf'
  resource_id UUID,
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Security classification
  severity VARCHAR(20) DEFAULT 'info', -- 'info', 'warning', 'critical'
  requires_review BOOLEAN DEFAULT FALSE
);

-- Create enhanced indexes for performance
CREATE INDEX IF NOT EXISTS idx_templates_user_id ON templates(user_id);
CREATE INDEX IF NOT EXISTS idx_templates_status ON templates(status);
CREATE INDEX IF NOT EXISTS idx_templates_updated_at ON templates(updated_at);
CREATE INDEX IF NOT EXISTS idx_templates_credentials_updated ON templates(credentials_last_updated);

CREATE INDEX IF NOT EXISTS idx_pdf_generations_user_id ON pdf_generations(user_id);
CREATE INDEX IF NOT EXISTS idx_pdf_generations_template_id ON pdf_generations(template_id);
CREATE INDEX IF NOT EXISTS idx_pdf_generations_created_at ON pdf_generations(created_at);
CREATE INDEX IF NOT EXISTS idx_pdf_generations_status ON pdf_generations(status);
CREATE INDEX IF NOT EXISTS idx_pdf_generations_filename ON pdf_generations(filename);

CREATE INDEX IF NOT EXISTS idx_user_activities_user_id ON user_activities(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activities_timestamp ON user_activities(timestamp);
CREATE INDEX IF NOT EXISTS idx_user_activities_action ON user_activities(action);

CREATE INDEX IF NOT EXISTS idx_security_audit_user_id ON security_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_security_audit_timestamp ON security_audit_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_security_audit_severity ON security_audit_log(severity);
CREATE INDEX IF NOT EXISTS idx_security_audit_requires_review ON security_audit_log(requires_review);

-- Row Level Security (RLS) policies
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE pdf_generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_audit_log ENABLE ROW LEVEL SECURITY;

-- Enhanced policies for templates with security considerations
CREATE POLICY "Users can view their own templates" ON templates 
  FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can insert their own templates" ON templates 
  FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can update their own templates" ON templates 
  FOR UPDATE USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can delete their own templates" ON templates 
  FOR DELETE USING (auth.uid() = user_id OR user_id IS NULL);

-- Policies for user_configs
CREATE POLICY "Users can view their own config" ON user_configs 
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own config" ON user_configs 
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own config" ON user_configs 
  FOR UPDATE USING (auth.uid() = user_id);

-- Enhanced policies for pdf_generations with filename access
CREATE POLICY "Users can view their own PDF generations" ON pdf_generations 
  FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can insert their own PDF generations" ON pdf_generations 
  FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Policies for user_activities
CREATE POLICY "Users can view their own activities" ON user_activities 
  FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can insert their own activities" ON user_activities 
  FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Security audit log policies (restricted access)
CREATE POLICY "Users can view their own security audit entries" ON security_audit_log 
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can insert security audit entries" ON security_audit_log 
  FOR INSERT WITH CHECK (true); -- Allow system to log security events

-- Functions for automatic timestamp and security updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  
  -- If credentials are being updated, track it
  IF TG_TABLE_NAME = 'templates' AND OLD.encrypted_credentials IS DISTINCT FROM NEW.encrypted_credentials THEN
    NEW.credentials_last_updated = NOW();
    
    -- Log credential update in security audit
    INSERT INTO security_audit_log (user_id, action, resource_type, resource_id, details, severity)
    VALUES (
      auth.uid(),
      'credentials_updated',
      'template',
      NEW.id,
      jsonb_build_object(
        'template_name', NEW.name,
        'had_previous_credentials', (OLD.encrypted_credentials IS NOT NULL),
        'has_new_credentials', (NEW.encrypted_credentials IS NOT NULL)
      ),
      'warning'
    );
  END IF;
  
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Function to log PDF generation with security tracking
CREATE OR REPLACE FUNCTION log_pdf_generation()
RETURNS TRIGGER AS $$
BEGIN
  -- Log PDF generation in security audit for successful generations
  IF NEW.status = 'completed' THEN
    INSERT INTO security_audit_log (user_id, action, resource_type, resource_id, details, severity)
    VALUES (
      NEW.user_id,
      'pdf_generated',
      'pdf',
      NEW.id,
      jsonb_build_object(
        'template_id', NEW.template_id,
        'filename', NEW.filename,
        'file_size', NEW.file_size,
        'generation_method', NEW.generation_method,
        'generation_time', NEW.generation_time
      ),
      'info'
    );
  END IF;
  
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for automatic updates
CREATE TRIGGER update_templates_updated_at 
  BEFORE UPDATE ON templates 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_configs_updated_at 
  BEFORE UPDATE ON user_configs 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER log_pdf_generation_trigger 
  AFTER INSERT ON pdf_generations 
  FOR EACH ROW EXECUTE FUNCTION log_pdf_generation();

-- Function to clean up old audit logs (optional, for maintenance)
CREATE OR REPLACE FUNCTION cleanup_old_audit_logs()
RETURNS void AS $$
BEGIN
  -- Keep only last 6 months of audit logs for performance
  DELETE FROM security_audit_log 
  WHERE timestamp < NOW() - INTERVAL '6 months'
    AND severity = 'info'
    AND requires_review = FALSE;
    
  -- Keep critical logs for 2 years
  DELETE FROM security_audit_log 
  WHERE timestamp < NOW() - INTERVAL '2 years'
    AND severity = 'critical';
END;
$$ language 'plpgsql';

-- View for template analytics with security info
CREATE OR REPLACE VIEW template_analytics AS
SELECT 
  t.id,
  t.name,
  t.status,
  t.usage_count,
  t.last_used,
  t.created_at,
  t.credentials_last_updated,
  (t.encrypted_credentials IS NOT NULL) AS has_encrypted_credentials,
  COUNT(pg.id) AS pdf_count,
  SUM(pg.file_size) AS total_file_size,
  AVG(pg.generation_time) AS avg_generation_time
FROM templates t
LEFT JOIN pdf_generations pg ON t.id = pg.template_id AND pg.status = 'completed'
GROUP BY t.id, t.name, t.status, t.usage_count, t.last_used, t.created_at, t.credentials_last_updated, t.encrypted_credentials;

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON templates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON user_configs TO authenticated;
GRANT SELECT, INSERT ON pdf_generations TO authenticated;
GRANT SELECT, INSERT ON user_activities TO authenticated;
GRANT SELECT, INSERT ON security_audit_log TO authenticated;
GRANT SELECT ON template_analytics TO authenticated;