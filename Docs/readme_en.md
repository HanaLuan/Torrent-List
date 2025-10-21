# Torrent-list

*This readme is translated by Doubao AI*

[English](./readme_en.md) | [Chinese](../README.md)| [Traditional Chinese](./readme_tcn.md)  

Thank you for finding this little project 😊 (hehe)

This is a magnet torrent storage station based on Express.js + PostgreSQL.


## Special Thanks

A special thanks to [yang杨](https://github.com/yang1145) for the careful optimization of the front-end interface of this project! Your contribution has made the interface more beautiful and user-friendly.


## Official Website (new version update is temporarily suspended due to some reasons): [Come back later~](https://wap-ac.ybmq.dpdns.org/)


## Features

### User System
- **User Registration and Login**: Supports new user registration and existing user login
- **Permission Management**:
  - Regular users: Can upload, view, and delete files they uploaded
  - Administrators: Can manage all users' files and user accounts (CRUD operations)
- **Default administrator account**: `admin/Zako114514` (Automatically created in the database when the server starts for the first time)
- **Administrator Panel**: Exclusive management interface providing system overview and user management (CRUD) functions


### File Management
- **File Upload**:
  - Logged-in users can upload `.torrent` files (maximum 50MB)
  - Automatically parses torrent metadata (InfoHash, file list, Trackers, etc.)
- **File Browsing**:
  - Displays file list in reverse order of upload time (including original file name, uploader, upload time)
  - Real-time search function (filter by file name or uploader)
- **File Details**:
  - Shows complete torrent metadata (name, InfoHash, total size, file list, Tracker servers, etc.)
- **File Operations**:
  - Download files: Uses original file name by default (supports Chinese and special characters)
  - Delete files: Regular users can only delete their own files; administrators can delete all files (deletes both database records and local files simultaneously)


### Security and Stability
- **Password Encryption**: Uses bcrypt hashing for password storage, no plaintext saving
- **Session Management**: Cookie-based login authentication (valid for 24 hours)
- **Data Persistence**: Uses PostgreSQL database to store user and file data
- **Input Validation**: Full-link validation of file type, size, and user permissions
- **Permission Control**: Administrator operations require special permission verification; prohibits deleting administrator accounts and role demotion


## Technology Stack

### Backend
- **Core Framework**: Express.js
- **Database**: PostgreSQL (data storage)
- **Database Client**: `pg` (Node.js connection to PostgreSQL)
- **Environment Configuration**: `dotenv` (loads environment variables such as database connection)
- **File Upload**: `multer` (handles file upload logic)
- **Password Encryption**: `bcryptjs` (user password hashing)
- **Torrent Parsing**: `parse-torrent` (parses `.torrent` file metadata)
- **Data Formatting**: `pretty-bytes` (converts file size units, e.g., B→MB)
- **Request Handling**: `body-parser` (parses form/JSON requests), `cookie-parser` (parses Cookies)


### Frontend
- **Responsive Design**: Adapts to desktop and mobile devices
- **Elegant Interface Layout**: Card-style lists, layered display of detail pages, exclusive administrator panel
- **Comfortable Interaction Experience**: Upload progress bar, real-time feedback on operation results, support for Chinese/special character file names, user management forms


## Installation and Operation

### Step 1: Clone the Repository
```bash
git clone https://github.com/HanaLuan/Torrent-List.git
cd Torrent-list
```

### Step 2: Install Dependencies
```bash
npm install
```

### Step 3: Configure Environment Variables (Critical)
Create a `.env` file in the project root directory and fill in PostgreSQL database connection information (example as follows):
```env
# Contents of .env file
DB_USER=postgres        # Database username (usually postgres by default)
DB_HOST=localhost       # Database address (fill in localhost for local development)
DB_NAME=torrent_db      # Database name (must be consistent with the one created later)
DB_PASSWORD=your_database_password  # Password set during PostgreSQL installation
DB_PORT=5432            # Database port (default 5432, keep default if not modified)
```

### Step 4: Create and Initialize the Database
1. Open PostgreSQL or a database management tool (such as Navicat), log in to the database, and create a database:
   - Database name: `torrent_db` (must be consistent with `DB_NAME` in `.env`)
   - Template: `template0` (to avoid collation conflicts)
   - Encoding: `UTF8`

2. Initialize the database (create table structure and default administrator):
   ```bash
   npm run db:init
   ```
   - After success, the terminal will display "Database initialization completed!", and automatically create `users` and `files` tables, as well as the default administrator account.


### Step 5: Start the Server
```bash
npm start
```
- After successful startup, the terminal will display:
  ```
  Server started: http://localhost:3000
  ```
- The server runs by default at `http://localhost:3000`


## Database Structure
The database initialization script (`npm run db:init`) will automatically create the following two core tables:

### 1. `users` Table (User Table)
| Field Name | Type         | Description                         | Constraints                  |
|------------|--------------|-------------------------------------|------------------------------|
| username   | VARCHAR(50)  | Username (login account)            | Primary key (unique), not null |
| password   | VARCHAR(100) | Encrypted password (bcrypt hash)    | Not null                     |
| role       | VARCHAR(20)  | User role (`user`/`admin`)          | Not null, default `user`     |


### 2. `files` Table (File Table)
| Field Name      | Type         | Description                                      | Constraints                                  |
|-----------------|--------------|--------------------------------------------------|----------------------------------------------|
| saved_name      | VARCHAR(255) | File name stored on the server (unique)          | Primary key (unique), not null               |
| original_name   | VARCHAR(255) | Original file name uploaded by the user          | Not null                                     |
| uploader        | VARCHAR(50)  | Username of the uploader                         | Not null, foreign key关联 `users.username` |
| upload_time     | TIMESTAMP(6) | Upload time                                      | Not null                                     |
| torrent_meta    | JSONB        | Torrent metadata (parsed structured information) | Nullable (error message if parsing fails)    |


## Usage Instructions

### 1. First Use
- Log in with the default administrator account: `admin` / password `Zako114514` (it is recommended to change the password immediately after logging in)
- Regular users can create accounts through the "Register" function (default role is `user`)


### 2. Core Operation Process
1. **Login/Register**: Go to the homepage and click "Login" or "Register" in the upper right corner.
2. **Upload Files**: After logging in, select a `.torrent` file and click "Upload" (supports file names with Chinese and special characters).
3. **Browse Files**: The homepage displays all files; you can filter files through the search box.
4. **View Details**: Click the file name to enter the detail page and view torrent metadata.
5. **Download/Delete**: On the detail page or homepage, click "Download" (to get the original file name) or "Delete" (requires corresponding permissions).


### 3. Administrator Operations
1. **Enter Administrator Panel**: After logging in with an administrator account, the homepage navigation bar will display the entry to "Administrator Panel".
2. **System Overview**: View statistics on total users, total files, and total file size.
3. **User Management**:
   - View all user lists, support searching by username/role
   - Add users: Specify username, password, and role (`user`/`admin`)
   - Modify user roles: Edit roles in the user list (prohibits demoting administrators to regular users)
   - Reset user passwords: Set new passwords directly (no need to know the old password)
   - Delete users: Will simultaneously delete all files uploaded by the user


## Notes

1. **Database Backup**:
   - Regularly back up the `torrent_db` database using PostgreSQL tools or Navicat to avoid data loss.
   - Example backup command (terminal): `pg_dump -U postgres torrent_db > backup.sql`

2. **File Storage**:
   - Uploaded `.torrent` files are actually saved in the `uploads` folder in the project root directory; corresponding files in this directory will be automatically deleted when files are deleted.
   - If files in `uploads` are deleted manually, the file list will automatically filter out records that no longer exist locally when the server restarts.

3. **Security Optimization (Production Environment)**:
   - Change the default administrator password: Modify the password through the administrator interface after login, or directly update the `password` field in the `users` table in the database (requires bcrypt encryption).
   - Enable HTTPS: Configure through Nginx or use Express plugins (such as `helmet`) to enable HTTPS.
   - Limit upload frequency: Add interface rate limiting (such as `express-rate-limit`) to prevent malicious uploads.

4. **Compatibility**:
   - Download file names support Chinese, spaces, `[`/`]` and other special characters, no additional processing required.


## Future Plans
To be determined......


## License

This project is open-source under the **MIT LICENSE**.
