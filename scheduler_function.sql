CREATE OR REPLACE FUNCTION schedule_campaign(p_start_offset INTERVAL, p_campaign_id UUID)
RETURNS void AS $$
DECLARE
    campaign_id_var UUID := p_campaign_id;
    market_region TEXT;
    dynamic_sql TEXT;
BEGIN
    -- Define custom schedule start offset
    CREATE TEMP TABLE schedule_start AS
    SELECT NOW() + p_start_offset AS start_time;

    -- Fetch market region from campaign
    SELECT market_region INTO market_region
    FROM campaigns
    WHERE id = campaign_id_var;

    IF market_region IS NULL THEN
        RAISE EXCEPTION 'Campaign ID % has no associated market region.', campaign_id_var;
    END IF;

    CREATE TEMP TABLE campaign_id AS SELECT campaign_id_var AS id;

    -- Build dynamic SQL to pull leads from the correct table based on campaign's market_region
    dynamic_sql := format($f$
        CREATE TEMP TABLE selected_leads AS
        WITH available_leads AS (
            SELECT 
                id as lead_id,
                contact_name,
                contact_email,
                ROW_NUMBER() OVER (ORDER BY RANDOM()) as rn
            FROM %I
            WHERE email_sent IS NULL OR email_sent = FALSE
            LIMIT 1000
        )
        SELECT 
            lead_id,
            contact_name,
            contact_email,
            rn
        FROM available_leads;
    $f$, market_region || '_fine_cut_leads');

    EXECUTE dynamic_sql;

    CREATE TEMP TABLE active_senders AS
    SELECT 
        id,
        ROW_NUMBER() OVER (ORDER BY id) as sender_num,
        COUNT(*) OVER () as total_senders
    FROM senders 
    WHERE is_active = TRUE;

    WITH 
    time_window AS (
        SELECT 10 * 60 * 60 as total_seconds
    ),
    all_seconds AS (
        SELECT generate_series(0, (SELECT total_seconds FROM time_window) - 1) as second_offset
    ),
    selected_times AS (
        SELECT 
            second_offset,
            ROW_NUMBER() OVER (ORDER BY RANDOM()) as rn
        FROM all_seconds
        ORDER BY RANDOM()
        LIMIT (SELECT COUNT(*) FROM selected_leads)
    ),
    scheduled_emails AS (
        SELECT
            sl.lead_id,
            sl.contact_name,
            sl.contact_email,
            (SELECT start_time FROM schedule_start) + (st.second_offset * INTERVAL '1 second') as send_time,
            asnd.id as sender_id
        FROM 
            selected_leads sl
        JOIN 
            selected_times st ON sl.rn = st.rn
        JOIN
            active_senders asnd ON 
                asnd.sender_num = ((sl.rn - 1) % (SELECT total_senders FROM active_senders LIMIT 1)) + 1
    )

    INSERT INTO campaign_jobs (
        campaign_id,
        status,
        lead_id,
        email_address,
        contact_name,
        assigned_sender_id,
        current_step,
        next_processing_time,
        created_at,
        updated_at
    )
    SELECT
        (SELECT id FROM campaign_id LIMIT 1) as campaign_id,
        'pending' as status,
        lead_id,
        contact_email as email_address,
        contact_name,
        sender_id as assigned_sender_id,
        1 as current_step,
        send_time as next_processing_time,
        NOW() as created_at,
        NOW() as updated_at
    FROM 
        scheduled_emails
    ORDER BY
        send_time;

    EXECUTE format('UPDATE %I SET email_sent = TRUE, updated_at = NOW() WHERE id IN (SELECT lead_id FROM selected_leads);', market_region || '_fine_cut_leads');

    WITH stats AS (
        SELECT
            COUNT(*) as total_emails,
            MIN(next_processing_time) as first_send_time,
            MAX(next_processing_time) as last_send_time,
            COUNT(DISTINCT assigned_sender_id) as senders_used
        FROM campaign_jobs 
        WHERE status = 'pending'
        AND created_at >= NOW() - INTERVAL '5 minutes'
    )
    INSERT INTO system_event_logs (
        event_type,
        message,
        details,
        created_at,
        updated_at
    ) 
    SELECT
        'campaign_scheduled',
        'Scheduled ' || total_emails || ' emails for campaign ID ' || p_campaign_id,
        json_build_object(
            'campaign_id', (SELECT id FROM campaign_id LIMIT 1),
            'total_emails', total_emails,
            'scheduled_at', NOW(),
            'time_window_hours', 10,
            'first_send_time', first_send_time,
            'last_send_time', last_send_time,
            'avg_emails_per_hour', ROUND(total_emails::numeric / 10, 2),
            'senders_used', senders_used,
            'leads_marked', (SELECT COUNT(*) FROM selected_leads)
        ),
        NOW(),
        NOW()
    FROM stats;

    WITH sender_stats AS (
        SELECT
            assigned_sender_id,
            COUNT(*) as email_count,
            MIN(next_processing_time) as first_send_time,
            MAX(next_processing_time) as last_send_time
        FROM 
            campaign_jobs 
        WHERE 
            status = 'pending'
            AND created_at >= NOW() - INTERVAL '5 minutes'
        GROUP BY 
            assigned_sender_id
    )
    INSERT INTO system_event_logs (
        event_type,
        message,
        details,
        created_at,
        updated_at
    )
    SELECT
        'campaign_sender_distribution',
        'Email distribution for sender ' || assigned_sender_id || ' in campaign ID ' || p_campaign_id,
        json_build_object(
            'campaign_id', (SELECT id FROM campaign_id LIMIT 1),
            'sender_id', assigned_sender_id,
            'email_count', email_count,
            'first_send_time', first_send_time,
            'last_send_time', last_send_time,
            'emails_per_hour', ROUND(email_count::numeric / 10, 2)
        ),
        NOW(),
        NOW()
    FROM 
        sender_stats;

    DROP TABLE IF EXISTS schedule_start;
    DROP TABLE IF EXISTS campaign_id;
    DROP TABLE IF EXISTS selected_leads;
    DROP TABLE IF EXISTS active_senders;
END;
$$ LANGUAGE plpgsql;
