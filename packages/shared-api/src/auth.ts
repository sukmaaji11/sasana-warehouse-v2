import { usernameToAuthEmail } from '@sasana/shared-constants';
import type { MyContext } from '@sasana/shared-types';
import type { LoginValues } from '@sasana/shared-validation';
import type { SasanaClient } from './client';
import { toAppError } from './errors';

export async function signInWithUsername(client: SasanaClient, values: LoginValues): Promise<void> {
  const { error } = await client.auth.signInWithPassword({
    email: usernameToAuthEmail(values.username),
    password: values.password,
  });
  if (error) throw toAppError(error);
}

export async function signOut(client: SasanaClient): Promise<void> {
  const { error } = await client.auth.signOut();
  if (error) throw toAppError(error);
}

export async function getMyContext(client: SasanaClient): Promise<MyContext> {
  const { data, error } = await client.rpc('get_my_context');
  if (error) throw toAppError(error);
  return data as unknown as MyContext;
}
