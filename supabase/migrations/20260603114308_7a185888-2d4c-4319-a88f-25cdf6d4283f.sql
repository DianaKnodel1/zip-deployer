UPDATE auth.users
SET encrypted_password = crypt('Admin1234!', gen_salt('bf')),
    updated_at = now()
WHERE email = 'admin@admin.de';