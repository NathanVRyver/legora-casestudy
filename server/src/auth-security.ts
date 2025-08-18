import bcrypt from 'bcrypt';

const BCRYPT_ROUNDS = 12;
// TODO: if you have time check this again
export function validateEmail(email: string): { error?: string; data?: string } {
  if (!email) {
    return { error: 'Email is required' };
  }

  if (email.length > 255) {
    return { error: 'Email too long (max 255 characters)' };
  }

  const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
  if (!emailRegex.test(email)) {
    return { error: 'Invalid email format' };
  }

  return { data: email.toLowerCase() };
}

export function validateUsername(username: string): { error?: string; data?: string } {
  if (!username) {
    return { error: 'Username is required' };
  }

  if (username.length < 5) {
    return { error: 'Username too short (min 5 characters)' };
  }

  if (username.length > 30) {
    return { error: 'Username too long (max 30 characters)' };
  }

  const usernameRegex = /^[a-zA-Z0-9_-]+$/;
  if (!usernameRegex.test(username)) {
    return { error: 'Username can only contain letters, numbers, underscore, and dash' };
  }

  return { data: username };
}

export function validatePassword(password: string): { error?: string; data?: string } {
  if (!password) {
    return { error: 'Password is required' };
  }

  if (password.length < 8) {
    return { error: 'Password too short (min 8 characters)' };
  }

  if (password.length > 128) {
    return { error: 'Password too long (max 128 characters)' };
  }

  return { data: password };
}

export function validateLoginData(
  email: string,
  password: string
): {
  error?: string;
  data?: { email: string; password: string };
} {
  const emailResult = validateEmail(email);
  if (emailResult.error) {
    return { error: emailResult.error };
  }

  const passwordResult = validatePassword(password);
  if (passwordResult.error) {
    return { error: passwordResult.error };
  }

  return {
    data: {
      email: emailResult.data!,
      password: passwordResult.data!,
    },
  };
}

/**
 * Password hashing and verification
 */
export async function hashPassword(password: string): Promise<{ error?: string; data?: string }> {
  try {
    const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    return { data: hash };
  } catch (_error) {
    return {
      error: `Password hashing failed: ${_error instanceof Error ? _error.message : 'unknown error'}`,
    };
  }
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<{ error?: string; data?: boolean }> {
  try {
    const isValid = await bcrypt.compare(password, hash);
    return { data: isValid };
  } catch (_error) {
    return {
      error: `Password verification failed: ${_error instanceof Error ? _error.message : 'unknown error'}`,
    };
  }
}

/**
 * Validates user registration data
 */
export function validateUserData(userData: {
  username?: string;
  email?: string;
  password?: string;
}): { error?: string; data?: { username: string; email: string; password: string } } {
  if (!userData.username || !userData.email || !userData.password) {
    return { error: 'Username, email, and password are required' };
  }

  const usernameResult = validateUsername(userData.username);
  if (usernameResult.error) {
    return { error: usernameResult.error };
  }

  const emailResult = validateEmail(userData.email);
  if (emailResult.error) {
    return { error: emailResult.error };
  }

  const passwordResult = validatePassword(userData.password);
  if (passwordResult.error) {
    return { error: passwordResult.error };
  }

  return {
    data: {
      username: usernameResult.data!,
      email: emailResult.data!,
      password: passwordResult.data!,
    },
  };
}
