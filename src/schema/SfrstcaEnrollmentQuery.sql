select
    gb_common.f_get_id(s1.sfrstca_pidm) as "campusId",
    s1.sfrstca_term_code as "term",
    s1.sfrstca_crn as "crn",
    s1.sfrstca_rsts_code as "registrationStatus"
from
    sfrstca s1
where 
    s1.sfrstca_term_code = '201732'
    and (s1.sfrstca_rsts_code like 'R%' or s1.sfrstca_rsts_code like 'D%')
    and s1.sfrstca_pidm = gb_common.f_get_pidm('20255108')
    and s1.sfrstca_source_cde = 'BASE'
    and (s1.sfrstca_error_flag not in ('F') or s1.sfrstca_error_flag is null)
    and s1.sfrstca_seq_number = (
        select max(s2.sfrstca_seq_number)
        from sfrstca s2
        where
            s2.sfrstca_term_code = s1.sfrstca_term_code
            and s2.sfrstca_crn = s1.sfrstca_crn
            and (s2.sfrstca_rsts_code like 'R%' or s2.sfrstca_rsts_code like 'D%')
            and s2.sfrstca_pidm = s1.sfrstca_pidm
            and s2.sfrstca_source_cde = 'BASE'
            and (s2.sfrstca_error_flag not in ('F') or s2.sfrstca_error_flag is null))
/

select *
from sfrstcr
where
    sfrstcr_term_code = '201732'
    and sfrstcr_pidm = gb_common.f_get_pidm('20255108')
/