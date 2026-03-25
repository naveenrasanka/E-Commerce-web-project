# MySQL Migration Setup Guide

## Database Migration Status
✅ **Complete** - Backend has been migrated from SQLite to MySQL
- server.js now uses mysql2 driver
- All database operations are async/await compatible
- Environment variable configuration supported

## Current Issue
The MySQL root user on your system requires a password. To proceed, you need to:

### Option 1: Use XAMPP Control Panel to Check MySQL Root Password
1. Open XAMPP Control Panel
2. Look for MySQL configuration
3. Check if you have set a password for the root user during installation
4. If you don't remember the password, you can reset it (see Option 2)

### Option 2: Reset MySQL Root Password (XAMPP)
If you forgot the root password:

1. Stop MySQL from XAMPP Control Panel
2. Open Command Prompt/PowerShell
3. Run: `mysqld --skip-grant-tables`
4. In another terminal, run:
   ```
   mysql -u root
   FLUSH PRIVILEGES;
   ALTER USER 'root'@'localhost' IDENTIFIED BY '';
   ```
5. Restart MySQL from XAMPP Control Panel

### Option 3: Create New MySQL User
Instead of using root, create a dedicated database user:

1. Connect to MySQL (as admin): `mysql -u root`
2. Create a new user:
   ```sql
   CREATE USER 'urbaneats'@'localhost' IDENTIFIED BY 'your_password_here';
   GRANT ALL PRIVILEGES ON urbaneats.* TO 'urbaneats'@'localhost';
   FLUSH PRIVILEGES;
   ```
3. Then use these credentials with the backend

## Running the Backend

Once you have confirmed your MySQL credentials, start the backend with:

**Windows PowerShell (avoid execution policy issues):**
```powershell
$env:DB_HOST = "localhost"
$env:DB_USER = "root"
$env:DB_PASSWORD = "your_password_here"
node server.js
```

**Or using Windows Command Prompt:**
```cmd
set DB_HOST=localhost
set DB_USER=root
set DB_PASSWORD=your_password_here
node server.js
```

**Or create a .env file and use dotenv:**
```
npm install dotenv
```
Create `.env`:
```
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password_here
DB_PORT=3306
PORT=3001
```

Then modify server.js line 1 to include:
```javascript
require('dotenv').config();
```

## Verify Connection
Once running, you should see:
```
UrbanEats backend running at http://localhost:3001
MySQL database: urbaneats on localhost
```

## Check Database Was Created
```
mysql -u root -p
SHOW DATABASES;
USE urbaneats;
SHOW TABLES;
SELECT * FROM menu_items;
```

## API Endpoints
- GET `/api/menu` - Get all menu items
- GET `/api/admin/status` - Check admin status
- POST `/api/admin/register` - Create first admin account
- POST `/api/admin/login` - Admin login
- POST `/api/admin/logout` - Admin logout
- POST `/api/admin/menu` - Add menu item (admin only)
- DELETE `/api/admin/menu/:id` - Delete menu item (admin only)

## Frontend Menu Loading
The frontend automatically loads menu from `/api/menu` endpoint at initialization.
If the API is unavailable, it falls back to static content.

## Common Issues

**Error: Access denied for user 'root'@'localhost' (using password: NO)**
- Your root user requires a password
- Set DB_PASSWORD environment variable or reset password (see Option 2)

**Error: connect ECONNREFUSED**
- MySQL service is not running
- Start MySQL from XAMPP Control Panel

**Error: ER_BAD_DB_ERROR or database not found**
- Database wasn't created
- Check that the application had permission to create database
- Manually create: `CREATE DATABASE urbaneats;`
