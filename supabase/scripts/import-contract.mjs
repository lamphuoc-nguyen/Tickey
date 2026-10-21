// Only existing user-facing RPCs. Payment/issuance/jobs are deliberately excluded.
export const RPCS = {
  create_organization: { required: ['p_name', 'p_slug'], optional: ['p_business_type'], result: 'uuid' },
  set_org_member: { required: ['p_org_id', 'p_email', 'p_roles'], result: 'json' },
  submit_kyc: { required: ['p_org_id', 'p_legal_info', 'p_identity_number', 'p_documents'], result: 'uuid' },
  review_kyc: { required: ['p_submission_id', 'p_decision'], optional: ['p_note'], result: 'void' },
  save_venue: { required: ['p'], result: 'uuid' },
  create_layout: { required: ['p_venue_id', 'p_name'], result: 'layout' },
  save_layout_draft: { required: ['p_layout_version_id', 'p_definition'], result: 'void' },
  publish_layout_version: { required: ['p_layout_version_id'], result: 'json' },
  save_event: { required: ['p'], result: 'uuid' },
  submit_event_for_review: { required: ['p_event_id'], result: 'json' },
  review_event: { required: ['p_event_id', 'p_decision'], optional: ['p_note'], result: 'void' },
  save_session: { required: ['p'], result: 'uuid' },
  save_ticket_type: { required: ['p'], result: 'uuid' },
  assign_seats_ticket_type: { required: ['p_session_id', 'p_seat_ids', 'p_ticket_type_id'], result: 'json' },
  set_session_gate_zones: { required: ['p_session_id', 'p_config'], result: 'void' },
  assign_staff: {
    required: ['p_session_id', 'p_user_id', 'p_permissions'],
    optional: ['p_gate_id', 'p_valid_from', 'p_valid_until'],
    result: 'uuid',
  },
  request_bank_account_change: {
    required: ['p_org_id', 'p_bank_code', 'p_account_number', 'p_account_holder'],
    result: 'uuid',
  },
  review_bank_account: {
    required: ['p_bank_account_id', 'p_decision'],
    optional: ['p_note'],
    result: 'void',
  },
};

export const READ_TABLES = new Set([
  'categories',
  'organizations',
  'profiles',
  'memberships',
  'venues',
  'layouts',
  'layout_versions',
  'zones',
  'seats',
  'gates',
  'events',
  'sessions',
  'ticket_types',
  'ticket_type_zones',
  'staff_assignments',
  'session_gate_zones',
]);

export const PLATFORM_ROLES = ['KYC_REVIEWER', 'FINANCE_ADMIN', 'DISPUTE_ADMIN', 'SUPPORT'];
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
