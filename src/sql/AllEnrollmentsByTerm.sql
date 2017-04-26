select
    sfrstcr_term_code as "term",
    sfrstcr_crn as "crn",
    sfrstcr_pidm as "pidm",
    spriden_id as "campusId",
    canvaslms_sections.course_id as "courseId",
    canvaslms_sections.section_id as "sectionId"
from
    sfrstcr,
    spriden,
    etsis.canvaslms_sections
where
    sfrstcr_term_code = :term
    and sfrstcr_rsts_code like 'R%'
    and spriden_pidm = sfrstcr_pidm
    and spriden_change_ind is null
    and canvaslms_sections.term = sfrstcr_term_code
    and canvaslms_sections.crn = sfrstcr_crn
order by
    sfrstcr_crn asc