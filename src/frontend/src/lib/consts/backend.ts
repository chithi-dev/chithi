import { env } from '$env/dynamic/public';
import { strip_trailing_slash } from '#functions/urls';
const envrionment_variable = env.PUBLIC_BACKEND_API ?? 'http://localhost:8000';

export const BACKEND_API = strip_trailing_slash(envrionment_variable);
export const LOGIN_URL = `${BACKEND_API}/login`;
export const USER_URL = `${BACKEND_API}/user`;
export const CONFIG_URL = `${BACKEND_API}/config`;
export const FILE_INFO_URL = `${BACKEND_API}/information`;
export const ONBOARDING_URL = `${BACKEND_API}/onboarding`;

export const ADMIN_CONFIG_URL = `${BACKEND_API}/admin/config`;
export const ADMIN_USER_UPDATE_URL = `${BACKEND_API}/admin/user`;
export const ADMIN_FILES_URL = `${BACKEND_API}/admin/files`;
