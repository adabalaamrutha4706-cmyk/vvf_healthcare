export const USER_PROFILE_SELECT =
  'id, name, email, role, phone, personal_email, age, date_of_birth, gender, about, is_active, created_at, photo_url, password_change_count, password_change_limit, password_change_locked, monthly_target, qualification, aadhar_number, date_of_joining, assigned_therapy';

export function sanitizeUserProfile(row: Record<string, any>) {
  const { password_hash, is_deleted, deleted_at, last_login_at, last_login_ip, last_login_device, ...profile } = row;
  return {
    ...profile,
    personal_email: profile.personal_email || profile.email || null,
  };
}
