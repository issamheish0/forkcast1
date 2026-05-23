-- Enable RLS on admin tables
ALTER TABLE public.rbs_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_permissions ENABLE ROW LEVEL SECURITY;

-- Create a function to check if current user is super admin (bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.rbs_admins
    WHERE user_id = auth.uid()
    AND role = 'super_admin'
  );
$$;

-- RLS Policies for rbs_admins table

-- Policy: Admins can view their own admin record
CREATE POLICY "admins_select_own"
ON public.rbs_admins
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
);

-- Policy: Super admins can view all admin records
CREATE POLICY "admins_select_super_admin"
ON public.rbs_admins
FOR SELECT
TO authenticated
USING (
  public.is_super_admin()
);

-- Policy: Super admins can insert new admins
CREATE POLICY "admins_insert_super_admin"
ON public.rbs_admins
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_super_admin()
);

-- Policy: Super admins can update admin records (except their own role)
CREATE POLICY "admins_update_super_admin"
ON public.rbs_admins
FOR UPDATE
TO authenticated
USING (
  public.is_super_admin()
  AND id != (
    SELECT id
    FROM public.rbs_admins
    WHERE user_id = auth.uid()
    LIMIT 1
  )
)
WITH CHECK (
  public.is_super_admin()
  AND id != (
    SELECT id
    FROM public.rbs_admins
    WHERE user_id = auth.uid()
    LIMIT 1
  )
);

-- Policy: Super admins can delete admin records (except themselves)
CREATE POLICY "admins_delete_super_admin"
ON public.rbs_admins
FOR DELETE
TO authenticated
USING (
  public.is_super_admin()
  AND id != (
    SELECT id
    FROM public.rbs_admins
    WHERE user_id = auth.uid()
    LIMIT 1
  )
);

-- RLS Policies for admin_permissions table

-- Policy: Admins can view their own permissions
CREATE POLICY "admin_permissions_select_own"
ON public.admin_permissions
FOR SELECT
TO authenticated
USING (
  admin_id IN (
    SELECT id
    FROM public.rbs_admins
    WHERE user_id = auth.uid()
  )
);

-- Policy: Super admins can view all permissions
CREATE POLICY "admin_permissions_select_super_admin"
ON public.admin_permissions
FOR SELECT
TO authenticated
USING (
  public.is_super_admin()
);

-- Policy: Super admins can insert/update permissions
CREATE POLICY "admin_permissions_upsert_super_admin"
ON public.admin_permissions
FOR ALL
TO authenticated
USING (
  public.is_super_admin()
)
WITH CHECK (
  public.is_super_admin()
);

-- Policy: Super admins can delete permissions
CREATE POLICY "admin_permissions_delete_super_admin"
ON public.admin_permissions
FOR DELETE
TO authenticated
USING (
  public.is_super_admin()
);


