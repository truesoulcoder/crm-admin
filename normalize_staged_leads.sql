-- Drop the function if it already exists, to ensure a clean setup
DROP FUNCTION IF EXISTS public.normalize_staged_leads(p_market_region TEXT);

-- Create or replace the function
CREATE OR REPLACE FUNCTION public.normalize_staged_leads(p_market_region TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- 1. Drop and recreate normalized_leads with the multi-contact schema
    DROP TABLE IF EXISTS public.normalized_leads CASCADE;
    CREATE TABLE public.normalized_leads (
        id BIGSERIAL PRIMARY KEY,
        original_lead_id UUID UNIQUE,
        contact_name TEXT,
        contact_email TEXT,
        contact1_name TEXT,
        contact1_email_1 TEXT,
        contact2_name TEXT,
        contact2_email_1 TEXT,
        contact3_name TEXT,
        contact3_email_1 TEXT,
        mls_curr_list_agent_name TEXT,
        mls_curr_list_agent_email TEXT,
        property_address TEXT,
        property_city TEXT,
        property_state TEXT,
        property_postal_code TEXT,
        property_type TEXT,
        baths TEXT,
        beds TEXT,
        year_built TEXT,
        square_footage TEXT,
        wholesale_value NUMERIC,
        assessed_total NUMERIC,
        mls_curr_status TEXT,
        mls_curr_days_on_market TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- 2. Insert and transform data from leads (staging) table for the specified market region
    INSERT INTO public.normalized_leads (
        original_lead_id,
        contact_name,
        contact_email,
        contact1_name,
        contact1_email_1,
        contact2_name,
        contact2_email_1,
        contact3_name,
        contact3_email_1,
        mls_curr_list_agent_name,
        mls_curr_list_agent_email,
        property_address,
        property_city,
        property_state,
        property_postal_code,
        property_type,
        baths,
        beds,
        year_built,
        square_footage,
        wholesale_value,
        assessed_total,
        mls_curr_status,
        mls_curr_days_on_market
    )
    SELECT
        staged.id AS original_lead_id,
        staged.contact1_name AS contact_name,
        LOWER(staged.contact1_email_1) AS contact_email,
        staged.contact1_name,
        LOWER(staged.contact1_email_1),
        staged.contact2_name,
        LOWER(staged.contact2_email_1),
        staged.contact3_name,
        LOWER(staged.contact3_email_1),
        staged.mls_curr_list_agent_name,
        LOWER(staged.mls_curr_list_agent_email),
        staged.property_address,
        staged.property_city,
        staged.property_state,
        staged.property_zip,
        staged.property_type,
        staged.baths,
        staged.beds,
        staged.year_built,
        staged.square_footage,
        NULLIF(REPLACE(REPLACE(staged.wholesale_value, '$', ''), ',', ''), '')::NUMERIC,
        NULLIF(REPLACE(REPLACE(staged.assessed_total, '$', ''), ',', ''), '')::NUMERIC,
        staged.mls_curr_status,
        staged.mls_curr_days_on_market
    FROM public.leads staged
    WHERE staged.market_region = p_market_region;

    -- 3. Clear the staging table for this market region
    DELETE FROM public.leads WHERE market_region = p_market_region;

    -- 4. Add relevant indexes
    CREATE INDEX IF NOT EXISTS idx_norm_leads_c1_email ON public.normalized_leads(contact1_email_1);
    CREATE INDEX IF NOT EXISTS idx_norm_leads_c2_email ON public.normalized_leads(contact2_email_1);
    CREATE INDEX IF NOT EXISTS idx_norm_leads_c3_email ON public.normalized_leads(contact3_email_1);
    CREATE INDEX IF NOT EXISTS idx_norm_leads_agent_email ON public.normalized_leads(mls_curr_list_agent_email);
    CREATE INDEX IF NOT EXISTS idx_norm_leads_prop_addr_full ON public.normalized_leads(property_address, property_city, property_state, property_postal_code);

    RAISE NOTICE 'Normalization of staged leads complete for region: %', p_market_region;

EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Error in normalize_staged_leads for market region %: %', p_market_region, SQLERRM;
END;
$$;
    -- 1. Define the target normalized_leads table with the SPECIFIED multi-contact schema
    --    Dropping and recreating ensures the schema is exactly as defined here.
    DROP TABLE IF EXISTS public.normalized_leads CASCADE; 
    CREATE TABLE public.normalized_leads (
        id BIGSERIAL PRIMARY KEY,
        original_lead_id UUID UNIQUE, -- To store the ID from the 'leads' staging table
        
        -- Contact fields based on your new schema preference
        contact_name TEXT, -- Alias for contact1_name
        contact_email TEXT, -- Alias for contact1_email_1
        contact1_name TEXT,
        contact1_email_1 TEXT,
        contact2_name TEXT,
        contact2_email_1 TEXT,
        contact3_name TEXT,
        contact3_email_1 TEXT,
        mls_curr_list_agent_name TEXT,
        mls_curr_list_agent_email TEXT,

        -- Property details
        property_address TEXT,
        property_city TEXT,
        property_state TEXT,
        property_postal_code TEXT,
        property_type TEXT,
        baths TEXT,
        beds TEXT,
        year_built TEXT,
        square_footage TEXT,          
        wholesale_value NUMERIC,     
        assessed_total NUMERIC,      
        mls_curr_status TEXT,
        mls_curr_days_on_market TEXT,
        
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- 2. Insert and transform data from the 'leads' (staging) table
    INSERT INTO public.normalized_leads (
        original_lead_id,
        contact_name,
        contact_email,
        contact1_name,
        contact1_email_1,
        contact2_name,
        contact2_email_1,
        contact3_name,
        contact3_email_1,
        mls_curr_list_agent_name,
        mls_curr_list_agent_email,
        property_address,
        property_city,
        property_state,
        property_postal_code,
        property_type,
        baths,
        beds,
        year_built,
        square_footage,
        wholesale_value,
        assessed_total,
        mls_curr_status,
        mls_curr_days_on_market
    )
    SELECT
        staged.id AS original_lead_id,
        staged.contact1_name AS contact_name,           -- Alias for contact1_name
        LOWER(staged.contact1_email_1) AS contact_email, -- Alias for contact1_email_1
        staged.contact1_name,                           -- Assuming 'contact1_name' from staging
        LOWER(staged.contact1_email_1),                 -- Assuming 'contact1_email_1' from staging
        staged.contact2_name,                           -- Assuming 'contact2_name' from staging
        LOWER(staged.contact2_email_1),                 -- Assuming 'contact2_email_1' from staging
        staged.contact3_name,                           -- Assuming 'contact3_name' from staging
        LOWER(staged.contact3_email_1),                 -- Assuming 'contact3_email_1' from staging
        staged.mls_curr_list_agent_name,                -- Assuming 'mls_curr_list_agent_name'
        LOWER(staged.mls_curr_list_agent_email),        -- Assuming 'mls_curr_list_agent_email'
        staged.property_address,
        staged.property_city,
        staged.property_state,
        staged.property_zip, -- MAPPING staging.property_zip to normalized_leads.property_postal_code
        staged.property_type,
        staged.baths, 
        staged.beds,
        staged.year_built,
        staged.square_footage, 
        NULLIF(REPLACE(REPLACE(staged.wholesale_value, '$', ''), ',', ''), '')::NUMERIC, -- Clean and cast
        NULLIF(REPLACE(REPLACE(staged.assessed_total, '$', ''), ',', ''), '')::NUMERIC,  -- Clean and cast
        staged.mls_curr_status,                         -- Matches CSV header after snake_case
        staged.mls_curr_days_on_market                  -- Matches CSV header after snake_case
    FROM public.leads staged
    WHERE staged.market_region = p_market_region
    ON CONFLICT (original_lead_id) DO UPDATE SET 
        contact1_name = EXCLUDED.contact1_name,
        contact1_email_1 = EXCLUDED.contact1_email_1,
        contact2_name = EXCLUDED.contact2_name,
        contact2_email_1 = EXCLUDED.contact2_email_1,
        contact3_name = EXCLUDED.contact3_name,
        contact3_email_1 = EXCLUDED.contact3_email_1,
        mls_curr_list_agent_name = EXCLUDED.mls_curr_list_agent_name,
        mls_curr_list_agent_email = EXCLUDED.mls_curr_list_agent_email,
        property_address = EXCLUDED.property_address,
        property_city = EXCLUDED.property_city,
        property_state = EXCLUDED.property_state,
        property_postal_code = EXCLUDED.property_postal_code,
        property_type = EXCLUDED.property_type,
        baths = EXCLUDED.baths,
        beds = EXCLUDED.beds,
        year_built = EXCLUDED.year_built,
        square_footage = EXCLUDED.square_footage,
        wholesale_value = EXCLUDED.wholesale_value,
        assessed_total = EXCLUDED.assessed_total,
        mls_curr_status = EXCLUDED.mls_curr_status,
        mls_curr_days_on_market = EXCLUDED.mls_curr_days_on_market,
        updated_at = NOW();

    -- 3. Clear the staging table for that market region after successful normalization
    DELETE FROM public.leads WHERE market_region = p_market_region;

    -- 4. (Optional) Add relevant indexes for the new schema
    CREATE INDEX IF NOT EXISTS idx_norm_leads_c1_email ON public.normalized_leads(contact1_email_1);
    CREATE INDEX IF NOT EXISTS idx_norm_leads_c2_email ON public.normalized_leads(contact2_email_1);
    CREATE INDEX IF NOT EXISTS idx_norm_leads_c3_email ON public.normalized_leads(contact3_email_1);
    CREATE INDEX IF NOT EXISTS idx_norm_leads_agent_email ON public.normalized_leads(mls_curr_list_agent_email);
    CREATE INDEX IF NOT EXISTS idx_norm_leads_prop_addr_full ON public.normalized_leads(property_address, property_city, property_state, property_postal_code);

    RAISE NOTICE 'Normalization of staged leads (multi-contact schema) complete. Staging table cleared.';

EXCEPTION
    WHEN OTHERS THEN
        -- Output the specific SQL error message for better debugging
        RAISE EXCEPTION 'Error in normalize_staged_leads (multi-contact schema): %', SQLERRM;
END;
$$;
