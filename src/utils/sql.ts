/**
 * SQL utility functions for safe query construction
 *
 * NOTE: SmartSQL doesn't appear to support parameterized queries,
 * so we need to sanitize inputs manually to prevent SQL injection.
 */

/**
 * Escapes single quotes in SQL string literals
 * Prevents SQL injection by doubling single quotes
 */
export function escapeSqlString(value: string | null | undefined): string {
  if (value == null) {
    return 'NULL';
  }
  // Replace single quotes with two single quotes (SQL standard escaping)
  return `'${value.replace(/'/g, "''")}'`;
}

/**
 * Safely inserts or updates a user in the database
 * Prevents SQL injection by escaping all string inputs
 */
export function buildUserUpsertQuery(user: {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
}): string {
  const id = escapeSqlString(user.id);
  const email = escapeSqlString(user.email);
  const firstName = escapeSqlString(user.firstName || '');
  const lastName = escapeSqlString(user.lastName || '');

  return `INSERT INTO users (id, email, first_name, last_name)
          VALUES (${id}, ${email}, ${firstName}, ${lastName})
          ON CONFLICT(id) DO UPDATE SET
            email = ${email},
            first_name = ${firstName},
            last_name = ${lastName}`;
}

/**
 * Safely builds a SELECT query for a user by ID
 */
export function buildSelectUserQuery(userId: string): string {
  const id = escapeSqlString(userId);
  return `SELECT id, email, first_name, last_name FROM users WHERE id = ${id}`;
}
