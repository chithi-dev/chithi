import { env } from '$env/dynamic/public';

export const BACKEND_API = env.PUBLIC_BACKEND_API ?? 'http://localhost:8000';
export const LOGIN_URL = `${BACKEND_API}/login`;
export const USER_URL = `${BACKEND_API}/user`;
export const CONFIG_URL = `${BACKEND_API}/config`;
export const FILE_INFO_URL = `${BACKEND_API}/information`;

export const ADMIN_CONFIG_URL = `${BACKEND_API}/admin/config`;
export const ADMIN_USER_UPDATE_URL = `${BACKEND_API}/admin/user`;
