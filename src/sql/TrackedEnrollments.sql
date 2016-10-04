select
    term as "term",
    crn as "crn",
    pidm as "pidm",
    type as "type",
    user_id as "userId",
    enrollment_id as "enrollmentId",
    section_id as "sectionId",
    course_id as "courseId",
    url as "url"
from
    canvaslms_enrollments
where
    term = :term
    and pidm = :pidm
