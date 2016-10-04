select
    event_id as "id",
    event_type as "type",
    event_pidm as "pidm",
    spriden_id as "campusId",
    event_term as "term",
    event_crn as "crn",
    event_timestamp as "timestamp"
from
    canvaslms_events,
    spriden
where
    spriden_pidm(+) = event_pidm
    and spriden_change_ind(+) is null
order by
    event_id asc
