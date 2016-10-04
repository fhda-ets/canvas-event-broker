create table canvaslms_enrollments (
    term varchar2(12),
    crn varchar2(12),
    user_id number,
    enrollment_id number,
    course_id number,
    section_id number,
    type varchar2(32),
    pidm number,
    url varchar2(128),
    created_on date default sysdate,
    constraint pk_canvalms_enrollments primary key (term, crn, enrollment_id, course_id, section_id))
/

create table canvaslms_sections (
    term varchar2(12),
    crn varchar2(12),
    section_id number,
    course_id number,
    created_on date default sysdate,
    constraint canvaslms_sections primary key (term, crn, section_id, course_id))
/

create sequence canvaslms_event_seq maxvalue 1000000000 cycle
/

create table canvaslms_events (
    event_id number,
    event_pidm number,
    event_term varchar2(6),
    event_crn varchar2(5),
    event_type number,
    event_timestamp timestamp default systimestamp,
    constraint pk_canvaslms_events primary key (event_id))
/

create or replace trigger t_canvaslms_event_setseq before insert on canvaslms_events
for each row
begin
    -- Automatically update the event ID with the next value in the sequence
    :new.event_id := canvaslms_event_seq.nextval;
end;
/
