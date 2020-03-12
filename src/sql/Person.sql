select
    spriden_id as "campusId",
    spriden_id as "sisLoginId",
    spriden_pidm as "pidm",
    nvl(spbpers_pref_first_name, spriden_first_name) as "firstName",
    spriden_last_name as "lastName",
    nvl(case
        when pebempl_ecls_code like 'S%' then (
            select lower(goremal_email_address)
            from goremal
            where
                goremal.rowid = baninst1.f_get_email_rowid(spriden_pidm, 'STDNEMAL', 'A', NULL)
            )
        else
            coalesce(
                (select lower(goremal_email_address)
                from goremal
                where
                    rownum = 1
                    and goremal_pidm = spriden_pidm
                    and goremal_status_ind in ('A')
                    and goremal_emal_code = 'FHDA'),
                    
                (select lower(goremal_email_address)
                from goremal
                    where rownum = 1
                    and goremal_pidm = spriden_pidm
                    and goremal_status_ind in ('A')
                    and goremal_emal_code = 'PE'),
                    
                (select lower(goremal_email_address)
                from goremal
                    where rownum = 1
                    and goremal_pidm = spriden_pidm
                    and goremal_status_ind in ('A')
                    and goremal_emal_code = 'FA'))
    end, 'noemail@fhda.edu') as "email",
    (
        select goradid_additional_id
        from goradid
        where goradid_pidm = spriden_pidm and goradid_adid_code = 'CCC' and rownum = 1
    ) as "cccId"
from
    spriden, spbpers, pebempl
where
    (spriden_pidm = :pidm or spriden_id = :campusId)
    and spriden_change_ind is null
    and spbpers_pidm = spriden_pidm
    and pebempl_pidm(+) = spbpers_pidm
