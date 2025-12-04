# Xtock

> Restaurant inventory forecasting and management platform

Xtock is a modern web application designed to help restaurants manage their inventory, forecast demand, and optimize operations across multiple locations. Built with Next.js 16, Clerk authentication, and Supabase.

## Features

### 🔐 Authentication & Organization Management
- Secure authentication powered by Clerk
- Multi-tenant organization support
- User and operator management per location

### 📍 Location Management
- Create and manage multiple restaurant locations
- Track kitchen closing times with automatic UTC conversion
- Timezone-aware display (shows times in user's local timezone)
- Operator assignment per location

### 📊 Inventory Forecasting
- Daily and weekly report views
- Compare forecasted vs actual quantities
- Visual accuracy indicators with color-coded variance
- Filter by location and date range
- Real-time calculations of forecast accuracy

### 🌍 Multi-Country Support
- Automatic timezone detection
- UTC storage with local display
- International phone number support (16+ countries)
- Handles Daylight Saving Time automatically

### 🎨 Modern UI/UX
- Beautiful onboarding flow with animated stepper
- Responsive design (mobile-first)
- Loading states and animations
- Modern gradient designs with Tailwind CSS

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Authentication**: Clerk
- **Database**: Supabase (PostgreSQL)
- **Styling**: Tailwind CSS v4
- **Language**: TypeScript
- **State Management**: React Hooks
- **Deployment**: Vercel-ready

## Project Structure

```
xtock-client/
├── app/
│   ├── page.tsx                    # Home (Reports page)
│   ├── layout.tsx                  # Root layout with Clerk provider
│   ├── globals.css                 # Global styles and animations
│   ├── welcome/
│   │   └── page.tsx               # Login and onboarding flow
│   ├── locations/
│   │   ├── layout.tsx             # Locations layout with auth
│   │   ├── page.tsx               # Locations list
│   │   └── [id]/
│   │       └── page.tsx           # Location detail with operators
│   └── api/
│       └── credentials/
│           └── route.ts           # API route for POS credentials
├── components/
│   ├── dashboard-layout.tsx       # Shared dashboard layout
│   ├── reports-content.tsx        # Reports table component
│   ├── onboarding.tsx             # Multi-step onboarding wizard
│   └── loading.tsx                # Loading screen component
├── lib/
│   ├── supabase.ts               # Supabase client configuration
│   └── timezones.ts              # Timezone utilities (UTC conversion)
└── supabase/
    └── schema.sql                # Database schema definition
```

## Database Schema

### Tables

#### `organizations`
- `id` (TEXT, PK) - Clerk organization ID
- `name` (TEXT)
- `admin_name` (TEXT)
- `onboarding_completed` (BOOLEAN)
- `created_at` (TIMESTAMPTZ)

#### `locations`
- `id` (UUID, PK)
- `organization_id` (TEXT, FK)
- `name` (TEXT)
- `address` (TEXT)
- `kitchen_close` (TIME) - Stored in UTC
- `created_at` (TIMESTAMPTZ)

#### `collaborators` (operators)
- `id` (UUID, PK)
- `organization_id` (TEXT, FK)
- `location_id` (UUID, FK)
- `contact_type` (TEXT) - 'phone' or 'email'
- `contact_value` (TEXT)
- `country_code` (TEXT) - For phone numbers
- `created_at` (TIMESTAMPTZ)

#### `credentials`
- `id` (UUID, PK)
- `organization_id` (TEXT, FK)
- `credential_type` (TEXT)
- `credential_value` (TEXT) - Encrypted
- `created_at` (TIMESTAMPTZ)

#### `reports`
- `id` (UUID, PK)
- `organization_id` (TEXT, FK)
- `location_id` (UUID, FK)
- `item_name` (TEXT)
- `forecast_quantity` (INTEGER)
- `actual_quantity` (INTEGER)
- `date` (DATE)
- `created_at` (TIMESTAMPTZ)

## Getting Started

### Prerequisites

- Node.js 18+ and pnpm
- Clerk account ([sign up here](https://clerk.com))
- Supabase account ([sign up here](https://supabase.com))

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd xtock-client
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Set up environment variables**

   Copy `.env.example` to `.env.local` and fill in the required values:
   ```bash
   cp .env.example .env.local
   ```

   Required environment variables:
   ```env
   # Clerk Authentication
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
   CLERK_SECRET_KEY=sk_test_...
   NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
   NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up

   # Supabase
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

   # Encryption (for credentials)
   ENCRYPTION_KEY=your-32-character-encryption-key
   ```

4. **Set up Clerk**
   - Create a new application in [Clerk Dashboard](https://dashboard.clerk.com)
   - Enable "Organizations" in Organization Settings
   - Copy your API keys to `.env.local`

5. **Set up Supabase**
   - Create a new project in [Supabase Dashboard](https://app.supabase.com)
   - Run the schema file:
     ```sql
     -- Copy and paste the contents of supabase/schema.sql
     -- in the SQL Editor in your Supabase dashboard
     ```
   - Copy your project URL and keys to `.env.local`

6. **Run the development server**
   ```bash
   pnpm dev
   ```

7. **Open your browser**

   Navigate to [http://localhost:3000](http://localhost:3000)

## Key Features Explained

### Timezone Handling

Xtock implements sophisticated timezone handling:

- **Storage**: All times are stored in UTC in the database
- **Input**: Users enter times in their local timezone
- **Display**: Times are automatically converted to user's local timezone
- **Conversion**: Uses browser's timezone detection via `Intl.DateTimeFormat`

Example flow:
```typescript
// User in New York (UTC-5) enters 10:00 PM
Input: "22:00" (local time)
↓ convertLocalTimeToUTC()
Stored: "03:00:00" (UTC)
↓ convertUTCToLocalTime()
Display (Tokyo user): "12:00" (UTC+9)
```

### Onboarding Flow

4-step onboarding wizard:
1. **Organization Info** - Name and admin details
2. **Locations** - Add restaurant locations with addresses and hours
3. **Operators** - Add team members with email or phone (WhatsApp)
4. **POS Integration** - Connect Toast POS system

Features:
- Step detection (resumes from correct step if incomplete)
- Validation at each step
- Animated stepper with progress indicators
- Mobile-optimized compact stepper

### Reports System

- **Daily View**: See specific day's forecast vs actual
- **Weekly View**: Aggregated data across 7 days
- **Accuracy Calculation**: `(1 - |forecast - actual| / forecast) × 100%`
- **Visual Indicators**:
  - Green bars: ≥80% accuracy
  - Yellow bars: 60-79% accuracy
  - Red bars: <60% accuracy
- **Variance Badges**: Color-coded to show over/under performance

## Development

### Code Style

- Use TypeScript for type safety
- Follow Next.js 16 App Router conventions
- Use async server components where possible
- Client components marked with `'use client'`
- Tailwind CSS for styling

### Useful Commands

```bash
# Development
pnpm dev

# Build
pnpm build

# Start production server
pnpm start

# Lint
pnpm lint

# Type check
pnpm type-check
```

## Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Import project in [Vercel Dashboard](https://vercel.com)
3. Add environment variables
4. Deploy

### Environment Variables for Production

Make sure to set all environment variables in your deployment platform:
- Clerk keys (production keys)
- Supabase keys (production project)
- Encryption key (generate a secure 32-character key)

## Security Considerations

- ✅ All API credentials are encrypted before storage
- ✅ Row Level Security (RLS) enabled on all Supabase tables
- ✅ Authentication required for all protected routes
- ✅ Organization-level data isolation
- ✅ Server-side API routes for sensitive operations
- ✅ Environment variables for secrets

## Roadmap

- [ ] Inventory tracking integration
- [ ] Advanced forecasting with ML
- [ ] Multi-POS support (beyond Toast)
- [ ] Mobile app (React Native)
- [ ] Waste tracking
- [ ] Cost analysis and reporting
- [ ] Recipe management
- [ ] Purchase order automation

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

[Add your license here]

## Support

For support, email [your-email] or open an issue in the repository.

---

Built with ❤️ using Next.js, Clerk, and Supabase
