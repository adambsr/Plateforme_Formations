const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function credentialsError(
  email: string,
  password: string,
): string | null {
  if (!EMAIL_PATTERN.test(email.trim())) return 'Saisissez un email valide.';
  if (password.length < 8)
    return 'Le mot de passe doit contenir au moins 8 caractères.';
  return null;
}

export function registrationError(input: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
}): string | null {
  if (
    input.firstName.trim().length === 0 ||
    input.lastName.trim().length === 0
  ) {
    return 'Renseignez votre prénom et votre nom.';
  }
  const credentials = credentialsError(input.email, input.password);
  if (credentials !== null) return credentials;
  if (input.password !== input.confirmPassword)
    return 'Les mots de passe doivent correspondre.';
  return null;
}

export function passwordChangeError(
  currentPassword: string,
  newPassword: string,
  confirmPassword: string,
): string | null {
  if (currentPassword.length === 0)
    return 'Saisissez votre mot de passe actuel.';
  if (newPassword.length < 8)
    return 'Le nouveau mot de passe doit contenir au moins 8 caractères.';
  if (newPassword === currentPassword)
    return 'Le nouveau mot de passe doit être différent.';
  if (newPassword !== confirmPassword)
    return 'Les mots de passe doivent correspondre.';
  return null;
}

export function resetPasswordError(
  newPassword: string,
  confirmPassword: string,
): string | null {
  if (newPassword.length < 8)
    return 'Le nouveau mot de passe doit contenir au moins 8 caractères.';
  if (newPassword !== confirmPassword)
    return 'Les mots de passe doivent correspondre.';
  return null;
}
