-- Create a function to safely delete links in batches
CREATE OR REPLACE FUNCTION safely_delete_topbar_links()
RETURNS void AS $$
DECLARE
    batch_size INTEGER := 100;
    deleted INTEGER;
BEGIN
    LOOP
        -- Delete links in small batches
        WITH batch AS (
            SELECT id FROM topbar_links
            LIMIT batch_size
            FOR UPDATE SKIP LOCKED
        )
        DELETE FROM topbar_links
        WHERE id IN (SELECT id FROM batch);
        
        GET DIAGNOSTICS deleted = ROW_COUNT;
        
        EXIT WHEN deleted = 0;
        
        -- Small pause between batches to prevent timeouts
        PERFORM pg_sleep(0.1);
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Execute the safe deletion function
DO $$
BEGIN
    PERFORM safely_delete_topbar_links();
END $$;

-- Drop the function after use
DROP FUNCTION IF EXISTS safely_delete_topbar_links();