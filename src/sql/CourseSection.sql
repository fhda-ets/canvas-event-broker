select
    ssbsect_term_code as "term",
    ssbsect_crn as "crn",
    ssbsect_subj_code as "subjectCode",
    ssbsect_crse_numb as "courseNumber",
    ssbsect_seq_numb as "sectionNumber"
from
    ssbsect
where
    ssbsect_term_code = :term
    and ssbsect_crn = :crn
