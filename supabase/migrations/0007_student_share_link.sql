-- Shareable, read-only student list. Each chairperson gets an
-- unguessable token; /students/<token> shows their program's list
-- without logging in. Emails and thesis links are left out since
-- the link gets passed around group chats.
ALTER TABLE program_chairperson
    ADD COLUMN IF NOT EXISTS share_token UUID NOT NULL DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX IF NOT EXISTS program_chairperson_share_token_idx
    ON program_chairperson (share_token);

CREATE OR REPLACE FUNCTION public_list_students(p_token UUID)
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT jsonb_build_object(
        'program', pc.program,
        'students', (
            SELECT COALESCE(jsonb_agg(s), '[]'::jsonb)
            FROM (
                SELECT
                    st.stu_id, st.student_name, st.partner_name, st.course,
                    t.title,
                    adv.full_name AS adviser_name,
                    (
                        SELECT COALESCE(jsonb_agg(jsonb_build_object(
                            'role', ap.role,
                            'full_name', p.full_name,
                            'position', p.position
                        ) ORDER BY (ap.role = 'chair') DESC, ap.assign_id), '[]'::jsonb)
                        FROM assigned_panelist ap
                        JOIN panelist p ON p.panel_id = ap.panel_id
                        WHERE ap.thesis_id = t.thesis_id
                    ) AS panel
                FROM student st
                LEFT JOIN thesis t ON t.stu_id = st.stu_id
                LEFT JOIN panelist adv ON adv.panel_id = t.adviser_id
                WHERE lower(trim(st.program)) = lower(trim(pc.program))
                ORDER BY st.student_name
            ) s
        )
    )
    FROM program_chairperson pc
    WHERE pc.share_token = p_token;
$$;

GRANT EXECUTE ON FUNCTION public_list_students(UUID) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
