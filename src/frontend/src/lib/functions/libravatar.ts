import { hashSHA256 } from '#functions/security';

export async function make_libravatar_url(email: string) {
  return `https://seccdn.libravatar.org/avatar/${await hashSHA256(email)}?s=512`;
}
