insert into etsis.canvaslms_web_audit
(audience, action, event_timestamp, payload_json)
values
(:audience, :action, systimestamp, :payload)