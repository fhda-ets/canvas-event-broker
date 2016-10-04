select distinct
    sirasgn_term_code as "termCode",
    spriden_id as "instructorId"
from
    sirasgn, spriden
    sample (2)
where
    sirasgn_term_code in (select term_code from student.current_term)
    and spriden_pidm = sirasgn_pidm
    and spriden_change_ind is null
