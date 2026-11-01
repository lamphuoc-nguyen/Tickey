-- ============================================================================
-- C-11: ký bù QR đơn cho Booking đã CONFIRMED trước 20261101000000.
--
-- Bước ký bù ở 20261101000000 gọi enqueue('ISSUE_TICKETS', ...), nhưng uq_outbox_dedupe (topic, aggregate_id)
-- cho ISSUE_TICKETS + `on conflict do nothing` làm lệnh đó không tạo việc nào: đơn đã CONFIRMED luôn có sẵn
-- việc ISSUE_TICKETS (DONE). Ở đây đưa chính việc đó về PENDING để worker chạy lại:
-- issue_tickets không phát vé mới (đơn đã có vé, trả []), worker ký QR đơn, attach_ticket_credentials với danh
-- sách rỗng giữ nguyên CONFIRMED và không gửi lại thông báo. Chạy lại migration này không có tác dụng phụ.
-- ============================================================================

update public.outbox o
   set status = 'PENDING', next_attempt_at = now(), attempts = 0, locked_at = null, locked_by = null,
       last_error = null, processed_at = null
 where o.topic = 'ISSUE_TICKETS'
   and o.status in ('DONE', 'DEAD')
   and exists (select 1 from public.bookings b
               join public.sessions s on s.id = b.session_id
               where b.id = o.aggregate_id
                 and b.status = 'CONFIRMED'
                 and s.ends_at > now()
                 and not exists (select 1 from public.booking_credentials c where c.booking_id = b.id));
