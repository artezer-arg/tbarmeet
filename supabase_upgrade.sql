-- 1. Renombrar la tabla de administradores para que sirva para cualquier rol
ALTER TABLE public.admin_users RENAME TO user_roles;

-- 2. Añadir la columna de roles (admin / manager) a los usuarios guardados
ALTER TABLE public.user_roles ADD COLUMN role TEXT DEFAULT 'admin';
