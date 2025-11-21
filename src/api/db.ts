import {
  ColumnType,
  Generated,
  Insertable,
  Selectable,
  Updateable,
} from 'kysely';

export interface Database {
  users: UserTable;
  avatars: AvatarTable;
}

export interface UserTable {
  id: ColumnType<string, string, never>;
  email: ColumnType<string | null, string | null, string | null>;
  first_name: ColumnType<string | null, string | null, string | null>;
  last_name: ColumnType<string | null, string | null, string | null>;
}

export interface AvatarTable {
  id: Generated<number>;
  name: string;
  relationship: ColumnType<string, string, string | undefined>;
  photo_url: ColumnType<string | null, string | null, string | null>;
  user_id: string;
}

export type User = Selectable<UserTable>;
export type NewUser = Insertable<UserTable>;
export type UserUpdate = Updateable<UserTable>;

export type Avatar = Selectable<AvatarTable>;
export type NewAvatar = Insertable<AvatarTable>;
export type AvatarUpdate = Updateable<AvatarTable>;