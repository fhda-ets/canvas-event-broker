select
    ssbsect_term_code as "term",
    ssbsect_crn as "crn",
    ssbsect_subj_code || ' ' || ssbsect_crse_numb || ssbsect_seq_numb as "courseId",
    ssbsect_subj_code as "subject",
    ssbsect_crse_numb as "courseNumber",
    ssbsect_seq_numb as "section",
    scbcrse_title  as "title",
    case
        when canvaslms_sections.section_id is not null then 'provisioned'
        else 'notProvisiond'
    end as "canvasStatus",
    ssbsect_ssts_code as "sectionStatus"
from
    (
    select distinct
        sirasgn_term_code,
        sirasgn_crn
    from
        sirasgn
    where
        sirasgn_pidm = gb_common.f_get_pidm(:instructorId)
    ) instructor_assign,
    ssbsect,
    scbcrse,
    etsis.canvaslms_sections
where
    instructor_assign.sirasgn_term_code = :term
    and ssbsect_term_code = instructor_assign.sirasgn_term_code
    and ssbsect_crn = instructor_assign.sirasgn_crn
    and scbcrse.rowid = f_fhda_get_scbcrse(ssbsect_subj_code, ssbsect_crse_numb, ssbsect_term_code)
    and canvaslms_sections.term(+) = ssbsect_term_code
    and canvaslms_sections.crn(+) = ssbsect_crn
order by
    ssbsect_subj_code,
    ssbsect_crse_numb,
    ssbsect_seq_numb
