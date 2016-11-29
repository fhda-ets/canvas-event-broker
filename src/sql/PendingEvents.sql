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
    event_term is not null
    and spriden_pidm(+) = event_pidm
    and spriden_change_ind(+) is null
    and rownum <= :limit
order by
    event_id asc
