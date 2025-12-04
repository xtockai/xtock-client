# Authentication & Onboarding Flow

This document describes the authentication and onboarding flow in the Xtock application.

## Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Access App                          │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
                    ┌───────────────┐
                    │ Authenticated? │
                    └───────┬───────┘
                            │
                ┌───────────┴───────────┐
                │                       │
               NO                      YES
                │                       │
                ▼                       ▼
        ┌──────────────┐       ┌──────────────────┐
        │ Redirect to  │       │ Has Organization? │
        │  /sign-in    │       └────────┬──────────┘
        └──────────────┘                │
                                ┌───────┴───────┐
                                │               │
                               NO              YES
                                │               │
                                ▼               ▼
                        ┌──────────────┐   ┌────────────────────┐
                        │ Redirect to  │   │ Onboarding Completed?│
                        │  /welcome    │   └─────────┬───────────┘
                        └──────────────┘             │
                                                ┌────┴────┐
                                                │         │
                                               NO        YES
                                                │         │
                                                ▼         ▼
                                        ┌──────────────┐  ┌─────────────┐
                                        │ Redirect to  │  │ Allow Access │
                                        │  /welcome    │  │ to Dashboard │
                                        └──────────────┘  └─────────────┘
```

## Routes and Protection

### Protected Routes
All main routes are protected and require completed onboarding:

- `/` (Home - Reports page)
- `/locations`
- `/locations/[id]`

**Protection Method**: Uses `requireOnboarding()` utility function

### Public Routes
- `/sign-in` - Clerk sign in page
- `/welcome` - Login + Onboarding flow

## Implementation Details

### 1. Server-Side Protection (`requireOnboarding()`)

Location: `/lib/auth-utils.ts`

```typescript
export async function requireOnboarding(): Promise<string>
```

This function:
1. ✅ Checks if user is authenticated (Clerk)
2. ✅ Checks if user has an organization (Clerk)
3. ✅ Checks if organization completed onboarding (Supabase)
4. ✅ Redirects to appropriate page if checks fail
5. ✅ Returns organization ID if all checks pass

**Used in**:
- `/app/page.tsx` (Home)
- `/app/locations/layout.tsx` (Locations & detail pages)

### 2. Welcome Page (`/welcome`)

Location: `/app/welcome/page.tsx`

Shows different content based on authentication state:
- **SignedOut**: Login form (Clerk SignIn component)
- **SignedIn**: Onboarding component

### 3. Onboarding Component

Location: `/components/onboarding.tsx`

**4-Step Wizard**:
1. Organization Info (name, admin)
2. Locations (restaurant locations with kitchen hours)
3. Operators (team members with contact info)
4. POS Integration (Toast API credentials)

**Features**:
- ✅ Step detection - Resumes from correct step if incomplete
- ✅ Data validation at each step
- ✅ Saves data to Supabase after each step
- ✅ Creates Clerk organization in step 1
- ✅ Marks `onboarding_completed = true` in step 4
- ✅ Redirects to `/` when completed

### 4. Data Flow

#### Creating Organization (Step 1)
```
User enters org info
    ↓
Create organization in Clerk
    ↓
Save to Supabase (onboarding_completed = false)
    ↓
Store Clerk org ID as primary key
```

#### Completing Onboarding (Step 4)
```
User enters POS credentials
    ↓
Save encrypted credentials
    ↓
Update Supabase (onboarding_completed = true)
    ↓
Set completed = true
    ↓
Redirect to '/' (dashboard)
```

## Edge Cases Handled

### 1. User Returns During Onboarding
- ✅ Checks existing data in Supabase
- ✅ Determines correct step based on what's completed
- ✅ Pre-fills data from database
- ✅ Allows user to continue from where they left off

### 2. Organization Exists but Onboarding Incomplete
- ✅ User redirected to `/welcome`
- ✅ Onboarding component resumes from correct step
- ✅ Shows existing data

### 3. User Without Organization
- ✅ Redirected to `/welcome`
- ✅ Starts onboarding from step 1

### 4. Multiple Users in Same Organization
- ✅ If organization already has `onboarding_completed = true`
- ✅ User can access dashboard immediately
- ✅ No need to repeat onboarding

## Testing Checklist

- [ ] New user can sign up and complete onboarding
- [ ] User without organization is redirected to `/welcome`
- [ ] User with incomplete onboarding resumes from correct step
- [ ] User with completed onboarding can access `/`
- [ ] User with completed onboarding can access `/locations`
- [ ] Completing onboarding redirects to `/`
- [ ] Direct access to `/` without onboarding redirects to `/welcome`
- [ ] Direct access to `/locations` without onboarding redirects to `/welcome`

## Security Considerations

- ✅ Server-side authentication checks (not client-side only)
- ✅ Organization ID from Clerk used as primary key
- ✅ Row-level security in Supabase
- ✅ API credentials encrypted before storage
- ✅ No bypass of authentication flow possible

## Future Improvements

- [ ] Add loading states during redirects
- [ ] Add progress persistence in localStorage (backup)
- [ ] Add ability to edit onboarding data after completion
- [ ] Add admin panel to manage organizations
- [ ] Add email notifications for completed onboarding
