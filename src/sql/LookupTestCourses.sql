select
    ssbsect_term_code as "term",
    ssbsect_crn as "crn"
from
    ssbsect,
    student.current_term
where
    current_term.term_college = decode(:college, 'foothill', 'FH', 'deanza', 'DA')
    and ssbsect_term_code = current_term.term_code
    and ssbsect_subj_code = 'ANTH'
    and rownum <= 4
order by
    ssbsect_crse_numb,
    ssbsect_seq_numb
