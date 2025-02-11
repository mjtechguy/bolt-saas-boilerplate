# Enterprise SaaS Starter

A full-featured SaaS starter template built with React, TypeScript, Tailwind CSS, and Supabase. This project provides a solid foundation for building enterprise-grade SaaS applications with features like multi-tenancy, role-based access control, and customizable authentication.

## Features

### Authentication & Authorization
- Email/password authentication
- Organization-specific social login providers
- OpenID Connect (OIDC) integration
- Two-factor authentication (2FA)
- Role-based access control (RBAC)
- Fine-grained permissions system

### Multi-tenancy
- Organization management
- Team management within organizations
- Hierarchical permissions structure
- Organization-specific settings and branding

### User Management
- User profiles with avatars
- Global admin dashboard
- User invitation system
- Activity monitoring
- Last login tracking

### Link Management
- Global, organization, and team-specific links
- Custom link categories
- Link sharing and access control
- Logo and metadata support

### Customization
- Theme customization (light/dark mode)
- Organization-specific branding
- Custom navigation links
- Social media integration
- Logo management for light/dark themes

### Developer Features
- TypeScript support
- Docker configuration for development and production
- Environment variable management
- Database migrations
- Row Level Security (RLS)
- Comprehensive type definitions

## Tech Stack

- **Frontend:**
  - React 18
  - TypeScript
  - Tailwind CSS
  - Lucide Icons
  - Vite

- **Backend:**
  - Supabase (PostgreSQL)
  - Row Level Security
  - Real-time subscriptions
  - Storage for avatars and logos

- **Authentication:**
  - Supabase Auth
  - OAuth 2.0
  - OpenID Connect
  - Two-factor authentication

## Prerequisites

- Node.js 18+ and npm
- Docker and Docker Compose (optional)
- Supabase account
- Git

## Getting Started

### Environment Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/enterprise-saas-starter.git
   cd enterprise-saas-starter
   ```

2. Create a `.env` file in the root directory:
   ```env
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   VITE_DEFAULT_ADMIN_EMAIL=admin@example.com
   VITE_DEFAULT_ADMIN_PASSWORD=your_admin_password
   ```

### Local Development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

### Docker Development

1. Build and start the containers:
   ```bash
   docker-compose up
   ```

### Production Deployment

1. Build and start the production containers:
   ```bash
   docker-compose -f docker-compose.prod.yml up
   ```

## Database Setup

The project uses Supabase migrations for database management. Migrations are located in the \`supabase/migrations\` directory.

### Key Tables

- \`profiles\`: User profiles and settings
- \`organizations\`: Organization management
- \`teams\`: Team management
- \`links\`: Link management system
- \`organization_auth_settings\`: Organization-specific auth providers
- \`site_settings\`: Global site configuration
- \`topbar_links\`: Navigation and social media links

### Running Migrations

Migrations are automatically applied when connecting to Supabase.

## Project Structure

```
├── src/
│   ├── components/      # Reusable React components
│   ├── hooks/          # Custom React hooks
│   ├── lib/            # Utilities and type definitions
│   ├── pages/          # Page components
│   └── main.tsx        # Application entry point
├── supabase/
│   └── migrations/     # Database migrations
├── public/             # Static assets
└── docker/            # Docker configuration
```

## Key Components

### Authentication
- \`AuthForm\`: Handles user login and registration
- \`ProtectedRoute\`: Route protection based on authentication and roles

### Organization Management
- \`Organizations\`: Organization CRUD operations
- \`Teams\`: Team management within organizations
- \`OrganizationAuthSettings\`: Auth provider configuration

### User Interface
- \`Layout\`: Main application layout
- \`Sidebar\`: Navigation sidebar
- \`TopBar\`: Top navigation bar
- \`PublicTopBar\`: Public landing page navigation

### Dashboard
- \`AdminDashboard\`: Global admin dashboard
- \`Dashboard\`: User dashboard
- \`Profile\`: User profile management

## Security

### Row Level Security (RLS)
- Organization-level data isolation
- Team-level access control
- User-specific data protection

### Authentication Security
- Password hashing
- Two-factor authentication
- Session management
- Social login security

# Project Setup

## Supabase CLI Setup

### 1. Install Supabase CLI
- To install Supabase CLI, use one of the following methods:

#### Using npm:
- npm install -g supabase
- supabase login
- STRIPE_SECRET_KEY=sk_live_********


## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support, please open an issue in the GitHub repository or contact the maintainers.