select
    gb_common.f_get_id(s1.sfrstca_pidm) as "campusId",
    s1.sfrstca_term_code as "term",
    s1.sfrstca_crn as "crn",
    s1.sfrstca_rsts_code as "registrationStatus"
from
    sfrstca s1,
    canvaslms_sections
where 
    s1.sfrstca_term_code = :term
    and (s1.sfrstca_rsts_code like 'R%' or s1.sfrstca_rsts_code like 'D%' or s1.sfrstca_rsts_code like 'I%' or s1.sfrstca_rsts_code like 'P%')
    and s1.sfrstca_pidm = :pidm
    and s1.sfrstca_source_cde = 'BASE'
    and (s1.sfrstca_error_flag not in ('F') or s1.sfrstca_error_flag is null)
    and s1.sfrstca_seq_number = (
        select max(s2.sfrstca_seq_number)
        from sfrstca s2
        where
            s2.sfrstca_term_code = s1.sfrstca_term_code
            and s2.sfrstca_crn = s1.sfrstca_crn
            and s2.sfrstca_pidm = s1.sfrstca_pidm
            and (s2.sfrstca_rsts_code like 'R%' or s2.sfrstca_rsts_code like 'D%' or s2.sfrstca_rsts_code like 'I%' or s2.sfrstca_rsts_code like 'P%')            
            and s2.sfrstca_source_cde = 'BASE'
            and (s2.sfrstca_error_flag not in ('F') or s2.sfrstca_error_flag is null))
    and canvaslms_sections.term = s1.sfrstca_term_code
    and canvaslms_sections.crn = s1.sfrstca_crn