select
    spriden_id as "campusId",
    spriden_pidm as "pidm",
    nvl(spbpers_pref_first_name, spriden_first_name) as "firstName",
    spriden_last_name as "lastName",
    case
        when pebempl_ecls_code like 'S%' then (
            select lower(goremal_email_address)
            from goremal
            where
                goremal.rowid = baninst1.f_get_email_rowid(spriden_pidm, 'STDNEMAL', 'A', NULL)
            )
        else
            coalesce((
                select lower(goremal_email_address)
                from goremal
                where
                    rownum = 1
                    and goremal_pidm = spriden_pidm
                    and goremal_status_ind in ('A')
                    and goremal_emal_code = 'FHDA'), (

                select lower(goremal_email_address)
                from goremal
                    where rownum = 1
                    and goremal_pidm = spriden_pidm
                    and goremal_status_ind in ('A')
                    and goremal_emal_code = 'PE'))
    end as "email"
from
    spriden, spbpers, pebempl
where
    (spriden_pidm = :pidm or spriden_id = :campusId)
    and spriden_change_ind is null
    and spbpers_pidm = spriden_pidm
    and pebempl_pidm(+) = spbpers_pidm
