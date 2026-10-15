// Gate scanning RPCs (register_gate_device, get_session_manifest, check_in, sync_offline_scans)
// get their own repository in packages/core with S2-FE2 / S3-FE2. POS reuses booking + payment.
export { repositories } from '@/lib/repositories';
