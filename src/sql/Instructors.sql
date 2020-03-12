select distinct
    spriden_id as "campusId",
    spriden_id as "sisLoginId",
    spriden_pidm as "pidm",
    nvl(spbpers_pref_first_name, spriden_first_name) as "firstName",
    spriden_last_name as "lastName",
    (select lower(goremal_email_address) from goremal where rownum = 1 and goremal_pidm = spriden_pidm and goremal_status_ind in ('A') and goremal_emal_code = 'FHDA') as "email",
    sirasgn_category as "category",
    decode(sirasgn_primary_ind, 'Y', 1, '2') as "primary"
from
    sirasgn,
    --sirattr,
    spriden,
    spbpers
where
    sirasgn_term_code = :term
    and sirasgn_crn = :crn
    --and sirattr_pidm = sirasgn_pidm
    --and sirattr_fatt_code = 'CANV'
    and spriden_pidm = sirasgn_pidm
    and spriden_change_ind is null
    and spbpers_pidm = spriden_pidm
    and spriden_id not in ('66666666')
-- ETS Help Desk #53725
-- Add stable sort to prioritize primary instructor of record
order by
    "category",
    "primary"