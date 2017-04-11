select distinct
    spriden_id as "campusId",
    spriden_pidm as "pidm",
    nvl(spbpers_pref_first_name, spriden_first_name) as "firstName",
    spriden_last_name as "lastName",
    (select lower(goremal_email_address) from goremal where rownum = 1 and goremal_pidm = spriden_pidm and goremal_status_ind in ('A') and goremal_emal_code = 'FHDA') as "email",
    sirasgn_category as "category",
    sirasgn_primary_ind as "primary"
from
    sirasgn,
    spriden,
    spbpers
where
    sirasgn_term_code = :term
    and sirasgn_crn = :crn
    and spriden_pidm = sirasgn_pidm
    and spriden_change_ind is null
    and spbpers_pidm = spriden_pidm
order by
    sirasgn_category asc,
    sirasgn_primary_ind asc