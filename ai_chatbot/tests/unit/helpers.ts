export function generateTestEmail() {
  return `test-${Date.now()}@example.com`;
}

export function generateTestPassword() {
  return "TestPass123!";
}

export function generateTestUser() {
  return {
    email: generateTestEmail(),
    password: generateTestPassword(),
  };
}
