select
    sfrstcr_term_code as "term",
    sfrstcr_crn as "crn",
    canvaslms_sections.course_id as "courseId",
    canvaslms_sections.section_id as "sectionId"
from
    sfrstcr,
    etsis.canvaslms_sections
where
    sfrstcr_term_code = :term
    and sfrstcr_pidm = :pidm    
    and canvaslms_sections.term = sfrstcr_term_code
    and canvaslms_sections.crn = sfrstcr_crn