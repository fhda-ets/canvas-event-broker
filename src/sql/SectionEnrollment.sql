select
    spriden_id as "campusId",
    spriden_pidm as "pidm",
    nvl(spbpers_pref_first_name, spriden_first_name) as "firstName",
    spriden_last_name as "lastName",
    (select lower(goremal_email_address) from goremal where goremal.rowid = baninst1.f_get_email_rowid(spriden_pidm, 'STDNEMAL', 'A', NULL)) as "email"
from
    sfrstcr,
    spriden,
    spbpers
where
    sfrstcr_term_code = :term
    and sfrstcr_crn = :crn
    and sfrstcr_rsts_code like 'R%'
    and sfrstcr_user not like ('NICXCHNGUSER')
    and spriden_pidm = sfrstcr_pidm
    and spriden_change_ind is null
    and spbpers_pidm = spriden_pidm