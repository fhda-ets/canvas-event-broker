select
    term as "term",
    crn as "crn",
    pidm as "pidm",
    type as "type",
    enrollment_id as "enrollmentId",
    user_id as "userId",
    section_id as "sectionId",
    course_id as "courseId"
from
    canvaslms_enrollments,
    spriden
where
    term = :term
    and crn = :crn
    and pidm = :pidm
    and spriden_pidm = pidm
    and spriden_change_ind is null
