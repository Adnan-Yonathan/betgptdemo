# Betting Mode Toggle Fix

## Problem Summary
The betting mode toggle was failing with "Failed to update mode. Please try again." error because the `betting_mode` column was missing from the profiles table in the database.

## Root Cause
The migration file existed (`supabase/migrations/20251022180000_add_betting_mode.sql`) but may not have been applied to the Supabase database yet.

## Solution Applied

### 1. Updated Migration File
Updated `/supabase/migrations/20251022180000_add_betting_mode.sql` to be **idempotent** (can be run multiple times safely):

- ✅ Checks if `betting_mode` column exists before adding it
- ✅ Adds column with CHECK constraint: `('basic', 'advanced')`
- ✅ Sets default value to `'basic'`
- ✅ Updates existing profiles to have default value
- ✅ Verifies RLS policies are in place

### 2. Created Manual Setup Script
Created `/supabase/manual_betting_mode_setup.sql` for direct execution in Supabase SQL Editor:

- ✅ Comprehensive setup and verification
- ✅ Includes helpful status messages
- ✅ Shows table structure and policies after setup
- ✅ Safe to run multiple times

## How to Apply the Fix

### Option A: Automatic (Recommended for Lovable Projects)
The migration will be automatically applied when you deploy/push changes to your Lovable project.

### Option B: Manual Application via Supabase Dashboard

1. **Go to Supabase Dashboard**
   - Navigate to: https://supabase.com/dashboard/project/dskfsnbdgyjizoaafqfk
   - Go to SQL Editor

2. **Run the Manual Setup Script**
   - Copy the contents of `supabase/manual_betting_mode_setup.sql`
   - Paste into the SQL Editor
   - Click "Run"

3. **Verify the Setup**
   - Check the output messages for ✅ success indicators
   - Review the query results showing table structure and policies

4. **Test the Feature**
   - Open your BetGPT app
   - Click the betting mode selector in the header
   - Toggle between "Basic" and "Advanced"
   - Verify it saves successfully and persists on refresh

## Technical Details

### Database Schema
```sql
profiles table:
  - betting_mode: TEXT
    - CHECK constraint: IN ('basic', 'advanced')
    - DEFAULT: 'basic'
    - NOT NULL (enforced by DEFAULT)
```

### RLS Policies
The profiles table has the following Row Level Security policies:

1. **SELECT**: Users can view their own profile (`auth.uid() = id`)
2. **UPDATE**: Users can update their own profile (`auth.uid() = id`)
3. **INSERT**: Users can insert their own profile (`auth.uid() = id`)

### Frontend Components

#### BettingModeSelector.tsx
- Located in: `src/components/BettingModeSelector.tsx`
- Uses **upsert** pattern to handle missing profiles:
  ```typescript
  supabase.from("profiles").upsert({
    id: user.id,
    email: user.email,
    betting_mode: mode
  }, {
    onConflict: 'id',
    ignoreDuplicates: false
  })
  ```
- Shows toast notifications for success/error
- Calls `onModeChange` callback on success

#### Index.tsx (Main Page)
- Located in: `src/pages/Index.tsx`
- Fetches `betting_mode` from profiles on mount
- Passes mode to BettingModeSelector component
- Updates local state when mode changes

### Type Definitions
The TypeScript types are auto-generated in:
- `src/integrations/supabase/types.ts`
- Includes `betting_mode: string | null` in Row, Insert, and Update types

## Verification Checklist

After applying the fix, verify:

- [ ] Migration runs successfully without errors
- [ ] `betting_mode` column exists in profiles table
- [ ] Column has CHECK constraint for 'basic' and 'advanced'
- [ ] Default value is 'basic'
- [ ] RLS policies allow users to UPDATE their own profile
- [ ] Frontend can successfully toggle between modes
- [ ] Mode persists after page refresh
- [ ] No console errors when changing modes
- [ ] Toast notifications show success messages

## Testing Steps

1. **Test Mode Toggle**:
   ```
   1. Log in to the app
   2. Click the mode selector in header
   3. Select "Advanced" mode
   4. Verify success toast appears
   5. Refresh the page
   6. Verify mode is still "Advanced"
   7. Toggle back to "Basic"
   8. Verify it persists after refresh
   ```

2. **Test New User**:
   ```
   1. Create a new user account
   2. Verify default mode is "Basic"
   3. Toggle to "Advanced"
   4. Verify it saves successfully
   ```

3. **Check Console**:
   ```
   1. Open browser DevTools
   2. Go to Console tab
   3. Toggle between modes
   4. Verify no errors appear
   5. Check Network tab for successful UPDATE requests
   ```

## Files Modified

1. `supabase/migrations/20251022180000_add_betting_mode.sql` - Made idempotent
2. `supabase/manual_betting_mode_setup.sql` - Created manual setup script
3. `BETTING_MODE_FIX.md` - This documentation file

## Files Verified (No Changes Needed)

- ✅ `src/components/BettingModeSelector.tsx` - Already using upsert pattern
- ✅ `src/pages/Index.tsx` - Already loading betting_mode on mount
- ✅ `src/integrations/supabase/types.ts` - Already includes betting_mode types
- ✅ `supabase/migrations/20251020025718_*.sql` - RLS policies already exist

## Troubleshooting

### Issue: Still getting "Failed to update mode" error
**Solution**:
1. Verify the migration was applied by running this query in Supabase SQL Editor:
   ```sql
   SELECT column_name, data_type, column_default
   FROM information_schema.columns
   WHERE table_name = 'profiles' AND column_name = 'betting_mode';
   ```
2. If no results, run the manual setup script

### Issue: Column exists but updates fail
**Solution**:
1. Check RLS policies:
   ```sql
   SELECT * FROM pg_policies WHERE tablename = 'profiles';
   ```
2. Verify UPDATE policy exists for users to update their own profile

### Issue: Type errors in TypeScript
**Solution**:
1. Regenerate types from Supabase dashboard
2. Or manually verify `src/integrations/supabase/types.ts` includes `betting_mode`

## Support

If issues persist after applying this fix:

1. Check browser console for specific error messages
2. Check Supabase logs in the dashboard
3. Verify user is authenticated before toggling mode
4. Ensure profile row exists for the user

## Additional Notes

- The `sync-betting-profile` edge function does not need changes - it only syncs CRM stats
- The betting_mode is stored per-user in the profiles table
- Mode changes are immediate and persist across sessions
- The upsert pattern handles edge cases where profile doesn't exist yet
