-- Auto-assignment only takes panelists approved by the API's validator
-- (p_panel_ids), and the minimum cosine similarity goes from 0.4 to 0.8
-- (distance 0.6 to 0.2). The new parameter changes the signature, so the
-- old function has to be dropped or it would stay callable as an overload.
DROP FUNCTION IF EXISTS auto_assign_panel(BIGINT, extensions.vector);

CREATE OR REPLACE FUNCTION auto_assign_panel(
    p_thesis_id       BIGINT,
    p_query_embedding extensions.vector(384),
    p_panel_ids       BIGINT[]
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    c_max_assignments CONSTANT INT := 5;
    v_has_chair     BOOLEAN;
    v_member_count  INT;
    v_candidate     RECORD;
BEGIN
    SELECT
        COALESCE(bool_or(role = 'chair'), FALSE),
        COALESCE(count(*) FILTER (WHERE role = 'member'), 0)
    INTO v_has_chair, v_member_count
    FROM assigned_panelist
    WHERE thesis_id = p_thesis_id;

    IF v_has_chair AND v_member_count >= 2 THEN
        RETURN get_thesis_panel(p_thesis_id);
    END IF;

    FOR v_candidate IN
        SELECT p.panel_id, min(e.expertise_embedding <=> p_query_embedding) AS distance
        FROM panelist p
        JOIN expertise e ON e.panel_id = p.panel_id
        WHERE e.expertise_embedding IS NOT NULL
          AND p.panel_id = ANY(p_panel_ids)
          AND p.panel_id NOT IN (SELECT panel_id FROM assigned_panelist WHERE thesis_id = p_thesis_id)
          AND p.panel_id IS DISTINCT FROM (SELECT adviser_id FROM thesis WHERE thesis_id = p_thesis_id)
          AND (SELECT count(*) FROM assigned_panelist ap WHERE ap.panel_id = p.panel_id) < c_max_assignments
        GROUP BY p.panel_id
        HAVING min(e.expertise_embedding <=> p_query_embedding) <= 0.2
        ORDER BY distance ASC, p.panel_id ASC
    LOOP
        IF NOT v_has_chair THEN
            INSERT INTO assigned_panelist (thesis_id, panel_id, role)
            VALUES (p_thesis_id, v_candidate.panel_id, 'chair');
            v_has_chair := TRUE;
        ELSIF v_member_count < 2 THEN
            INSERT INTO assigned_panelist (thesis_id, panel_id, role)
            VALUES (p_thesis_id, v_candidate.panel_id, 'member');
            v_member_count := v_member_count + 1;
        ELSE
            EXIT;
        END IF;
    END LOOP;

    RETURN get_thesis_panel(p_thesis_id);
END;
$$;

-- The API calls this over PostgREST, which caches function signatures.
NOTIFY pgrst, 'reload schema';
