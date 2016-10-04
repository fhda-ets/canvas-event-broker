select
    ssbsect_subj_code as "subjectCode",
    ssbsect_crse_numb as "courseNumber",
    ssbsect_ptrm_start_date as "startDate",
    ssbsect_ptrm_end_date as "endDate",
    scbcrse_title as "title"
from
    ssbsect, scbcrse
where
    ssbsect_term_code = :term
    and ssbsect_crn = :crn
    and scbcrse.rowid = student.f_fhda_get_scbcrse(ssbsect_subj_code, ssbsect_crse_numb, ssbsect_term_code)
