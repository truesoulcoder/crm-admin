-- Create or replace the stop_eli5_engine function
CREATE OR REPLACE FUNCTION public.stop_eli5_engine()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
  updated_rows INTEGER;
  status_record RECORD;
  
  -- Constants for response messages
  MSG_ALREADY_STOPPED CONSTANT TEXT := 'ELI5 Engine is already stopped';
  MSG_STOPPED CONSTANT TEXT := 'ELI5 Engine has been stopped';
  MSG_NO_RECORD CONSTANT TEXT := 'No active engine status record found, nothing to stop';
  MSG_ERROR CONSTANT TEXT := 'Error stopping ELI5 Engine';
  
BEGIN
  -- Check current status
  SELECT * INTO status_record 
  FROM public.eli5_engine_status 
  WHERE status_key = 'campaign_processing_enabled';
  
  IF FOUND THEN
    -- If already stopped, return success but with appropriate message
    IF NOT status_record.is_enabled THEN
      result := json_build_object(
        'status', 'success',
        'message', MSG_ALREADY_STOPPED,
        'was_running', false,
        'stopped_at', NOW(),
        'details', json_build_object(
          'previous_status', 'stopped',
          'last_started_at', status_record.last_started_at,
          'last_stopped_at', status_record.last_stopped_at
        )
      );
    ELSE
      -- Update status to stopped
      UPDATE public.eli5_engine_status
      SET 
        is_enabled = false,
        updated_at = NOW(),
        last_stopped_at = NOW()
      WHERE status_key = 'campaign_processing_enabled'
      RETURNING 1 INTO updated_rows;
      
      -- Verify the update was successful
      IF updated_rows > 0 THEN
        -- Get the updated record for the response
        SELECT * INTO status_record 
        FROM public.eli5_engine_status 
        WHERE status_key = 'campaign_processing_enabled';
        
        result := json_build_object(
          'status', 'success',
          'message', MSG_STOPPED,
          'was_running', true,
          'stopped_at', status_record.last_stopped_at,
          'details', json_build_object(
            'previous_status', 'running',
            'last_started_at', status_record.last_started_at,
            'run_duration_seconds', EXTRACT(EPOCH FROM (NOW() - status_record.updated_at)),
            'dry_run', status_record.dry_run,
            'limit_per_run', status_record.limit_per_run,
            'market_region', status_record.market_region
          )
        );
        
        -- Log the stop event
        RAISE NOTICE 'ELI5 Engine stopped at %', NOW();
      ELSE
        -- This should theoretically never happen since we found the record above
        result := json_build_object(
          'status', 'error',
          'message', 'Failed to update engine status',
          'error', 'No rows updated when stopping engine'
        );
      END IF;
    END IF;
  ELSE
    -- No status record found
    result := json_build_object(
      'status', 'success',
      'message', MSG_NO_RECORD,
      'was_running', false,
      'stopped_at', NOW()
    );
  END IF;
  
  -- In a real implementation, you might want to:
  -- 1. Cancel any in-progress background jobs
  -- 2. Update the status of any in-progress campaign jobs
  -- 3. Log the stop event for auditing
  
  RETURN result;
  
EXCEPTION WHEN OTHERS THEN
  -- Log the error
  RAISE WARNING 'Error in stop_eli5_engine: %', SQLERRM;
  
  -- Return error response
  RETURN json_build_object(
    'status', 'error',
    'message', MSG_ERROR,
    'error', SQLERRM
  );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.stop_eli5_engine() TO authenticated;

-- Add a comment to the function
COMMENT ON FUNCTION public.stop_eli5_engine IS 'Stops the ELI5 email campaign engine by updating the engine status. This function is idempotent and safe to call multiple times.';