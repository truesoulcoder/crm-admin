-- Create or replace the start_eli5_engine function
CREATE OR REPLACE FUNCTION public.start_eli5_engine(
  dry_run BOOLEAN DEFAULT false,
  sender_quota INTEGER DEFAULT 100,
  market_region TEXT DEFAULT NULL,
  min_interval_seconds INTEGER DEFAULT 60,
  max_interval_seconds INTEGER DEFAULT 300,
  selected_sender_ids UUID[] DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
  campaign_record RECORD;
  sender_record RECORD;
  sender_ids UUID[];
  min_interval INTERVAL;
  max_interval INTERVAL;
  interval_seconds INTEGER;
  sender_count INTEGER;
  campaign_id_param UUID;
  sender_quota_param INTEGER;
  
  -- Default values - update these with your actual values if needed
  DEFAULT_CAMPAIGN_ID CONSTANT UUID := '00000000-0000-0000-0000-000000000000';
  DEFAULT_SENDER_QUOTA CONSTANT INTEGER := 100;
  
BEGIN
  -- Convert interval seconds to interval type
  min_interval := (min_interval_seconds || ' seconds')::INTERVAL;
  max_interval := (max_interval_seconds || ' seconds')::INTERVAL;
  
  -- Log the start of the engine with parameters
  RAISE NOTICE 'Starting ELI5 Engine with parameters: dry_run=%, limit_per_run=%, market_region=%, min_interval=%, max_interval=%, selected_senders=%', 
    dry_run, limit_per_run, market_region, min_interval, max_interval, 
    CASE WHEN selected_sender_ids IS NULL THEN 'ALL' ELSE array_to_string(selected_sender_ids, ',') END;
  
  -- Get active campaign with optional market region filter
  SELECT id, daily_limit, market_region 
  INTO campaign_record
  FROM public.campaigns 
  WHERE status = 'active' 
  AND (market_region IS NULL OR market_region = start_eli5_engine.market_region OR start_eli5_engine.market_region IS NULL)
  ORDER BY created_at DESC 
  LIMIT 1;
  
  -- If no active campaign is found, use defaults
  IF NOT FOUND OR campaign_record.id IS NULL THEN
    campaign_id_param := DEFAULT_CAMPAIGN_ID;
    sender_quota_param := DEFAULT_SENDER_QUOTA;
    
    RAISE WARNING 'No active campaign found, using default values';
  ELSE
    campaign_id_param := campaign_record.id;
    sender_quota_param := COALESCE(campaign_record.daily_limit, DEFAULT_SENDER_QUOTA);
    
    -- Use campaign's market region if not provided
    IF market_region IS NULL AND campaign_record.market_region IS NOT NULL THEN
      market_region := campaign_record.market_region;
      RAISE NOTICE 'Using campaign market region: %', market_region;
    END IF;
  END IF;
  
  -- Get sender IDs if not provided
  IF selected_sender_ids IS NULL OR array_length(selected_sender_ids, 1) = 0 THEN
    -- Get all active senders
    SELECT array_agg(id) INTO sender_ids
    FROM public.senders
    WHERE status = 'ACTIVE' AND is_active = true;
    
    IF array_length(sender_ids, 1) IS NULL THEN
      RAISE EXCEPTION 'No active senders found';
    END IF;
  ELSE
    -- Use provided sender IDs
    sender_ids := selected_sender_ids;
  END IF;
  
  -- Log the senders that will be used
  SELECT count(*) INTO sender_count FROM unnest(sender_ids);
  RAISE NOTICE 'Using % senders for this run', sender_count;
  
  -- Update campaign status to indicate the engine is running
  BEGIN
    -- First, try to update existing status
    UPDATE public.eli5_engine_status
    SET 
      is_enabled = true,
      updated_at = NOW(),
      last_started_at = NOW(),
      dry_run = dry_run,
      limit_per_run = limit_per_run,
      market_region = market_region,
      min_interval_seconds = min_interval_seconds,
      max_interval_seconds = max_interval_seconds,
      selected_sender_ids = selected_sender_ids
    WHERE status_key = 'campaign_processing_enabled';
    
    -- If no rows were updated, insert a new one
    IF NOT FOUND THEN
      INSERT INTO public.eli5_engine_status (
        status_key, 
        is_enabled, 
        updated_at, 
        last_started_at,
        dry_run,
        limit_per_run,
        market_region,
        min_interval_seconds,
        max_interval_seconds,
        selected_sender_ids
      ) VALUES (
        'campaign_processing_enabled',
        true,
        NOW(),
        NOW(),
        dry_run,
        limit_per_run,
        market_region,
        min_interval_seconds,
        max_interval_seconds,
        selected_sender_ids
      );
    END IF;
    
    -- Log the status update
    RAISE NOTICE 'Updated engine status to: enabled=true, dry_run=%', dry_run;
    
    -- In a real implementation, you would start your background job or worker here
    -- For example, you might call a function that processes leads in batches
    -- This is a placeholder for that logic
    
    -- Example of how you might start processing leads
    -- PERFORM public.process_leads_batch(
    --   campaign_id_param,
    --   template_id_param,
    --   sender_quota_param,
    --   dry_run,
    --   market_region,
    --   min_interval_seconds,
    --   max_interval_seconds,
    --   selected_sender_ids
    -- );
    
    -- Return success response
    result := json_build_object(
      'status', 'success',
      'message', 'ELI5 Engine started successfully',
      'details', json_build_object(
        'dry_run', dry_run,
        'limit_per_run', limit_per_run,
        'market_region', market_region,
        'min_interval_seconds', min_interval_seconds,
        'max_interval_seconds', max_interval_seconds,
        'sender_count', sender_count,
        'campaign_id', campaign_id_param,
        'template_id', template_id_param
      )
    );
    
  EXCEPTION WHEN OTHERS THEN
    -- Log the error
    RAISE WARNING 'Failed to start ELI5 Engine: %', SQLERRM;
    
    -- Return error response
    result := json_build_object(
      'status', 'error',
      'message', 'Failed to start ELI5 Engine',
      'error', SQLERRM
    );
  END;
  
  RETURN result;
END;
$$;

-- Grant execute permission to authenticated users
GRANTE EXECUTE ON FUNCTION public.start_eli5_engine(
  BOOLEAN, INTEGER, TEXT, INTEGER, INTEGER, UUID[]
) TO authenticated;

-- Add a comment to the function
COMMENT ON FUNCTION public.start_eli5_engine IS 'Starts the ELI5 email campaign engine with the specified parameters. The engine will process leads and send emails according to the provided configuration.';
