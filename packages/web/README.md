# Echo AI Web Interface

A comprehensive web dashboard for managing Echo AI sessions, models, analytics, and settings.

## Features

- **Dashboard**: Overview of models, sessions, and recent activity
- **Model Explorer**: Discover and test 651+ AI models from 43+ providers
- **Session Manager**: View, manage, export, and share AI conversation sessions
- **Analytics**: Track usage patterns, costs, and performance metrics
- **Security Center**: Manage permissions and security policies
- **Settings**: Configure preferences, API keys, and system options

## Architecture

- **Frontend**: Astro + SolidJS for reactive components
- **Backend**: Express.js API server for data management
- **Styling**: CSS Modules with dark theme design
- **Data**: SQLite integration with Echo AI CLI

## Getting Started

### Prerequisites

- Node.js 18+ 
- Echo AI CLI installed and configured

### Installation

1. **Install web dependencies:**
   ```bash
   cd web
   npm install
   ```

2. **Install API dependencies:**
   ```bash
   cd web/api
   npm install
   ```

### Development

1. **Start the API server:**
   ```bash
   cd web/api
   npm run dev
   ```
   
   The API server runs on http://localhost:3001

2. **Start the web development server:**
   ```bash
   cd web
   npm run dev
   ```
   
   The web interface runs on http://localhost:4321

### Production

1. **Build the web interface:**
   ```bash
   cd web
   npm run build
   ```

2. **Start production servers:**
   ```bash
   cd web/api
   npm start
   ```

## API Endpoints

### Dashboard
- `GET /api/dashboard/stats` - Get dashboard overview statistics

### Models  
- `GET /api/models` - List all models with optional filtering
- `GET /api/models/:id` - Get specific model details
- `POST /api/models/:id/test` - Test a model with a prompt

### Sessions
- `GET /api/sessions` - List sessions with optional filtering
- `GET /api/sessions/:id` - Get specific session details
- `DELETE /api/sessions/:id` - Delete a session
- `POST /api/sessions/:id/share` - Share a session

### Analytics
- `GET /api/analytics` - Get usage analytics by period
- `GET /api/analytics/models` - Get per-model usage statistics

### Security
- `GET /api/security/profiles` - List security profiles
- `GET /api/security/audit-logs` - Get security audit logs

### Settings
- `GET /api/settings` - Get current settings
- `PUT /api/settings` - Update settings

## Web Pages

- `/dashboard` - Main dashboard with overview stats
- `/models` - Model discovery and testing interface
- `/sessions` - Session management and history
- `/analytics` - Usage analytics and insights
- `/security` - Security settings and audit logs
- `/settings` - Configuration and preferences

## Integration with Echo AI CLI

The web interface integrates with your Echo AI CLI installation:

1. **Models**: Fetches from your configured Models.dev registry
2. **Sessions**: Reads from your SQLite session store
3. **Analytics**: Pulls from your usage tracking data
4. **Security**: Reflects your permission settings
5. **Settings**: Syncs with CLI configuration

## 🧞 Commands

All commands are run from the root of the project, from a terminal:

| Command                   | Action                                           |
| :------------------------ | :----------------------------------------------- |
| `npm install`             | Installs dependencies                            |
| `npm run dev`             | Starts local dev server at `localhost:4321`      |
| `npm run build`           | Build your production site to `./dist/`          |
| `npm run preview`         | Preview your build locally, before deploying     |
| `npm run astro ...`       | Run CLI commands like `astro add`, `astro check` |
| `npm run astro -- --help` | Get help using the Astro CLI                     |

## Customization

### Themes
The interface supports dark/light themes. Modify CSS custom properties in the component stylesheets.

### API Integration
To connect with real CLI data instead of mock data, update the API server to import and use your CLI modules:

```javascript
import { ModelsRegistry } from '../../src/models/registry.js';
import { SessionStore } from '../../src/storage/session-store.js';
import { AnalyticsTracker } from '../../src/analytics/tracker.js';
```

### Security
All API keys and sensitive data are handled securely:
- Keys encrypted at rest
- No logging of sensitive information
- CORS configured for local development

## Contributing

1. Follow existing code patterns and styling
2. Test all API endpoints thoroughly
3. Ensure responsive design works on mobile
4. Update documentation for new features

## License

Same license as Echo AI CLI.
