delete from canvaslms_enrollments
where
    course_id = :courseId
    and type = 'TeacherEnrollment'
