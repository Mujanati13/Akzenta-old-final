# HeadOffice - How to Launch

## Prerequisites

- **Node.js**: Version 20 or higher
- **npm**: Version 8.0.0 or higher
- **Backend Server**: Must be running on `http://localhost:3000`

## Step 1: Install Dependencies

```bash
cd HeadOffice
npm install
```

## Step 2: Configure Environment

The project uses environment files located in `src/environments/`:
- `environment.ts` - Development environment
- `environment.prod.ts` - Production environment

By default, the API URL is set to `http://localhost:3000/api/v1`. Make sure your backend server is running on this port, or update the `apiUrl` in the environment file.

## Step 3: Start the Development Server

```bash
npm start
```

Or to serve on all network interfaces:

```bash
npm run serve
```

The application will be available at `http://localhost:4200` (default Angular port).

## Step 4: Build for Production

```bash
npm run build
```

The production build will be in the `dist/angular-boilerplate/browser` directory.

## Additional Commands

- **Run tests**: `npm test`
- **Lint code**: `npm run lint`
- **Format code**: `npm run prettier`
- **Watch mode**: `npm run watch`

## Important Notes

- Make sure the **Backend** server is running before starting this application
- The default API endpoint is `http://localhost:3000/api/v1`
- Hot Module Replacement (HMR) is configured for faster development
