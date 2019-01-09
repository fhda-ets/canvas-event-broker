select 
    stvterm_code as "term",
    stvterm_start_date as "termStart",
    stvterm_end_date as "termEnd",
    stvterm_next_code as "nextTerm",
    stvterm_next_start_date as "nextTermStart",
    stvterm_next_end_date as "nextTermEnd",
    stvterm_prev_code as "prevTerm"
from
    (select
        stvterm_code,
        stvterm_start_date,
        lead(stvterm_start_date, 1) over (partition by substr(stvterm_code, 6, 1) order by stvterm_code asc) - interval '1' minute as stvterm_end_date,
        lead(stvterm_code, 1) over (partition by substr(stvterm_code, 6, 1) order by stvterm_code asc) as stvterm_next_code,
        lead(stvterm_start_date, 1) over (partition by substr(stvterm_code, 6, 1) order by stvterm_code asc) as stvterm_next_start_date,
        lead(stvterm_end_date, 1) over (partition by substr(stvterm_code, 6, 1) order by stvterm_code asc) as stvterm_next_end_date,
        lag(stvterm_code, 1) over (partition by substr(stvterm_code, 6, 1) order by stvterm_code asc) as stvterm_prev_code
    from stvterm)
where
    substr(stvterm_code, 6, 1) = :collegeId
    and sysdate between stvterm_start_date and stvterm_end_date