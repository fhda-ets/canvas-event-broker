insert into goradid (
    goradid_pidm,
    goradid_adid_code,
    goradid_additional_id,
    goradid_user_id, 
    goradid_activity_date,
    goradid_data_origin)
values (
    :pidm,
    :adidCode,
    :additionalId,
    'CANVAS',
    sysdate,
    'Canvas Event Broker')