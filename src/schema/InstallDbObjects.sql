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

create or replace trigger t_canvaslms_stdn_enroll after insert on "saturn"."sfrstca"
for each row  when (
    new.sfrstca_rsts_code like 'R%'
    and new.sfrstca_source_cde = 'BASE'
    and (
        new.sfrstca_error_flag not in ('F')
        or (new.sfrstca_error_flag is null)
    ))
begin
    -- Insert a matching sync record into CANVASLMS_EVENTS for processing by the broker
    insert into canvaslms_events (event_pidm, event_term, event_crn, event_type)
    values (:new.sfrstca_pidm, :new.sfrstca_term_code, :new.sfrstca_crn, 1);
end;
/

create or replace trigger t_canvaslms_stdn_delete after delete on "saturn"."sfrstcr"
for each row
begin
    -- Insert a matching sync record into CANVASLMS_EVENTS for processing by the broker
    insert into canvaslms_events (event_pidm, event_term, event_crn, event_type)
    values (:old.sfrstcr_pidm, :old.sfrstcr_term_code, :old.sfrstcr_crn, 2);
end;
/

create or replace trigger t_canvaslms_stdn_drop after update on "saturn"."sfrstcr"
for each row when (
    old.sfrstcr_rsts_code <> new.sfrstcr_rsts_code
    and (new.sfrstcr_rsts_code like 'D%' or new.sfrstcr_rsts_code like 'I%'))
begin
    -- Insert a matching sync record into CANVASLMS_EVENTS for processing by the broker
    insert into canvaslms_events (event_pidm, event_term, event_crn, event_type)
    values (:new.sfrstcr_pidm, :new.sfrstcr_term_code, :new.sfrstcr_crn, 2);
end;
/

create or replace trigger etsis.t_canvaslms_user_sync_pfname after update on "saturn"."spbpers"
for each row when (old.spbpers_pref_first_name <> new.spbpers_pref_first_name)
begin
    -- Insert a matching sync record into CANVASLMS_EVENTS for processing by the broker
    insert into canvaslms_events (event_pidm, event_type)
    values (:new.spbpers_pidm, 0);
end;
/

create or replace trigger etsis.t_canvaslms_sect_cancel after update on "saturn"."ssbsect"
for each row when (
    old.ssbsect_ssts_code <> new.ssbsect_ssts_code
    and new.ssbsect_ssts_code in ('X'))
begin
    -- Insert a matching sync record into CANVASLMS_EVENTS for processing by the broker
    insert into canvaslms_events (event_term, event_crn, event_type)
    values (:new.ssbsect_term_code, :new.ssbsect_crn, 3);
end;
/
